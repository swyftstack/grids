/**
 * PostgreSQL access for the self-hosted server, using node-postgres.
 *
 * Mirrors the desktop's Rust `db` module: one connection pool per database, catalog introspection,
 * query execution, and row mutations. SQL is intentionally close to the Rust version so behaviour
 * matches across the two backends.
 */
import os from 'node:os';
import { statfs } from 'node:fs/promises';
import pg from 'pg';
import { openTunnel, type Tunnel } from './tunnel.js';
import {
  qualified,
  quoteIdent,
  splitStatements,
  type CellValue,
  type ConnectionConfig,
  type ConnectionHealth,
  type DatabaseDashboard,
  type DataSearchHit,
  type IndexReport,
  type MonitoringSample,
  type QueryExecution,
  type QueryPerfReport,
  type ResourceMetric,
  type Row,
  type SafeDeleteImpact,
  type SchemaSnapshot,
  type SchemaTreeNode,
  type TableInfo,
  type TablePage,
  type TablePageRequest,
} from '@swyftgrid/core';

const pools = new Map<string, pg.Pool>();
// Live SSH tunnels, keyed by connection id, torn down on disconnect.
const tunnels = new Map<string, Tunnel>();

function usesSsh(config: ConnectionConfig): boolean {
  return (
    config.method !== undefined && config.method !== 'direct' && (config.ssh?.hops?.length ?? 0) > 0
  );
}

/**
 * TLS options. `servername` matters when tunnelling: the connection terminates on `127.0.0.1` but
 * the certificate must still be validated against the real database hostname.
 */
function sslFor(config: ConnectionConfig, servername?: string): pg.PoolConfig['ssl'] {
  if (config.ssl.mode === 'disable') return false;
  const verify = config.ssl.mode.startsWith('verify');
  return { rejectUnauthorized: verify, ...(servername ? { servername } : {}) };
}

/** The database endpoint and credentials, resolved from discrete fields or a connection string. */
function dbTarget(config: ConnectionConfig): {
  host: string;
  port: number;
  database: string;
  user?: string;
  password?: string;
} {
  if (config.connectionString) {
    try {
      const u = new URL(config.connectionString);
      return {
        host: u.hostname || config.host,
        port: u.port ? Number(u.port) : config.port,
        database: u.pathname.replace(/^\//, '') || config.database,
        user: decodeURIComponent(u.username) || config.username,
        password: u.password ? decodeURIComponent(u.password) : config.password,
      };
    } catch {
      /* fall through to discrete fields */
    }
  }
  return {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
  };
}

export async function connect(id: string, config: ConnectionConfig): Promise<string> {
  disconnect(id);

  let pool: pg.Pool;
  if (usesSsh(config)) {
    const target = dbTarget(config);
    const tunnel = await openTunnel(config.ssh!, target.host, target.port);
    tunnels.set(id, tunnel);
    pool = new pg.Pool({
      host: tunnel.host,
      port: tunnel.port,
      database: target.database,
      user: target.user,
      password: target.password,
      ssl: sslFor(config, target.host),
      connectionTimeoutMillis: (config.connectTimeoutSecs ?? 15) * 1000,
      application_name: 'Swyftgrids',
      max: 4,
    });
  } else if (config.connectionString) {
    pool = new pg.Pool({ connectionString: config.connectionString, ssl: sslFor(config) });
  } else {
    pool = new pg.Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      ssl: sslFor(config),
      connectionTimeoutMillis: (config.connectTimeoutSecs ?? 15) * 1000,
      application_name: 'Swyftgrids',
      max: 4,
    });
  }
  pools.set(id, pool);

  try {
    const { rows } = await pool.query('SELECT version()');
    return rows[0]?.version ?? 'PostgreSQL';
  } catch (err) {
    // Don't leak a half-open pool/tunnel if the first query fails.
    disconnect(id);
    throw err;
  }
}

export function disconnect(id: string) {
  pools
    .get(id)
    ?.end()
    .catch(() => {});
  pools.delete(id);
  tunnels.get(id)?.close();
  tunnels.delete(id);
}

function poolFor(id: string): pg.Pool {
  const pool = pools.get(id);
  if (!pool) throw new Error(`Not connected: ${id}. Call db.connect first.`);
  return pool;
}

function coerce(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'bigint') return v.toString();
  return JSON.stringify(v);
}

