import { useEffect, useState } from 'react';
import { Bookmark, Star, Play, Copy, Trash2, Search, Tag } from 'lucide-react';
import type { SavedQuery, SavedQueryFolder } from '@swyftgrid/core';
import { Badge, cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { useUi } from '@/stores/ui';
import { openEditor } from '@/lib/actions';
import { EmptyState } from '@/components/common/EmptyState';

export function SavedQueriesView({ connectionId }: { connectionId: string }) {
  const pushToast = useUi((s) => s.pushToast);
  const requestConfirm = useUi((s) => s.requestConfirm);
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [folders, setFolders] = useState<SavedQueryFolder[]>([]);
  const [search, setSearch] = useState('');

  const reload = () =>
    invoke('savedQueries.list', { connectionId }).then((r) => {
      setQueries(r.queries);
      setFolders(r.folders);
    });

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  const filtered = queries.filter(
    (q) =>
      !search ||
      q.name.toLowerCase().includes(search.toLowerCase()) ||
      q.tags.some((t) => t.includes(search.toLowerCase())),
  );
  const grouped = new Map<string | null, SavedQuery[]>();
  for (const q of filtered) {
    const key = q.folderId;
    grouped.set(key, [...(grouped.get(key) ?? []), q]);
  }

  const remove = (q: SavedQuery) =>
    requestConfirm({
      title: `Delete “${q.name}”?`,
      message: 'This removes the saved query.',
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await invoke('savedQueries.delete', { id: q.id });
        void reload();
      },
    });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <header className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Saved Queries</h1>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search queries & tags…"
              className="h-8 w-full rounded-md border border-border bg-surface-2 pl-7 pr-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </header>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<Bookmark className="h-10 w-10" />}
            title="No saved queries"
            description="Save a query from the SQL editor to find it here."
          />
        ) : (
          [...grouped.entries()].map(([folderId, items]) => (
            <section key={folderId ?? 'root'} className="mb-6">
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-subtle">
                {folders.find((f) => f.id === folderId)?.name ?? 'Ungrouped'}
              </h2>
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                {items.map((q, i) => (
                  <div
                    key={q.id}
                    className={cn(
                      'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2',
                      i > 0 && 'border-t border-border',
                    )}
                  >
                    {q.isFavorite ? (
                      <Star className="h-4 w-4 shrink-0 fill-warning text-warning" />
                    ) : (
                      <Bookmark className="h-4 w-4 shrink-0 text-content-subtle" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{q.name}</span>
                        {q.tags.map((t) => (
                          <Badge key={t} tone="neutral">
                            <Tag className="h-2.5 w-2.5" />
                            {t}
                          </Badge>
                        ))}
                      </div>
                      <p className="truncate font-mono text-2xs text-content-subtle">
                        {q.sql.replace(/\s+/g, ' ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <IconBtn label="Run" onClick={() => openEditor(connectionId, q.sql, q.id)}>
                        <Play className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        label="Duplicate"
                        onClick={async () => {
                          await invoke('savedQueries.duplicate', { id: q.id });
                          void reload();
                          pushToast('Duplicated', 'success');
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn label="Delete" danger onClick={() => remove(q)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconBtn>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md text-content-muted transition-colors',
        danger ? 'hover:bg-danger/10 hover:text-danger' : 'hover:bg-border hover:text-content',
      )}
    >
      {children}
    </button>
  );
}
