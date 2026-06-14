//! Query execution, table browsing, and row mutations.
//!
//! Reads use the typed `Row` path (prepared statements expose column types even with zero rows).
//! Writes and filter/sort fragments render JSON values as safely-escaped SQL literals — PostgreSQL
//! coerces an UNKNOWN-typed literal to the target column type, which lets the generic grid edit any
//! column without knowing its type up front. Identifiers are always double-quoted and escaped.

use std::time::Instant;

use serde_json::Value;
use tokio_postgres::Client;

use super::convert::row_to_json;
use crate::error::{AppError, AppResult};
use crate::models::*;

// ───────────────────────────── SQL editor ─────────────────────────────

pub async fn execute(client: &Client, sql: &str, max_rows: usize) -> AppResult<QueryExecution> {
    let started = Instant::now();
    let mut statements = Vec::new();

    for stmt_sql in split_statements(sql) {
        match run_one(client, &stmt_sql, max_rows).await {
            Ok(result) => statements.push(StatementResult {
                sql: stmt_sql,
                result: Some(result),
                error: None,
            }),
            Err(err) => {
                statements.push(StatementResult {
                    sql: stmt_sql,
                    result: None,
                    error: Some(err.serialized()),
                });
                break; // stop the batch on the first error, like psql
            }
        }
    }

    Ok(QueryExecution {
        statements,
        total_ms: started.elapsed().as_secs_f64() * 1000.0,
    })
}

async fn run_one(client: &Client, sql: &str, max_rows: usize) -> AppResult<QueryResult> {
    let started = Instant::now();
    let stmt = client.prepare(sql).await?;

    if stmt.columns().is_empty() {
        // DDL / writes without RETURNING.
        let affected = client.execute(&stmt, &[]).await?;
        return Ok(QueryResult {
            fields: vec![],
            rows: vec![],
            rows_affected: Some(affected as i64),
            execution_ms: started.elapsed().as_secs_f64() * 1000.0,
            command_tag: command_tag(sql, affected),
            truncated: false,
        });
    }

    let rows = client.query(&stmt, &[]).await?;
    let fields = field_info(&stmt);
    let truncated = rows.len() > max_rows;
    let json_rows: Vec<Vec<Value>> = rows.iter().take(max_rows).map(row_to_json).collect();
    let returned = json_rows.len();

    Ok(QueryResult {
        fields,
        rows: json_rows,
        rows_affected: None,
        execution_ms: started.elapsed().as_secs_f64() * 1000.0,
        command_tag: format!("SELECT {returned}"),
        truncated,
    })
}

/// Estimated rows affected, from the planner — drives Production Safety confirmations.
pub async fn estimate_impact(client: &Client, sql: &str) -> AppResult<Option<i64>> {
    let explain = format!("EXPLAIN (FORMAT JSON) {sql}");
    let row = client.query_one(&explain, &[]).await?;
    let plan: Value = row.get(0);
    let rows = plan
        .get(0)
        .and_then(|p| p.get("Plan"))
        .and_then(|p| p.get("Plan Rows"))
        .and_then(Value::as_i64);
    Ok(rows)
}

pub async fn explain(client: &Client, sql: &str, analyze: bool) -> AppResult<(Value, String)> {
    let json_sql = format!(
        "EXPLAIN (FORMAT JSON{}) {sql}",
        if analyze { ", ANALYZE" } else { "" }
    );
    let plan: Value = client.query_one(&json_sql, &[]).await?.get(0);

    let text_sql = format!("EXPLAIN {sql}");
    let text = client
        .query(&text_sql, &[])
        .await?
        .iter()
        .map(|r| r.get::<_, String>(0))
        .collect::<Vec<_>>()
        .join("\n");

    Ok((plan, text))
}

// ───────────────────────────── Table browser ─────────────────────────────

