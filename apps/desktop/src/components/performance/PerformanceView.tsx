import { useEffect, useState } from 'react';
import {
  Gauge,
  Play,
  Activity,
  Repeat,
  Timer,
  ExternalLink,
  Sparkles,
  HeartPulse,
} from 'lucide-react';
import type { ExplainResult, QueryPerfReport, QueryStat } from '@swyftgrid/core';
import { formatDuration, formatNumber } from '@swyftgrid/core';
import { cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { openEditor, type PerfSubView } from '@/lib/actions';
import { Page, Card } from '@/components/common/Page';
import { SubTabBar, useTabView } from '@/components/common/SubTabs';
import { HealthView } from '@/components/health/HealthView';
import { MonitoringView } from './MonitoringView';
import { QueryPlan } from './QueryPlan';

type Tab = 'slow' | 'frequent' | 'longRunning';

/**
 * The unified Performance workspace: query performance, the database health report, and realtime
 * monitoring, all under one tab. The active sub-view lives in the tab payload for deep-linking.
 */
export function PerformanceView({ tabId, connectionId }: { tabId: string; connectionId: string }) {
  const [view, setView] = useTabView<PerfSubView>(tabId, 'performance');
  return (
    <div className="flex h-full flex-col">
      <SubTabBar
        value={view}
        onChange={setView}
        tabs={[
          { value: 'performance', label: 'Performance', icon: Gauge },
          { value: 'health', label: 'Health', icon: HeartPulse },
          { value: 'monitoring', label: 'Monitoring', icon: Activity },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'performance' && <PerformanceQueries connectionId={connectionId} />}
        {view === 'health' && <HealthView connectionId={connectionId} />}
        {view === 'monitoring' && <MonitoringView connectionId={connectionId} />}
      </div>
    </div>
  );
}

function PerformanceQueries({ connectionId }: { connectionId: string }) {
  const [report, setReport] = useState<QueryPerfReport | null>(null);
  const [tab, setTab] = useState<Tab>('slow');

  useEffect(() => {
    invoke('performance.queries', { connectionId }).then(setReport);
  }, [connectionId]);

  const tabs: { key: Tab; label: string; icon: typeof Activity }[] = [
    { key: 'slow', label: 'Slowest', icon: Timer },
    { key: 'frequent', label: 'Most executed', icon: Repeat },
    { key: 'longRunning', label: 'Long running', icon: Activity },
  ];

  const rows = report?.[tab] ?? [];

  return (
    <Page title="Performance" description="Query plans and statement statistics">
      <ExplainRunner connectionId={connectionId} />

      <h2 className="mb-3 mt-8 text-sm font-semibold">Query statistics</h2>
      {report && !report.available ? (
        <Card className="p-4 text-xs text-content-muted">
          <p>
            <code className="rounded bg-surface-2 px-1">pg_stat_statements</code> is not enabled.
            Enable it to see slow and frequent queries:
          </p>
          <pre className="mt-2 rounded-md bg-surface-2 p-2 font-mono text-2xs">
            CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
          </pre>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center gap-1 border-b border-border p-1.5">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors',
                    tab === t.key
                      ? 'bg-surface-2 text-content'
                      : 'text-content-muted hover:text-content',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              );
            })}
          </div>
          <div>
            {rows.map((q, i) => (
              <QueryStatRow key={i} stat={q} connectionId={connectionId} />
            ))}
            {rows.length === 0 && (
              <div className="p-6 text-center text-xs text-content-subtle">No data yet.</div>
            )}
          </div>
        </Card>
      )}
    </Page>
  );
}

function QueryStatRow({ stat, connectionId }: { stat: QueryStat; connectionId: string }) {
  return (
    <div className="group flex items-center gap-3 border-b border-border/60 px-4 py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs">{stat.query}</p>
        <p className="mt-0.5 flex gap-3 text-2xs text-content-subtle">
          <span>{formatNumber(stat.calls)} calls</span>
          <span>avg {formatDuration(stat.meanMs)}</span>
          <span>max {formatDuration(stat.maxMs)}</span>
          <span>total {formatDuration(stat.totalMs)}</span>
        </p>
      </div>
      <button
        onClick={() => openEditor(connectionId, stat.query, String(Date.now()), { newTab: true })}
        title="Open in SQL editor"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-content-muted opacity-0 transition hover:bg-surface-2 hover:text-content group-hover:opacity-100"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ExplainRunner({ connectionId }: { connectionId: string }) {
  const [sql, setSql] = useState(
    'SELECT * FROM comments JOIN posts ON comments.post_id = posts.id;',
  );
  const [result, setResult] = useState<ExplainResult | null>(null);
  const [analyzed, setAnalyzed] = useState(false);
  const [running, setRunning] = useState(false);

  const run = async (analyze: boolean) => {
    setRunning(true);
    setAnalyzed(analyze);
    try {
      setResult(await invoke('query.explain', { connectionId, sql, analyze }));
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <Gauge className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">Visual query plan</h2>
      </div>
      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        rows={2}
        spellCheck={false}
        className="w-full resize-y rounded-md border border-border bg-surface-2 p-2 font-mono text-xs outline-none focus:border-accent"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => run(false)}
          disabled={running}
          className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-50"
        >
          <Play className="h-3 w-3" /> Explain
        </button>
        <button
          onClick={() => run(true)}
          disabled={running}
          className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-content-muted hover:text-content disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" /> Explain Analyze
        </button>
      </div>
      {result && (
        <div className="mt-3">
          <QueryPlan plan={result.plan} analyzed={analyzed} />
        </div>
      )}
    </Card>
  );
}
