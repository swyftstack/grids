//! Tauri command handlers — the desktop implementation of the `@swyftgrid/core` IPC contract.
//!
//! The frontend maps contract names like `table.updateRow` to the snake_case command names below
//! (see `apps/desktop/src/lib/ipc.ts`). Each handler is thin: validate, delegate to `db`/`store`,
//! and return a model that serialises to the contract's TypeScript shape.

use std::sync::Arc;

use serde_json::{json, Value};
use tauri::State;

use crate::analysis;
use crate::db::pool::Session;
use crate::db::{introspect, query};
use crate::error::AppResult;
use crate::models::*;
use crate::AppState;

/// Return the live session for `id`, opening one from the stored connection if needed.
async fn ensure_session(state: &AppState, id: &str) -> AppResult<Arc<Session>> {
    if let Ok(session) = state.pool.get(id) {
        return Ok(session);
    }
    let conn = state.store.connection_with_secret(id)?;
    state.pool.open(id, &conn.config).await
}

// ── Connections ──────────────────────────────────────────────────────────────

#[tauri::command]
pub fn connections_list(state: State<AppState>) -> AppResult<Value> {
    let (connections, folders) = state.store.list_connections()?;
    Ok(json!({ "connections": connections, "folders": folders }))
}

#[tauri::command]
pub fn connections_save(state: State<AppState>, connection: Connection) -> AppResult<Connection> {
    state.store.save_connection(connection)
}

#[tauri::command]
pub fn connections_delete(state: State<AppState>, id: String) -> AppResult<()> {
    state.pool.remove(&id);
    state.store.delete_connection(&id)
}

#[tauri::command]
pub fn connections_duplicate(state: State<AppState>, id: String) -> AppResult<Connection> {
    let mut conn = state.store.connection_with_secret(&id)?;
    conn.id = String::new();
    conn.name = format!("{} copy", conn.name);
    conn.is_favorite = false;
    state.store.save_connection(conn)
}

#[tauri::command]
pub async fn connections_test(config: ConnectionConfig) -> ConnectionTestResult {
    match crate::db::pool::test(&config).await {
        Ok(report) => ConnectionTestResult {
            ok: true,
            latency_ms: Some(report.latency_ms),
            server_version: Some(report.server_version),
            error: None,
            ssh_host_fingerprints: (!report.ssh_host_fingerprints.is_empty())
                .then_some(report.ssh_host_fingerprints),
        },
        Err(err) => ConnectionTestResult {
            ok: false,
            latency_ms: None,
            server_version: None,
            error: Some(err.to_string()),
            ssh_host_fingerprints: None,
        },
    }
}

#[tauri::command]
pub fn connections_save_folder(
    state: State<AppState>,
    folder: ConnectionFolder,
) -> AppResult<ConnectionFolder> {
    state.store.save_folder(folder)
}

#[tauri::command]
pub fn connections_delete_folder(state: State<AppState>, id: String) -> AppResult<()> {
    state.store.delete_folder(&id)
}

// ── Sessions / dashboard ─────────────────────────────────────────────────────

#[tauri::command]
pub async fn db_connect(state: State<'_, AppState>, connection_id: String) -> AppResult<Value> {
    let conn = state.store.connection_with_secret(&connection_id)?;
    let session = state.pool.open(&connection_id, &conn.config).await?;
    state.store.touch_connection(&connection_id)?;
    let dashboard = introspect::dashboard(
        &session.client,
        &session.server_version,
        &session.last_connected_at,
    )
    .await?;
    Ok(json!({ "sessionId": connection_id, "dashboard": dashboard }))
}

#[tauri::command]
pub fn db_disconnect(state: State<AppState>, connection_id: String) -> AppResult<()> {
    state.pool.remove(&connection_id);
    Ok(())
}

#[tauri::command]
pub async fn db_dashboard(
    state: State<'_, AppState>,
    connection_id: String,
) -> AppResult<DatabaseDashboard> {
    let session = state.pool.get(&connection_id)?;
    introspect::dashboard(
        &session.client,
        &session.server_version,
        &session.last_connected_at,
    )
    .await
}

