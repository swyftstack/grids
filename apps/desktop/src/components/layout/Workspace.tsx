import { lazy, Suspense } from 'react';
import type { CellValue } from '@swyftgrid/core';
import { Spinner } from '@swyftgrid/ui';
import { useWorkspace } from '@/stores/workspace';
import { ConnectionsView } from '@/components/connections/ConnectionsView';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { TablesView } from '@/components/tables/TablesView';
import { TableBrowser } from '@/components/table/TableBrowser';
import { SchemaView } from '@/components/schema/SchemaView';
import { SettingsView } from '@/components/settings/SettingsView';
import { SavedQueriesView } from '@/components/saved/SavedQueriesView';
import { HistoryView } from '@/components/history/HistoryView';
import { BackupsView } from '@/components/backups/BackupsView';
import { EmptyState } from '@/components/common/EmptyState';

// Heaviest views are code-split so the initial bundle stays small (CodeMirror, the AI workspace,
// and the performance/query-plan visualiser only load when first opened).
const SqlEditor = lazy(() =>
  import('@/components/editor/SqlEditor').then((m) => ({ default: m.SqlEditor })),
);
const PerformanceView = lazy(() =>
  import('@/components/performance/PerformanceView').then((m) => ({ default: m.PerformanceView })),
);
const AiView = lazy(() => import('@/components/ai/AiView').then((m) => ({ default: m.AiView })));

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="h-5 w-5" />
    </div>
  );
}

export function Workspace() {
  const { tabs, activeTabId } = useWorkspace();
  const tab = tabs.find((t) => t.id === activeTabId);

  if (!tab) {
    return (
      <div className="flex-1 bg-bg">
        <EmptyState
          title="Welcome to Swyftgrids"
          description="Choose a database from the sidebar, then use the top navigation to explore it."
          hint="⌘K"
        />
      </div>
    );
  }

  const c = tab.connectionId!;

  return (
    <div className="min-h-0 flex-1 overflow-hidden bg-bg">
      <Suspense fallback={<Loading />}>
        {/* Keyed so each tab gets fresh state when its identity changes. */}
        {tab.kind === 'connections' && <ConnectionsView key={tab.id} />}
        {tab.kind === 'dashboard' && <DashboardView key={tab.id} connectionId={c} />}
        {tab.kind === 'tables' && <TablesView key={tab.id} connectionId={c} />}
        {tab.kind === 'table' && (
          <TableBrowser
            key={tab.id}
            connectionId={c}
            schema={String(tab.payload?.schema)}
            table={String(tab.payload?.table)}
            initialFilterColumn={
              tab.payload?.filterColumn ? String(tab.payload.filterColumn) : undefined
            }
            initialFilterValue={
              tab.payload?.filterValue !== undefined
                ? (tab.payload.filterValue as CellValue)
                : undefined
            }
          />
        )}
        {tab.kind === 'editor' && (
          <SqlEditor
            key={tab.id}
            tabId={tab.id}
            connectionId={c}
            initialSql={tab.payload?.sql ? String(tab.payload.sql) : undefined}
          />
        )}
        {tab.kind === 'schema' && <SchemaView key={tab.id} tabId={tab.id} connectionId={c} />}
        {tab.kind === 'performance' && (
          <PerformanceView key={tab.id} tabId={tab.id} connectionId={c} />
        )}
        {tab.kind === 'ai' && <AiView key={tab.id} connectionId={c} />}
        {tab.kind === 'backups' && <BackupsView key={tab.id} connectionId={c} />}
        {tab.kind === 'saved' && <SavedQueriesView key={tab.id} connectionId={c} />}
        {tab.kind === 'history' && <HistoryView key={tab.id} connectionId={c} />}
        {tab.kind === 'settings' && <SettingsView key={tab.id} />}
      </Suspense>
    </div>
  );
}
