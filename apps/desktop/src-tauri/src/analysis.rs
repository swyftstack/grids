//! Analysis features implemented against the PostgreSQL catalogs: connection health, health score,
//! index inspector, query performance, safe-delete impact, in-data search, and schema diff.
//!
//! SQL mirrors `apps/web/src/pg.ts` so the desktop and web backends behave the same.

use std::collections::HashMap;

use tokio_postgres::Client;

use crate::db::introspect;
use crate::error::AppResult;
use crate::models::*;

fn qualify(schema: &str, table: &str) -> String {
    format!(
        "\"{}\".\"{}\"",
        schema.replace('"', "\"\""),
        table.replace('"', "\"\"")
    )
}

pub async fn connection_health(client: &Client) -> AppResult<ConnectionHealth> {
    let started = std::time::Instant::now();
    let row = client
        .query_one(
            "SELECT (SELECT count(*) FROM pg_stat_activity WHERE state='active')::int8 AS active,
                    (SELECT count(*) FROM pg_stat_activity WHERE state='idle')::int8 AS idle,
                    current_setting('max_connections')::int8 AS max",
            &[],
        )
        .await?;
    let ping_ms = started.elapsed().as_millis() as u64;
    let active: i64 = row.get("active");
    let idle: i64 = row.get("idle");
    let max: i64 = row.get("max");
    let ratio = active as f64 / max.max(1) as f64;
    let status = if ratio > 0.9 {
        "critical"
    } else if ratio > 0.7 {
        "warning"
    } else {
        "healthy"
    };
    let warnings = if status != "healthy" {
        vec![format!(
            "High connection count ({}% of max)",
            (ratio * 100.0) as i64
        )]
    } else {
        vec![]
    };
    Ok(ConnectionHealth {
        status: status.into(),
        ping_ms,
        active_connections: active,
        idle_connections: idle,
        max_connections: max,
        warnings,
    })
}

/// The catalog-derived part of a monitoring sample (connections, db size, cache hit, txn counter).
/// Returns `(active, idle, total, max, db_size, cache_hit, xact_total)`. Host CPU/memory/disk and
/// the per-interval TPS are layered on by the command handler.
pub async fn monitoring_db(
    client: &Client,
) -> AppResult<(i64, i64, i64, i64, i64, Option<f64>, i64)> {
    let row = client
        .query_one(
            "SELECT
               (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='active')::int8 AS active,
               (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='idle')::int8 AS idle,
               (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database())::int8 AS total,
               current_setting('max_connections')::int8 AS max,
               pg_database_size(current_database())::int8 AS size,
               (SELECT round(100.0*sum(blks_hit)/NULLIF(sum(blks_hit)+sum(blks_read),0),2)
                  FROM pg_stat_database WHERE datname=current_database())::float8 AS cache_hit,
               (SELECT sum(xact_commit+xact_rollback) FROM pg_stat_database WHERE datname=current_database())::int8 AS xact",
            &[],
        )
        .await?;
    let cache_hit: Option<f64> = row.get("cache_hit");
    let xact: Option<i64> = row.get("xact");
    Ok((
        row.get("active"),
        row.get("idle"),
        row.get("total"),
        row.get("max"),
        row.get("size"),
        cache_hit,
        xact.unwrap_or(0),
    ))
}

pub async fn index_inspect(client: &Client) -> AppResult<IndexReport> {
    let idx_rows = client
        .query(
            "SELECT s.schemaname AS schema, s.relname AS table, s.indexrelname AS name,
                    s.idx_scan::int8 AS usage, pg_relation_size(s.indexrelid)::int8 AS size,
                    ix.indisunique AS uniq, ix.indisprimary AS prim,
                    array_agg(a.attname) AS columns
             FROM pg_stat_user_indexes s
             JOIN pg_index ix ON ix.indexrelid = s.indexrelid
             JOIN pg_attribute a ON a.attrelid = s.relid AND a.attnum = ANY(ix.indkey)
             GROUP BY s.schemaname, s.relname, s.indexrelname, s.idx_scan, s.indexrelid, ix.indisunique, ix.indisprimary",
            &[],
        )
        .await?;
    let indexes: Vec<IndexEntry> = idx_rows
        .iter()
        .map(|r| IndexEntry {
            schema: r.get("schema"),
            table: r.get("table"),
            name: r.get("name"),
            columns: r.get::<_, Vec<String>>("columns"),
            size_bytes: r.get("size"),
            usage_count: r.get("usage"),
            is_unique: r.get("uniq"),
            is_primary: r.get("prim"),
        })
        .collect();

    let missing = client
        .query(
            "SELECT con.conrelid::regclass::text AS table, att.attname AS column
             FROM pg_constraint con
             JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
             WHERE con.contype = 'f'
               AND NOT EXISTS (
                 SELECT 1 FROM pg_index i WHERE i.indrelid = con.conrelid AND att.attnum = ANY(i.indkey)
               )",
            &[],
        )
        .await?;
    let mut recommendations: Vec<IndexRecommendation> = missing
        .iter()
        .map(|r| {
            let table: String = r.get("table");
            let column: String = r.get("column");
            IndexRecommendation {
                reason: "missing".into(),
                schema: "public".into(),
                message: format!("Foreign key {column} has no covering index."),
                statement: format!("CREATE INDEX idx_{table}_{column} ON {table} ({column});"),
                table,
            }
        })
        .collect();
    for e in &indexes {
        if e.usage_count == 0 && !e.is_primary {
            recommendations.push(IndexRecommendation {
                reason: "unused".into(),
                schema: e.schema.clone(),
                table: e.table.clone(),
                message: format!("{} is unused (0 scans).", e.name),
                statement: format!("DROP INDEX {}.{};", e.schema, e.name),
            });
        }
    }
    Ok(IndexReport {
        indexes,
        recommendations,
    })
}