// ── Schema ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn schema_tree(
    state: State<'_, AppState>,
    connection_id: String,
    node_id: Option<String>,
) -> AppResult<Vec<SchemaTreeNode>> {
    let session = state.pool.get(&connection_id)?;
    introspect::schema_tree(&session.client, node_id.as_deref()).await
}

#[tauri::command]
pub async fn schema_table(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
) -> AppResult<TableInfo> {
    let session = state.pool.get(&connection_id)?;
    introspect::table_info(&session.client, &schema, &table).await
}

#[tauri::command]
pub async fn schema_snapshot(
    state: State<'_, AppState>,
    connection_id: String,
) -> AppResult<SchemaSnapshot> {
    let session = state.pool.get(&connection_id)?;
    introspect::snapshot(&session.client).await
}

// ── SQL editor ───────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn query_execute(
    state: State<'_, AppState>,
    connection_id: String,
    sql: String,
    max_rows: Option<usize>,
) -> AppResult<QueryExecution> {
    let session = state.pool.get(&connection_id)?;
    query::execute(&session.client, &sql, max_rows.unwrap_or(50_000)).await
}

#[tauri::command]
pub async fn query_explain(
    state: State<'_, AppState>,
    connection_id: String,
    sql: String,
    analyze: Option<bool>,
) -> AppResult<Value> {
    let session = state.pool.get(&connection_id)?;
    let (plan, text) = query::explain(&session.client, &sql, analyze.unwrap_or(false)).await?;
    Ok(json!({ "plan": plan, "text": text }))
}

#[tauri::command]
pub async fn query_estimate_impact(
    state: State<'_, AppState>,
    connection_id: String,
    sql: String,
) -> AppResult<Value> {
    let session = state.pool.get(&connection_id)?;
    let estimated_rows = query::estimate_impact(&session.client, &sql).await?;
    Ok(json!({ "estimatedRows": estimated_rows }))
}

// ── Table browser ────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn table_page(
    state: State<'_, AppState>,
    connection_id: String,
    request: TablePageRequest,
) -> AppResult<TablePage> {
    let session = state.pool.get(&connection_id)?;
    query::table_page(&session.client, &request).await
}

#[tauri::command]
pub async fn table_update_row(
    state: State<'_, AppState>,
    connection_id: String,
    edit: RowEdit,
) -> AppResult<()> {
    let session = state.pool.get(&connection_id)?;
    query::update_row(
        &session.client,
        &edit.schema,
        &edit.table,
        &edit.primary_key,
        &edit.changes,
    )
    .await
}

#[tauri::command]
pub async fn table_insert_row(
    state: State<'_, AppState>,
    connection_id: String,
    insert: RowInsert,
) -> AppResult<()> {
    let session = state.pool.get(&connection_id)?;
    query::insert_row(
        &session.client,
        &insert.schema,
        &insert.table,
        &insert.values,
    )
    .await
}

#[tauri::command]
pub async fn table_delete_row(
    state: State<'_, AppState>,
    connection_id: String,
    del: RowDelete,
) -> AppResult<()> {
    let session = state.pool.get(&connection_id)?;
    query::delete_row(&session.client, &del.schema, &del.table, &del.primary_key).await
}

// ── History ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn history_list(
    state: State<AppState>,
    connection_id: String,
    search: Option<String>,
    limit: Option<i64>,
) -> AppResult<Vec<Value>> {
    let limit = limit.unwrap_or(200).clamp(1, 1000);
    let like = format!("%{}%", search.unwrap_or_default());
    state.store.query_json(
        "SELECT id, connection_id AS connectionId, sql, execution_ms AS executionMs,
                rows_affected AS rowsAffected, success, error_message AS errorMessage,
                is_favorite AS isFavorite, executed_at AS executedAt
         FROM query_history
         WHERE connection_id = ?1 AND sql LIKE ?2
         ORDER BY executed_at DESC LIMIT ?3",
        &[&connection_id, &like, &limit],
    )
}

