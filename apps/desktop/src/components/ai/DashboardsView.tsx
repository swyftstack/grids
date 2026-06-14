import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  WandSparkles,
  X,
  LayoutDashboard,
  AlertTriangle,
} from 'lucide-react';
import {
  CHART_TYPES,
  newId,
  type ChartType,
  type Dashboard,
  type DashboardWidget,
  type QueryExecution,
} from '@swyftgrid/core';
import { Button, cn, Spinner } from '@swyftgrid/ui';
import { invoke, toBackendError } from '@/lib/ipc';
import { useUi } from '@/stores/ui';
import { Chart, type ChartData } from '@/components/common/Chart';
import { Card } from '@/components/common/Page';
import { EmptyState } from '@/components/common/EmptyState';

/**
 * Build, save, and switch between dashboards — collections of chart widgets, each backed by a SQL
 * query. AI can author a widget's query (NL → SQL) but nothing runs without the user asking.
 */
export function DashboardsView({ connectionId }: { connectionId: string }) {
  const pushToast = useUi((s) => s.pushToast);
  const requestConfirm = useUi((s) => s.requestConfirm);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DashboardWidget | null>(null);
  const [renaming, setRenaming] = useState(false);

  useEffect(() => {
    invoke('dashboards.list', { connectionId }).then((list) => {
      setDashboards(list);
      setActiveId(list[0]?.id ?? null);
      setLoading(false);
    });
  }, [connectionId]);

  const active = dashboards.find((d) => d.id === activeId) ?? null;

  const persist = useCallback(async (dashboard: Dashboard) => {
    const saved = await invoke('dashboards.save', { dashboard });
    setDashboards((list) =>
      list.some((d) => d.id === saved.id)
        ? list.map((d) => (d.id === saved.id ? saved : d))
        : [...list, saved],
    );
    setActiveId(saved.id);
    return saved;
  }, []);

  const createDashboard = async () => {
    await persist({
      id: '',
      connectionId,
      name: `Dashboard ${dashboards.length + 1}`,
      widgets: [],
      createdAt: '',
      updatedAt: '',
    });
    pushToast('Dashboard created', 'success');
  };

  const deleteDashboard = (dashboard: Dashboard) =>
    requestConfirm({
      title: 'Delete dashboard?',
      message: `“${dashboard.name}” and its ${dashboard.widgets.length} widget(s) will be removed.`,
      tone: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        await invoke('dashboards.delete', { id: dashboard.id });
        setDashboards((list) => {
          const next = list.filter((d) => d.id !== dashboard.id);
          setActiveId(next[0]?.id ?? null);
          return next;
        });
        pushToast('Dashboard deleted', 'info');
      },
    });

  const saveWidget = async (widget: DashboardWidget) => {
    if (!active) return;
    const exists = active.widgets.some((w) => w.id === widget.id);
    const widgets = exists
      ? active.widgets.map((w) => (w.id === widget.id ? widget : w))
      : [...active.widgets, widget];
    await persist({ ...active, widgets });
    setEditing(null);
  };

  const removeWidget = (widgetId: string) => {
    if (!active) return;
    persist({ ...active, widgets: active.widgets.filter((w) => w.id !== widgetId) });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Dashboard switcher */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {dashboards.map((d) => (
            <button
              key={d.id}
              onClick={() => setActiveId(d.id)}
              className={cn(
                'flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                d.id === activeId
                  ? 'bg-accent-soft text-accent'
                  : 'text-content-muted hover:bg-surface-2 hover:text-content',
              )}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              {d.name}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={createDashboard}>
          <Plus className="h-3.5 w-3.5" /> New
        </Button>
      </div>

      {!active ? (
        <EmptyState
          icon={<LayoutDashboard className="h-10 w-10" />}
          title="No dashboards yet"
          description="Create a dashboard to chart saved queries side by side."
          action={
            <Button variant="primary" onClick={createDashboard}>
              <Plus className="h-4 w-4" /> New dashboard
            </Button>
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* Dashboard header */}
          <div className="mb-4 flex items-center gap-2">
            {renaming ? (
              <input
                autoFocus
                defaultValue={active.name}
                onBlur={(e) => {
                  persist({ ...active, name: e.target.value.trim() || active.name });
                  setRenaming(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className="h-8 rounded-md border border-border bg-surface-2 px-2 text-lg font-semibold outline-none focus:border-accent"
              />
            ) : (
              <h1 className="text-lg font-semibold tracking-tight">{active.name}</h1>
            )}
            <button
              onClick={() => setRenaming(true)}
              className="grid h-7 w-7 place-items-center rounded-md text-content-subtle hover:bg-surface-2 hover:text-content"
              title="Rename"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setEditing({
                    id: newId('w'),
                    title: 'New widget',
                    sql: 'SELECT plan, count(*) AS n FROM organizations GROUP BY plan;',
                    chartType: 'bar',
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" /> Add widget
              </Button>
              <button
                onClick={() => deleteDashboard(active)}
                className="grid h-8 w-8 place-items-center rounded-md text-content-subtle hover:bg-danger/10 hover:text-danger"
                title="Delete dashboard"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {active.widgets.length === 0 ? (
            <Card className="grid place-items-center gap-3 p-12 text-center">
              <LayoutDashboard className="h-8 w-8 text-content-subtle/50" />
              <p className="text-sm text-content-muted">
                This dashboard is empty. Add a widget to chart a query.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {active.widgets.map((widget) => (
                <div key={widget.id} className={cn(widget.span === 2 && 'lg:col-span-2')}>
                  <WidgetCard
                    widget={widget}
                    connectionId={connectionId}
                    onEdit={() => setEditing(widget)}
                    onRemove={() => removeWidget(widget.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <WidgetEditor
          connectionId={connectionId}
          widget={editing}
          onCancel={() => setEditing(null)}
          onSave={saveWidget}
        />
      )}
    </div>
  );
}

function WidgetCard({
  widget,
  connectionId,
  onEdit,
  onRemove,
}: {
  widget: DashboardWidget;
  connectionId: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const exec: QueryExecution = await invoke('query.execute', {
        connectionId,
        sql: widget.sql,
        maxRows: 1000,
      });
      const stmt = exec.statements.find((s) => s.result);
      if (stmt?.result) {
        setData({ fields: stmt.result.fields, rows: stmt.result.rows });
      } else {
        const firstError = exec.statements.find((s) => s.error)?.error;
        setError(firstError?.message ?? 'Query returned no result set');
      }
    } catch (e) {
      setError(toBackendError(e).message);
    } finally {
      setLoading(false);
    }
  }, [connectionId, widget.sql]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{widget.title}</span>
        <button
          onClick={run}
          title="Refresh"
          className="grid h-6 w-6 place-items-center rounded text-content-subtle hover:bg-surface-2 hover:text-content"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
        <button
          onClick={onEdit}
          title="Edit"
          className="grid h-6 w-6 place-items-center rounded text-content-subtle hover:bg-surface-2 hover:text-content"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onRemove}
          title="Remove"
          className="grid h-6 w-6 place-items-center rounded text-content-subtle hover:bg-danger/10 hover:text-danger"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 p-3">
        {loading && !data ? (
          <div className="grid h-40 place-items-center">
            <Spinner className="h-4 w-4" />
          </div>
        ) : error ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <AlertTriangle className="h-5 w-5 text-danger" />
            <p className="max-w-xs text-xs text-danger">{error}</p>
          </div>
        ) : data ? (
          <Chart
            type={widget.chartType}
            data={data}
            labelColumn={widget.labelColumn}
            valueColumns={widget.valueColumns}
          />
        ) : null}
      </div>
    </Card>
  );
}

function WidgetEditor({
  connectionId,
  widget,
  onSave,
  onCancel,
}: {
  connectionId: string;
  widget: DashboardWidget;
  onSave: (widget: DashboardWidget) => void;
  onCancel: () => void;
}) {
  const pushToast = useUi((s) => s.pushToast);
  const [draft, setDraft] = useState<DashboardWidget>(widget);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);

  const set = <K extends keyof DashboardWidget>(key: K, value: DashboardWidget[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const generate = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    try {
      const result = await invoke('ai.run', {
        connectionId,
        feature: 'nl_to_sql',
        prompt: aiPrompt,
      });
      if (result.sql) {
        set('sql', result.sql);
        pushToast('Query generated', 'success');
      } else {
        pushToast('No SQL was generated', 'error');
      }
    } catch {
      pushToast('Could not generate SQL', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onCancel} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg animate-scale-in flex-col overflow-hidden rounded-xl border border-border bg-overlay shadow-popover">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Widget</h2>
          <button
            onClick={onCancel}
            className="grid h-7 w-7 place-items-center rounded text-content-subtle hover:bg-surface-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <Field label="Title">
            <input
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-surface-2 px-2 text-sm outline-none focus:border-accent"
            />
          </Field>

          {/* AI assist */}
          <div className="rounded-lg border border-accent/30 bg-accent-soft/40 p-2.5">
            <label className="mb-1 flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-accent">
              <WandSparkles className="h-3 w-3" /> Generate query with AI
            </label>
            <div className="flex gap-1.5">
              <input
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generate()}
                placeholder="e.g. signups per day this month"
                className="h-8 flex-1 rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-accent"
              />
              <Button variant="primary" size="sm" onClick={generate} disabled={generating}>
                {generating ? 'Thinking…' : 'Generate'}
              </Button>
            </div>
          </div>

          <Field label="SQL">
            <textarea
              value={draft.sql}
              onChange={(e) => set('sql', e.target.value)}
              rows={4}
              spellCheck={false}
              className="w-full resize-y rounded-md border border-border bg-surface-2 p-2 font-mono text-xs outline-none focus:border-accent"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Chart type">
              <select
                value={draft.chartType}
                onChange={(e) => set('chartType', e.target.value as ChartType)}
                className="h-8 w-full rounded-md border border-border bg-surface-2 px-2 text-sm outline-none focus:border-accent"
              >
                {CHART_TYPES.map((c) => (
                  <option key={c.type} value={c.type}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Width">
              <select
                value={draft.span ?? 1}
                onChange={(e) => set('span', Number(e.target.value) as 1 | 2)}
                className="h-8 w-full rounded-md border border-border bg-surface-2 px-2 text-sm outline-none focus:border-accent"
              >
                <option value={1}>Half</option>
                <option value={2}>Full</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Label column" hint="x-axis / category (optional)">
              <input
                value={draft.labelColumn ?? ''}
                onChange={(e) => set('labelColumn', e.target.value || undefined)}
                className="h-8 w-full rounded-md border border-border bg-surface-2 px-2 text-sm outline-none focus:border-accent"
              />
            </Field>
            <Field label="Value column" hint="numeric series (optional)">
              <input
                value={draft.valueColumns?.[0] ?? ''}
                onChange={(e) => set('valueColumns', e.target.value ? [e.target.value] : undefined)}
                className="h-8 w-full rounded-md border border-border bg-surface-2 px-2 text-sm outline-none focus:border-accent"
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSave(draft)} disabled={!draft.sql.trim()}>
            Save widget
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-2xs font-medium uppercase tracking-wide text-content-subtle">
        {label}
        {hint && <span className="ml-1 normal-case text-content-subtle/70">· {hint}</span>}
      </span>
      {children}
    </label>
  );
}
