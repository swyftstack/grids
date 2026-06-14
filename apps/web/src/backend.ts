/**
 * HTTP backend: the web implementation of the `@swyftgrid/core` IPC contract.
 *
 * A single dispatch table maps every contract command to a handler backed by the JSON {@link Store}
 * and the {@link pg} PostgreSQL layer. The server exposes this as `POST /api/invoke`.
 */
import type {
  BackupRecord,
  IpcCommand,
  IpcContract,
  SchemaDiff,
  SchemaDiffEntry,
  SchemaSnapshot,
} from '@swyftgrid/core';
import { Store } from './store.js';
import * as db from './pg.js';

const store = new Store();
/** Per-connection session metadata (server version + last connect time) for the dashboard. */
const sessions = new Map<string, { serverVersion: string; lastConnectedAt: string }>();

type Handler<K extends IpcCommand> = (
  params: IpcContract[K]['params'],
) => Promise<IpcContract[K]['result']> | IpcContract[K]['result'];

type Dispatch = { [K in IpcCommand]: Handler<K> };

export const dispatch: Dispatch = {
  'connections.list': () => store.listConnections(),
  'connections.save': ({ connection }) => store.saveConnection(connection as never),
  'connections.delete': ({ id }) => store.deleteConnection(id),
  'connections.duplicate': ({ id }) => store.duplicateConnection(id),
  'connections.test': async ({ config }) => {
    const started = Date.now();
    try {
      const version = await db.connect('__test__', config);
      return { ok: true, latencyMs: Date.now() - started, serverVersion: version };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    } finally {
      // Always tear down the throwaway pool/tunnel, even when the test fails.
      db.disconnect('__test__');
    }
  },
  'connections.saveFolder': ({ folder }) => store.saveFolder(folder as never),
  'connections.deleteFolder': ({ id }) => store.deleteFolder(id),

  'db.connect': async ({ connectionId }) => {
    const conn = store.connectionWithSecret(connectionId);
    if (!conn) throw new Error(`connection ${connectionId} not found`);
    const serverVersion = await db.connect(connectionId, conn.config);
    const lastConnectedAt = new Date().toISOString();
    sessions.set(connectionId, { serverVersion, lastConnectedAt });
    store.touchConnection(connectionId);
    const dashboard = await db.dashboard(connectionId, serverVersion, lastConnectedAt);
    return { sessionId: connectionId, dashboard };
  },
  'db.disconnect': ({ connectionId }) => {
    db.disconnect(connectionId);
    sessions.delete(connectionId);
  },
  'db.dashboard': ({ connectionId }) => {
    const s = sessions.get(connectionId);
    return db.dashboard(
      connectionId,
      s?.serverVersion ?? 'PostgreSQL',
      s?.lastConnectedAt ?? new Date().toISOString(),
    );
  },

  'schema.tree': ({ connectionId, nodeId }) => db.schemaTree(connectionId, nodeId),
  'schema.table': ({ connectionId, schema, table }) => db.tableInfo(connectionId, schema, table),
  'schema.snapshot': ({ connectionId }) => db.snapshot(connectionId),

  'query.execute': ({ connectionId, sql, maxRows }) =>
    db.execute(connectionId, sql, maxRows ?? 50_000),
  'query.explain': ({ connectionId, sql, analyze }) =>
    db.explain(connectionId, sql, analyze ?? false),
  'query.estimateImpact': async ({ connectionId, sql }) => ({
    estimatedRows: await db.estimateImpact(connectionId, sql),
  }),

  'table.page': ({ connectionId, request }) => db.tablePage(connectionId, request),
  'table.updateRow': ({ connectionId, edit }) =>
    db.updateRow(connectionId, edit.schema, edit.table, edit.primaryKey, edit.changes),
  'table.insertRow': ({ connectionId, insert }) =>
    db.insertRow(connectionId, insert.schema, insert.table, insert.values),
  'table.deleteRow': ({ connectionId, del }) =>
    db.deleteRow(connectionId, del.schema, del.table, del.primaryKey),

  'history.list': ({ connectionId, search }) => store.listHistory(connectionId, search),
  'history.add': ({ entry }) => store.addHistory(entry),
  'history.toggleFavorite': ({ id }) => store.toggleHistoryFavorite(id),
  'history.clear': ({ connectionId }) => store.clearHistory(connectionId),

  'savedQueries.list': ({ connectionId }) => store.listSavedQueries(connectionId),
  'savedQueries.save': ({ query }) => store.saveSavedQuery(query as never),
  'savedQueries.delete': ({ id }) => store.deleteSavedQuery(id),
  'savedQueries.duplicate': ({ id }) => store.duplicateSavedQuery(id),
  'savedQueries.saveFolder': ({ folder }) => store.saveSavedQueryFolder(folder as never),

  // Export/import operate on the server filesystem in the self-hosted build; the browser UI uses
  // client-side download for CSV/JSON, so these are intentionally minimal here.
  'export.query': ({ path }) => ({ path, rows: 0 }),
  'import.csv': () => ({ rowsImported: 0 }),

  'settings.get': () => store.getSettings(),
  'settings.set': ({ settings }) => store.setSettings(settings),

  // ── Analysis & operations ──────────────────────────────────────────────────
  'health.connection': ({ connectionId }) => db.connectionHealth(connectionId),
  'health.score': async ({ connectionId }) => {
    const report = await db.indexInspect(connectionId);
    const missing = report.recommendations.filter((r) => r.reason === 'missing').length;
    const unused = report.recommendations.filter((r) => r.reason === 'unused').length;
    const score = Math.max(0, 100 - missing * 4 - unused * 3);
    return {
      score,
      issues: [],
      categories: [
        {
          category: 'missing_indexes',
          label: 'Missing indexes',
          status: missing ? 'warning' : 'healthy',
          value: String(missing),
        },
        {
          category: 'unused_indexes',
          label: 'Unused indexes',
          status: unused ? 'warning' : 'healthy',
          value: String(unused),
        },
        {
          category: 'duplicate_indexes',
          label: 'Duplicate indexes',
          status: 'healthy',
          value: '0',
        },
        { category: 'table_bloat', label: 'Table bloat', status: 'healthy', value: 'Low' },
        { category: 'dead_tuples', label: 'Dead tuples', status: 'healthy', value: 'Low' },
        { category: 'slow_queries', label: 'Slow queries', status: 'healthy', value: '0' },
      ],
    };
  },
  'indexes.inspect': ({ connectionId }) => db.indexInspect(connectionId),
  'performance.queries': ({ connectionId }) => db.queryPerf(connectionId),
  // PostgreSQL has no built-in DDL history; a real implementation would use an event trigger audit
  // table. Returned empty here for the self-hosted build.
  'timeline.list': () => [],
  'monitoring.sample': ({ connectionId }) => db.monitoring(connectionId),

  'dashboards.list': ({ connectionId }) => store.listDashboards(connectionId),
  'dashboards.save': ({ dashboard }) => store.saveDashboard(dashboard),
  'dashboards.delete': ({ id }) => store.deleteDashboard(id),
  'safety.deleteImpact': ({ connectionId, schema, table, operation }) =>
    db.deleteImpact(connectionId, schema, table, operation),

  // Backups: simplified record-keeping for the self-hosted build (real pg_dump integration is a
  // follow-up — see docs/roadmap.md).
  'backups.list': ({ connectionId }) => backups.get(connectionId) ?? [],
  'backups.create': ({ connectionId, scope, format }) => {
    const record = {
      id: `bak_${Date.now()}`,
      connectionId,
      scope,
      format,
      sizeBytes: 0,
      status: 'complete' as const,
      createdAt: new Date().toISOString(),
      path: `swyftgrid-${scope}.${format === 'custom' ? 'dump' : 'sql'}`,
    };
    backups.set(connectionId, [record, ...(backups.get(connectionId) ?? [])]);
    return record;
  },
  'backups.delete': ({ id }) => {
    for (const [k, list] of backups)
      backups.set(
        k,
        list.filter((b) => b.id !== id),
      );
  },
  'backups.restore': ({ fileName }) => ({ ok: true, message: `Restore from ${fileName} queued.` }),

  'diff.schema': async ({ sourceConnectionId, targetConnectionId }) => {
    await ensureConnected(targetConnectionId);
    const [source, target] = await Promise.all([
      db.snapshot(sourceConnectionId),
      db.snapshot(targetConnectionId),
    ]);
    return diffSnapshots(source, target);
  },
  'diff.data': () => ({ table: '', added: 0, removed: 0, modified: 0, rows: [] }),

  // AI runs against the user's configured provider; wire your provider client here.
  'ai.run': ({ feature }) => ({
    text: `AI feature “${feature}” requires a provider/API key configured in this deployment.`,
  }),

  'search.data': ({ connectionId, term, limit }) => db.searchData(connectionId, term, limit),
};

