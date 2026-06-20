/**
 * In-memory mock backend.
 *
 * Implements the full IPC contract with believable sample data so the entire UI is usable in a
 * plain browser (`pnpm dev`) — no Rust, no PostgreSQL. Connections, settings, saved queries, and
 * history persist to `localStorage`; schema and table data are generated from a fixed sample
 * dataset. This is *not* used in the packaged desktop app.
 */
import {
  defaultSettings,
  newId,
  type Connection,
  type ConnectionConfig,
  type ConnectionFolder,
  type SshHostConfig,
  type IpcCommand,
  type IpcParams,
  type IpcResult,
  type Row,
  type TableInfo,
} from '@swyftgrid/core';

/** Mirror the real backends: never echo secrets (DB password or SSH hop secrets) back to the UI. */
function stripConfigSecrets(config: ConnectionConfig): ConnectionConfig {
  return {
    ...config,
    password: undefined,
    ssh: config.ssh
      ? {
          hops: config.ssh.hops.map((h) => ({
            ...h,
            password: undefined,
            privateKey: undefined,
            passphrase: undefined,
          })),
        }
      : config.ssh,
  };
}

// ─────────────────────────────── persistence ───────────────────────────────

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`swyftgrid:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`swyftgrid:${key}`, JSON.stringify(value));
  } catch {
    /* ignore quota errors in the mock */
  }
}

const now = () => new Date().toISOString();

// Seed one connection on first run so the app isn't empty.
function seedConnections(): Connection[] {
  return [
    {
      id: 'conn_dev',
      name: 'Development Database',
      environment: 'development',
      folderId: null,
      isFavorite: true,
      color: '#635bff',
      createdAt: now(),
      updatedAt: now(),
      lastConnectedAt: now(),
      config: {
        host: 'localhost',
        port: 5432,
        database: 'app_dev',
        username: 'postgres',
        ssl: { mode: 'prefer' },
      },
    },
    {
      id: 'conn_prod',
      name: 'Production Database',
      environment: 'production',
      folderId: null,
      isFavorite: false,
      color: '#ef4444',
      createdAt: now(),
      updatedAt: now(),
      config: {
        host: 'db.production.internal',
        port: 5432,
        database: 'app_prod',
        username: 'readonly',
        ssl: { mode: 'require' },
      },
    },
  ];
}

let connections = load<Connection[]>('connections', seedConnections());
let folders = load<ConnectionFolder[]>('folders', []);
let settings = load('settings', defaultSettings);
let savedQueries = load<Record<string, unknown>[]>('savedQueries', [
  {
    id: 'sq_signups',
    connectionId: 'conn_dev',
    name: 'Recent Signups',
    sql: "SELECT id, email, created_at\nFROM users\nWHERE created_at > now() - interval '7 days'\nORDER BY created_at DESC;",
    description: 'Users who signed up in the last week',
    folderId: 'sqf_analytics',
    tags: ['analytics', 'users'],
    isFavorite: true,
    createdAt: now(),
    updatedAt: now(),
  },
  {
    id: 'sq_revenue',
    connectionId: 'conn_dev',
    name: 'Monthly Revenue',
    sql: "SELECT date_trunc('month', created_at) AS month, sum(amount) AS revenue\nFROM subscriptions\nGROUP BY 1 ORDER BY 1 DESC;",
    folderId: 'sqf_analytics',
    tags: ['revenue', 'finance'],
    isFavorite: false,
    createdAt: now(),
    updatedAt: now(),
  },
]);
let savedQueryFolders = load<Record<string, unknown>[]>('savedQueryFolders', [
  {
    id: 'sqf_analytics',
    connectionId: 'conn_dev',
    name: 'User Analytics',
    parentId: null,
    sortOrder: 0,
  },
]);
let history = load<Record<string, unknown>[]>('history', []);

// Seed one dashboard so the Dashboards feature isn't empty on first run. The widget queries are
// written to demo nicely against the in-memory aggregate simulator below.
function seedDashboards(): Record<string, unknown>[] {
  return [
    {
      id: 'dash_overview',
      connectionId: 'conn_dev',
      name: 'Product Overview',
      description: 'A few key metrics at a glance.',
      widgets: [
        {
          id: 'w_users',
          title: 'Total users',
          sql: 'SELECT count(*) AS users FROM users;',
          chartType: 'number',
          valueColumns: ['users'],
          span: 1,
        },
        {
          id: 'w_orgs_plan',
          title: 'Organizations by plan',
          sql: 'SELECT plan, count(*) AS orgs FROM organizations GROUP BY plan;',
          chartType: 'bar',
          labelColumn: 'plan',
          valueColumns: ['orgs'],
          span: 1,
        },
        {
          id: 'w_subs_status',
          title: 'Subscriptions by status',
          sql: 'SELECT status, count(*) AS n FROM subscriptions GROUP BY status;',
          chartType: 'pie',
          labelColumn: 'status',
          valueColumns: ['n'],
          span: 1,
        },
        {
          id: 'w_users_active',
          title: 'Users by active flag',
          sql: 'SELECT is_active, count(*) AS n FROM users GROUP BY is_active;',
          chartType: 'bar',
          labelColumn: 'is_active',
          valueColumns: ['n'],
          span: 1,
        },
      ],
      createdAt: now(),
      updatedAt: now(),
    },
  ];
}
let dashboards = load<Record<string, unknown>[]>('dashboards', seedDashboards());

// ─────────────────────────────── sample schema ───────────────────────────────

interface SampleColumn {
  name: string;
  type: string;
  pk?: boolean;
  fk?: { table: string; column: string };
  nullable?: boolean;
}
interface SampleTable {
  name: string;
  columns: SampleColumn[];
  rows: number;
}

const SAMPLE: SampleTable[] = [
  {
    name: 'users',
    rows: 1284,
    columns: [
      { name: 'id', type: 'int8', pk: true },
      { name: 'email', type: 'varchar(255)' },
      { name: 'full_name', type: 'text', nullable: true },
      {
        name: 'organization_id',
        type: 'int8',
        fk: { table: 'organizations', column: 'id' },
        nullable: true,
      },
      { name: 'is_active', type: 'bool' },
      { name: 'created_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'organizations',
    rows: 92,
    columns: [
      { name: 'id', type: 'int8', pk: true },
      { name: 'name', type: 'text' },
      { name: 'plan', type: 'varchar(32)' },
      { name: 'seats', type: 'int4' },
      { name: 'created_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'posts',
    rows: 8432,
    columns: [
      { name: 'id', type: 'int8', pk: true },
      { name: 'author_id', type: 'int8', fk: { table: 'users', column: 'id' } },
      { name: 'title', type: 'text' },
      { name: 'body', type: 'text', nullable: true },
      { name: 'published', type: 'bool' },
      { name: 'created_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'comments',
    rows: 23900,
    columns: [
      { name: 'id', type: 'int8', pk: true },
      { name: 'post_id', type: 'int8', fk: { table: 'posts', column: 'id' } },
      { name: 'user_id', type: 'int8', fk: { table: 'users', column: 'id' } },
      { name: 'body', type: 'text' },
      { name: 'created_at', type: 'timestamptz' },
    ],
  },
  {
    name: 'subscriptions',
    rows: 92,
    columns: [
      { name: 'id', type: 'int8', pk: true },
      { name: 'organization_id', type: 'int8', fk: { table: 'organizations', column: 'id' } },
      { name: 'amount', type: 'numeric(10,2)' },
      { name: 'status', type: 'varchar(20)' },
      { name: 'created_at', type: 'timestamptz' },
    ],
  },
];

function tableInfo(name: string): TableInfo {
  const t = SAMPLE.find((x) => x.name === name) ?? SAMPLE[0]!;
  return {
    schema: 'public',
    name: t.name,
    kind: 'table',
    estimatedRows: t.rows,
    sizeBytes: t.rows * 512,
    columns: t.columns.map((c, i) => ({
      name: c.name,
      dataType: c.type,
      udtName: c.type.replace(/\(.*\)/, ''),
      nullable: c.nullable ?? false,
      defaultValue: c.name === 'id' ? `nextval('${t.name}_id_seq')` : null,
      isPrimaryKey: c.pk ?? false,
      references: c.fk ? { schema: 'public', table: c.fk.table, column: c.fk.column } : undefined,
      position: i + 1,
    })),
    indexes: [
      {
        name: `${t.name}_pkey`,
        columns: ['id'],
        isUnique: true,
        isPrimary: true,
        method: 'btree',
        definition: `CREATE UNIQUE INDEX ${t.name}_pkey ON public.${t.name} USING btree (id)`,
      },
    ],
    constraints: [
      {
        name: `${t.name}_pkey`,
        type: 'primary_key',
        definition: 'PRIMARY KEY (id)',
        columns: ['id'],
      },
    ],
    triggers: [],
  };
}

function sampleValue(col: SampleColumn, rowIndex: number): Row[number] {
  const seed = rowIndex + 1;
  if (col.pk) return seed;
  if (col.fk) return ((rowIndex * 7) % 90) + 1;
  if (col.type.startsWith('bool')) return seed % 3 !== 0;
  if (col.type.startsWith('int') || col.type.startsWith('numeric')) {
    return col.name === 'amount' ? Number((19 + (seed % 80) + 0.99).toFixed(2)) : (seed % 500) + 1;
  }
  if (col.type.includes('timestamp')) {
    return new Date(Date.now() - seed * 3_600_000).toISOString();
  }
  switch (col.name) {
    case 'email':
      return `user${seed}@example.com`;
    case 'full_name':
      return ['Ada Lovelace', 'Alan Turing', 'Grace Hopper', 'Linus T.', 'Margaret H.'][seed % 5]!;
    case 'name':
      return ['Acme Inc', 'Globex', 'Initech', 'Umbrella', 'Hooli'][seed % 5]!;
    case 'plan':
    case 'status':
      return ['free', 'pro', 'team', 'enterprise'][seed % 4]!;
    case 'title':
      return `Post title #${seed}`;
    case 'body':
      return `Lorem ipsum dolor sit amet, content body number ${seed}.`;
    default:
      return `value_${seed}`;
  }
}

