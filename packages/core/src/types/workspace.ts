/**
 * Workspace types: dashboard metrics, query history, and saved queries.
 */

/** High-level metrics shown on the per-database Dashboard. */
export interface DatabaseDashboard {
  databaseName: string;
  /** Total database size in bytes. */
  sizeBytes: number;
  tableCount: number;
  schemaCount: number;
  viewCount: number;
  /** Active backends (sessions) currently connected to the server. */
  activeConnections: number;
  /** Full server version string, e.g. "PostgreSQL 16.2 on x86_64-pc-linux-gnu". */
  serverVersion: string;
  /** When the client last established a session to this database (ISO 8601). */
  lastConnectedAt: string;
  /** The few largest tables, for a quick "where is my data" panel. */
  largestTables: Array<{ schema: string; table: string; sizeBytes: number }>;
}

/** One entry in the per-database query history. */
export interface QueryHistoryEntry {
  id: string;
  connectionId: string;
  sql: string;
  /** Execution time in milliseconds, when the query ran successfully. */
  executionMs?: number;
  rowsAffected?: number;
  success: boolean;
  errorMessage?: string;
  isFavorite: boolean;
  executedAt: string;
}

/** A saved query. Saved queries are scoped to a single connection (database-specific). */
export interface SavedQuery {
  id: string;
  connectionId: string;
  name: string;
  sql: string;
  description?: string;
  folderId: string | null;
  tags: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SavedQueryFolder {
  id: string;
  connectionId: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
}

export type SavedQueryInput = Omit<SavedQuery, 'id' | 'createdAt' | 'updatedAt'>;
