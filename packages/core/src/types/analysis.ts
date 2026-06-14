/**
 * Types for the analysis & operations features: connection health, database health score, index
 * inspector, query performance, schema/data diff, timeline, backups, and safe-delete impact.
 */

export type HealthStatus = 'healthy' | 'warning' | 'critical';

// ── Connection health (Part 5) ────────────────────────────────────────────────

export interface ConnectionHealth {
  status: HealthStatus;
  /** Round-trip ping latency in milliseconds. */
  pingMs: number;
  activeConnections: number;
  idleConnections: number;
  maxConnections: number;
  /** Human-readable warnings, e.g. "High connection count (82% of max)". */
  warnings: string[];
}

// ── Database health score (Part 11) ───────────────────────────────────────────

export type HealthCategory =
  | 'missing_indexes'
  | 'unused_indexes'
  | 'duplicate_indexes'
  | 'table_bloat'
  | 'dead_tuples'
  | 'slow_queries';

export interface HealthIssue {
  category: HealthCategory;
  severity: HealthStatus;
  title: string;
  detail: string;
  count: number;
}

export interface HealthScore {
  /** 0–100, higher is better. */
  score: number;
  issues: HealthIssue[];
  /** Per-category summary used for the breakdown panel. */
  categories: Array<{
    category: HealthCategory;
    label: string;
    status: HealthStatus;
    value: string;
  }>;
}

// ── Index inspector (Part 4) ──────────────────────────────────────────────────

export interface IndexEntry {
  schema: string;
  table: string;
  name: string;
  columns: string[];
  sizeBytes: number;
  /** Times the index has been used (idx_scan from pg_stat_user_indexes). */
  usageCount: number;
  isUnique: boolean;
  isPrimary: boolean;
}

export interface IndexRecommendation {
  reason: 'missing' | 'unused' | 'duplicate';
  schema: string;
  table: string;
  message: string;
  /** A ready-to-run statement (CREATE INDEX … / DROP INDEX …). */
  statement: string;
}

export interface IndexReport {
  indexes: IndexEntry[];
  recommendations: IndexRecommendation[];
}

// ── Query performance (Part 6) ────────────────────────────────────────────────

export interface QueryStat {
  query: string;
  calls: number;
  totalMs: number;
  meanMs: number;
  maxMs: number;
  rows: number;
}

export interface QueryPerfReport {
  /** Whether pg_stat_statements is installed; when false the UI shows an enable hint. */
  available: boolean;
  slow: QueryStat[];
  frequent: QueryStat[];
  longRunning: QueryStat[];
}

// ── Timeline (Part 12) ────────────────────────────────────────────────────────

export type TimelineAction =
  | 'create_table'
  | 'drop_table'
  | 'add_column'
  | 'drop_column'
  | 'create_index'
  | 'drop_index'
  | 'alter_column';

export interface TimelineEvent {
  id: string;
  at: string;
  action: TimelineAction;
  objectType: string;
  object: string;
  detail?: string;
}

// ── Backups (Part 1) ──────────────────────────────────────────────────────────

export type BackupScope = 'full' | 'schema_only' | 'data_only';
export type BackupFormat = 'sql' | 'custom';
export type BackupStatus = 'pending' | 'running' | 'complete' | 'failed';

export interface BackupRecord {
  id: string;
  connectionId: string;
  scope: BackupScope;
  format: BackupFormat;
  sizeBytes: number;
  status: BackupStatus;
  createdAt: string;
  /** Local path / download handle, when complete. */
  path?: string;
  error?: string;
}

// ── Schema diff (Part 7) ──────────────────────────────────────────────────────

export type DiffChange = 'added' | 'removed' | 'changed';

export interface SchemaDiffEntry {
  change: DiffChange;
  objectType: 'table' | 'column' | 'index' | 'constraint';
  object: string;
  /** Description of the difference and, for `changed`, the before/after. */
  detail: string;
  before?: string;
  after?: string;
}

export interface SchemaDiff {
  sourceLabel: string;
  targetLabel: string;
  entries: SchemaDiffEntry[];
  /** Migration SQL that would bring target in line with source. */
  migrationSql: string;
}

// ── Data diff (Part 8) ────────────────────────────────────────────────────────

export interface DataDiffRow {
  change: DiffChange;
  key: string;
  detail: string;
}

export interface DataDiff {
  table: string;
  added: number;
  removed: number;
  modified: number;
  rows: DataDiffRow[];
}

// ── In-data search ────────────────────────────────────────────────────────────

export interface DataSearchHit {
  schema: string;
  table: string;
  column: string;
  /** The matching value (truncated for display). */
  value: string;
}

// ── Safe delete impact (Part 9) ───────────────────────────────────────────────

export interface SafeDeleteImpact {
  operation: 'DELETE' | 'TRUNCATE' | 'DROP' | 'ALTER DROP';
  schema: string;
  table: string;
  estimatedRows: number | null;
  /** Dependent objects (FKs, views) that could be affected. */
  dependencies: string[];
  /** The phrase the user must type to confirm, e.g. "DELETE users". */
  confirmationPhrase: string;
}