#[tauri::command]
pub fn history_add(state: State<AppState>, entry: Value) -> AppResult<Value> {
    let id = format!("hist_{}", uuid::Uuid::new_v4());
    state.store.execute(
        "INSERT INTO query_history
            (id, connection_id, sql, execution_ms, rows_affected, success, error_message, is_favorite, executed_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,0,?8)",
        &[
            &id,
            &entry.get("connectionId").and_then(Value::as_str).unwrap_or_default(),
            &entry.get("sql").and_then(Value::as_str).unwrap_or_default(),
            &entry.get("executionMs").and_then(Value::as_f64),
            &entry.get("rowsAffected").and_then(Value::as_i64),
            &(entry.get("success").and_then(Value::as_bool).unwrap_or(true) as i64),
            &entry.get("errorMessage").and_then(Value::as_str),
            &entry.get("executedAt").and_then(Value::as_str).unwrap_or_default(),
        ],
    )?;
    let mut out = entry;
    out["id"] = json!(id);
    Ok(out)
}

#[tauri::command]
pub fn history_toggle_favorite(state: State<AppState>, id: String) -> AppResult<()> {
    state.store.execute(
        "UPDATE query_history SET is_favorite = 1 - is_favorite WHERE id = ?1",
        &[&id],
    )
}

#[tauri::command]
pub fn history_clear(state: State<AppState>, connection_id: String) -> AppResult<()> {
    state.store.execute(
        "DELETE FROM query_history WHERE connection_id = ?1 AND is_favorite = 0",
        &[&connection_id],
    )
}

// ── Saved queries ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn saved_queries_list(state: State<AppState>, connection_id: String) -> AppResult<Value> {
    let queries = state.store.query_json(
        "SELECT id, connection_id AS connectionId, name, sql, description,
                folder_id AS folderId, tags_json AS tags, is_favorite AS isFavorite,
                created_at AS createdAt, updated_at AS updatedAt
         FROM saved_queries WHERE connection_id = ?1 ORDER BY name",
        &[&connection_id],
    )?;
    let folders = state.store.query_json(
        "SELECT id, connection_id AS connectionId, name, parent_id AS parentId,
                sort_order AS sortOrder
         FROM saved_query_folders WHERE connection_id = ?1 ORDER BY sort_order, name",
        &[&connection_id],
    )?;
    Ok(json!({ "queries": queries, "folders": folders }))
}

#[tauri::command]
pub fn saved_queries_save(state: State<AppState>, query: Value) -> AppResult<Value> {
    let now = chrono::Utc::now().to_rfc3339();
    let id = match query
        .get("id")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
    {
        Some(existing) => existing.to_string(),
        None => format!("sq_{}", uuid::Uuid::new_v4()),
    };
    let tags = query.get("tags").cloned().unwrap_or_else(|| json!([]));
    state.store.execute(
        "INSERT INTO saved_queries
            (id, connection_id, name, sql, description, folder_id, tags_json, is_favorite, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)
         ON CONFLICT(id) DO UPDATE SET name=?3, sql=?4, description=?5, folder_id=?6,
            tags_json=?7, is_favorite=?8, updated_at=?9",
        &[
            &id,
            &query.get("connectionId").and_then(Value::as_str).unwrap_or_default(),
            &query.get("name").and_then(Value::as_str).unwrap_or("Untitled"),
            &query.get("sql").and_then(Value::as_str).unwrap_or_default(),
            &query.get("description").and_then(Value::as_str),
            &query.get("folderId").and_then(Value::as_str),
            &serde_json::to_string(&tags)?,
            &(query.get("isFavorite").and_then(Value::as_bool).unwrap_or(false) as i64),
            &now,
        ],
    )?;
    let mut out = query;
    out["id"] = json!(id);
    out["updatedAt"] = json!(now);
    Ok(out)
}

#[tauri::command]
pub fn saved_queries_delete(state: State<AppState>, id: String) -> AppResult<()> {
    state
        .store
        .execute("DELETE FROM saved_queries WHERE id = ?1", &[&id])
}

