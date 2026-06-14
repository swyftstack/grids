//! Schema introspection against the PostgreSQL system catalogs.
//!
//! Queries are written against `pg_catalog` (not `information_schema`) for accuracy and speed, and
//! return the camelCase models the UI consumes. The Schema Explorer tree is lazy: each call returns
//! only the children of the requested node, encoded as `kind:schema:name` ids.

use tokio_postgres::Client;

use crate::error::AppResult;
use crate::models::*;

/// Non-system schemas, used everywhere we enumerate schemas.
const USER_SCHEMA_FILTER: &str =
    "nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND nspname NOT LIKE 'pg\\_temp\\_%'";

fn qualify(schema: &str, table: &str) -> String {
    format!(
        "\"{}\".\"{}\"",
        schema.replace('"', "\"\""),
        table.replace('"', "\"\"")
    )
}

/// Return the children of `node_id`, or the schema roots when `node_id` is `None`.
pub async fn schema_tree(client: &Client, node_id: Option<&str>) -> AppResult<Vec<SchemaTreeNode>> {
    match node_id {
        None => roots(client).await,
        Some(id) => {
            let parts: Vec<&str> = id.splitn(3, ':').collect();
            match parts.as_slice() {
                ["schema", schema] => Ok(schema_groups(schema)),
                ["group", rest] => {
                    let (schema, group) = rest.split_once(':').unwrap_or((rest, ""));
                    group_children(client, schema, group).await
                }
                _ => Ok(vec![]),
            }
        }
    }
}

async fn roots(client: &Client) -> AppResult<Vec<SchemaTreeNode>> {
    let sql =
        format!("SELECT nspname FROM pg_namespace WHERE {USER_SCHEMA_FILTER} ORDER BY nspname");
    let rows = client.query(&sql, &[]).await?;
    Ok(rows
        .iter()
        .map(|r| {
            let name: String = r.get(0);
            SchemaTreeNode {
                id: format!("schema:{name}"),
                kind: "schema".into(),
                label: name.clone(),
                group_kind: None,
                schema: Some(name),
                expandable: true,
                children: None,
            }
        })
        .collect())
}

fn schema_groups(schema: &str) -> Vec<SchemaTreeNode> {
    let groups = [
        ("tables", "table", "Tables"),
        ("views", "view", "Views"),
        ("matviews", "materialized_view", "Materialized Views"),
        ("functions", "function", "Functions"),
        ("extensions", "extension", "Extensions"),
    ];
    groups
        .iter()
        .map(|(key, kind, label)| SchemaTreeNode {
            id: format!("group:{schema}:{key}"),
            kind: "group".into(),
            label: (*label).into(),
            group_kind: Some((*kind).into()),
            schema: Some(schema.into()),
            expandable: true,
            children: None,
        })
        .collect()
}

async fn group_children(
    client: &Client,
    schema: &str,
    group: &str,
) -> AppResult<Vec<SchemaTreeNode>> {
    let (relkind, kind): (&str, &str) = match group {
        "tables" => ("r", "table"),
        "views" => ("v", "view"),
        "matviews" => ("m", "materialized_view"),
        "functions" => ("", "function"),
        "extensions" => ("", "extension"),
        _ => ("r", "table"),
    };

    if group == "functions" {
        let sql = "SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
                   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                   WHERE n.nspname = $1 ORDER BY p.proname";
        let rows = client.query(sql, &[&schema]).await?;
        return Ok(rows
            .iter()
            .map(|r| {
                let name: String = r.get(0);
                let args: String = r.get(1);
                SchemaTreeNode {
                    id: format!("function:{schema}:{name}"),
                    kind: "function".into(),
                    label: format!("{name}({args})"),
                    group_kind: None,
                    schema: Some(schema.into()),
                    expandable: false,
                    children: None,
                }
            })
            .collect());
    }

    if group == "extensions" {
        let rows = client
            .query("SELECT extname FROM pg_extension ORDER BY extname", &[])
            .await?;
        return Ok(rows
            .iter()
            .map(|r| {
                let name: String = r.get(0);
                SchemaTreeNode {
                    id: format!("extension:{name}"),
                    kind: "extension".into(),
                    label: name,
                    group_kind: None,
                    schema: Some(schema.into()),
                    expandable: false,
                    children: None,
                }
            })
            .collect());
    }

    let sql = "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = $1 AND c.relkind = $2 ORDER BY c.relname";
    let rows = client.query(sql, &[&schema, &relkind]).await?;
    Ok(rows
        .iter()
        .map(|r| {
            let name: String = r.get(0);
            SchemaTreeNode {
                id: format!("{kind}:{schema}:{name}"),
                kind: kind.into(),
                label: name.clone(),
                group_kind: None,
                schema: Some(schema.into()),
                expandable: false,
                children: None,
            }
        })
        .collect())
}