function literal(v: CellValue): string {
  if (v === null) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export async function dashboard(
  id: string,
  serverVersion: string,
  lastConnectedAt: string,
): Promise<DatabaseDashboard> {
  const pool = poolFor(id);
  const { rows } = await pool.query(`
    SELECT current_database() AS db,
           pg_database_size(current_database())::int8 AS size,
           (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int8 AS conns,
           (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema'))::int8 AS tables,
           (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
              WHERE c.relkind IN ('v','m') AND n.nspname NOT IN ('pg_catalog','information_schema'))::int8 AS views,
           (SELECT count(*) FROM pg_namespace WHERE nspname NOT IN ('pg_catalog','information_schema','pg_toast'))::int8 AS schemas`);
  const largest = await pool.query(`
    SELECT n.nspname AS schema, c.relname AS table, pg_total_relation_size(c.oid)::int8 AS size
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind='r' AND n.nspname NOT IN ('pg_catalog','information_schema')
    ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 5`);
  const r = rows[0];
  return {
    databaseName: r.db,
    sizeBytes: Number(r.size),
    tableCount: Number(r.tables),
    schemaCount: Number(r.schemas),
    viewCount: Number(r.views),
    activeConnections: Number(r.conns),
    serverVersion,
    lastConnectedAt,
    largestTables: largest.rows.map((t) => ({
      schema: t.schema,
      table: t.table,
      sizeBytes: Number(t.size),
    })),
  };
}

// ── Schema tree ───────────────────────────────────────────────────────────────

export async function schemaTree(id: string, nodeId?: string): Promise<SchemaTreeNode[]> {
  const pool = poolFor(id);
  if (!nodeId) {
    const { rows } = await pool.query(
      `SELECT nspname FROM pg_namespace
       WHERE nspname NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY nspname`,
    );
    return rows.map((r) => ({
      id: `schema:${r.nspname}`,
      kind: 'schema',
      label: r.nspname,
      schema: r.nspname,
      expandable: true,
    }));
  }

  if (nodeId.startsWith('schema:')) {
    const schema = nodeId.slice('schema:'.length);
    return [
      {
        id: `group:${schema}:tables`,
        kind: 'group',
        label: 'Tables',
        groupKind: 'table',
        schema,
        expandable: true,
      },
      {
        id: `group:${schema}:views`,
        kind: 'group',
        label: 'Views',
        groupKind: 'view',
        schema,
        expandable: true,
      },
      {
        id: `group:${schema}:functions`,
        kind: 'group',
        label: 'Functions',
        groupKind: 'function',
        schema,
        expandable: true,
      },
      {
        id: `group:${schema}:extensions`,
        kind: 'group',
        label: 'Extensions',
        groupKind: 'extension',
        schema,
        expandable: true,
      },
    ];
  }

  if (nodeId.startsWith('group:')) {
    const [, schema, group] = nodeId.split(':');
    if (group === 'functions') {
      const { rows } = await pool.query(
        `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
         FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 ORDER BY p.proname`,
        [schema],
      );
      return rows.map((r) => ({
        id: `function:${schema}:${r.proname}`,
        kind: 'function',
        label: `${r.proname}(${r.args})`,
        schema,
        expandable: false,
      }));
    }
    if (group === 'extensions') {
      const { rows } = await pool.query('SELECT extname FROM pg_extension ORDER BY extname');
      return rows.map((r) => ({
        id: `extension:${r.extname}`,
        kind: 'extension',
        label: r.extname,
        schema,
        expandable: false,
      }));
    }
    const relkind = group === 'views' ? 'v' : 'r';
    const { rows } = await pool.query(
      `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname=$1 AND c.relkind=$2 ORDER BY c.relname`,
      [schema, relkind],
    );
    const kind = group === 'views' ? 'view' : 'table';
    return rows.map((r) => ({
      id: `${kind}:${schema}:${r.relname}`,
      kind,
      label: r.relname,
      schema,
      expandable: false,
    }));
  }
  return [];
}

// ── Table info ───────────────────────────────────────────────────────────────

export async function tableInfo(id: string, schema: string, table: string): Promise<TableInfo> {
  const pool = poolFor(id);
  const rel = qualified(schema, table);

  const meta = await pool.query(
    `SELECT pg_total_relation_size($1::regclass)::int8 AS size, c.reltuples::int8 AS rows,
            obj_description($1::regclass) AS comment, c.relkind::text AS relkind
     FROM pg_class c WHERE c.oid = $1::regclass`,
    [rel],
  );
  const pk = await pool.query(
    `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=ANY(i.indkey)
     WHERE i.indrelid=$1::regclass AND i.indisprimary`,
    [rel],
  );
  const fks = await pool.query(
    `SELECT att.attname AS col, ns.nspname AS fschema, cl.relname AS ftable, fatt.attname AS fcol
     FROM pg_constraint con
     JOIN pg_attribute att ON att.attrelid=con.conrelid AND att.attnum=ANY(con.conkey)
     JOIN pg_class cl ON cl.oid=con.confrelid JOIN pg_namespace ns ON ns.oid=cl.relnamespace
     JOIN pg_attribute fatt ON fatt.attrelid=con.confrelid AND fatt.attnum=ANY(con.confkey)
     WHERE con.conrelid=$1::regclass AND con.contype='f'`,
    [rel],
  );
  const cols = await pool.query(
    `SELECT a.attname, format_type(a.atttypid,a.atttypmod) AS data_type, t.typname AS udt,
            NOT a.attnotnull AS nullable, pg_get_expr(d.adbin,d.adrelid) AS def,
            a.attnum::int4 AS position, col_description(a.attrelid,a.attnum) AS comment
     FROM pg_attribute a JOIN pg_type t ON t.oid=a.atttypid
     LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
     WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`,
    [rel],
  );
  const idx = await pool.query(
    `SELECT i.relname AS name, ix.indisunique AS uniq, ix.indisprimary AS prim,
            am.amname AS method, pg_get_indexdef(ix.indexrelid) AS def
     FROM pg_index ix JOIN pg_class i ON i.oid=ix.indexrelid JOIN pg_am am ON am.oid=i.relam
     WHERE ix.indrelid=$1::regclass`,
    [rel],
  );
  const cons = await pool.query(
    `SELECT conname, contype::text AS contype, pg_get_constraintdef(oid) AS def
     FROM pg_constraint WHERE conrelid=$1::regclass`,
    [rel],
  );
  const trg = await pool.query(
    `SELECT tgname, pg_get_triggerdef(oid) AS def FROM pg_trigger
     WHERE tgrelid=$1::regclass AND NOT tgisinternal`,
    [rel],
  );

  const pkNames = new Set(pk.rows.map((r) => r.attname));
  const relkind = meta.rows[0]?.relkind;
  return {
    schema,
    name: table,
    kind: relkind === 'v' ? 'view' : relkind === 'm' ? 'materialized_view' : 'table',
    estimatedRows: Math.max(0, Number(meta.rows[0]?.rows ?? 0)),
    sizeBytes: Number(meta.rows[0]?.size ?? 0),
    comment: meta.rows[0]?.comment ?? undefined,
    columns: cols.rows.map((c) => {
      const fk = fks.rows.find((f) => f.col === c.attname);
      return {
        name: c.attname,
        dataType: c.data_type,
        udtName: c.udt,
        nullable: c.nullable,
        defaultValue: c.def,
        isPrimaryKey: pkNames.has(c.attname),
        references: fk ? { schema: fk.fschema, table: fk.ftable, column: fk.fcol } : undefined,
        position: c.position,
        comment: c.comment ?? undefined,
      };
    }),
    indexes: idx.rows.map((r) => ({
      name: r.name,
      columns: indexColumns(r.def),
      isUnique: r.uniq,
      isPrimary: r.prim,
      method: r.method,
      definition: r.def,
    })),
    constraints: cons.rows.map((r) => ({
      name: r.conname,
      type:
        r.contype === 'p'
          ? 'primary_key'
          : r.contype === 'f'
            ? 'foreign_key'
            : r.contype === 'u'
              ? 'unique'
              : r.contype === 'x'
                ? 'exclusion'
                : 'check',
      definition: r.def,
      columns: [],
    })),
    triggers: trg.rows.map((r) => ({
      name: r.tgname,
      timing: /INSTEAD OF/i.test(r.def) ? 'INSTEAD OF' : /AFTER/i.test(r.def) ? 'AFTER' : 'BEFORE',
      events: ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'].filter((e) =>
        r.def.toUpperCase().includes(e),
      ),
      definition: r.def,
    })),
  };
}