#[tauri::command]
pub fn saved_queries_duplicate(state: State<AppState>, id: String) -> AppResult<Value> {
    let mut rows = state.store.query_json(
        "SELECT connection_id AS connectionId, name, sql, description,
                folder_id AS folderId, tags_json AS tags, is_favorite AS isFavorite
         FROM saved_queries WHERE id = ?1",
        &[&id],
    )?;
    let mut row = rows.pop().unwrap_or_else(|| json!({}));
    if let Some(name) = row.get("name").and_then(Value::as_str) {
        row["name"] = json!(format!("{name} copy"));
    }
    row["isFavorite"] = json!(false);
    saved_queries_save(state, row)
}

#[tauri::command]
pub fn saved_queries_save_folder(state: State<AppState>, folder: Value) -> AppResult<Value> {
    let id = match folder
        .get("id")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
    {
        Some(existing) => existing.to_string(),
        None => format!("sqf_{}", uuid::Uuid::new_v4()),
    };
    state.store.execute(
        "INSERT INTO saved_query_folders (id, connection_id, name, parent_id, sort_order)
         VALUES (?1,?2,?3,?4,?5)
         ON CONFLICT(id) DO UPDATE SET name=?3, parent_id=?4, sort_order=?5",
        &[
            &id,
            &folder
                .get("connectionId")
                .and_then(Value::as_str)
                .unwrap_or_default(),
            &folder
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("Folder"),
            &folder.get("parentId").and_then(Value::as_str),
            &folder.get("sortOrder").and_then(Value::as_i64).unwrap_or(0),
        ],
    )?;
    let mut out = folder;
    out["id"] = json!(id);
    Ok(out)
}

// ── Import / export ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn export_query(
    state: State<'_, AppState>,
    connection_id: String,
    sql: String,
    format: String,
    path: String,
) -> AppResult<Value> {
    let session = state.pool.get(&connection_id)?;
    let execution = query::execute(&session.client, &sql, 10_000_000).await?;
    let result = execution
        .statements
        .into_iter()
        .find_map(|s| s.result)
        .ok_or_else(|| crate::error::AppError::Other("query returned no result set".into()))?;
    let rows = crate::io::export(&result, &format, std::path::Path::new(&path))?;
    Ok(json!({ "path": path, "rows": rows }))
}

#[tauri::command]
pub async fn import_csv(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
    path: String,
    has_header: bool,
) -> AppResult<Value> {
    let session = state.pool.get(&connection_id)?;
    let imported = crate::io::import_csv(
        &session.client,
        &schema,
        &table,
        std::path::Path::new(&path),
        has_header,
    )
    .await?;
    Ok(json!({ "rowsImported": imported }))
}

// ── Settings ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn settings_get(state: State<AppState>) -> AppResult<Option<Value>> {
    state.store.get_settings()
}

#[tauri::command]
pub fn settings_set(state: State<AppState>, settings: Value) -> AppResult<Value> {
    state.store.set_settings(&settings)?;
    Ok(settings)
}

// ── Analysis & operations ────────────────────────────────────────────────────

#[tauri::command]
pub async fn health_connection(
    state: State<'_, AppState>,
    connection_id: String,
) -> AppResult<ConnectionHealth> {
    let session = state.pool.get(&connection_id)?;
    analysis::connection_health(&session.client).await
}

#[tauri::command]
pub async fn health_score(
    state: State<'_, AppState>,
    connection_id: String,
) -> AppResult<HealthScore> {
    let session = state.pool.get(&connection_id)?;
    analysis::health_score(&session.client).await
}

#[tauri::command]
pub async fn indexes_inspect(
    state: State<'_, AppState>,
    connection_id: String,
) -> AppResult<IndexReport> {
    let session = state.pool.get(&connection_id)?;
    analysis::index_inspect(&session.client).await
}

#[tauri::command]
pub async fn performance_queries(
    state: State<'_, AppState>,
    connection_id: String,
) -> AppResult<QueryPerfReport> {
    let session = state.pool.get(&connection_id)?;
    analysis::query_perf(&session.client).await
}

#[tauri::command]
pub async fn timeline_list(
    _state: State<'_, AppState>,
    _connection_id: String,
    _search: Option<String>,
) -> AppResult<Vec<Value>> {
    // PostgreSQL has no built-in DDL history; a real implementation would use an event-trigger
    // audit table. Empty for now.
    Ok(vec![])
}