/// Full detail for a single table or view.
pub async fn table_info(client: &Client, schema: &str, table: &str) -> AppResult<TableInfo> {
    let rel = qualify(schema, table);

    // Base metadata.
    let meta = client
        .query_one(
            "SELECT pg_total_relation_size($1::regclass)::int8 AS size,
                    c.reltuples::int8 AS rows,
                    obj_description($1::regclass) AS comment,
                    c.relkind::text AS relkind
             FROM pg_class c WHERE c.oid = $1::regclass",
            &[&rel],
        )
        .await?;
    let size_bytes: i64 = meta.get("size");
    let estimated_rows: i64 = meta.get::<_, i64>("rows").max(0);
    let comment: Option<String> = meta.get("comment");
    let relkind: String = meta.get("relkind");
    let kind = match relkind.as_str() {
        "v" => "view",
        "m" => "materialized_view",
        _ => "table",
    };

    // Primary-key columns.
    let pk_rows = client
        .query(
            "SELECT a.attname FROM pg_index i
             JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
             WHERE i.indrelid = $1::regclass AND i.indisprimary",
            &[&rel],
        )
        .await?;
    let pk: Vec<String> = pk_rows.iter().map(|r| r.get(0)).collect();

    // Foreign keys keyed by local column.
    let fk_rows = client
        .query(
            "SELECT att.attname AS col, ns.nspname AS fschema, cl.relname AS ftable, fatt.attname AS fcol
             FROM pg_constraint con
             JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
             JOIN pg_class cl ON cl.oid = con.confrelid
             JOIN pg_namespace ns ON ns.oid = cl.relnamespace
             JOIN pg_attribute fatt ON fatt.attrelid = con.confrelid AND fatt.attnum = ANY(con.confkey)
             WHERE con.conrelid = $1::regclass AND con.contype = 'f'",
            &[&rel],
        )
        .await?;

    // Columns.
    let col_rows = client
        .query(
            "SELECT a.attname,
                    format_type(a.atttypid, a.atttypmod) AS data_type,
                    t.typname AS udt_name,
                    NOT a.attnotnull AS nullable,
                    pg_get_expr(d.adbin, d.adrelid) AS default_value,
                    a.attnum::int4 AS position,
                    col_description(a.attrelid, a.attnum) AS comment
             FROM pg_attribute a
             JOIN pg_type t ON t.oid = a.atttypid
             LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
             WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped
             ORDER BY a.attnum",
            &[&rel],
        )
        .await?;

    let columns = col_rows
        .iter()
        .map(|r| {
            let name: String = r.get("attname");
            let references = fk_rows
                .iter()
                .find(|f| f.get::<_, String>("col") == name)
                .map(|f| ForeignKeyTarget {
                    schema: f.get("fschema"),
                    table: f.get("ftable"),
                    column: f.get("fcol"),
                });
            ColumnInfo {
                is_primary_key: pk.contains(&name),
                references,
                data_type: r.get("data_type"),
                udt_name: r.get("udt_name"),
                nullable: r.get("nullable"),
                default_value: r.get("default_value"),
                position: r.get("position"),
                comment: r.get("comment"),
                name,
            }
        })
        .collect();

    // Indexes.
    let idx_rows = client
        .query(
            "SELECT i.relname AS name, ix.indisunique AS uniq, ix.indisprimary AS prim,
                    am.amname AS method, pg_get_indexdef(ix.indexrelid) AS def
             FROM pg_index ix
             JOIN pg_class i ON i.oid = ix.indexrelid
             JOIN pg_am am ON am.oid = i.relam
             WHERE ix.indrelid = $1::regclass",
            &[&rel],
        )
        .await?;
    let indexes = idx_rows
        .iter()
        .map(|r| {
            let def: String = r.get("def");
            IndexInfo {
                columns: parse_index_columns(&def),
                name: r.get("name"),
                is_unique: r.get("uniq"),
                is_primary: r.get("prim"),
                method: r.get("method"),
                definition: def,
            }
        })
        .collect();

    // Constraints.
    let con_rows = client
        .query(
            "SELECT conname, contype::text AS contype, pg_get_constraintdef(oid) AS def
             FROM pg_constraint WHERE conrelid = $1::regclass",
            &[&rel],
        )
        .await?;
    let constraints = con_rows
        .iter()
        .map(|r| {
            let contype: String = r.get("contype");
            ConstraintInfo {
                name: r.get("conname"),
                kind: match contype.as_str() {
                    "p" => "primary_key",
                    "f" => "foreign_key",
                    "u" => "unique",
                    "c" => "check",
                    "x" => "exclusion",
                    _ => "check",
                }
                .into(),
                definition: r.get("def"),
                columns: vec![],
            }
        })
        .collect();

    // Triggers.
    let trg_rows = client
        .query(
            "SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger
             WHERE tgrelid = $1::regclass AND NOT tgisinternal",
            &[&rel],
        )
        .await?;
    let triggers = trg_rows
        .iter()
        .map(|r| {
            let def: String = r.get("def");
            TriggerInfo {
                name: r.get("tgname"),
                timing: parse_trigger_timing(&def),
                events: parse_trigger_events(&def),
                definition: def,
            }
        })
        .collect();

    Ok(TableInfo {
        schema: schema.into(),
        name: table.into(),
        kind: kind.into(),
        estimated_rows,
        size_bytes: Some(size_bytes),
        comment,
        columns,
        indexes,
        constraints,
        triggers,
    })
}