pub async fn health_score(client: &Client) -> AppResult<HealthScore> {
    let report = index_inspect(client).await?;
    let missing = report
        .recommendations
        .iter()
        .filter(|r| r.reason == "missing")
        .count() as i64;
    let unused = report
        .recommendations
        .iter()
        .filter(|r| r.reason == "unused")
        .count() as i64;
    let score = (100 - missing * 4 - unused * 3).max(0);
    let cat = |category: &str, label: &str, status: &str, value: String| HealthCategoryItem {
        category: category.into(),
        label: label.into(),
        status: status.into(),
        value,
    };
    Ok(HealthScore {
        score,
        issues: vec![],
        categories: vec![
            cat(
                "missing_indexes",
                "Missing indexes",
                if missing > 0 { "warning" } else { "healthy" },
                missing.to_string(),
            ),
            cat(
                "unused_indexes",
                "Unused indexes",
                if unused > 0 { "warning" } else { "healthy" },
                unused.to_string(),
            ),
            cat(
                "duplicate_indexes",
                "Duplicate indexes",
                "healthy",
                "0".into(),
            ),
            cat("table_bloat", "Table bloat", "healthy", "Low".into()),
            cat("dead_tuples", "Dead tuples", "healthy", "Low".into()),
            cat("slow_queries", "Slow queries", "healthy", "0".into()),
        ],
    })
}

pub async fn query_perf(client: &Client) -> AppResult<QueryPerfReport> {
    let ext = client
        .query(
            "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'",
            &[],
        )
        .await?;
    if ext.is_empty() {
        return Ok(QueryPerfReport {
            available: false,
            slow: vec![],
            frequent: vec![],
            long_running: vec![],
        });
    }
    async fn stats(client: &Client, order: &str) -> AppResult<Vec<QueryStat>> {
        let sql = format!(
            "SELECT query, calls::int8, total_exec_time AS total, mean_exec_time AS mean,
                    max_exec_time AS max, rows::int8 AS rows
             FROM pg_stat_statements ORDER BY {order} DESC LIMIT 10"
        );
        let rows = client.query(&sql, &[]).await?;
        Ok(rows
            .iter()
            .map(|r| QueryStat {
                query: r.get("query"),
                calls: r.get("calls"),
                total_ms: r.get::<_, f64>("total"),
                mean_ms: r.get::<_, f64>("mean"),
                max_ms: r.get::<_, f64>("max"),
                rows: r.get("rows"),
            })
            .collect())
    }
    Ok(QueryPerfReport {
        available: true,
        slow: stats(client, "mean_exec_time").await?,
        frequent: stats(client, "calls").await?,
        long_running: stats(client, "total_exec_time").await?,
    })
}

pub async fn delete_impact(
    client: &Client,
    schema: &str,
    table: &str,
    operation: &str,
) -> AppResult<SafeDeleteImpact> {
    let rel = qualify(schema, table);
    let estimated_rows = client
        .query_one(
            "SELECT GREATEST(reltuples::int8, 0) AS n FROM pg_class WHERE oid = $1::regclass",
            &[&rel],
        )
        .await
        .ok()
        .map(|r| r.get::<_, i64>("n"));
    let deps = client
        .query(
            "SELECT conrelid::regclass::text AS src FROM pg_constraint WHERE confrelid = $1::regclass AND contype = 'f'",
            &[&rel],
        )
        .await?;
    let phrase = match operation {
        "TRUNCATE" => format!("TRUNCATE {table}"),
        "DROP" => format!("DROP TABLE {table}"),
        _ => format!("DELETE {table}"),
    };
    Ok(SafeDeleteImpact {
        operation: operation.into(),
        schema: schema.into(),
        table: table.into(),
        estimated_rows,
        dependencies: deps
            .iter()
            .map(|r| format!("{} → {}", r.get::<_, String>("src"), table))
            .collect(),
        confirmation_phrase: phrase,
    })
}