function buildPage(table: string, offset: number, limit: number) {
  const t = SAMPLE.find((x) => x.name === table) ?? SAMPLE[0]!;
  const fields = t.columns.map((c) => ({
    name: c.name,
    dataTypeId: 0,
    dataTypeName: c.type.replace(/\(.*\)/, ''),
  }));
  const total = t.rows;
  const count = Math.min(limit, Math.max(0, total - offset));
  const rows: Row[] = Array.from({ length: count }, (_, i) =>
    t.columns.map((c) => sampleValue(c, offset + i)),
  );
  return { fields, rows, estimatedTotal: total, executionMs: 4 + Math.random() * 6 };
}

// ─────────────────────────────── dispatcher ───────────────────────────────

const delay = (ms = 60) => new Promise((r) => setTimeout(r, ms));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: Record<string, (p: any) => unknown> = {
  'connections.list': () => ({ connections, folders }),
  'connections.save': ({ connection }) => {
    const isNew = !connection.id;
    const saved: Connection = {
      ...connection,
      id: connection.id || newId('conn'),
      createdAt: connection.createdAt || now(),
      updatedAt: now(),
    };
    connections = isNew
      ? [...connections, saved]
      : connections.map((c) => (c.id === saved.id ? saved : c));
    save('connections', connections);
    return { ...saved, config: stripConfigSecrets(saved.config) };
  },
  'connections.delete': ({ id }) => {
    connections = connections.filter((c) => c.id !== id);
    save('connections', connections);
  },
  'connections.duplicate': ({ id }) => {
    const src = connections.find((c) => c.id === id)!;
    const copy: Connection = {
      ...src,
      id: newId('conn'),
      name: `${src.name} copy`,
      isFavorite: false,
      createdAt: now(),
      updatedAt: now(),
    };
    connections = [...connections, copy];
    save('connections', connections);
    return copy;
  },
  'connections.test': async ({ config }) => {
    await delay(350);
    // When a connection string is supplied it is the source of truth — validate it the way the real
    // backend does (a parseable postgres:// URL) instead of blindly reporting success.
    if (config.connectionString) {
      try {
        const u = new URL(config.connectionString);
        if (!/^postgres(ql)?:$/.test(u.protocol) || !u.hostname) throw new Error('bad url');
      } catch {
        return {
          ok: false,
          error: 'Invalid connection string. Expected postgres://user:password@host:5432/database',
        };
      }
    } else if (!config.host) {
      return { ok: false, error: 'Host is required' };
    }
    const hops: SshHostConfig[] = config.ssh?.hops ?? [];
    const usesSsh = config.method && config.method !== 'direct' && hops.length > 0;
    if (usesSsh) {
      const bad = hops.findIndex((h) => !h.host || !h.username);
      if (bad >= 0) return { ok: false, error: `SSH hop ${bad + 1} needs a host and username` };
    }
    return {
      ok: true,
      latencyMs: 18 + Math.floor(Math.random() * 30),
      serverVersion: 'PostgreSQL 16.2 (mock)',
      // Surface a deterministic fake fingerprint per hop so the "pin host key" flow is explorable.
      sshHostFingerprints: usesSsh
        ? hops.map((h) => `SHA256:mock+${(h.host || 'host').slice(0, 12)}`)
        : undefined,
    };
  },
  'connections.saveFolder': ({ folder }) => {
    const saved = { ...folder, id: folder.id || newId('folder') };
    folders = folder.id ? folders.map((f) => (f.id === saved.id ? saved : f)) : [...folders, saved];
    save('folders', folders);
    return saved;
  },
  'connections.deleteFolder': ({ id }) => {
    folders = folders.filter((f) => f.id !== id);
    save('folders', folders);
  },

  'db.connect': ({ connectionId }) => {
    const conn = connections.find((c) => c.id === connectionId)!;
    return { sessionId: connectionId, dashboard: dashboard(conn) };
  },
  'db.disconnect': () => undefined,
  'db.dashboard': ({ connectionId }) => dashboard(connections.find((c) => c.id === connectionId)!),

  'schema.tree': ({ nodeId }) => schemaTree(nodeId),
  'schema.table': ({ table }) => tableInfo(table),
  'schema.snapshot': () => ({
    schemas: [{ name: 'public', owner: 'postgres', tableCount: SAMPLE.length, viewCount: 0 }],
    tables: SAMPLE.map((t) => tableInfo(t.name)),
    functions: [],
    extensions: [
      { name: 'pgcrypto', version: '1.3', schema: 'public' },
      { name: 'uuid-ossp', version: '1.1', schema: 'public' },
    ],
    capturedAt: now(),
  }),

  'query.execute': ({ sql, maxRows }) => executeQuery(sql, maxRows ?? 50_000),
  'query.explain': ({ sql }) => ({
    plan: [
      {
        Plan: {
          'Node Type': 'Seq Scan',
          'Relation Name': fromTable(sql) ?? 'users',
          'Plan Rows': 1284,
          'Total Cost': 24.5,
        },
      },
    ],
    text: `Seq Scan on ${fromTable(sql) ?? 'users'}  (cost=0.00..24.50 rows=1284 width=64)`,
  }),
  'query.estimateImpact': ({ sql }) => ({
    estimatedRows: SAMPLE.find((t) => t.name === fromTable(sql))?.rows ?? null,
  }),

  'table.page': ({ request }) => buildPage(request.table, request.offset, request.limit),
  'table.updateRow': () => undefined,
  'table.insertRow': () => undefined,
  'table.deleteRow': () => undefined,

  'history.list': ({ connectionId, search }) =>
    history
      .filter((h) => h.connectionId === connectionId && (!search || String(h.sql).includes(search)))
      .slice(0, 200),
  'history.add': ({ entry }) => {
    const saved = { ...entry, id: newId('hist') };
    history = [saved, ...history].slice(0, 500);
    save('history', history);
    return saved;
  },
  'history.toggleFavorite': ({ id }) => {
    history = history.map((h) => (h.id === id ? { ...h, isFavorite: !h.isFavorite } : h));
    save('history', history);
  },
  'history.clear': ({ connectionId }) => {
    history = history.filter((h) => h.connectionId !== connectionId || h.isFavorite);
    save('history', history);
  },

  'savedQueries.list': ({ connectionId }) => ({
    queries: savedQueries.filter((q) => q.connectionId === connectionId),
    folders: savedQueryFolders.filter((f) => f.connectionId === connectionId),
  }),
  'savedQueries.save': ({ query }) => {
    const saved = {
      ...query,
      id: query.id || newId('sq'),
      updatedAt: now(),
      createdAt: query.createdAt || now(),
    };
    savedQueries = query.id
      ? savedQueries.map((q) => (q.id === saved.id ? saved : q))
      : [...savedQueries, saved];
    save('savedQueries', savedQueries);
    return saved;
  },
  'savedQueries.delete': ({ id }) => {
    savedQueries = savedQueries.filter((q) => q.id !== id);
    save('savedQueries', savedQueries);
  },
  'savedQueries.duplicate': ({ id }) => {
    const src = savedQueries.find((q) => q.id === id)!;
    const copy = {
      ...src,
      id: newId('sq'),
      name: `${src.name} copy`,
      createdAt: now(),
      updatedAt: now(),
    };
    savedQueries = [...savedQueries, copy];
    save('savedQueries', savedQueries);
    return copy;
  },
  'savedQueries.saveFolder': ({ folder }) => {
    const saved = { ...folder, id: folder.id || newId('sqf') };
    savedQueryFolders = folder.id
      ? savedQueryFolders.map((f) => (f.id === saved.id ? saved : f))
      : [...savedQueryFolders, saved];
    save('savedQueryFolders', savedQueryFolders);
    return saved;
  },

  'export.query': ({ path }) => ({ path, rows: 0 }),
  'import.csv': () => ({ rowsImported: 0 }),

  'settings.get': () => settings,
  'settings.set': ({ settings: next }) => {
    settings = next;
    save('settings', settings);
    return settings;
  },

  // ── Analysis & operations ──────────────────────────────────────────────────
  'health.connection': ({ connectionId }) => {
    const prod = connections.find((c) => c.id === connectionId)?.environment === 'production';
    const active = prod ? 78 : 7;
    const max = 100;
    const status = active > 90 ? 'critical' : active > 70 ? 'warning' : 'healthy';
    return {
      status,
      pingMs: 12 + Math.floor(Math.random() * 20),
      activeConnections: active,
      idleConnections: prod ? 9 : 12,
      maxConnections: max,
      warnings:
        status !== 'healthy'
          ? [`High connection count (${Math.round((active / max) * 100)}% of max)`]
          : [],
    };
  },
  'health.score': () => ({
    score: 92,
    issues: [
      {
        category: 'missing_indexes',
        severity: 'warning',
        title: '2 missing indexes',
        detail: 'Foreign keys without a covering index on posts.author_id, comments.post_id.',
        count: 2,
      },
      {
        category: 'unused_indexes',
        severity: 'warning',
        title: '1 unused index',
        detail: 'idx_users_full_name has 0 scans since stats reset.',
        count: 1,
      },
      {
        category: 'dead_tuples',
        severity: 'healthy',
        title: 'Dead tuples low',
        detail: 'Autovacuum is keeping bloat in check.',
        count: 0,
      },
    ],
    categories: [
      { category: 'missing_indexes', label: 'Missing indexes', status: 'warning', value: '2' },
      { category: 'unused_indexes', label: 'Unused indexes', status: 'warning', value: '1' },
      { category: 'duplicate_indexes', label: 'Duplicate indexes', status: 'healthy', value: '0' },
      { category: 'table_bloat', label: 'Table bloat', status: 'healthy', value: 'Low' },
      { category: 'dead_tuples', label: 'Dead tuples', status: 'healthy', value: 'Low' },
      { category: 'slow_queries', label: 'Slow queries', status: 'healthy', value: '0' },
    ],
  }),
  'indexes.inspect': () => ({
    indexes: SAMPLE.map((t) => ({
      schema: 'public',
      table: t.name,
      name: `${t.name}_pkey`,
      columns: ['id'],
      sizeBytes: t.rows * 24,
      usageCount: 1000 + Math.floor(Math.random() * 9000),
      isUnique: true,
      isPrimary: true,
    })).concat([
      {
        schema: 'public',
        table: 'users',
        name: 'idx_users_full_name',
        columns: ['full_name'],
        sizeBytes: 40960,
        usageCount: 0,
        isUnique: false,
        isPrimary: false,
      },
    ]),
    recommendations: [
      {
        reason: 'missing',
        schema: 'public',
        table: 'posts',
        message: 'Foreign key author_id has no covering index.',
        statement: 'CREATE INDEX idx_posts_author_id ON public.posts (author_id);',
      },
      {
        reason: 'missing',
        schema: 'public',
        table: 'comments',
        message: 'Foreign key post_id has no covering index.',
        statement: 'CREATE INDEX idx_comments_post_id ON public.comments (post_id);',
      },
      {
        reason: 'unused',
        schema: 'public',
        table: 'users',
        message: 'idx_users_full_name is unused (0 scans).',
        statement: 'DROP INDEX public.idx_users_full_name;',
      },
    ],
  }),
  'performance.queries': () => ({
    available: true,
    slow: [
      {
        query:
          'SELECT * FROM comments JOIN posts ON comments.post_id = posts.id WHERE posts.published',
        calls: 142,
        totalMs: 48210,
        meanMs: 339.5,
        maxMs: 1204,
        rows: 23900,
      },
      {
        query: 'SELECT count(*) FROM users WHERE created_at > now() - interval $1',
        calls: 89,
        totalMs: 12030,
        meanMs: 135.2,
        maxMs: 410,
        rows: 89,
      },
    ],
    frequent: [
      {
        query: 'SELECT * FROM users WHERE id = $1',
        calls: 184320,
        totalMs: 9210,
        meanMs: 0.05,
        maxMs: 12,
        rows: 184320,
      },
      {
        query: 'SELECT * FROM organizations WHERE id = $1',
        calls: 92110,
        totalMs: 5120,
        meanMs: 0.06,
        maxMs: 9,
        rows: 92110,
      },
    ],
    longRunning: [
      {
        query: 'REFRESH MATERIALIZED VIEW analytics_daily',
        calls: 30,
        totalMs: 90400,
        meanMs: 3013.3,
        maxMs: 5200,
        rows: 0,
      },
    ],
  }),
  'timeline.list': ({ search }) => {
    const events = [
      {
        id: 't1',
        at: new Date(Date.now() - 2 * 3600_000).toISOString(),
        action: 'create_index',
        objectType: 'index',
        object: 'idx_posts_author_id',
        detail: 'CREATE INDEX on posts(author_id)',
      },
      {
        id: 't2',
        at: new Date(Date.now() - 26 * 3600_000).toISOString(),
        action: 'add_column',
        objectType: 'column',
        object: 'users.last_login_at',
        detail: 'timestamptz NULL',
      },
      {
        id: 't3',
        at: new Date(Date.now() - 3 * 86400_000).toISOString(),
        action: 'create_table',
        objectType: 'table',
        object: 'subscriptions',
        detail: '5 columns',
      },
      {
        id: 't4',
        at: new Date(Date.now() - 9 * 86400_000).toISOString(),
        action: 'drop_column',
        objectType: 'column',
        object: 'organizations.legacy_plan',
      },
      {
        id: 't5',
        at: new Date(Date.now() - 20 * 86400_000).toISOString(),
        action: 'create_table',
        objectType: 'table',
        object: 'comments',
        detail: '5 columns',
      },
    ];
    return search
      ? events.filter((e) => e.object.includes(search) || e.action.includes(search))
      : events;
  },

  'monitoring.sample': ({ connectionId }) => monitoringSample(connectionId),

  'dashboards.list': ({ connectionId }) =>
    dashboards.filter((d) => d.connectionId === connectionId),
  'dashboards.save': ({ dashboard }) => {
    const isNew = !dashboard.id;
    const saved = {
      ...dashboard,
      id: dashboard.id || newId('dash'),
      createdAt: dashboard.createdAt || now(),
      updatedAt: now(),
    };
    dashboards = isNew
      ? [...dashboards, saved]
      : dashboards.map((d) => (d.id === saved.id ? saved : d));
    save('dashboards', dashboards);
    return saved;
  },
  'dashboards.delete': ({ id }) => {
    dashboards = dashboards.filter((d) => d.id !== id);
    save('dashboards', dashboards);
  },

  'safety.deleteImpact': ({ schema, table, operation }) => {
    const t = SAMPLE.find((x) => x.name === table);
    const deps = SAMPLE.flatMap((other) =>
      other.columns
        .filter((c) => c.fk?.table === table)
        .map((c) => `${other.name}.${c.name} → ${table}.${c.fk!.column}`),
    );
    return {
      operation,
      schema,
      table,
      estimatedRows: t?.rows ?? null,
      dependencies: deps,
      confirmationPhrase: `${operation === 'TRUNCATE' ? 'TRUNCATE' : operation === 'DROP' ? 'DROP TABLE' : 'DELETE'} ${table}`,
    };
  },

  'backups.list': ({ connectionId }) =>
    load<Record<string, unknown>[]>(`backups:${connectionId}`, []),
  'backups.create': ({ connectionId, scope, format }) => {
    const record = {
      id: newId('bak'),
      connectionId,
      scope,
      format,
      sizeBytes: Math.floor(
        (scope === 'schema_only' ? 0.4 : 248) * 1024 * 1024 * (0.8 + Math.random() * 0.4),
      ),
      status: 'complete',
      createdAt: now(),
      path: `swyftgrid-${scope}-${Date.now()}.${format === 'custom' ? 'dump' : 'sql'}`,
    };
    const list = load<Record<string, unknown>[]>(`backups:${connectionId}`, []);
    save(`backups:${connectionId}`, [record, ...list]);
    return record;
  },
  'backups.delete': ({ id }) => {
    for (const c of connections) {
      const key = `backups:${c.id}`;
      const list = load<Record<string, unknown>[]>(key, []);
      if (list.some((b) => b.id === id))
        save(
          key,
          list.filter((b) => b.id !== id),
        );
    }
  },
  'backups.restore': async ({ fileName }) => {
    await delay(600);
    return { ok: true, message: `Restored from ${fileName} (mock).` };
  },

  'diff.schema': () => ({
    sourceLabel: 'source',
    targetLabel: 'target',
    entries: [
      {
        change: 'added',
        objectType: 'table',
        object: 'audit_log',
        detail: 'Table exists in source but not target.',
      },
      {
        change: 'added',
        objectType: 'column',
        object: 'users.last_login_at',
        detail: 'Column missing in target.',
        after: 'timestamptz',
      },
      {
        change: 'changed',
        objectType: 'column',
        object: 'organizations.seats',
        detail: 'Type changed.',
        before: 'int4',
        after: 'int8',
      },
      {
        change: 'removed',
        objectType: 'index',
        object: 'idx_comments_user_id',
        detail: 'Index present in target only.',
      },
    ],
    migrationSql:
      '-- Migration: align target with source\nCREATE TABLE audit_log (\n  id bigserial PRIMARY KEY,\n  actor text,\n  action text,\n  created_at timestamptz DEFAULT now()\n);\nALTER TABLE users ADD COLUMN last_login_at timestamptz;\nALTER TABLE organizations ALTER COLUMN seats TYPE int8;\nDROP INDEX IF EXISTS idx_comments_user_id;',
  }),
  'diff.data': ({ table }) => ({
    table,
    added: 12,
    removed: 3,
    modified: 5,
    rows: [
      { change: 'added', key: 'id=1042', detail: 'Row exists in source only.' },
      { change: 'removed', key: 'id=88', detail: 'Row exists in target only.' },
      { change: 'modified', key: 'id=17', detail: "email: 'a@x.com' → 'a@y.com'" },
      { change: 'modified', key: 'id=23', detail: 'is_active: true → false' },
    ],
  }),

  'ai.run': async ({ feature, prompt }) => {
    await delay(500);
    return aiMockResult(feature, prompt);
  },

  'search.data': ({ term, limit }) => {
    const q = String(term).toLowerCase();
    if (q.length < 2) return [];
    const cap = limit ?? 50;
    const hits: { schema: string; table: string; column: string; value: string }[] = [];
    for (const t of SAMPLE) {
      for (let i = 0; i < Math.min(t.rows, 400) && hits.length < cap; i++) {
        for (const c of t.columns) {
          const v = sampleValue(c, i);
          if (v !== null && String(v).toLowerCase().includes(q)) {
            hits.push({
              schema: 'public',
              table: t.name,
              column: c.name,
              value: String(v).slice(0, 80),
            });
            break;
          }
        }
      }
    }
    return hits.slice(0, cap);
  },
};

