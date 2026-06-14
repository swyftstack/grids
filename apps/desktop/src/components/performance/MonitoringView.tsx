import { useEffect, useRef, useState } from 'react';
import { Cpu, MemoryStick, HardDrive, Network, Pause, Play, Activity, Gauge } from 'lucide-react';
import type { MonitoringSample, ResourceMetric } from '@swyftgrid/core';
import { formatBytes, formatNumber } from '@swyftgrid/core';
import { cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { Page, Card } from '@/components/common/Page';

const POLL_MS = 2500;
const HISTORY = 80;

const SOURCE_NOTE: Record<MonitoringSample['resourceSource'], string> = {
  host: 'CPU / memory / disk are read from the machine running Swyftgrids (accurate when the database is local).',
  simulated: 'CPU / memory / disk are simulated in this in-browser demo.',
  unavailable: 'CPU / memory / disk could not be read from this server.',
};

export function MonitoringView({ connectionId }: { connectionId: string }) {
  const [sample, setSample] = useState<MonitoringSample | null>(null);
  const [history, setHistory] = useState<MonitoringSample[]>([]);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (paused) return;
    let alive = true;
    const poll = async () => {
      try {
        const next = await invoke('monitoring.sample', { connectionId });
        if (!alive) return;
        setError(false);
        setSample(next);
        setHistory((h) => [...h, next].slice(-HISTORY));
      } catch {
        if (alive) setError(true);
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [connectionId, paused]);

  const connPct = sample
    ? Math.min(100, (sample.totalConnections / Math.max(1, sample.maxConnections)) * 100)
    : 0;

  return (
    <Page
      title="Realtime monitoring"
      description={
        sample ? (
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                paused ? 'bg-content-subtle' : 'bg-success animate-pulse',
              )}
            />
            {paused ? 'Paused' : 'Live'} · {SOURCE_NOTE[sample.resourceSource]}
          </span>
        ) : (
          'Connecting…'
        )
      }
      actions={
        <button
          onClick={() => setPaused((p) => !p)}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-content-muted transition-colors hover:text-content"
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          {paused ? 'Resume' : 'Pause'}
        </button>
      }
    >
      {error && !sample ? (
        <Card className="p-6 text-center text-sm text-content-muted">
          Couldn't read monitoring data. The database session may have closed.
        </Card>
      ) : !sample ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <ResourceCard
              label="CPU"
              icon={<Cpu className="h-4 w-4" />}
              metric={sample.cpu}
              history={history.map((s) => s.cpu.percent ?? 0)}
            />
            <ResourceCard
              label="Memory"
              icon={<MemoryStick className="h-4 w-4" />}
              metric={sample.memory}
              history={history.map((s) => s.memory.percent ?? 0)}
              detail={
                sample.memory.usedBytes != null && sample.memory.totalBytes != null
                  ? `${formatBytes(sample.memory.usedBytes)} / ${formatBytes(sample.memory.totalBytes)}`
                  : undefined
              }
            />
            <ResourceCard
              label="Disk"
              icon={<HardDrive className="h-4 w-4" />}
              metric={sample.disk}
              history={history.map((s) => s.disk.percent ?? 0)}
              detail={
                sample.disk.usedBytes != null && sample.disk.totalBytes != null
                  ? `${formatBytes(sample.disk.usedBytes)} / ${formatBytes(sample.disk.totalBytes)}`
                  : undefined
              }
            />
            <ConnectionsCard
              percent={connPct}
              active={sample.activeConnections}
              total={sample.totalConnections}
              max={sample.maxConnections}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              icon={<Activity className="h-3.5 w-3.5" />}
              label="Transactions / sec"
              value={
                sample.transactionsPerSec == null
                  ? '—'
                  : formatNumber(Math.round(sample.transactionsPerSec))
              }
            />
            <Stat
              icon={<Gauge className="h-3.5 w-3.5" />}
              label="Cache hit ratio"
              value={sample.cacheHitRatio == null ? '—' : `${sample.cacheHitRatio}%`}
            />
            <Stat
              icon={<HardDrive className="h-3.5 w-3.5" />}
              label="Database size"
              value={formatBytes(sample.databaseSizeBytes)}
            />
            <Stat
              icon={<Network className="h-3.5 w-3.5" />}
              label="Idle connections"
              value={formatNumber(sample.idleConnections)}
            />
          </div>

          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Transactions per second</h3>
            <Sparkline
              data={history.map((s) => s.transactionsPerSec ?? 0)}
              height={64}
              stroke="rgb(var(--sg-accent))"
              fill
            />
          </Card>
        </div>
      )}
    </Page>
  );
}

function tone(percent: number | null): { bar: string; text: string } {
  if (percent == null) return { bar: 'bg-border-strong', text: 'text-content-subtle' };
  if (percent >= 90) return { bar: 'bg-danger', text: 'text-danger' };
  if (percent >= 75) return { bar: 'bg-warning', text: 'text-warning' };
  return { bar: 'bg-success', text: 'text-success' };
}

function ResourceCard({
  label,
  icon,
  metric,
  detail,
  history,
}: {
  label: string;
  icon: React.ReactNode;
  metric: ResourceMetric;
  detail?: string;
  history: number[];
}) {
  const t = tone(metric.percent);
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between text-xs text-content-muted">
        <span className="flex items-center gap-1.5">
          {icon} {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className={cn('text-3xl font-bold tracking-tight tabular-nums', t.text)}>
          {metric.percent == null ? 'N/A' : metric.percent.toFixed(0)}
        </span>
        {metric.percent != null && <span className="text-sm text-content-subtle">%</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full transition-all', t.bar)}
          style={{ width: `${metric.percent ?? 0}%` }}
        />
      </div>
      <Sparkline data={history} height={28} stroke={`rgb(var(--sg-accent))`} />
      {detail && <p className="truncate text-2xs text-content-subtle">{detail}</p>}
    </Card>
  );
}

function ConnectionsCard({
  percent,
  active,
  total,
  max,
}: {
  percent: number;
  active: number;
  total: number;
  max: number;
}) {
  const t = tone(percent);
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="flex items-center gap-1.5 text-xs text-content-muted">
        <Network className="h-4 w-4" /> Connections
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold tracking-tight tabular-nums">
          {formatNumber(total)}
        </span>
        <span className="text-sm text-content-subtle">/ {formatNumber(max)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className={cn('h-full rounded-full transition-all', t.bar)}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-2xs text-content-subtle">{formatNumber(active)} active</p>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-1.5 text-2xs text-content-subtle">
        {icon} {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function Sparkline({
  data,
  height = 40,
  stroke,
  fill,
}: {
  data: number[];
  height?: number;
  stroke: string;
  fill?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(240);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const max = Math.max(1, ...data);
  const n = data.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * width);
  const y = (v: number) => height - (v / max) * (height - 4) - 2;
  const line = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
    .join(' ');
  const area = n > 0 ? `${line} L ${x(n - 1)} ${height} L ${x(0)} ${height} Z` : '';

  return (
    <div ref={ref} className="w-full">
      <svg width={width} height={height} className="block">
        {fill && area && <path d={area} fill={stroke} opacity={0.12} />}
        {n > 0 && <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} />}
      </svg>
    </div>
  );
}