pub async fn table_page(client: &Client, req: &TablePageRequest) -> AppResult<TablePage> {
    let started = Instant::now();
    let rel = qualify(&req.schema, &req.table);

    let mut conditions: Vec<String> = Vec::new();
    for f in &req.filters {
        conditions.push(filter_clause(f)?);
    }
    if let Some(search) = req.search.as_deref().filter(|s| !s.is_empty()) {
        conditions.push(search_clause(client, req, search).await?);
    }
    let where_sql = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let order_sql = build_order(&req.sort);
    let limit = req.limit.clamp(1, 100_000);
    let offset = req.offset.max(0);

    let sql = format!("SELECT * FROM {rel} {where_sql} {order_sql} LIMIT {limit} OFFSET {offset}");
    let stmt = client.prepare(&sql).await?;
    let rows = client.query(&stmt, &[]).await?;
    let fields = field_info(&stmt);
    let json_rows = rows.iter().map(row_to_json).collect();

    let estimated_total: i64 = client
        .query_one(
            "SELECT GREATEST(reltuples::int8, 0) FROM pg_class WHERE oid = $1::regclass",
            &[&rel],
        )
        .await
        .ok()
        .map(|r| r.get(0))
        .unwrap_or(0);

    Ok(TablePage {
        fields,
        rows: json_rows,
        estimated_total,
        execution_ms: started.elapsed().as_secs_f64() * 1000.0,
    })
}

pub async fn update_row(
    client: &Client,
    schema: &str,
    table: &str,
    pk: &serde_json::Map<String, Value>,
    changes: &serde_json::Map<String, Value>,
) -> AppResult<()> {
    if changes.is_empty() {
        return Ok(());
    }
    let set = changes
        .iter()
        .map(|(c, v)| format!("{} = {}", quote_ident(c), literal(v)))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "UPDATE {} SET {set} WHERE {}",
        qualify(schema, table),
        pk_predicate(pk)
    );
    client.execute(&sql, &[]).await?;
    Ok(())
}

pub async fn insert_row(
    client: &Client,
    schema: &str,
    table: &str,
    values: &serde_json::Map<String, Value>,
) -> AppResult<()> {
    if values.is_empty() {
        return Err(AppError::Other("cannot insert an empty row".into()));
    }
    let cols = values
        .keys()
        .map(|c| quote_ident(c))
        .collect::<Vec<_>>()
        .join(", ");
    let vals = values.values().map(literal).collect::<Vec<_>>().join(", ");
    let sql = format!(
        "INSERT INTO {} ({cols}) VALUES ({vals})",
        qualify(schema, table)
    );
    client.execute(&sql, &[]).await?;
    Ok(())
}

pub async fn delete_row(
    client: &Client,
    schema: &str,
    table: &str,
    pk: &serde_json::Map<String, Value>,
) -> AppResult<()> {
    if pk.is_empty() {
        return Err(AppError::Other(
            "cannot delete without a primary key".into(),
        ));
    }
    let sql = format!(
        "DELETE FROM {} WHERE {}",
        qualify(schema, table),
        pk_predicate(pk)
    );
    client.execute(&sql, &[]).await?;
    Ok(())
}

// ───────────────────────────── helpers ─────────────────────────────

fn field_info(stmt: &tokio_postgres::Statement) -> Vec<FieldInfo> {
    stmt.columns()
        .iter()
        .map(|c| FieldInfo {
            name: c.name().to_string(),
            data_type_id: c.type_().oid(),
            data_type_name: c.type_().name().to_string(),
        })
        .collect()
}

fn build_order(sort: &[SortSpec]) -> String {
    if sort.is_empty() {
        return String::new();
    }
    let parts = sort
        .iter()
        .map(|s| {
            let dir = if s.direction.eq_ignore_ascii_case("desc") {
                "DESC"
            } else {
                "ASC"
            };
            format!("{} {dir}", quote_ident(&s.column))
        })
        .collect::<Vec<_>>()
        .join(", ");
    format!("ORDER BY {parts}")
}

fn filter_clause(f: &FilterSpec) -> AppResult<String> {
    let col = quote_ident(&f.column);
    let clause = match f.operator.as_str() {
        "eq" => format!("{col} = {}", literal(&f.value)),
        "neq" => format!("{col} <> {}", literal(&f.value)),
        "gt" => format!("{col} > {}", literal(&f.value)),
        "gte" => format!("{col} >= {}", literal(&f.value)),
        "lt" => format!("{col} < {}", literal(&f.value)),
        "lte" => format!("{col} <= {}", literal(&f.value)),
        "like" => format!("{col}::text LIKE {}", literal(&f.value)),
        "ilike" => format!("{col}::text ILIKE {}", literal(&f.value)),
        "is_null" => format!("{col} IS NULL"),
        "is_not_null" => format!("{col} IS NOT NULL"),
        other => {
            return Err(AppError::Other(format!(
                "unsupported filter operator: {other}"
            )))
        }
    };
    Ok(clause)
}