function aiMockResult(
  feature: string,
  prompt: string,
): { text: string; sql?: string; warnings?: string[] } {
  switch (feature) {
    case 'nl_to_sql':
      return {
        text: `Here's a query for: _${prompt}_`,
        sql: "SELECT id, email, created_at\nFROM users\nWHERE created_at >= now() - interval '7 days'\nORDER BY created_at DESC;",
      };
    case 'explain_sql':
      return {
        text: 'This query selects recent users: it filters `users` to rows created in the last 7 days and orders them newest-first. It scans on `created_at`, which benefits from an index.',
      };
    case 'optimize_query':
      return {
        text: 'Add an index on `created_at` and select only needed columns. Avoid `SELECT *` for wide tables.',
        sql: 'CREATE INDEX idx_users_created_at ON users (created_at);',
      };
    case 'explain_error':
      return {
        text: '**42P01 — undefined_table**: PostgreSQL could not find the referenced table. Check the spelling and the `search_path`, and confirm the table exists in the expected schema.',
      };
    case 'schema_understanding':
      return {
        text: 'Authentication centers on `users`. Each user belongs to an `organization` (FK `users.organization_id`). Sessions/credentials would typically reference `users.id`. There is no dedicated `sessions` table in this schema.',
      };
    case 'data_discovery':
      return {
        text: 'Subscription records are stored in the **`subscriptions`** table, linked to `organizations` via `organization_id`. Amounts are in `subscriptions.amount` (numeric) with a `status` column.',
      };
    case 'documentation':
      return {
        text: '# Schema Documentation\n\n## users\nApplication users.\n\n| Column | Type | Notes |\n|---|---|---|\n| id | int8 | PK |\n| email | varchar(255) | |\n| organization_id | int8 | FK → organizations.id |\n\n## organizations\nTenant accounts…',
      };
    case 'migration':
      return {
        text: 'Migration to add a user preferences table:',
        sql: "CREATE TABLE user_preferences (\n  user_id int8 PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,\n  theme text NOT NULL DEFAULT 'system',\n  email_opt_in boolean NOT NULL DEFAULT true,\n  updated_at timestamptz NOT NULL DEFAULT now()\n);",
      };
    case 'refactor':
      return {
        text: 'Rewritten to avoid a correlated subquery and use a join:',
        sql: 'SELECT u.id, u.email, o.name AS org\nFROM users u\nJOIN organizations o ON o.id = u.organization_id;',
      };
    case 'test_data':
      return {
        text: 'Generated 3 sample rows for `users`:',
        sql: "INSERT INTO users (email, full_name, is_active, created_at) VALUES\n  ('ada@example.com', 'Ada Lovelace', true, now()),\n  ('alan@example.com', 'Alan Turing', true, now()),\n  ('grace@example.com', 'Grace Hopper', false, now());",
      };
    case 'business_question':
      return {
        text: '**Answer:** 1,284 paying customers signed up last month.\n\nGenerated query:',
        sql: "SELECT count(*)\nFROM organizations\nWHERE plan <> 'free'\n  AND created_at >= date_trunc('month', now() - interval '1 month')\n  AND created_at < date_trunc('month', now());",
      };
    case 'query_review':
      return {
        text: 'This statement deletes from `users` without a `WHERE` clause — it would remove **every row**. Add a predicate or wrap it in a transaction you can roll back.',
        warnings: ['Mass delete: no WHERE clause', 'Full table scan'],
      };
    default:
      return { text: `(${feature}) ${prompt}` };
  }
}

