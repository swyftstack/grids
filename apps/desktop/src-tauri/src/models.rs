//! Serde models mirroring the `@swyftgrid/core` TypeScript contract.
//!
//! Everything serialises as camelCase so the JSON matches the frontend types exactly. Keep these in
//! sync with `packages/core/src/types` — the IPC contract is the shared source of truth.

use serde::{Deserialize, Serialize};

// ─────────────────────────────── Connections ───────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SslOptions {
    pub mode: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root_cert: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_cert: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_key: Option<String>,
}

/// A single SSH hop. Secrets mirror the database password handling: stripped from the metadata
/// store and held in the OS keychain (see `store.rs`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshHostConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    /// `"password"` or `"key"`.
    pub auth: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub private_key_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub private_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub passphrase: Option<String>,
    /// Pinned SSH host key fingerprint (`SHA256:...`). When set, a mismatched key is refused.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub host_fingerprint: Option<String>,
}

/// SSH tunnel configuration: an ordered chain of hops from the client to the database host.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SshConfig {
    #[serde(default)]
    pub hops: Vec<SshHostConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub password: Option<String>,
    pub ssl: SslOptions,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub connection_string: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub connect_timeout_secs: Option<u64>,
    /// How to reach the host: `direct` (or absent), `ssh-tunnel`, `bastion`, or `jump-host`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    /// SSH hop chain, present when `method` is not `direct`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssh: Option<SshConfig>,
}

