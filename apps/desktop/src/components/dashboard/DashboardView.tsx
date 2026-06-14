import { useEffect, useState } from 'react';
import {
  HardDrive,
  Table2,
  FolderTree,
  Eye,
  Users,
  Server,
  Clock,
  TerminalSquare,
  Network,
  ArrowRight,
} from 'lucide-react';
import type { DatabaseDashboard } from '@swyftgrid/core';
import { formatBytes, formatNumber, timeAgo } from '@swyftgrid/core';
import { cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { useConnections } from '@/stores/connections';
import { openTable, openEditor, openErd } from '@/lib/actions';

export function DashboardView({ connectionId }: { connectionId: string }) {
  const cached = useConnections((s) => s.dashboards[connectionId]);
  const conn = useConnections((s) => s.connections.find((c) => c.id === connectionId));
  const [data, setData] = useState<DatabaseDashboard | null>(cached ?? null);

  useEffect(() => {
    invoke('db.dashboard', { connectionId }).then(setData);
  }, [connectionId]);

  if (!data) {
    return <div className="p-8 text-sm text-content-subtle">Loading dashboard…</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {conn?.name ?? data.databaseName}
            </h1>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-content-muted">
              <Server className="h-3.5 w-3.5" /> {shortVersion(data.serverVersion)}
            </p>
          </div>
          <div className="flex gap-2">
            <QuickAction
              icon={<TerminalSquare className="h-4 w-4" />}
              label="Query"
              onClick={() => openEditor(connectionId)}
            />
            <QuickAction
              icon={<Network className="h-4 w-4" />}
              label="ER Diagram"
              onClick={() => openErd(connectionId)}
            />
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Metric
            icon={<HardDrive className="h-4 w-4" />}
            label="Database size"
            value={formatBytes(data.sizeBytes)}
            accent
          />
          <Metric
            icon={<Table2 className="h-4 w-4" />}
            label="Tables"
            value={formatNumber(data.tableCount)}
          />
          <Metric
            icon={<FolderTree className="h-4 w-4" />}
            label="Schemas"
            value={formatNumber(data.schemaCount)}
          />
          <Metric
            icon={<Eye className="h-4 w-4" />}
            label="Views"
            value={formatNumber(data.viewCount)}
          />
          <Metric
            icon={<Users className="h-4 w-4" />}
            label="Active connections"
            value={formatNumber(data.activeConnections)}
          />
          <Metric
            icon={<Clock className="h-4 w-4" />}
            label="Last connected"
            value={timeAgo(data.lastConnectedAt)}
          />
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-content-subtle">
            Largest tables
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {data.largestTables.map((t, i) => (
              <button
                key={`${t.schema}.${t.table}`}
                onClick={() => openTable(connectionId, t.schema, t.table)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-2',
                  i > 0 && 'border-t border-border',
                )}
              >
                <Table2 className="h-4 w-4 text-info" />
                <span className="flex-1 text-sm">
                  <span className="text-content-subtle">{t.schema}.</span>
                  {t.table}
                </span>
                <span className="text-xs text-content-muted">{formatBytes(t.sizeBytes)}</span>
                <ArrowRight className="h-3.5 w-3.5 text-content-subtle" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function shortVersion(v: string): string {
  const m = /PostgreSQL\s+[\d.]+/.exec(v);
  return m ? m[0] : v;
}

function Metric({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div
        className={cn(
          'mb-3 grid h-8 w-8 place-items-center rounded-lg',
          accent ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-content-muted',
        )}
      >
        {icon}
      </div>
      <div className="text-lg font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-content-muted">{label}</div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-content-muted transition-colors hover:border-border-strong hover:text-content"
    >
      {icon}
      {label}
    </button>
  );
}