export async function snapshot(id: string): Promise<SchemaSnapshot> {
  const pool = poolFor(id);
  const tablesRes = await pool.query(
    `SELECT n.nspname AS schema, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE c.relkind IN ('r','v','m') AND n.nspname NOT IN ('pg_catalog','information_schema','pg_toast')
     ORDER BY n.nspname, c.relname`,
  );
  const tables: TableInfo[] = [];
  for (const t of tablesRes.rows) {
    tables.push(await tableInfo(id, t.schema, t.name));
  }
  const schemas = await pool.query(
    `SELECT n.nspname AS name, pg_get_userbyid(n.nspowner) AS owner
     FROM pg_namespace n WHERE n.nspname NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY n.nspname`,
  );
  const exts = await pool.query(
    `SELECT e.extname AS name, e.extversion AS version, n.nspname AS schema
     FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace ORDER BY e.extname`,
  );
  return {
    schemas: schemas.rows.map((s) => ({
      name: s.name,
      owner: s.owner,
      tableCount: tables.filter((t) => t.schema === s.name && t.kind === 'table').length,
      viewCount: tables.filter((t) => t.schema === s.name && t.kind !== 'table').length,
    })),
    tables,
    functions: [],
    extensions: exts.rows.map((e) => ({ name: e.name, version: e.version, schema: e.schema })),
    capturedAt: new Date().toISOString(),
  };
}

