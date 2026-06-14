import { useEffect, useState } from 'react';
import {
  HeartPulse,
  Activity,
  ListChecks,
  Copy,
  Database,
  Gauge,
  Lightbulb,
  TriangleAlert,
} from 'lucide-react';
import type { ConnectionHealth, HealthScore, IndexReport } from '@swyftgrid/core';
import { formatBytes, formatNumber } from '@swyftgrid/core';
import { cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { useUi } from '@/stores/ui';
import { Page, Card, StatusPill } from '@/components/common/Page';

type Tab = 'overview' | 'indexes';

export function HealthView({ connectionId }: { connectionId: string }) {
  const [tab, setTab] = useState<Tab>('overview');
  const [score, setScore] = useState<HealthScore | null>(null);
  const [conn, setConn] = useState<ConnectionHealth | null>(null);
  const [indexes, setIndexes] = useState<IndexReport | null>(null);

  useEffect(() => {
    invoke('health.score', { connectionId }).then(setScore);
    invoke('health.connection', { connectionId }).then(setConn);
    invoke('indexes.inspect', { connectionId }).then(setIndexes);
  }, [connectionId]);

  return (
    <Page
      title="Health"
      description="Database health score, connection health, and index hygiene"
      actions={
        <div className="flex rounded-md border border-border bg-surface-2 p-0.5">
          {(['overview', 'indexes'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'rounded px-2.5 py-1 text-xs capitalize transition-colors',
                tab === t ? 'bg-accent text-accent-fg' : 'text-content-muted hover:text-content',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      }
    >
      {tab === 'overview' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ScoreCard score={score} />
            <div className="lg:col-span-2">
              <ConnectionHealthCard health={conn} />
            </div>
          </div>
          {score && (
            <Card className="p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <ListChecks className="h-4 w-4 text-content-muted" /> Issue breakdown
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {score.categories.map((c) => (
                  <div
                    key={c.category}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <div className="text-xs">{c.label}</div>
                      <div className="text-sm font-semibold">{c.value}</div>
                    </div>
                    <StatusPill status={c.status} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : (
        <IndexInspector report={indexes} />
      )}
    </Page>
  );
}

function ScoreCard({ score }: { score: HealthScore | null }) {
  const value = score?.score ?? 0;
  const status = value >= 85 ? 'healthy' : value >= 60 ? 'warning' : 'critical';
  const color =
    status === 'healthy'
      ? 'var(--sg-success)'
      : status === 'warning'
        ? 'var(--sg-warning)'
        : 'var(--sg-danger)';
  const circumference = 2 * Math.PI * 42;
  return (
    <Card className="flex flex-col items-center justify-center gap-2 p-6">
      <div className="relative h-32 w-32">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgb(var(--sg-border))"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={`rgb(${color})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - value / 100)}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tracking-tight">{value}</span>
          <span className="text-2xs text-content-subtle">/ 100</span>
        </div>
      </div>
      <div className="text-sm font-medium">Health Score</div>
      {score && <StatusPill status={status} />}
    </Card>
  );
}

function ConnectionHealthCard({ health }: { health: ConnectionHealth | null }) {
  if (!health) return <Card className="skeleton h-full min-h-[160px]" />;
  return (
    <Card className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-content-muted" /> Connection Health
        </h3>
        <StatusPill status={health.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric
          icon={<HeartPulse className="h-3.5 w-3.5" />}
          label="Ping"
          value={`${health.pingMs} ms`}
        />
        <Metric
          icon={<Database className="h-3.5 w-3.5" />}
          label="Active"
          value={formatNumber(health.activeConnections)}
        />
        <Metric
          icon={<Gauge className="h-3.5 w-3.5" />}
          label="Idle"
          value={formatNumber(health.idleConnections)}
        />
        <Metric
          icon={<Database className="h-3.5 w-3.5" />}
          label="Max"
          value={formatNumber(health.maxConnections)}
        />
      </div>
      {/* Connection usage bar */}
      <div className="mt-3">
        <div className="h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className={cn(
              'h-full rounded-full',
              health.status === 'critical'
                ? 'bg-danger'
                : health.status === 'warning'
                  ? 'bg-warning'
                  : 'bg-success',
            )}
            style={{
              width: `${Math.min(100, (health.activeConnections / health.maxConnections) * 100)}%`,
            }}
          />
        </div>
      </div>
      {health.warnings.length > 0 && (
        <div className="mt-3 space-y-1">
          {health.warnings.map((w, i) => (
            <div key={i} className="flex items-center gap-1.5 text-2xs text-warning">
              <TriangleAlert className="h-3 w-3" /> {w}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-2xs text-content-subtle">
        {icon} {label}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function IndexInspector({ report }: { report: IndexReport | null }) {
  const pushToast = useUi((s) => s.pushToast);
  if (!report)
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-10 rounded-lg" />
        ))}
      </div>
    );

  return (
    <div className="space-y-5">
      {report.recommendations.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-warning" /> Recommendations
          </h3>
          <div className="space-y-2">
            {report.recommendations.map((r, i) => (
              <div key={i} className="rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-2xs font-medium capitalize',
                      r.reason === 'missing'
                        ? 'bg-warning/10 text-warning'
                        : r.reason === 'unused'
                          ? 'bg-info/10 text-info'
                          : 'bg-danger/10 text-danger',
                    )}
                  >
                    {r.reason}
                  </span>
                  <span className="text-xs text-content-muted">{r.message}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(r.statement);
                      pushToast('Copied recommendation', 'success');
                    }}
                    className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs text-content-muted hover:bg-surface-2"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                </div>
                <pre className="mt-1.5 overflow-x-auto rounded bg-surface-2 p-2 font-mono text-2xs">
                  {r.statement}
                </pre>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 className="border-b border-border px-4 py-2.5 text-sm font-semibold">
          Existing indexes
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-2xs text-content-subtle">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left font-medium">Index</th>
                <th className="px-4 py-2 text-left font-medium">Table</th>
                <th className="px-4 py-2 text-left font-medium">Columns</th>
                <th className="px-4 py-2 text-right font-medium">Size</th>
                <th className="px-4 py-2 text-right font-medium">Scans</th>
              </tr>
            </thead>
            <tbody>
              {report.indexes.map((idx) => (
                <tr
                  key={`${idx.table}.${idx.name}`}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-4 py-2 font-mono">
                    {idx.name}
                    {idx.isPrimary && <span className="ml-1 text-2xs text-warning">PK</span>}
                  </td>
                  <td className="px-4 py-2 text-content-muted">{idx.table}</td>
                  <td className="px-4 py-2 font-mono text-content-muted">
                    {idx.columns.join(', ')}
                  </td>
                  <td className="px-4 py-2 text-right text-content-muted">
                    {formatBytes(idx.sizeBytes)}
                  </td>
                  <td
                    className={cn('px-4 py-2 text-right', idx.usageCount === 0 && 'text-warning')}
                  >
                    {formatNumber(idx.usageCount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