impl ConnectionConfig {
    /// True when this connection should be opened through an SSH tunnel.
    pub fn uses_ssh(&self) -> bool {
        !matches!(self.method.as_deref(), None | Some("direct"))
            && self.ssh.as_ref().is_some_and(|s| !s.hops.is_empty())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    pub id: String,
    pub name: String,
    pub config: ConnectionConfig,
    pub environment: String,
    pub folder_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    pub is_favorite: bool,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_connected_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionFolder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub latency_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub server_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Observed SSH host key fingerprints (one per hop) for hops that were not already pinned.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ssh_host_fingerprints: Option<Vec<String>>,
}

// ─────────────────────────────── Schema ───────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaTreeNode {
    pub id: String,
    pub kind: String,
    pub label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub group_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,
    pub expandable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<SchemaTreeNode>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub udt_name: String,
    pub nullable: bool,
    pub default_value: Option<String>,
    pub is_primary_key: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub references: Option<ForeignKeyTarget>,
    pub position: i32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForeignKeyTarget {
    pub schema: String,
    pub table: String,
    pub column: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexInfo {
    pub name: String,
    pub columns: Vec<String>,
    pub is_unique: bool,
    pub is_primary: bool,
    pub method: String,
    pub definition: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConstraintInfo {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub definition: String,
    pub columns: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TriggerInfo {
    pub name: String,
    pub timing: String,
    pub events: Vec<String>,
    pub definition: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableInfo {
    pub schema: String,
    pub name: String,
    pub kind: String,
    pub estimated_rows: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comment: Option<String>,
    pub columns: Vec<ColumnInfo>,
    pub indexes: Vec<IndexInfo>,
    pub constraints: Vec<ConstraintInfo>,
    pub triggers: Vec<TriggerInfo>,
}

// ─────────────────────────────── Query / table ───────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldInfo {
    pub name: String,
    pub data_type_id: u32,
    pub data_type_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryResult {
    pub fields: Vec<FieldInfo>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub rows_affected: Option<i64>,
    pub execution_ms: f64,
    pub command_tag: String,
    pub truncated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatementResult {
    pub sql: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<QueryResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<crate::error::SerializedError>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryExecution {
    pub statements: Vec<StatementResult>,
    pub total_ms: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SortSpec {
    pub column: String,
    pub direction: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FilterSpec {
    pub column: String,
    pub operator: String,
    #[serde(default)]
    pub value: serde_json::Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TablePageRequest {
    pub schema: String,
    pub table: String,
    pub offset: i64,
    pub limit: i64,
    #[serde(default)]
    pub sort: Vec<SortSpec>,
    #[serde(default)]
    pub filters: Vec<FilterSpec>,
    #[serde(default)]
    pub search: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TablePage {
    pub fields: Vec<FieldInfo>,
    pub rows: Vec<Vec<serde_json::Value>>,
    pub estimated_total: i64,
    pub execution_ms: f64,
}

// ─────────────────────────────── Snapshot (ER / search) ───────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaInfo {
    pub name: String,
    pub owner: String,
    pub table_count: i64,
    pub view_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FunctionInfo {
    pub schema: String,
    pub name: String,
    pub arguments: String,
    pub return_type: String,
    pub language: String,
    pub kind: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionInfo {
    pub name: String,
    pub version: String,
    pub schema: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaSnapshot {
    pub schemas: Vec<SchemaInfo>,
    pub tables: Vec<TableInfo>,
    pub functions: Vec<FunctionInfo>,
    pub extensions: Vec<ExtensionInfo>,
    pub captured_at: String,
}

// ─────────────────────────────── Row mutations ───────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowEdit {
    pub schema: String,
    pub table: String,
    pub primary_key: serde_json::Map<String, serde_json::Value>,
    pub changes: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowInsert {
    pub schema: String,
    pub table: String,
    pub values: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RowDelete {
    pub schema: String,
    pub table: String,
    pub primary_key: serde_json::Map<String, serde_json::Value>,
}

// ─────────────────────────────── Analysis features ───────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionHealth {
    pub status: String,
    pub ping_ms: u64,
    pub active_connections: i64,
    pub idle_connections: i64,
    pub max_connections: i64,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCategoryItem {
    pub category: String,
    pub label: String,
    pub status: String,
    pub value: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthIssue {
    pub category: String,
    pub severity: String,
    pub title: String,
    pub detail: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthScore {
    pub score: i64,
    pub issues: Vec<HealthIssue>,
    pub categories: Vec<HealthCategoryItem>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexEntry {
    pub schema: String,
    pub table: String,
    pub name: String,
    pub columns: Vec<String>,
    pub size_bytes: i64,
    pub usage_count: i64,
    pub is_unique: bool,
    pub is_primary: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexRecommendation {
    pub reason: String,
    pub schema: String,
    pub table: String,
    pub message: String,
    pub statement: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexReport {
    pub indexes: Vec<IndexEntry>,
    pub recommendations: Vec<IndexRecommendation>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryStat {
    pub query: String,
    pub calls: i64,
    pub total_ms: f64,
    pub mean_ms: f64,
    pub max_ms: f64,
    pub rows: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryPerfReport {
    pub available: bool,
    pub slow: Vec<QueryStat>,
    pub frequent: Vec<QueryStat>,
    pub long_running: Vec<QueryStat>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeDeleteImpact {
    pub operation: String,
    pub schema: String,
    pub table: String,
    pub estimated_rows: Option<i64>,
    pub dependencies: Vec<String>,
    pub confirmation_phrase: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataSearchHit {
    pub schema: String,
    pub table: String,
    pub column: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRecord {
    pub id: String,
    pub connection_id: String,
    pub scope: String,
    pub format: String,
    pub size_bytes: i64,
    pub status: String,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaDiffEntry {
    pub change: String,
    pub object_type: String,
    pub object: String,
    pub detail: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub before: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub after: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaDiff {
    pub source_label: String,
    pub target_label: String,
    pub entries: Vec<SchemaDiffEntry>,
    pub migration_sql: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataDiffRow {
    pub change: String,
    pub key: String,
    pub detail: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataDiff {
    pub table: String,
    pub added: i64,
    pub removed: i64,
    pub modified: i64,
    pub rows: Vec<DataDiffRow>,
}

// ─────────────────────────────── Monitoring ───────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceMetric {
    pub percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub used_bytes: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_bytes: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitoringSample {
    pub at: String,
    pub active_connections: i64,
    pub idle_connections: i64,
    pub total_connections: i64,
    pub max_connections: i64,
    pub database_size_bytes: i64,
    pub cache_hit_ratio: Option<f64>,
    pub transactions_per_sec: Option<f64>,
    pub cpu: ResourceMetric,
    pub memory: ResourceMetric,
    pub disk: ResourceMetric,
    pub resource_source: String,
}

// ─────────────────────────────── Dashboard ───────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LargeTable {
    pub schema: String,
    pub table: String,
    pub size_bytes: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseDashboard {
    pub database_name: String,
    pub size_bytes: i64,
    pub table_count: i64,
    pub schema_count: i64,
    pub view_count: i64,
    pub active_connections: i64,
    pub server_version: String,
    pub last_connected_at: String,
    pub largest_tables: Vec<LargeTable>,
}