// ── Query + table browsing ───────────────────────────────────────────────────

export async function execute(id: string, sql: string, maxRows: number): Promise<QueryExecution> {
  const pool = poolFor(id);
  const started = performance.now();
  const statements = [];
  for (const text of splitStatements(sql)) {
    const t0 = performance.now();
    try {
      const res = await pool.query({ text, rowMode: 'array' });
      const fields = res.fields.map((f) => ({
        name: f.name,
        dataTypeId: f.dataTypeID,
        dataTypeName: String(f.dataTypeID),
      }));
      const allRows = (res.rows as unknown[][]).map((r) => r.map(coerce) as Row);
      const isSelect = fields.length > 0;
      statements.push({
        sql: text,
        result: {
          fields: isSelect ? fields : [],
          rows: isSelect ? allRows.slice(0, maxRows) : [],
          rowsAffected: isSelect ? null : (res.rowCount ?? 0),
          executionMs: performance.now() - t0,
          commandTag: `${res.command} ${res.rowCount ?? 0}`.trim(),
          truncated: isSelect && allRows.length > maxRows,
        },
      });
    } catch (err) {
      statements.push({ sql: text, error: pgError(err) });
      break;
    }
  }
  return { statements, totalMs: performance.now() - started };
}

export async function tablePage(id: string, req: TablePageRequest): Promise<TablePage> {
  const pool = poolFor(id);
  const started = performance.now();
  const rel = qualified(req.schema, req.table);
  const conditions: string[] = [];
  if (req.search) {
    const cols = await pool.query(
      `SELECT a.attname FROM pg_attribute a WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped`,
      [rel],
    );
    const pattern = literal(`%${req.search}%`);
    conditions.push(
      '(' +
        cols.rows.map((c) => `${quoteIdent(c.attname)}::text ILIKE ${pattern}`).join(' OR ') +
        ')',
    );
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = req.sort.length
    ? 'ORDER BY ' +
      req.sort
        .map((s) => `${quoteIdent(s.column)} ${s.direction === 'desc' ? 'DESC' : 'ASC'}`)
        .join(', ')
    : '';
  const limit = Math.min(Math.max(req.limit, 1), 100_000);
  const offset = Math.max(req.offset, 0);
  const res = await pool.query({
    text: `SELECT * FROM ${rel} ${where} ${order} LIMIT ${limit} OFFSET ${offset}`,
    rowMode: 'array',
  });
  const total = await pool.query(
    `SELECT GREATEST(reltuples::int8,0) AS n FROM pg_class WHERE oid=$1::regclass`,
    [rel],
  );
  return {
    fields: res.fields.map((f) => ({
      name: f.name,
      dataTypeId: f.dataTypeID,
      dataTypeName: String(f.dataTypeID),
    })),
    rows: (res.rows as unknown[][]).map((r) => r.map(coerce) as Row),
    estimatedTotal: Number(total.rows[0]?.n ?? 0),
    executionMs: performance.now() - started,
  };
}

export async function updateRow(
  id: string,
  schema: string,
  table: string,
  pk: Record<string, CellValue>,
  changes: Record<string, CellValue>,
) {
  const set = Object.entries(changes)
    .map(([c, v]) => `${quoteIdent(c)} = ${literal(v)}`)
    .join(', ');
  await poolFor(id).query(`UPDATE ${qualified(schema, table)} SET ${set} WHERE ${predicate(pk)}`);
}

export async function insertRow(
  id: string,
  schema: string,
  table: string,
  values: Record<string, CellValue>,
) {
  const cols = Object.keys(values).map(quoteIdent).join(', ');
  const vals = Object.values(values).map(literal).join(', ');
  await poolFor(id).query(`INSERT INTO ${qualified(schema, table)} (${cols}) VALUES (${vals})`);
}

export async function deleteRow(
  id: string,
  schema: string,
  table: string,
  pk: Record<string, CellValue>,
) {
  await poolFor(id).query(`DELETE FROM ${qualified(schema, table)} WHERE ${predicate(pk)}`);
}

export async function estimateImpact(id: string, sql: string): Promise<number | null> {
  const res = await poolFor(id).query(`EXPLAIN (FORMAT JSON) ${sql}`);
  return res.rows[0]?.['QUERY PLAN']?.[0]?.Plan?.['Plan Rows'] ?? null;
}

export async function explain(id: string, sql: string, analyze: boolean) {
  const pool = poolFor(id);
  const plan = await pool.query(`EXPLAIN (FORMAT JSON${analyze ? ', ANALYZE' : ''}) ${sql}`);
  const text = await pool.query(`EXPLAIN ${sql}`);
  return {
    plan: plan.rows[0]?.['QUERY PLAN'],
    text: text.rows.map((r) => r['QUERY PLAN']).join('\n'),
  };
}

// ── Analysis features ─────────────────────────────────────────────────────────

export async function connectionHealth(id: string): Promise<ConnectionHealth> {
  const pool = poolFor(id);
  const t0 = performance.now();
  const r = await pool.query(`
    SELECT
      (SELECT count(*) FROM pg_stat_activity WHERE state = 'active')::int AS active,
      (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle')::int AS idle,
      current_setting('max_connections')::int AS max`);
  const pingMs = Math.round(performance.now() - t0);
  const active = Number(r.rows[0]?.active ?? 0);
  const idle = Number(r.rows[0]?.idle ?? 0);
  const max = Number(r.rows[0]?.max ?? 100);
  const ratio = active / Math.max(max, 1);
  const status = ratio > 0.9 ? 'critical' : ratio > 0.7 ? 'warning' : 'healthy';
  return {
    status,
    pingMs,
    activeConnections: active,
    idleConnections: idle,
    maxConnections: max,
    warnings:
      status !== 'healthy' ? [`High connection count (${Math.round(ratio * 100)}% of max)`] : [],
  };
}

// Track the previous transaction counter (for TPS) and CPU times (for utilisation) between polls.
const xactPrev = new Map<string, { xact: number; at: number }>();
let cpuPrev: { idle: number; total: number } | null = null;

function cpuPercent(): number | null {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const c of cpus) {
    for (const v of Object.values(c.times)) total += v;
    idle += c.times.idle;
  }
  const prev = cpuPrev;
  cpuPrev = { idle, total };
  if (!prev) return null; // need two readings to compute a delta
  const idleDiff = idle - prev.idle;
  const totalDiff = total - prev.total;
  if (totalDiff <= 0) return null;
  return Number((100 * (1 - idleDiff / totalDiff)).toFixed(1));
}