/// Aggregate per-database metrics for the dashboard.
pub async fn dashboard(
    client: &Client,
    server_version: &str,
    last_connected_at: &str,
) -> AppResult<DatabaseDashboard> {
    let row = client
        .query_one(
            "SELECT current_database() AS db,
                    pg_database_size(current_database())::int8 AS size,
                    (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int8 AS conns,
                    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                       WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema'))::int8 AS tables,
                    (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                       WHERE c.relkind IN ('v','m') AND n.nspname NOT IN ('pg_catalog','information_schema'))::int8 AS views,
                    (SELECT count(*) FROM pg_namespace
                       WHERE nspname NOT IN ('pg_catalog','information_schema','pg_toast') AND nspname NOT LIKE 'pg\\_temp\\_%')::int8 AS schemas",
            &[],
        )
        .await?;

    let largest = client
        .query(
            "SELECT n.nspname AS schema, c.relname AS table, pg_total_relation_size(c.oid)::int8 AS size
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')
             ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 5",
            &[],
        )
        .await?;

    Ok(DatabaseDashboard {
        database_name: row.get("db"),
        size_bytes: row.get("size"),
        table_count: row.get("tables"),
        schema_count: row.get("schemas"),
        view_count: row.get("views"),
        active_connections: row.get("conns"),
        server_version: server_version.to_string(),
        last_connected_at: last_connected_at.to_string(),
        largest_tables: largest
            .iter()
            .map(|r| LargeTable {
                schema: r.get("schema"),
                table: r.get("table"),
                size_bytes: r.get("size"),
            })
            .collect(),
    })
}

/// Full denormalised snapshot for the ER diagram and universal search.
///
/// Reuses [`table_info`] per table for correctness; on very large databases this is a number of
/// round-trips proportional to the table count. The frontend caches the result per session.
pub async fn snapshot(client: &Client) -> AppResult<SchemaSnapshot> {
    let schema_rows = client
        .query(
            &format!(
                "SELECT n.nspname AS name, pg_get_userbyid(n.nspowner) AS owner,
                        count(*) FILTER (WHERE c.relkind='r')::int8 AS tables,
                        count(*) FILTER (WHERE c.relkind IN ('v','m'))::int8 AS views
                 FROM pg_namespace n LEFT JOIN pg_class c ON c.relnamespace = n.oid
                 WHERE {USER_SCHEMA_FILTER}
                 GROUP BY n.nspname, n.nspowner ORDER BY n.nspname"
            ),
            &[],
        )
        .await?;
    let schemas = schema_rows
        .iter()
        .map(|r| SchemaInfo {
            name: r.get("name"),
            owner: r.get("owner"),
            table_count: r.get("tables"),
            view_count: r.get("views"),
        })
        .collect();

    let table_rows = client
        .query(
            &format!(
                "SELECT n.nspname AS schema, c.relname AS name
                 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE c.relkind IN ('r','v','m') AND {}
                 ORDER BY n.nspname, c.relname",
                USER_SCHEMA_FILTER.replace("nspname", "n.nspname")
            ),
            &[],
        )
        .await?;

    let mut tables = Vec::with_capacity(table_rows.len());
    for r in &table_rows {
        let schema: String = r.get("schema");
        let name: String = r.get("name");
        if let Ok(info) = table_info(client, &schema, &name).await {
            tables.push(info);
        }
    }

    let func_rows = client
        .query(
            "SELECT n.nspname AS schema, p.proname AS name,
                    pg_get_function_identity_arguments(p.oid) AS args,
                    pg_get_function_result(p.oid) AS ret, l.lanname AS lang, p.prokind::text AS kind
             FROM pg_proc p
             JOIN pg_namespace n ON n.oid = p.pronamespace
             JOIN pg_language l ON l.oid = p.prolang
             WHERE n.nspname NOT IN ('pg_catalog','information_schema')
             ORDER BY n.nspname, p.proname",
            &[],
        )
        .await?;
    let functions = func_rows
        .iter()
        .map(|r| {
            let kind: String = r.get("kind");
            FunctionInfo {
                schema: r.get("schema"),
                name: r.get("name"),
                arguments: r.get("args"),
                return_type: r.get("ret"),
                language: r.get("lang"),
                kind: match kind.as_str() {
                    "p" => "procedure",
                    "a" => "aggregate",
                    "w" => "window",
                    _ => "function",
                }
                .into(),
            }
        })
        .collect();

    let ext_rows = client
        .query(
            "SELECT e.extname AS name, e.extversion AS version, n.nspname AS schema
             FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace ORDER BY e.extname",
            &[],
        )
        .await?;
    let extensions = ext_rows
        .iter()
        .map(|r| ExtensionInfo {
            name: r.get("name"),
            version: r.get("version"),
            schema: r.get("schema"),
        })
        .collect();

    Ok(SchemaSnapshot {
        schemas,
        tables,
        functions,
        extensions,
        captured_at: chrono::Utc::now().to_rfc3339(),
    })
}

fn parse_index_columns(def: &str) -> Vec<String> {
    // pg_get_indexdef => "... USING btree (a, b)". Extract the parenthesised list.
    if let (Some(start), Some(end)) = (def.find('('), def.rfind(')')) {
        if end > start {
            return def[start + 1..end]
                .split(',')
                .map(|s| s.trim().to_string())
                .collect();
        }
    }
    vec![]
}

fn parse_trigger_timing(def: &str) -> String {
    let upper = def.to_uppercase();
    if upper.contains("INSTEAD OF") {
        "INSTEAD OF".into()
    } else if upper.contains(" AFTER ") {
        "AFTER".into()
    } else {
        "BEFORE".into()
    }
}

fn parse_trigger_events(def: &str) -> Vec<String> {
    let upper = def.to_uppercase();
    ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]
        .iter()
        .filter(|e| upper.contains(*e))
        .map(|e| e.to_string())
        .collect()
}
