/**
 * Realtime server monitoring types.
 *
 * A {@link MonitoringSample} is a single point-in-time reading of a database server's load. The UI
 * polls `monitoring.sample` on an interval and keeps a rolling window to draw live sparklines.
 *
 * Connection and database metrics are always derived directly from PostgreSQL (`pg_stat_activity`,
 * `pg_database_size`, `pg_stat_database`) and are exact. Host resource metrics (CPU / memory / disk)
 * cannot be read through SQL alone, so each backend fills them on a best-effort basis and records
 * where they came from in {@link MonitoringSample.resourceSource}:
 *
 *  - `host`      — read from the machine running the backend (accurate when the database is local).
 *  - `simulated` — generated sample data (the in-browser demo backend).
 *  - `unavailable` — could not be determined; the UI shows the gauge as N/A.
 */

export type ResourceSource = 'host' | 'simulated' | 'unavailable';

export interface ResourceMetric {
  /** 0–100 utilisation. `null` when unavailable. */
  percent: number | null;
  /** Bytes in use, when known. */
  usedBytes?: number;
  /** Total bytes, when known. */
  totalBytes?: number;
}

export interface MonitoringSample {
  /** ISO 8601 timestamp the reading was taken. */
  at: string;
  /** Active (running a query) backends. */
  activeConnections: number;
  /** Idle backends holding a connection slot. */
  idleConnections: number;
  /** Total backends connected (active + idle + other states). */
  totalConnections: number;
  /** Server `max_connections`. */
  maxConnections: number;
  /** Total on-disk size of the current database in bytes. */
  databaseSizeBytes: number;
  /** Buffer cache hit ratio (0–100); high is good. `null` when not yet measurable. */
  cacheHitRatio: number | null;
  /** Transactions per second since the previous sample (commits + rollbacks). `null` on first read. */
  transactionsPerSec: number | null;
  /** Host CPU utilisation. */
  cpu: ResourceMetric;
  /** Host memory utilisation. */
  memory: ResourceMetric;
  /** Host disk utilisation for the volume holding the data directory (best effort). */
  disk: ResourceMetric;
  /** Where the CPU/memory/disk readings came from. */
  resourceSource: ResourceSource;
}