/**
 * A realtime monitoring sample. Connection/database/cache/TPS figures come straight from the server
 * catalog and are exact. CPU/memory/disk are read from the host running this server (best effort —
 * accurate when the database is local), and `resourceSource` is set to `host`.
 */
export async function monitoring(id: string): Promise<MonitoringSample> {
  const pool = poolFor(id);
  const r = await pool.query(`
    SELECT
      (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='active')::int AS active,
      (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND state='idle')::int AS idle,
      (SELECT count(*) FROM pg_stat_activity WHERE datname=current_database())::int AS total,
      current_setting('max_connections')::int AS max,
      pg_database_size(current_database())::int8 AS size,
      (SELECT round(100.0*sum(blks_hit)/NULLIF(sum(blks_hit)+sum(blks_read),0),2)
         FROM pg_stat_database WHERE datname=current_database())::float8 AS cache_hit,
      (SELECT sum(xact_commit+xact_rollback)
         FROM pg_stat_database WHERE datname=current_database())::int8 AS xact`);
  const row = r.rows[0] ?? {};

  const nowMs = Date.now();
  const xact = Number(row.xact ?? 0);
  const prevXact = xactPrev.get(id);
  xactPrev.set(id, { xact, at: nowMs });
  let tps: number | null = null;
  if (prevXact) {
    const dt = (nowMs - prevXact.at) / 1000;
    if (dt > 0) tps = Math.max(0, Number(((xact - prevXact.xact) / dt).toFixed(1)));
  }

  const totalMem = os.totalmem();
  const usedMem = totalMem - os.freemem();
  let disk: ResourceMetric = { percent: null };
  try {
    const fs = await statfs(process.env.SWYFTGRID_DATA_DIR ?? process.cwd());
    const totalDisk = fs.blocks * fs.bsize;
    const usedDisk = totalDisk - fs.bavail * fs.bsize;
    if (totalDisk > 0) {
      disk = {
        percent: Number(((usedDisk / totalDisk) * 100).toFixed(1)),
        usedBytes: usedDisk,
        totalBytes: totalDisk,
      };
    }
  } catch {
    /* statfs unavailable on this platform */
  }

  return {
    at: new Date().toISOString(),
    activeConnections: Number(row.active ?? 0),
    idleConnections: Number(row.idle ?? 0),
    totalConnections: Number(row.total ?? 0),
    maxConnections: Number(row.max ?? 100),
    databaseSizeBytes: Number(row.size ?? 0),
    cacheHitRatio: row.cache_hit != null ? Number(row.cache_hit) : null,
    transactionsPerSec: tps,
    cpu: { percent: cpuPercent() },
    memory: {
      percent: Number(((usedMem / totalMem) * 100).toFixed(1)),
      usedBytes: usedMem,
      totalBytes: totalMem,
    },
    disk,
    resourceSource: 'host',
  };
}

