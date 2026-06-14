/**
 * High-level workspace actions shared by the top nav, sidebar, command palette, schema explorer,
 * and universal search.
 *
 * By default actions **navigate within the current tab** (IDE-style single-click) to avoid tab
 * explosion. Pass `{ newTab: true }` (right-click → Open in New Tab) to force a new tab.
 */
import type { CellValue } from '@swyftgrid/core';
import { useConnections } from '@/stores/connections';
import { useWorkspace, tabIds, type Tab } from '@/stores/workspace';

export interface OpenOpts {
  newTab?: boolean;
}

function go(tab: Tab, opts?: OpenOpts): void {
  const ws = useWorkspace.getState();
  if (opts?.newTab) ws.open(tab);
  else ws.navigate(tab);
}

function connName(connectionId: string): string {
  return (
    useConnections.getState().connections.find((c) => c.id === connectionId)?.name ?? 'Database'
  );
}

export function openConnections(opts?: OpenOpts): void {
  go({ id: tabIds.connections(), kind: 'connections', title: 'Connections' }, opts);
}

export function openSettings(opts?: OpenOpts): void {
  go({ id: tabIds.settings(), kind: 'settings', title: 'Settings' }, opts);
}

export function openDashboard(connectionId: string, opts?: OpenOpts): void {
  go(
    {
      id: tabIds.dashboard(connectionId),
      kind: 'dashboard',
      title: connName(connectionId),
      connectionId,
    },
    opts,
  );
}

export function openTables(connectionId: string, opts?: OpenOpts): void {
  go({ id: tabIds.tables(connectionId), kind: 'tables', title: 'Tables', connectionId }, opts);
}

/** Sub-views hosted inside the unified Schema tab. */
export type SchemaSubView = 'tables' | 'sql' | 'diagram' | 'changes';
/** Sub-views hosted inside the unified Performance tab. */
export type PerfSubView = 'performance' | 'health' | 'monitoring';

/** Focus an existing tab's sub-view (so deep links update an already-open tab). */
function applyView(id: string, view: string): void {
  useWorkspace.getState().update(id, { payload: { view } });
}

export function openSchema(connectionId: string, opts?: OpenOpts & { view?: SchemaSubView }): void {
  const view = opts?.view ?? 'tables';
  const id = tabIds.schema(connectionId);
  go({ id, kind: 'schema', title: 'Schema', connectionId, payload: { view } }, opts);
  applyView(id, view);
}

export function openEditor(
  connectionId: string,
  sql?: string,
  key?: string,
  opts?: OpenOpts,
): void {
  go(
    {
      id: tabIds.editor(connectionId, key),
      kind: 'editor',
      title: 'SQL Editor',
      connectionId,
      payload: sql ? { sql } : undefined,
    },
    opts,
  );
}

export function openTable(
  connectionId: string,
  schema: string,
  table: string,
  opts?: OpenOpts & { filterColumn?: string; filterValue?: CellValue },
): void {
  go(
    {
      id: tabIds.table(connectionId, schema, table),
      kind: 'table',
      title: table,
      connectionId,
      payload: {
        schema,
        table,
        ...(opts?.filterColumn
          ? { filterColumn: opts.filterColumn, filterValue: opts.filterValue }
          : {}),
      },
    },
    opts,
  );
}

/** The ER diagram is a sub-view of the unified Schema tab. */
export function openErd(connectionId: string, opts?: OpenOpts): void {
  openSchema(connectionId, { ...opts, view: 'diagram' });
}

/** Schema changes (timeline) is a sub-view of the unified Schema tab. */
export function openTimeline(connectionId: string, opts?: OpenOpts): void {
  openSchema(connectionId, { ...opts, view: 'changes' });
}

export function openPerformance(
  connectionId: string,
  opts?: OpenOpts & { view?: PerfSubView },
): void {
  const view = opts?.view ?? 'performance';
  const id = tabIds.performance(connectionId);
  go({ id, kind: 'performance', title: 'Performance', connectionId, payload: { view } }, opts);
  applyView(id, view);
}

/** Health is a sub-view of the unified Performance tab. */
export function openHealth(connectionId: string, opts?: OpenOpts): void {
  openPerformance(connectionId, { ...opts, view: 'health' });
}

/** Realtime monitoring is a sub-view of the unified Performance tab. */
export function openMonitoring(connectionId: string, opts?: OpenOpts): void {
  openPerformance(connectionId, { ...opts, view: 'monitoring' });
}

export function openAi(connectionId: string, opts?: OpenOpts): void {
  go({ id: tabIds.ai(connectionId), kind: 'ai', title: 'AI', connectionId }, opts);
}

export function openSaved(connectionId: string, opts?: OpenOpts): void {
  go({ id: tabIds.saved(connectionId), kind: 'saved', title: 'Saved Queries', connectionId }, opts);
}

export function openHistory(connectionId: string, opts?: OpenOpts): void {
  go(
    { id: tabIds.history(connectionId), kind: 'history', title: 'Query History', connectionId },
    opts,
  );
}

export function openBackups(connectionId: string, opts?: OpenOpts): void {
  go({ id: tabIds.backups(connectionId), kind: 'backups', title: 'Backups', connectionId }, opts);
}

/** Connect to a database (if needed) and focus its dashboard. */
export async function switchConnection(connectionId: string): Promise<void> {
  const conn = useConnections.getState();
  conn.setActive(connectionId);
  if (!conn.connectedIds.includes(connectionId)) {
    const ok = await conn.connect(connectionId);
    if (!ok) return;
  }
  openDashboard(connectionId);
}
