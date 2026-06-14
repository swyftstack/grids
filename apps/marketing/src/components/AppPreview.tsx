import type { ReactNode } from 'react';
import {
  Search,
  LayoutDashboard,
  Table2,
  TerminalSquare,
  FolderTree,
  Gauge,
  Sparkles,
  Database,
  HardDrive,
  Eye,
  Users,
  Clock,
  Server,
  Network,
  ArrowRight,
} from 'lucide-react';

/**
 * A faithful, static mock of the Swyftgrids dashboard. It mirrors the real app screen pixel for
 * pixel in layout (sidebar sections, metric cards, and the "Largest tables" list with the same
 * sample data the in-app demo ships), so the hero shows exactly what users get.
 */
export function AppPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]">
      {/* Window chrome */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-2/60 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-2xs text-content-subtle">
          <Database className="h-3 w-3 text-accent" /> Production Database
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-2xs font-medium text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Connected
        </span>
      </div>

      <div className="flex min-h-[360px]">
        {/* Sidebar */}
        <div className="hidden w-44 shrink-0 flex-col gap-1 border-r border-border bg-surface p-2 sm:flex">
          <div className="mb-1 flex items-center gap-1.5 px-1">
            <span className="grid h-4 w-4 place-items-center rounded bg-accent text-[8px] font-bold text-accent-fg">
              S
            </span>
            <span className="text-2xs font-semibold tracking-tight">Swyftgrids</span>
          </div>
          <div className="mb-1 flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-2xs text-content-subtle">
            <Search className="h-3 w-3" /> Search everything…
          </div>
          {[
            { icon: LayoutDashboard, label: 'Dashboard', active: true },
            { icon: Table2, label: 'Tables' },
            { icon: TerminalSquare, label: 'SQL Editor' },
            { icon: FolderTree, label: 'Schema' },
            { icon: Gauge, label: 'Performance' },
            { icon: Sparkles, label: 'AI' },
          ].map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ' +
                (active ? 'bg-accent-soft font-medium text-accent' : 'text-content-muted')
              }
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </div>
          ))}
        </div>

        {/* Main: dashboard */}
        <div className="min-w-0 flex-1 p-4">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold tracking-tight">Production Database</div>
              <div className="mt-0.5 flex items-center gap-1 text-2xs text-content-muted">
                <Server className="h-3 w-3" /> PostgreSQL 16.2
              </div>
            </div>
            <div className="flex gap-1.5">
              <Chip icon={<TerminalSquare className="h-3 w-3" />}>Query</Chip>
              <Chip icon={<Network className="h-3 w-3" />}>ER Diagram</Chip>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            <Metric
              icon={<HardDrive className="h-3.5 w-3.5" />}
              label="Size"
              value="248 MB"
              accent
            />
            <Metric icon={<Table2 className="h-3.5 w-3.5" />} label="Tables" value="5" />
            <Metric icon={<FolderTree className="h-3.5 w-3.5" />} label="Schemas" value="1" />
            <Metric icon={<Eye className="h-3.5 w-3.5" />} label="Views" value="2" />
            <Metric icon={<Users className="h-3.5 w-3.5" />} label="Connections" value="7" />
            <Metric icon={<Clock className="h-3.5 w-3.5" />} label="Connected" value="now" />
          </div>

          <div className="mt-4 text-2xs font-medium uppercase tracking-wide text-content-subtle">
            Largest tables
          </div>
          <div className="mt-2 overflow-hidden rounded-lg border border-border">
            {[
              ['comments', '11.7 MB'],
              ['posts', '4.1 MB'],
              ['users', '642 KB'],
              ['organizations', '46 KB'],
              ['subscriptions', '46 KB'],
            ].map((row, i) => (
              <div
                key={row[0]}
                className={
                  'flex items-center gap-2.5 px-3 py-2 ' +
                  (i > 0 ? 'border-t border-border/60' : '')
                }
              >
                <Table2 className="h-3.5 w-3.5 text-info" />
                <span className="flex-1 text-xs">
                  <span className="text-content-subtle">public.</span>
                  {row[0]}
                </span>
                <span className="text-2xs text-content-muted">{row[1]}</span>
                <ArrowRight className="h-3 w-3 text-content-subtle" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  accent,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/50 p-2.5">
      <div
        className={
          'mb-2 grid h-6 w-6 place-items-center rounded-md ' +
          (accent ? 'bg-accent-soft text-accent' : 'bg-surface text-content-muted')
        }
      >
        {icon}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-2xs text-content-subtle">{label}</div>
    </div>
  );
}

function Chip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-2xs font-medium text-content-muted">
      {icon}
      {children}
    </span>
  );
}
