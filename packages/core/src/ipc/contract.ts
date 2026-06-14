/**
 * The Swyftgrids IPC contract.
 *
 * This single file is the source of truth for every operation the UI can ask a backend to perform.
 * It is implemented twice:
 *
 *  - **Desktop**: as Tauri commands in Rust (`apps/desktop/src-tauri`).
 *  - **Web (self-hosted)**: as HTTP routes (`apps/web`).
 *
 * The React app calls everything through a single typed `invoke<K>(command, params)` function
 * (see `apps/desktop/src/lib/ipc.ts`), so adding a capability is a three-step change: add it here,
 * implement it in Rust, implement it in the web server. The compiler enforces the rest.
 */
import type {
  Connection,
  ConnectionConfig,
  ConnectionFolder,
  ConnectionInput,
  ConnectionTestResult,
} from '../types/connection.js';
import type { SchemaSnapshot, SchemaTreeNode, TableInfo } from '../types/schema.js';
import type {
  QueryExecution,
  RowDelete,
  RowEdit,
  RowInsert,
  TablePage,
  TablePageRequest,
} from '../types/query.js';
import type { Settings } from '../types/settings.js';
import type {
  DatabaseDashboard,
  QueryHistoryEntry,
  SavedQuery,
  SavedQueryFolder,
  SavedQueryInput,
} from '../types/workspace.js';
import type {
  BackupRecord,
  BackupScope,
  BackupFormat,
  ConnectionHealth,
  DataDiff,
  DataSearchHit,
  HealthScore,
  IndexReport,
  QueryPerfReport,
  SafeDeleteImpact,
  SchemaDiff,
  TimelineEvent,
} from '../types/analysis.js';
import type { AiRunRequest, AiResult } from '../types/ai.js';
import type { MonitoringSample } from '../types/monitoring.js';
import type { Dashboard, DashboardInput } from '../types/dashboard.js';

/** Result of an `EXPLAIN` request, kept loose because the plan shape is provider-specific. */
export interface ExplainResult {
  /** The raw `EXPLAIN (FORMAT JSON)` document. */
  plan: unknown;
  /** A flattened, human-readable text plan for quick display. */
  text: string;
}

/**
 * Map of command name -> `{ params, result }`. Every backend method lives here.
 * Use `void` for commands that take no parameters or return nothing.
 */
export interface IpcContract {
  // ── Connections (local SQLite store) ─────────────────────────────────────────
  'connections.list': {
    params: void;
    result: { connections: Connection[]; folders: ConnectionFolder[] };
  };
  'connections.save': { params: { connection: ConnectionInput | Connection }; result: Connection };
  'connections.delete': { params: { id: string }; result: void };
  'connections.duplicate': { params: { id: string }; result: Connection };
  'connections.test': { params: { config: ConnectionConfig }; result: ConnectionTestResult };
  'connections.saveFolder': {
    params: { folder: Omit<ConnectionFolder, 'id'> & { id?: string } };
    result: ConnectionFolder;
  };
  'connections.deleteFolder': { params: { id: string }; result: void };

  // ── Sessions / dashboard ─────────────────────────────────────────────────────
  'db.connect': {
    params: { connectionId: string };
    result: { sessionId: string; dashboard: DatabaseDashboard };
  };
  'db.disconnect': { params: { connectionId: string }; result: void };
  'db.dashboard': { params: { connectionId: string }; result: DatabaseDashboard };

  // ── Schema introspection ─────────────────────────────────────────────────────
  /** Returns the children of `nodeId` (or the roots when omitted) for lazy tree expansion. */
  'schema.tree': { params: { connectionId: string; nodeId?: string }; result: SchemaTreeNode[] };
  'schema.table': {
    params: { connectionId: string; schema: string; table: string };
    result: TableInfo;
  };
  /** Full denormalised snapshot for the ER diagram and universal search. */
  'schema.snapshot': { params: { connectionId: string }; result: SchemaSnapshot };

  // ── SQL editor ───────────────────────────────────────────────────────────────
  'query.execute': {
    params: { connectionId: string; sql: string; maxRows?: number };
    result: QueryExecution;
  };
  'query.explain': {
    params: { connectionId: string; sql: string; analyze?: boolean };
    result: ExplainResult;
  };
  /** Estimated rows a statement would affect, used by Production Safety confirmations. */
  'query.estimateImpact': {
    params: { connectionId: string; sql: string };
    result: { estimatedRows: number | null };
  };

  // ── Table browser ────────────────────────────────────────────────────────────
  'table.page': { params: { connectionId: string; request: TablePageRequest }; result: TablePage };
  'table.updateRow': { params: { connectionId: string; edit: RowEdit }; result: void };
  'table.insertRow': { params: { connectionId: string; insert: RowInsert }; result: void };
  'table.deleteRow': { params: { connectionId: string; del: RowDelete }; result: void };

  // ── Query history (local store) ──────────────────────────────────────────────
  'history.list': {
    params: { connectionId: string; search?: string; limit?: number };
    result: QueryHistoryEntry[];
  };
  'history.add': { params: { entry: Omit<QueryHistoryEntry, 'id'> }; result: QueryHistoryEntry };
  'history.toggleFavorite': { params: { id: string }; result: void };
  'history.clear': { params: { connectionId: string }; result: void };

