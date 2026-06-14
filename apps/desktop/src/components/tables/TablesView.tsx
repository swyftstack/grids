import { useEffect, useMemo, useState } from 'react';
import { Table2, Search, ExternalLink, Plus, KeyRound } from 'lucide-react';
import type { SchemaSnapshot } from '@swyftgrid/core';
import { formatBytes, formatNumber } from '@swyftgrid/core';
import { cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { useUi } from '@/stores/ui';
import { openTable } from '@/lib/actions';
import { Page } from '@/components/common/Page';
import { EmptyState } from '@/components/common/EmptyState';

export function TablesView({ connectionId }: { connectionId: string }) {
  const [snapshot, setSnapshot] = useState<SchemaSnapshot | null>(null);
  const [search, setSearch] = useState('');
  const openContextMenu = useUi((s) => s.openContextMenu);

  useEffect(() => {
    invoke('schema.snapshot', { connectionId }).then(setSnapshot);
  }, [connectionId]);

  const tables = useMemo(
    () =>
      (snapshot?.tables ?? []).filter(
        (t) => !search || `${t.schema}.${t.name}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [snapshot, search],
  );

  return (
    <Page
      title="Tables"
      description={snapshot ? `${snapshot.tables.length} tables & views` : 'Loading…'}
      actions={
        <div className="relative w-60">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tables…"
            className="h-8 w-full rounded-md border border-border bg-surface-2 pl-7 pr-2 text-sm outline-none focus:border-accent"
          />
        </div>
      }
    >
      {!snapshot ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-xl" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <EmptyState icon={<Table2 className="h-10 w-10" />} title="No tables match" />
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tables.map((t) => {
            const pkCount = t.columns.filter((c) => c.isPrimaryKey).length;
            return (
              <button
                key={`${t.schema}.${t.name}`}
                onClick={() => openTable(connectionId, t.schema, t.name)}
                onContextMenu={(e) =>
                  openContextMenu(e, [
                    {
                      label: 'Open',
                      icon: <ExternalLink className="h-3.5 w-3.5" />,
                      onSelect: () => openTable(connectionId, t.schema, t.name),
                    },
                    {
                      label: 'Open in New Tab',
                      icon: <Plus className="h-3.5 w-3.5" />,
                      onSelect: () => openTable(connectionId, t.schema, t.name, { newTab: true }),
                    },
                  ])
                }
                className={cn(
                  'group flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 text-left',
                  'transition-all hover:border-border-strong hover:shadow-subtle',
                )}
              >
                <div className="flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-info" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{t.name}</span>
                  {t.kind !== 'table' && (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs text-content-subtle">
                      {t.kind === 'view' ? 'view' : 'matview'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-2xs text-content-subtle">
                  <span>{t.schema}</span>
                  <span>{formatNumber(t.estimatedRows)} rows</span>
                  {t.sizeBytes != null && <span>{formatBytes(t.sizeBytes)}</span>}
                  <span className="flex items-center gap-0.5">
                    <KeyRound className="h-3 w-3" />
                    {pkCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Page>
  );
}
