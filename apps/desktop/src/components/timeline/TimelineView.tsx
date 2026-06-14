import { useEffect, useState } from 'react';
import {
  GitBranch,
  Search,
  Plus,
  Trash2,
  Columns3,
  Database,
  TableProperties,
  Pencil,
} from 'lucide-react';
import type { TimelineAction, TimelineEvent } from '@swyftgrid/core';
import { timeAgo } from '@swyftgrid/core';
import { cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { Page } from '@/components/common/Page';
import { EmptyState } from '@/components/common/EmptyState';

const ACTION_META: Record<TimelineAction, { label: string; icon: typeof Plus; tone: string }> = {
  create_table: { label: 'Created table', icon: TableProperties, tone: 'text-success' },
  drop_table: { label: 'Dropped table', icon: Trash2, tone: 'text-danger' },
  add_column: { label: 'Added column', icon: Plus, tone: 'text-success' },
  drop_column: { label: 'Dropped column', icon: Trash2, tone: 'text-danger' },
  create_index: { label: 'Created index', icon: Database, tone: 'text-info' },
  drop_index: { label: 'Removed index', icon: Trash2, tone: 'text-danger' },
  alter_column: { label: 'Altered column', icon: Pencil, tone: 'text-warning' },
};

export function TimelineView({ connectionId }: { connectionId: string }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    invoke('timeline.list', { connectionId, search: search || undefined }).then(setEvents);
  }, [connectionId, search]);

  return (
    <Page
      title="Schema changes"
      description="History of schema changes over time"
      width="max-w-3xl"
      actions={
        <div className="relative w-60">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-content-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search changes…"
            className="h-8 w-full rounded-md border border-border bg-surface-2 pl-7 pr-2 text-sm outline-none focus:border-accent"
          />
        </div>
      }
    >
      {!events ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-12 rounded-lg" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState icon={<GitBranch className="h-10 w-10" />} title="No schema changes recorded" />
      ) : (
        <div className="relative ml-3 border-l border-border pl-6">
          {events.map((e) => {
            const meta = ACTION_META[e.action] ?? ACTION_META.alter_column;
            const Icon = meta.icon;
            return (
              <div key={e.id} className="relative pb-5 last:pb-0">
                <span className="absolute -left-[31px] grid h-6 w-6 place-items-center rounded-full border border-border bg-surface">
                  <Icon className={cn('h-3 w-3', meta.tone)} />
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{meta.label}</span>
                  <Columns3 className="h-3 w-3 text-content-subtle" />
                  <span className="font-mono text-xs">{e.object}</span>
                  <span className="ml-auto text-2xs text-content-subtle">{timeAgo(e.at)}</span>
                </div>
                {e.detail && <p className="mt-0.5 text-2xs text-content-muted">{e.detail}</p>}
              </div>
            );
          })}
        </div>
      )}
    </Page>
  );
}
