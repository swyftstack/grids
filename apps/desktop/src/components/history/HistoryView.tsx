import { useEffect, useState } from 'react';
import { History, Star, Play, Search, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import type { QueryHistoryEntry } from '@swyftgrid/core';
import { formatDuration, timeAgo } from '@swyftgrid/core';
import { cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { useUi } from '@/stores/ui';
import { openEditor } from '@/lib/actions';
import { EmptyState } from '@/components/common/EmptyState';

export function HistoryView({ connectionId }: { connectionId: string }) {
  const requestConfirm = useUi((s) => s.requestConfirm);
  const [entries, setEntries] = useState<QueryHistoryEntry[]>([]);
  const [search, setSearch] = useState('');

  const reload = () =>
    invoke('history.list', { connectionId, search }).then((rows) =>
      setEntries(
        // The backend stores booleans as 0/1; coerce for the typed UI.
        rows.map((r) => ({
          ...r,
          success: !!r.success,
          isFavorite: !!r.isFavorite,
        })) as QueryHistoryEntry[],
      ),
    );

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, search]);

  const clear = () =>
    requestConfirm({
      title: 'Clear history?',
      message: 'Non-favorite history entries for this database will be removed.',
      tone: 'danger',
      confirmLabel: 'Clear',
      onConfirm: async () => {
        await invoke('history.clear', { connectionId });
        void reload();
      },
    });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <header className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Query History</h1>
          <div className="flex items-center gap-2">
            <div className="relative w-56">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search history…"
                className="h-8 w-full rounded-md border border-border bg-surface-2 pl-7 pr-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <button
              onClick={clear}
              className="grid h-8 w-8 place-items-center rounded-md text-content-muted hover:bg-danger/10 hover:text-danger"
              title="Clear history"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </header>

        {entries.length === 0 ? (
          <EmptyState
            icon={<History className="h-10 w-10" />}
            title="No history yet"
            description="Queries you run will be recorded here."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {entries.map((e, i) => (
              <div
                key={e.id}
                className={cn(
                  'group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2',
                  i > 0 && 'border-t border-border',
                )}
              >
                {e.success ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-danger" />
                )}
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openEditor(connectionId, e.sql, String(Date.now()))}
                  title="Open in editor"
                >
                  <p className="truncate font-mono text-xs text-content">
                    {e.sql.replace(/\s+/g, ' ')}
                  </p>
                  <p className="text-2xs text-content-subtle">
                    {timeAgo(e.executedAt)}
                    {e.executionMs != null && ` · ${formatDuration(e.executionMs)}`}
                    {e.rowsAffected != null && ` · ${e.rowsAffected} rows`}
                  </p>
                </button>
                <button
                  aria-label="Favorite"
                  onClick={async () => {
                    await invoke('history.toggleFavorite', { id: e.id });
                    void reload();
                  }}
                  className="text-content-subtle transition-colors hover:text-warning"
                >
                  <Star
                    className={cn('h-3.5 w-3.5', e.isFavorite && 'fill-warning text-warning')}
                  />
                </button>
                <button
                  aria-label="Re-run"
                  onClick={() => openEditor(connectionId, e.sql, String(Date.now()))}
                  className="grid h-7 w-7 place-items-center rounded-md text-content-muted opacity-0 transition-opacity hover:bg-border hover:text-content group-hover:opacity-100"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