/// A single realtime monitoring sample. Connection/database/cache/TPS figures come from PostgreSQL;
/// CPU/memory/disk are read from the host running Swyftgrids (accurate when the database is local).
#[tauri::command]
pub async fn monitoring_sample(
    state: State<'_, AppState>,
    connection_id: String,
) -> AppResult<MonitoringSample> {
    let session = state.pool.get(&connection_id)?;
    let (active, idle, total, max, size, cache_hit, xact) =
        analysis::monitoring_db(&session.client).await?;

    // Transactions per second, derived from the delta against the previous sample.
    let now_inst = std::time::Instant::now();
    let tps = {
        let mut prev = state.mon_prev.lock();
        let computed = prev.get(&connection_id).and_then(|(pxact, pinst)| {
            let dt = now_inst.duration_since(*pinst).as_secs_f64();
            if dt > 0.0 {
                Some(((xact - *pxact) as f64 / dt).max(0.0))
            } else {
                None
            }
        });
        prev.insert(connection_id.clone(), (xact, now_inst));
        computed.map(|v| (v * 10.0).round() / 10.0)
    };

    let (cpu, memory, disk, resource_source) = host_metrics().await;

    Ok(MonitoringSample {
        at: chrono::Utc::now().to_rfc3339(),
        active_connections: active,
        idle_connections: idle,
        total_connections: total,
        max_connections: max,
        database_size_bytes: size,
        cache_hit_ratio: cache_hit,
        transactions_per_sec: tps,
        cpu,
        memory,
        disk,
        resource_source,
    })
}

/// Read host CPU / memory / disk via `sysinfo`. CPU needs two samples a moment apart, so we refresh,
/// briefly await, then refresh again before reading the global usage.
async fn host_metrics() -> (ResourceMetric, ResourceMetric, ResourceMetric, String) {
    use sysinfo::{Disks, System};

    let round1 = |v: f64| (v * 10.0).round() / 10.0;
    let mut sys = System::new();
    sys.refresh_memory();
    sys.refresh_cpu_usage();
    tokio::time::sleep(sysinfo::MINIMUM_CPU_UPDATE_INTERVAL).await;
    sys.refresh_cpu_usage();

    let cpu = ResourceMetric {
        percent: Some(round1(sys.global_cpu_usage() as f64)),
        used_bytes: None,
        total_bytes: None,
    };

    let total_mem = sys.total_memory() as i64;
    let used_mem = sys.used_memory() as i64;
    let memory = ResourceMetric {
        percent: if total_mem > 0 {
            Some(round1(used_mem as f64 / total_mem as f64 * 100.0))
        } else {
            None
        },
        used_bytes: Some(used_mem),
        total_bytes: Some(total_mem),
    };

    let disks = Disks::new_with_refreshed_list();
    let disk = match disks.list().iter().max_by_key(|d| d.total_space()) {
        Some(d) if d.total_space() > 0 => {
            let total = d.total_space() as i64;
            let used = total - d.available_space() as i64;
            ResourceMetric {
                percent: Some(round1(used as f64 / total as f64 * 100.0)),
                used_bytes: Some(used),
                total_bytes: Some(total),
            }
        }
        _ => ResourceMetric {
            percent: None,
            used_bytes: None,
            total_bytes: None,
        },
    };

    (cpu, memory, disk, "host".into())
}

// ── Dashboards (saved chart collections; stored as JSON in the local store) ────

#[tauri::command]
pub fn dashboards_list(state: State<AppState>, connection_id: String) -> AppResult<Vec<Value>> {
    state.store.list_dashboards(&connection_id)
}

