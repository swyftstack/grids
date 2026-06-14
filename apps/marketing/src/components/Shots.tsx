import type { ReactNode } from 'react';
import { Table2, Filter, ArrowUpDown, Play, KeyRound, Link2, HeartPulse } from 'lucide-react';

/**
 * Lightweight, presentational mocks of individual Swyftgrids screens. They reuse the app's real
 * design tokens so the showcase reads like genuine product shots without shipping bitmaps.
 */

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_24px_60px_-30px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="ml-1 text-2xs font-medium text-content-subtle">{label}</span>
      </div>
      {children}
    </div>
  );
}

// ─────────────── SQL editor ───────────────

export function SqlEditorShot() {
  return (
    <Frame label="SQL Editor">
      <div className="flex items-center gap-1 border-b border-border bg-surface px-2 pt-2">
        {['users.sql', 'revenue.sql'].map((t, i) => (
          <span
            key={t}
            className={
              'rounded-t-md px-2.5 py-1 text-2xs ' +
              (i === 0
                ? 'border border-b-0 border-border bg-surface-2 text-content'
                : 'text-content-subtle')
            }
          >
            {t}
          </span>
        ))}
      </div>
      <div className="space-y-1 bg-[#0c0c0f] px-3 py-3 font-mono text-2xs leading-relaxed">
        <div>
          <span className="text-accent">SELECT</span>{' '}
          <span className="text-content">u.email, o.name, count(p.id)</span>
        </div>
        <div>
          <span className="text-accent">FROM</span> <span className="text-info">users</span>{' '}
          <span className="text-content-subtle">u</span>
        </div>
        <div>
          <span className="text-accent">JOIN</span> <span className="text-info">organizations</span>{' '}
          <span className="text-content-subtle">o</span> <span className="text-accent">ON</span>{' '}
          <span className="text-content">o.id = u.organization_id</span>
        </div>
        <div>
          <span className="text-accent">GROUP BY</span> <span className="text-content">1, 2</span>{' '}
          <span className="text-accent">ORDER BY</span> <span className="text-content">3 DESC</span>
          <span className="text-content">;</span>
        </div>
      </div>
      <div className="flex items-center justify-between border-y border-border bg-surface-2/40 px-3 py-1.5 text-2xs text-content-subtle">
        <span className="inline-flex items-center gap-1 text-success">
          <Play className="h-3 w-3" /> 1,284 rows
        </span>
        <span>18 ms · cached plan</span>
      </div>
      <div className="px-0">
        <div className="flex bg-surface-2/60 px-3 py-1.5 text-2xs font-medium text-content-subtle">
          <span className="flex-1">email</span>
          <span className="w-24">name</span>
          <span className="w-10 text-right">count</span>
        </div>
        {[
          ['ada@example.com', 'Acme Inc', '142'],
          ['grace@example.com', 'Globex', '98'],
          ['alan@example.com', 'Initech', '67'],
        ].map((r, i) => (
          <div
            key={r[0]}
            className={
              'flex px-3 py-1.5 font-mono text-2xs ' + (i > 0 ? 'border-t border-border/50' : '')
            }
          >
            <span className="flex-1 truncate">{r[0]}</span>
            <span className="w-24 truncate text-content-muted">{r[1]}</span>
            <span className="w-10 text-right text-accent">{r[2]}</span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ─────────────── Table browser ───────────────

export function TableBrowserShot() {
  const rows = [
    ['1', 'ada@example.com', 'Ada Lovelace', 'Acme Inc', 'true'],
    ['2', 'grace@example.com', 'Grace Hopper', 'Globex', 'true'],
    ['3', 'alan@example.com', 'Alan Turing', 'Initech', 'false'],
    ['4', 'edsger@example.com', 'E. Dijkstra', 'Acme Inc', 'true'],
  ];
  return (
    <Frame label="public.users">
      <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-1.5 text-2xs text-content-subtle">
        <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5">
          <Filter className="h-3 w-3" /> Filter
        </span>
        <span className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5">
          <ArrowUpDown className="h-3 w-3" /> created_at
        </span>
        <span className="ml-auto">1,284 rows</span>
      </div>
      <div className="overflow-hidden">
        <div className="flex bg-surface-2/60 px-3 py-1.5 text-2xs font-medium text-content-subtle">
          <span className="w-8">id</span>
          <span className="flex-1">email</span>
          <span className="w-24">full_name</span>
          <span className="w-20">org</span>
          <span className="w-12 text-right">active</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={r[0]}
            className={
              'flex items-center px-3 py-1.5 font-mono text-2xs ' +
              (i > 0 ? 'border-t border-border/50' : '')
            }
          >
            <span className="w-8 text-content-subtle">{r[0]}</span>
            <span className="flex-1 truncate">{r[1]}</span>
            <span className="w-24 truncate text-content-muted">{r[2]}</span>
            <span className="w-20 truncate">
              <span className="inline-flex items-center gap-0.5 rounded bg-accent-soft px-1 text-accent">
                <Link2 className="h-2.5 w-2.5" />
                {r[3]}
              </span>
            </span>
            <span className="w-12 text-right">
              <span className={r[4] === 'true' ? 'text-success' : 'text-content-subtle'}>
                {r[4]}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ─────────────── ER diagram ───────────────

export function ErdShot() {
  return (
    <Frame label="Schema · Diagram">
      <div className="relative h-[230px] erd-canvas">
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <path
            d="M120 78 C 180 78, 180 150, 240 150"
            fill="none"
            stroke="rgb(var(--sg-accent))"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <path
            d="M120 96 C 160 96, 160 56, 250 56"
            fill="none"
            stroke="rgb(var(--sg-border-strong))"
            strokeWidth="1.5"
          />
          <path
            d="M300 188 C 240 188, 240 188, 180 170"
            fill="none"
            stroke="rgb(var(--sg-border-strong))"
            strokeWidth="1.5"
          />
        </svg>
        <ErdNode x="24" y="60" title="users" cols={['id', 'email', 'org_id']} accent />
        <ErdNode x="250" y="34" title="organizations" cols={['id', 'name', 'plan']} />
        <ErdNode x="240" y="128" title="posts" cols={['id', 'author_id', 'title']} />
        <ErdNode x="300" y="166" title="comments" cols={['id', 'post_id']} />
      </div>
    </Frame>
  );
}

function ErdNode({
  x,
  y,
  title,
  cols,
  accent,
}: {
  x: string;
  y: string;
  title: string;
  cols: string[];
  accent?: boolean;
}) {
  return (
    <div
      className="absolute w-[96px] overflow-hidden rounded-md border border-border bg-surface shadow-sm"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      <div
        className={
          'flex items-center gap-1 px-2 py-1 text-2xs font-semibold ' +
          (accent ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-content')
        }
      >
        <Table2 className="h-2.5 w-2.5" />
        {title}
      </div>
      {cols.map((c) => (
        <div
          key={c}
          className="flex items-center gap-1 border-t border-border/50 px-2 py-0.5 font-mono text-[10px] text-content-muted"
        >
          {c === 'id' ? (
            <KeyRound className="h-2.5 w-2.5 text-accent" />
          ) : (
            <span className="h-2.5 w-2.5" />
          )}
          {c}
        </div>
      ))}
    </div>
  );
}

// ─────────────── Database health ───────────────

export function HealthShot() {
  const checks = [
    { label: 'Indexes', status: 'Good', tone: 'success' },
    { label: 'Table bloat', status: '2 tables', tone: 'warn' },
    { label: 'Dead tuples', status: 'Low', tone: 'success' },
    { label: 'Slow queries', status: '1 found', tone: 'warn' },
    { label: 'Cache hit ratio', status: '99.2%', tone: 'success' },
  ];
  return (
    <Frame label="Performance · Health">
      <div className="flex items-center gap-4 p-4">
        <div className="relative grid h-20 w-20 shrink-0 place-items-center">
          <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="rgb(var(--sg-border))"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="rgb(var(--sg-success))"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="97.4"
              strokeDashoffset="7.8"
            />
          </svg>
          <div className="absolute text-center">
            <div className="text-lg font-bold leading-none text-success">92</div>
            <div className="text-[9px] text-content-subtle">health</div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-2xs font-medium">
            <HeartPulse className="h-3.5 w-3.5 text-accent" /> Database health score
          </div>
          <p className="mt-1 text-2xs text-content-subtle">
            Indexes, bloat, dead tuples, query performance, and storage at a glance.
          </p>
        </div>
      </div>
      <div className="border-t border-border">
        {checks.map((c, i) => (
          <div
            key={c.label}
            className={
              'flex items-center justify-between px-4 py-1.5 text-2xs ' +
              (i > 0 ? 'border-t border-border/50' : '')
            }
          >
            <span className="text-content-muted">{c.label}</span>
            <span
              className={
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ' +
                (c.tone === 'success' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning')
              }
            >
              <span
                className={
                  'h-1.5 w-1.5 rounded-full ' + (c.tone === 'success' ? 'bg-success' : 'bg-warning')
                }
              />
              {c.status}
            </span>
          </div>
        ))}
      </div>
    </Frame>
  );
}