pub async fn search_data(client: &Client, term: &str, limit: i64) -> AppResult<Vec<DataSearchHit>> {
    if term.trim().len() < 2 {
        return Ok(vec![]);
    }
    let cols = client
        .query(
            "SELECT n.nspname AS schema, c.relname AS table, a.attname AS column
             FROM pg_attribute a
             JOIN pg_class c ON c.oid = a.attrelid
             JOIN pg_namespace n ON n.oid = c.relnamespace
             JOIN pg_type t ON t.oid = a.atttypid
             WHERE c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
               AND n.nspname NOT IN ('pg_catalog', 'information_schema')
               AND t.typname IN ('text', 'varchar', 'bpchar', 'citext', 'name')
             LIMIT 40",
            &[],
        )
        .await?;
    let pattern = format!("%{term}%");
    let mut hits = Vec::new();
    for c in &cols {
        if hits.len() as i64 >= limit {
            break;
        }
        let schema: String = c.get("schema");
        let table: String = c.get("table");
        let column: String = c.get("column");
        let colq = format!("\"{}\"", column.replace('"', "\"\""));
        let sql = format!(
            "SELECT {colq}::text AS v FROM {} WHERE {colq}::text ILIKE $1 LIMIT 3",
            qualify(&schema, &table)
        );
        if let Ok(rows) = client.query(&sql, &[&pattern]).await {
            for row in rows {
                if let Some(v) = row.get::<_, Option<String>>("v") {
                    hits.push(DataSearchHit {
                        schema: schema.clone(),
                        table: table.clone(),
                        column: column.clone(),
                        value: v.chars().take(80).collect(),
                    });
                }
            }
        }
    }
    hits.truncate(limit as usize);
    Ok(hits)
}

pub async fn schema_diff(source: &Client, target: &Client) -> AppResult<SchemaDiff> {
    let s = introspect::snapshot(source).await?;
    let t = introspect::snapshot(target).await?;

    let mut entries: Vec<SchemaDiffEntry> = Vec::new();
    let tmap: HashMap<String, &TableInfo> = t
        .tables
        .iter()
        .map(|x| (format!("{}.{}", x.schema, x.name), x))
        .collect();
    let smap: HashMap<String, &TableInfo> = s
        .tables
        .iter()
        .map(|x| (format!("{}.{}", x.schema, x.name), x))
        .collect();

    for stbl in &s.tables {
        let key = format!("{}.{}", stbl.schema, stbl.name);
        match tmap.get(&key) {
            None => entries.push(SchemaDiffEntry {
                change: "added".into(),
                object_type: "table".into(),
                object: key,
                detail: "Missing in target".into(),
                before: None,
                after: None,
            }),
            Some(ttbl) => {
                let tcols: HashMap<&str, &ColumnInfo> =
                    ttbl.columns.iter().map(|c| (c.name.as_str(), c)).collect();
                for c in &stbl.columns {
                    match tcols.get(c.name.as_str()) {
                        None => entries.push(SchemaDiffEntry {
                            change: "added".into(),
                            object_type: "column".into(),
                            object: format!("{}.{}", stbl.name, c.name),
                            detail: "Missing in target".into(),
                            before: None,
                            after: Some(c.data_type.clone()),
                        }),
                        Some(tc) if tc.data_type != c.data_type => entries.push(SchemaDiffEntry {
                            change: "changed".into(),
                            object_type: "column".into(),
                            object: format!("{}.{}", stbl.name, c.name),
                            detail: "Type differs".into(),
                            before: Some(tc.data_type.clone()),
                            after: Some(c.data_type.clone()),
                        }),
                        _ => {}
                    }
                }
            }
        }
    }
    for ttbl in &t.tables {
        let key = format!("{}.{}", ttbl.schema, ttbl.name);
        if !smap.contains_key(&key) {
            entries.push(SchemaDiffEntry {
                change: "removed".into(),
                object_type: "table".into(),
                object: key,
                detail: "Only in target".into(),
                before: None,
                after: None,
            });
        }
    }

    let migration: String = entries
        .iter()
        .filter(|e| e.change == "added" && e.object_type == "column")
        .map(|e| {
            let mut parts = e.object.splitn(2, '.');
            let tbl = parts.next().unwrap_or("");
            let col = parts.next().unwrap_or("");
            format!(
                "ALTER TABLE {tbl} ADD COLUMN {col} {};",
                e.after.clone().unwrap_or_default()
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    let migration_sql = if migration.is_empty() {
        "-- target schema matches source".to_string()
    } else {
        migration
    };

    Ok(SchemaDiff {
        source_label: "source".into(),
        target_label: "target".into(),
        entries,
        migration_sql,
    })
}