  // ── Saved queries (local store, per-connection) ──────────────────────────────
  'savedQueries.list': {
    params: { connectionId: string };
    result: { queries: SavedQuery[]; folders: SavedQueryFolder[] };
  };
  'savedQueries.save': { params: { query: SavedQueryInput | SavedQuery }; result: SavedQuery };
  'savedQueries.delete': { params: { id: string }; result: void };
  'savedQueries.duplicate': { params: { id: string }; result: SavedQuery };
  'savedQueries.saveFolder': {
    params: { folder: Omit<SavedQueryFolder, 'id'> & { id?: string } };
    result: SavedQueryFolder;
  };

  // ── Import / export ──────────────────────────────────────────────────────────
  'export.query': {
    params: { connectionId: string; sql: string; format: 'csv' | 'json'; path: string };
    result: { path: string; rows: number };
  };
  'import.csv': {
    params: {
      connectionId: string;
      schema: string;
      table: string;
      path: string;
      hasHeader: boolean;
    };
    result: { rowsImported: number };
  };

  // ── Settings (local store) ───────────────────────────────────────────────────
  'settings.get': { params: void; result: Settings };
  'settings.set': { params: { settings: Settings }; result: Settings };

  // ── Health & performance (analysis features) ─────────────────────────────────
  'health.connection': { params: { connectionId: string }; result: ConnectionHealth };
  'health.score': { params: { connectionId: string }; result: HealthScore };
  'indexes.inspect': { params: { connectionId: string }; result: IndexReport };
  'performance.queries': { params: { connectionId: string }; result: QueryPerfReport };
  'timeline.list': { params: { connectionId: string; search?: string }; result: TimelineEvent[] };
  /** A single realtime reading of server load for the Monitoring tab (polled on an interval). */
  'monitoring.sample': { params: { connectionId: string }; result: MonitoringSample };

  // ── Dashboards (saved chart collections, per-connection) ──────────────────────
  'dashboards.list': { params: { connectionId: string }; result: Dashboard[] };
  'dashboards.save': { params: { dashboard: DashboardInput }; result: Dashboard };
  'dashboards.delete': { params: { id: string }; result: void };

  // ── Safe delete (Part 9) ─────────────────────────────────────────────────────
  'safety.deleteImpact': {
    params: {
      connectionId: string;
      schema: string;
      table: string;
      operation: SafeDeleteImpact['operation'];
    };
    result: SafeDeleteImpact;
  };

  // ── Backups (Part 1) ─────────────────────────────────────────────────────────
  'backups.list': { params: { connectionId: string }; result: BackupRecord[] };
  'backups.create': {
    params: { connectionId: string; scope: BackupScope; format: BackupFormat };
    result: BackupRecord;
  };
  'backups.delete': { params: { id: string }; result: void };
  'backups.restore': {
    params: { connectionId: string; fileName: string; sizeBytes: number };
    result: { ok: boolean; message: string };
  };

  // ── Diff (Parts 7 & 8) ───────────────────────────────────────────────────────
  'diff.schema': {
    params: { sourceConnectionId: string; targetConnectionId: string };
    result: SchemaDiff;
  };
  'diff.data': {
    params: {
      sourceConnectionId: string;
      targetConnectionId: string;
      schema: string;
      table: string;
    };
    result: DataDiff;
  };

  // ── AI (Part 13) ─────────────────────────────────────────────────────────────
  'ai.run': { params: AiRunRequest; result: AiResult };

  // ── In-data search (⌘K when "search within tables" is enabled) ───────────────
  'search.data': {
    params: { connectionId: string; term: string; limit?: number };
    result: DataSearchHit[];
  };
}

/** Union of every valid command name. */
export type IpcCommand = keyof IpcContract;

/** Parameters for a given command. */
export type IpcParams<K extends IpcCommand> = IpcContract[K]['params'];

/** Result for a given command. */
export type IpcResult<K extends IpcCommand> = IpcContract[K]['result'];

/**
 * The shape every backend bridge must satisfy. The desktop (Tauri) and web (HTTP) bridges both
 * implement this, and the mock backend used by `pnpm dev` does too.
 */
export type IpcInvoke = <K extends IpcCommand>(
  command: K,
  params: IpcParams<K>,
) => Promise<IpcResult<K>>;

/** All command names as a runtime array — handy for the web router and tests. */
export const IPC_COMMANDS = [
  'connections.list',
  'connections.save',
  'connections.delete',
  'connections.duplicate',
  'connections.test',
  'connections.saveFolder',
  'connections.deleteFolder',
  'db.connect',
  'db.disconnect',
  'db.dashboard',
  'schema.tree',
  'schema.table',
  'schema.snapshot',
  'query.execute',
  'query.explain',
  'query.estimateImpact',
  'table.page',
  'table.updateRow',
  'table.insertRow',
  'table.deleteRow',
  'history.list',
  'history.add',
  'history.toggleFavorite',
  'history.clear',
  'savedQueries.list',
  'savedQueries.save',
  'savedQueries.delete',
  'savedQueries.duplicate',
  'savedQueries.saveFolder',
  'export.query',
  'import.csv',
  'settings.get',
  'settings.set',
  'health.connection',
  'health.score',
  'indexes.inspect',
  'performance.queries',
  'timeline.list',
  'monitoring.sample',
  'dashboards.list',
  'dashboards.save',
  'dashboards.delete',
  'safety.deleteImpact',
  'backups.list',
  'backups.create',
  'backups.delete',
  'backups.restore',
  'diff.schema',
  'diff.data',
  'ai.run',
  'search.data',
] as const satisfies readonly IpcCommand[];