/// Free-text search across all text-castable columns of the table.
async fn search_clause(client: &Client, req: &TablePageRequest, term: &str) -> AppResult<String> {
    let cols = client
        .query(
            "SELECT a.attname FROM pg_attribute a
             WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped",
            &[&qualify(&req.schema, &req.table)],
        )
        .await?;
    if cols.is_empty() {
        return Ok("TRUE".into());
    }
    let pattern = literal(&Value::String(format!("%{term}%")));
    let ors = cols
        .iter()
        .map(|r| {
            format!(
                "{}::text ILIKE {pattern}",
                quote_ident(&r.get::<_, String>(0))
            )
        })
        .collect::<Vec<_>>()
        .join(" OR ");
    Ok(format!("({ors})"))
}

fn pk_predicate(pk: &serde_json::Map<String, Value>) -> String {
    pk.iter()
        .map(|(c, v)| {
            if v.is_null() {
                format!("{} IS NULL", quote_ident(c))
            } else {
                format!("{} = {}", quote_ident(c), literal(v))
            }
        })
        .collect::<Vec<_>>()
        .join(" AND ")
}

/// Render a JSON value as a safe SQL literal.
fn literal(v: &Value) -> String {
    match v {
        Value::Null => "NULL".to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::String(s) => format!("'{}'", s.replace('\'', "''")),
        // Arrays/objects are stored as JSON text.
        other => format!("'{}'", other.to_string().replace('\'', "''")),
    }
}

fn quote_ident(name: &str) -> String {
    format!("\"{}\"", name.replace('"', "\"\""))
}

fn qualify(schema: &str, table: &str) -> String {
    format!("{}.{}", quote_ident(schema), quote_ident(table))
}

fn command_tag(sql: &str, affected: u64) -> String {
    let verb = sql.split_whitespace().next().unwrap_or("").to_uppercase();
    match verb.as_str() {
        "INSERT" => format!("INSERT 0 {affected}"),
        "UPDATE" | "DELETE" => format!("{verb} {affected}"),
        _ => verb,
    }
}

/// Split a SQL script into statements, respecting quotes, dollar-quotes, and comments.
/// Mirrors `splitStatements` in `@swyftgrid/core`.
fn split_statements(sql: &str) -> Vec<String> {
    let bytes = sql.as_bytes();
    let mut out = Vec::new();
    let mut start = 0usize;
    let mut i = 0usize;
    let n = bytes.len();

    while i < n {
        let c = bytes[i];
        let next = if i + 1 < n { bytes[i + 1] } else { 0 };

        // line comment
        if c == b'-' && next == b'-' {
            while i < n && bytes[i] != b'\n' {
                i += 1;
            }
            continue;
        }
        // block comment
        if c == b'/' && next == b'*' {
            i += 2;
            while i + 1 < n && !(bytes[i] == b'*' && bytes[i + 1] == b'/') {
                i += 1;
            }
            i += 2;
            continue;
        }
        // quoted string
        if c == b'\'' || c == b'"' {
            let quote = c;
            i += 1;
            while i < n {
                if bytes[i] == quote && i + 1 < n && bytes[i + 1] == quote {
                    i += 2;
                    continue;
                }
                if bytes[i] == quote {
                    break;
                }
                i += 1;
            }
            i += 1;
            continue;
        }
        // dollar-quoted string
        if c == b'$' {
            if let Some(tag_len) = dollar_tag_len(&bytes[i..]) {
                let tag = &bytes[i..i + tag_len];
                i += tag_len;
                while i + tag_len <= n && &bytes[i..i + tag_len] != tag {
                    i += 1;
                }
                i += tag_len;
                continue;
            }
        }
        // statement terminator
        if c == b';' {
            let piece = sql[start..i].trim();
            if !piece.is_empty() {
                out.push(piece.to_string());
            }
            i += 1;
            start = i;
            continue;
        }
        i += 1;
    }

    let tail = sql[start..].trim();
    if !tail.is_empty() {
        out.push(tail.to_string());
    }
    out
}

/// If `bytes` starts with a dollar-quote tag (`$$` or `$tag$`), return its byte length.
fn dollar_tag_len(bytes: &[u8]) -> Option<usize> {
    if bytes.first() != Some(&b'$') {
        return None;
    }
    let mut j = 1;
    while j < bytes.len() && (bytes[j].is_ascii_alphanumeric() || bytes[j] == b'_') {
        j += 1;
    }
    if j < bytes.len() && bytes[j] == b'$' {
        Some(j + 1)
    } else {
        None
    }
}