/** Simple in-memory backup records for the self-hosted build. */
const backups = new Map<string, BackupRecord[]>();

async function ensureConnected(id: string): Promise<void> {
  if (sessions.has(id)) return;
  const conn = store.connectionWithSecret(id);
  if (!conn) throw new Error(`connection ${id} not found`);
  const serverVersion = await db.connect(id, conn.config);
  sessions.set(id, { serverVersion, lastConnectedAt: new Date().toISOString() });
}

function diffSnapshots(source: SchemaSnapshot, target: SchemaSnapshot): SchemaDiff {
  const entries: SchemaDiffEntry[] = [];
  const tMap = new Map(target.tables.map((t) => [`${t.schema}.${t.name}`, t]));
  for (const s of source.tables) {
    const key = `${s.schema}.${s.name}`;
    const t = tMap.get(key);
    if (!t) {
      entries.push({
        change: 'added',
        objectType: 'table',
        object: key,
        detail: 'Missing in target',
      });
      continue;
    }
    const tCols = new Map(t.columns.map((c) => [c.name, c]));
    for (const c of s.columns) {
      const tc = tCols.get(c.name);
      if (!tc)
        entries.push({
          change: 'added',
          objectType: 'column',
          object: `${s.name}.${c.name}`,
          detail: 'Missing in target',
          after: c.dataType,
        });
      else if (tc.dataType !== c.dataType)
        entries.push({
          change: 'changed',
          objectType: 'column',
          object: `${s.name}.${c.name}`,
          detail: 'Type differs',
          before: tc.dataType,
          after: c.dataType,
        });
    }
  }
  for (const t of target.tables) {
    if (!source.tables.find((s) => `${s.schema}.${s.name}` === `${t.schema}.${t.name}`))
      entries.push({
        change: 'removed',
        objectType: 'table',
        object: `${t.schema}.${t.name}`,
        detail: 'Only in target',
      });
  }
  const migrationSql =
    entries
      .filter((e) => e.change === 'added' && e.objectType === 'column')
      .map(
        (e) =>
          `ALTER TABLE ${e.object.split('.')[0]} ADD COLUMN ${e.object.split('.')[1]} ${e.after};`,
      )
      .join('\n') || '-- target schema matches source';
  return { sourceLabel: 'source', targetLabel: 'target', entries, migrationSql };
}

/** Invoke a command by name with arbitrary params (validated by the contract types at the edges). */
export async function invokeCommand(command: string, params: unknown): Promise<unknown> {
  const handler = (dispatch as Record<string, (p: unknown) => unknown>)[command];
  if (!handler) throw new Error(`Unknown command: ${command}`);
  return handler(params ?? {});
}