function dashboard(conn: Connection) {
  return {
    databaseName: conn.config.database,
    sizeBytes: 248 * 1024 * 1024,
    tableCount: SAMPLE.length,
    schemaCount: 1,
    viewCount: 2,
    activeConnections: 7,
    serverVersion: 'PostgreSQL 16.2 on x86_64-pc-linux-gnu (mock)',
    lastConnectedAt: now(),
    largestTables: [...SAMPLE]
      .sort((a, b) => b.rows - a.rows)
      .slice(0, 5)
      .map((t) => ({ schema: 'public', table: t.name, sizeBytes: t.rows * 512 })),
  };
}

function schemaTree(nodeId?: string) {
  if (!nodeId) {
    return [
      { id: 'schema:public', kind: 'schema', label: 'public', schema: 'public', expandable: true },
    ];
  }
  if (nodeId === 'schema:public') {
    return [
      {
        id: 'group:public:tables',
        kind: 'group',
        label: 'Tables',
        groupKind: 'table',
        schema: 'public',
        expandable: true,
      },
      {
        id: 'group:public:views',
        kind: 'group',
        label: 'Views',
        groupKind: 'view',
        schema: 'public',
        expandable: true,
      },
      {
        id: 'group:public:functions',
        kind: 'group',
        label: 'Functions',
        groupKind: 'function',
        schema: 'public',
        expandable: true,
      },
      {
        id: 'group:public:extensions',
        kind: 'group',
        label: 'Extensions',
        groupKind: 'extension',
        schema: 'public',
        expandable: true,
      },
    ];
  }
  if (nodeId === 'group:public:tables') {
    return SAMPLE.map((t) => ({
      id: `table:public:${t.name}`,
      kind: 'table' as const,
      label: t.name,
      schema: 'public',
      expandable: false,
    }));
  }
  if (nodeId === 'group:public:extensions') {
    return ['pgcrypto', 'uuid-ossp'].map((name) => ({
      id: `extension:${name}`,
      kind: 'extension' as const,
      label: name,
      schema: 'public',
      expandable: false,
    }));
  }
  return [];
}