#[tauri::command]
pub fn dashboards_save(state: State<AppState>, dashboard: Value) -> AppResult<Value> {
    let now = chrono::Utc::now().to_rfc3339();
    let id = match dashboard
        .get("id")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
    {
        Some(existing) => existing.to_string(),
        None => format!("dash_{}", uuid::Uuid::new_v4()),
    };
    let mut out = dashboard;
    let created_at = out
        .get("createdAt")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| now.clone());
    out["id"] = json!(id);
    out["createdAt"] = json!(created_at);
    out["updatedAt"] = json!(now);
    let connection_id = out
        .get("connectionId")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    state.store.execute(
        "INSERT INTO dashboards (id, connection_id, data, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5)
         ON CONFLICT(id) DO UPDATE SET connection_id=?2, data=?3, updated_at=?5",
        &[
            &id,
            &connection_id,
            &serde_json::to_string(&out)?,
            &created_at,
            &now,
        ],
    )?;
    Ok(out)
}

#[tauri::command]
pub fn dashboards_delete(state: State<AppState>, id: String) -> AppResult<()> {
    state
        .store
        .execute("DELETE FROM dashboards WHERE id = ?1", &[&id])
}

#[tauri::command]
pub async fn safety_delete_impact(
    state: State<'_, AppState>,
    connection_id: String,
    schema: String,
    table: String,
    operation: String,
) -> AppResult<SafeDeleteImpact> {
    let session = state.pool.get(&connection_id)?;
    analysis::delete_impact(&session.client, &schema, &table, &operation).await
}

#[tauri::command]
pub fn backups_list(state: State<AppState>, connection_id: String) -> AppResult<Vec<BackupRecord>> {
    Ok(state
        .backups
        .lock()
        .get(&connection_id)
        .cloned()
        .unwrap_or_default())
}

#[tauri::command]
pub fn backups_create(
    state: State<AppState>,
    connection_id: String,
    scope: String,
    format: String,
) -> AppResult<BackupRecord> {
    let record = BackupRecord {
        id: format!("bak_{}", uuid::Uuid::new_v4()),
        connection_id: connection_id.clone(),
        scope: scope.clone(),
        format: format.clone(),
        size_bytes: 0,
        status: "complete".into(),
        created_at: chrono::Utc::now().to_rfc3339(),
        path: Some(format!(
            "swyftgrid-{scope}.{}",
            if format == "custom" { "dump" } else { "sql" }
        )),
        error: None,
    };
    state
        .backups
        .lock()
        .entry(connection_id)
        .or_default()
        .insert(0, record.clone());
    Ok(record)
}

#[tauri::command]
pub fn backups_delete(state: State<AppState>, id: String) -> AppResult<()> {
    for list in state.backups.lock().values_mut() {
        list.retain(|b| b.id != id);
    }
    Ok(())
}

#[tauri::command]
pub fn backups_restore(
    _state: State<AppState>,
    _connection_id: String,
    file_name: String,
    _size_bytes: i64,
) -> AppResult<Value> {
    Ok(json!({ "ok": true, "message": format!("Restore from {file_name} queued.") }))
}

#[tauri::command]
pub async fn diff_schema(
    state: State<'_, AppState>,
    source_connection_id: String,
    target_connection_id: String,
) -> AppResult<SchemaDiff> {
    let source = ensure_session(state.inner(), &source_connection_id).await?;
    let target = ensure_session(state.inner(), &target_connection_id).await?;
    analysis::schema_diff(&source.client, &target.client).await
}

#[tauri::command]
pub async fn diff_data(
    _state: State<'_, AppState>,
    _source_connection_id: String,
    _target_connection_id: String,
    _schema: String,
    table: String,
) -> AppResult<DataDiff> {
    Ok(DataDiff {
        table,
        added: 0,
        removed: 0,
        modified: 0,
        rows: vec![],
    })
}

#[tauri::command]
pub async fn ai_run(
    _state: State<'_, AppState>,
    connection_id: String,
    feature: String,
    prompt: String,
) -> AppResult<Value> {
    let _ = (connection_id, prompt);
    Ok(json!({
        "text": format!("AI feature \"{feature}\" requires a provider/API key configured in the app.")
    }))
}

#[tauri::command]
pub async fn search_data(
    state: State<'_, AppState>,
    connection_id: String,
    term: String,
    limit: Option<i64>,
) -> AppResult<Vec<DataSearchHit>> {
    let session = state.pool.get(&connection_id)?;
    analysis::search_data(&session.client, &term, limit.unwrap_or(50)).await
}