export async function indexInspect(id: string): Promise<IndexReport> {
  const pool = poolFor(id);
  const idx = await pool.query(`
    SELECT s.schemaname AS schema, s.relname AS table, s.indexrelname AS name,
           s.idx_scan::int8 AS usage, pg_relation_size(s.indexrelid)::int8 AS size,
           ix.indisunique AS uniq, ix.indisprimary AS prim,
           array_to_string(array_agg(a.attname), ',') AS columns
    FROM pg_stat_user_indexes s
    JOIN pg_index ix ON ix.indexrelid = s.indexrelid
    JOIN pg_attribute a ON a.attrelid = s.relid AND a.attnum = ANY(ix.indkey)
    GROUP BY s.schemaname, s.relname, s.indexrelname, s.idx_scan, s.indexrelid, ix.indisunique, ix.indisprimary`);
  const missing = await pool.query(`
    SELECT con.conrelid::regclass::text AS table, att.attname AS column
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
    WHERE con.contype = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i WHERE i.indrelid = con.conrelid AND att.attnum = ANY(i.indkey)
      )`);
  return {
    indexes: idx.rows.map((r) => ({
      schema: r.schema,
      table: r.table,
      name: r.name,
      columns: String(r.columns ?? '')
        .split(',')
        .filter(Boolean),
      sizeBytes: Number(r.size),
      usageCount: Number(r.usage),
      isUnique: r.uniq,
      isPrimary: r.prim,
    })),
    recommendations: [
      ...missing.rows.map((r) => ({
        reason: 'missing' as const,
        schema: 'public',
        table: r.table,
        message: `Foreign key ${r.column} has no covering index.`,
        statement: `CREATE INDEX idx_${r.table}_${r.column} ON ${r.table} (${r.column});`,
      })),
      ...idx.rows
        .filter((r) => Number(r.usage) === 0 && !r.prim)
        .map((r) => ({
          reason: 'unused' as const,
          schema: r.schema,
          table: r.table,
          message: `${r.name} is unused (0 scans).`,
          statement: `DROP INDEX ${r.schema}.${r.name};`,
        })),
    ],
  };
}