function fromTable(sql: string): string | undefined {
  const m = /from\s+(?:public\.)?["']?(\w+)/i.exec(sql);
  return m?.[1];
}

/**
 * Recognise a small set of aggregate query shapes (`count(*)`, `sum`, `avg`, optional `GROUP BY`)
 * and synthesise a believable result from the sample data, so the SQL editor and dashboard charts
 * demo well in the browser. Returns `null` for anything it doesn't understand (falls back to a page).
 */
function tryAggregate(sql: string): { fields: MockField[]; rows: Row[] } | null {
  const table = fromTable(sql);
  const t = SAMPLE.find((x) => x.name === table);
  if (!t) return null;

  const isCount = /\bcount\s*\(/i.test(sql);
  const sumCol = /\bsum\s*\(\s*([a-z_]\w*)\s*\)/i.exec(sql)?.[1];
  const avgCol = /\bavg\s*\(\s*([a-z_]\w*)\s*\)/i.exec(sql)?.[1];
  if (!isCount && !sumCol && !avgCol) return null;

  const aggName = isCount ? 'count' : sumCol ? 'sum' : 'avg';
  const valueColName = sumCol ?? avgCol;
  const valueCol = valueColName ? t.columns.find((c) => c.name === valueColName) : undefined;
  const sampleN = Math.min(t.rows, 600);
  const scale = t.rows / sampleN;
  const numVal = (i: number) => {
    const v = valueCol ? sampleValue(valueCol, i) : 0;
    return typeof v === 'number' ? v : 0;
  };

  const groupColName = /\bgroup\s+by\s+([a-z_]\w*)/i.exec(sql)?.[1];
  if (!groupColName) {
    let value: number;
    if (isCount) value = t.rows;
    else {
      let total = 0;
      for (let i = 0; i < sampleN; i++) total += numVal(i);
      value = aggName === 'avg' ? Number((total / sampleN).toFixed(2)) : Math.round(total * scale);
    }
    return { fields: [{ name: aggName, dataTypeId: 0, dataTypeName: 'numeric' }], rows: [[value]] };
  }

  const groupCol = t.columns.find((c) => c.name === groupColName);
  if (!groupCol) return null;
  const buckets = new Map<string, { sum: number; count: number }>();
  for (let i = 0; i < sampleN; i++) {
    const key = String(sampleValue(groupCol, i));
    const cur = buckets.get(key) ?? { sum: 0, count: 0 };
    cur.count += 1;
    cur.sum += numVal(i);
    buckets.set(key, cur);
  }
  const rows: Row[] = [...buckets.entries()].map(([k, v]) => {
    const value =
      aggName === 'count'
        ? Math.round(v.count * scale)
        : aggName === 'avg'
          ? Number((v.sum / v.count).toFixed(2))
          : Math.round(v.sum * scale);
    return [k, value];
  });
  return {
    fields: [
      { name: groupColName, dataTypeId: 0, dataTypeName: 'text' },
      { name: aggName, dataTypeId: 0, dataTypeName: 'numeric' },
    ],
    rows,
  };
}

interface MockField {
  name: string;
  dataTypeId: number;
  dataTypeName: string;
}

// Smooth per-connection state so simulated CPU/memory drift like a real server rather than jitter.
const monState = new Map<string, { cpu: number; mem: number; disk: number }>();

function monitoringSample(connectionId: string) {
  const conn = connections.find((c) => c.id === connectionId);
  const prod = conn?.environment === 'production';
  let s = monState.get(connectionId);
  if (!s) {
    s = { cpu: prod ? 52 : 16, mem: prod ? 66 : 40, disk: prod ? 71 : 47 };
    monState.set(connectionId, s);
  }
  const drift = (v: number, min: number, max: number, step: number) =>
    Math.max(min, Math.min(max, v + (Math.random() - 0.5) * step));
  s.cpu = drift(s.cpu, 3, 97, prod ? 16 : 9);
  s.mem = drift(s.mem, 22, 94, 5);
  s.disk = Math.min(99, s.disk + Math.random() * 0.03);

  const totalMem = 16 * 1024 ** 3;
  const totalDisk = 512 * 1024 ** 3;
  const active = Math.round(prod ? 28 + Math.random() * 52 : 2 + Math.random() * 8);
  const idle = Math.round(prod ? 8 + Math.random() * 14 : 4 + Math.random() * 8);
  const tps = prod ? 120 + Math.random() * 420 : 4 + Math.random() * 28;
  return {
    at: now(),
    activeConnections: active,
    idleConnections: idle,
    totalConnections: active + idle,
    maxConnections: 100,
    databaseSizeBytes: 248 * 1024 * 1024,
    cacheHitRatio: Number((96 + Math.random() * 3.5).toFixed(2)),
    transactionsPerSec: Number(tps.toFixed(1)),
    cpu: { percent: Number(s.cpu.toFixed(1)) },
    memory: {
      percent: Number(s.mem.toFixed(1)),
      usedBytes: Math.round((totalMem * s.mem) / 100),
      totalBytes: totalMem,
    },
    disk: {
      percent: Number(s.disk.toFixed(1)),
      usedBytes: Math.round((totalDisk * s.disk) / 100),
      totalBytes: totalDisk,
    },
    resourceSource: 'simulated' as const,
  };
}

function executeQuery(sql: string, maxRows: number) {
  const started = performance.now();
  const trimmed = sql.trim().replace(/;\s*$/, '');
  const isSelect = /^\s*(select|with|explain|show|table)\b/i.test(trimmed);

  if (!isSelect) {
    return {
      statements: [
        {
          sql: trimmed,
          result: {
            fields: [],
            rows: [],
            rowsAffected: Math.floor(Math.random() * 5) + 1,
            executionMs: performance.now() - started,
            commandTag: trimmed.split(/\s+/)[0]?.toUpperCase() ?? 'OK',
            truncated: false,
          },
        },
      ],
      totalMs: performance.now() - started,
    };
  }

  const table = fromTable(trimmed);
  const agg = tryAggregate(trimmed);
  const page = agg ?? buildPage(table ?? 'users', 0, Math.min(maxRows, 200));
  return {
    statements: [
      {
        sql: trimmed,
        result: {
          fields: page.fields,
          rows: page.rows,
          rowsAffected: null,
          executionMs: performance.now() - started,
          commandTag: `SELECT ${page.rows.length}`,
          truncated: page.rows.length >= maxRows,
        },
      },
    ],
    totalMs: performance.now() - started,
  };
}

/** Mock implementation of {@link invoke}. */
export async function mockInvoke<K extends IpcCommand>(
  command: K,
  params: IpcParams<K>,
): Promise<IpcResult<K>> {
  const handler = handlers[command];
  if (!handler) throw { message: `Mock backend: no handler for "${command}"` };
  await delay(command.startsWith('connections') ? 30 : 50);
  return handler(params ?? {}) as IpcResult<K>;
}