export async function queryPerf(id: string): Promise<QueryPerfReport> {
  const pool = poolFor(id);
  const ext = await pool.query(`SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'`);
  if (ext.rowCount === 0) return { available: false, slow: [], frequent: [], longRunning: [] };
  const map = (rows: Record<string, unknown>[]) =>
    rows.map((r) => ({
      query: String(r.query),
      calls: Number(r.calls),
      totalMs: Number(r.total),
      meanMs: Number(r.mean),
      maxMs: Number(r.max),
      rows: Number(r.rows),
    }));
  const cols = `query, calls, total_exec_time AS total, mean_exec_time AS mean, max_exec_time AS max, rows`;
  const slow = await pool.query(
    `SELECT ${cols} FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10`,
  );
  const frequent = await pool.query(
    `SELECT ${cols} FROM pg_stat_statements ORDER BY calls DESC LIMIT 10`,
  );
  const long = await pool.query(
    `SELECT ${cols} FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10`,
  );
  return {
    available: true,
    slow: map(slow.rows),
    frequent: map(frequent.rows),
    longRunning: map(long.rows),
  };
}

export async function deleteImpact(
  id: string,
  schema: string,
  table: string,
  operation: SafeDeleteImpact['operation'],
): Promise<SafeDeleteImpact> {
  const pool = poolFor(id);
  const rel = qualified(schema, table);
  const est = await pool
    .query(`SELECT GREATEST(reltuples::int8, 0) AS n FROM pg_class WHERE oid = $1::regclass`, [rel])
    .catch(() => null);
  const deps = await pool.query(
    `SELECT conrelid::regclass::text AS src FROM pg_constraint WHERE confrelid = $1::regclass AND contype = 'f'`,
    [rel],
  );
  return {
    operation,
    schema,
    table,
    estimatedRows: est ? Number(est.rows[0]?.n ?? 0) : null,
    dependencies: deps.rows.map((r) => `${r.src} → ${table}`),
    confirmationPhrase: `${operation === 'TRUNCATE' ? 'TRUNCATE' : operation === 'DROP' ? 'DROP TABLE' : 'DELETE'} ${table}`,
  };
}

/**
 * Search inside table data across text-like columns. Bounded (a capped set of columns, small LIMIT
 * per column) so it stays responsive; on very large tables back this with a trigram / FTS index.
 */
export async function searchData(id: string, term: string, limit = 50): Promise<DataSearchHit[]> {
  if (term.trim().length < 2) return [];
  const pool = poolFor(id);
  const cols = await pool.query(`
    SELECT n.nspname AS schema, c.relname AS "table", a.attname AS "column"
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND t.typname IN ('text', 'varchar', 'bpchar', 'citext', 'name')
    LIMIT 40`);

  const pattern = `%${term}%`;
  const hits: DataSearchHit[] = [];
  for (const c of cols.rows) {
    if (hits.length >= limit) break;
    const rel = qualified(c.schema, c.table);
    const col = quoteIdent(c.column);
    try {
      const r = await pool.query(
        `SELECT ${col}::text AS v FROM ${rel} WHERE ${col}::text ILIKE $1 LIMIT 3`,
        [pattern],
      );
      for (const row of r.rows) {
        hits.push({
          schema: c.schema,
          table: c.table,
          column: c.column,
          value: String(row.v).slice(0, 80),
        });
      }
    } catch {
      /* skip columns we can't scan */
    }
  }
  return hits.slice(0, limit);
}

function predicate(pk: Record<string, CellValue>): string {
  return Object.entries(pk)
    .map(([c, v]) => (v === null ? `${quoteIdent(c)} IS NULL` : `${quoteIdent(c)} = ${literal(v)}`))
    .join(' AND ');
}

function indexColumns(def: string): string[] {
  const open = def.indexOf('(');
  const close = def.lastIndexOf(')');
  return open >= 0 && close > open
    ? def
        .slice(open + 1, close)
        .split(',')
        .map((s) => s.trim())
    : [];
}

function pgError(err: unknown) {
  const e = err as { message?: string; code?: string; detail?: string; hint?: string };
  return { message: e.message ?? 'Query error', code: e.code, detail: e.detail, hint: e.hint };
}
