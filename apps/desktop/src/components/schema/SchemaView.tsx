import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Table2,
  KeyRound,
  Puzzle,
  GitCompare,
  Copy,
  Download,
  Play,
  FunctionSquare,
  FileCode,
  Network,
  GitBranch,
} from 'lucide-react';
import type { DiffChange, SchemaDiff, SchemaSnapshot } from '@swyftgrid/core';
import { schemaToSql } from '@swyftgrid/core';
import { cn, Spinner } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { useConnections } from '@/stores/connections';
import { useUi } from '@/stores/ui';
import { openEditor, type SchemaSubView } from '@/lib/actions';
import { Page, Card } from '@/components/common/Page';
import { SubTabBar, useTabView } from '@/components/common/SubTabs';
import { TimelineView } from '@/components/timeline/TimelineView';

const ErdView = lazy(() =>
  import('@/components/erd/ErdView').then((m) => ({ default: m.ErdView })),
);

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <Spinner className="h-5 w-5" />
    </div>
  );
}

/**
 * The unified Schema workspace: object list, generated SQL, the ER diagram, and the change history,
 * all under one tab. The active sub-view lives in the tab payload so the top-nav can deep-link to it.
 */
export function SchemaView({ tabId, connectionId }: { tabId: string; connectionId: string }) {
  const [view, setView] = useTabView<SchemaSubView>(tabId, 'tables');

  return (
    <div className="flex h-full flex-col">
      <SubTabBar
        value={view}
        onChange={setView}
        tabs={[
          { value: 'tables', label: 'Tables', icon: Table2 },
          { value: 'sql', label: 'SQL', icon: FileCode },
          { value: 'diagram', label: 'Diagram', icon: Network },
          { value: 'changes', label: 'Changes', icon: GitBranch },
        ]}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === 'tables' && <SchemaObjects connectionId={connectionId} />}
        {view === 'sql' && <SchemaSql connectionId={connectionId} />}
        {view === 'diagram' && (
          <Suspense fallback={<Loading />}>
            <ErdView connectionId={connectionId} />
          </Suspense>
        )}
        {view === 'changes' && <TimelineView connectionId={connectionId} />}
      </div>
    </div>
  );
}

function SchemaObjects({ connectionId }: { connectionId: string }) {
  const [snapshot, setSnapshot] = useState<SchemaSnapshot | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    invoke('schema.snapshot', { connectionId }).then(setSnapshot);
  }, [connectionId]);

  return (
    <Page
      title="Schema"
      description={
        snapshot
          ? `${snapshot.schemas.length} schema(s) · ${snapshot.tables.length} tables`
          : 'Loading…'
      }
      actions={
        <button
          onClick={() => setComparing((c) => !c)}
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors',
            comparing
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-border bg-surface text-content-muted hover:text-content',
          )}
        >
          <GitCompare className="h-3.5 w-3.5" /> Compare
        </button>
      }
    >
      {comparing && <SchemaDiffPanel connectionId={connectionId} />}

      {!snapshot ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-10 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {snapshot.tables.map((t) => (
            <TableRow key={`${t.schema}.${t.name}`} table={t} />
          ))}

          {snapshot.extensions.length > 0 && (
            <Card className="mt-4 p-4">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-content-subtle">
                <Puzzle className="h-3.5 w-3.5" /> Extensions
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.extensions.map((e) => (
                  <span key={e.name} className="rounded-md bg-surface-2 px-2 py-1 text-xs">
                    {e.name} <span className="text-content-subtle">v{e.version}</span>
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </Page>
  );
}

function SchemaSql({ connectionId }: { connectionId: string }) {
  const pushToast = useUi((s) => s.pushToast);
  const [snapshot, setSnapshot] = useState<SchemaSnapshot | null>(null);

  useEffect(() => {
    invoke('schema.snapshot', { connectionId }).then(setSnapshot);
  }, [connectionId]);

  const sql = useMemo(() => (snapshot ? schemaToSql(snapshot) : ''), [snapshot]);

  const copy = () => {
    navigator.clipboard.writeText(sql);
    pushToast('Schema SQL copied to clipboard', 'success');
  };

  const downloadSql = () => {
    const blob = new Blob([sql], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Page
      title="Schema as SQL"
      description="Generated CREATE statements for the current database"
      actions={
        <>
          <button
            onClick={copy}
            disabled={!snapshot}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-content-muted transition-colors hover:text-content disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" /> Copy SQL
          </button>
          <button
            onClick={downloadSql}
            disabled={!snapshot}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-content-muted transition-colors hover:text-content disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </button>
          <button
            onClick={() => openEditor(connectionId, sql, String(Date.now()), { newTab: true })}
            disabled={!snapshot}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-xs font-medium text-content-muted transition-colors hover:text-content disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Open in editor
          </button>
        </>
      }
    >
      {!snapshot ? (
        <div className="skeleton h-96 rounded-xl" />
      ) : (
        <pre className="overflow-auto rounded-xl border border-border bg-surface-2 p-4 font-mono text-xs leading-relaxed">
          {sql}
        </pre>
      )}
    </Page>
  );
}

function TableRow({ table }: { table: SchemaSnapshot['tables'][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 text-content-subtle transition-transform',
            open && 'rotate-90',
          )}
        />
        <Table2 className="h-4 w-4 text-info" />
        <span className="text-sm font-medium">{table.name}</span>
        <span className="text-2xs text-content-subtle">{table.schema}</span>
        <span className="ml-auto text-2xs text-content-subtle">{table.columns.length} columns</span>
      </button>
      {open && (
        <div className="border-t border-border">
          {table.columns.map((c) => (
            <div
              key={c.name}
              className="flex items-center gap-2 border-b border-border/50 px-4 py-1.5 text-xs last:border-0"
            >
              {c.isPrimaryKey ? (
                <KeyRound className="h-3 w-3 text-warning" />
              ) : c.references ? (
                <FunctionSquare className="h-3 w-3 text-accent" />
              ) : (
                <span className="w-3" />
              )}
              <span className="font-mono">{c.name}</span>
              <span className="text-content-subtle">{c.dataType}</span>
              {c.references && (
                <span className="ml-auto text-2xs text-accent">
                  → {c.references.table}.{c.references.column}
                </span>
              )}
              {!c.nullable && !c.references && (
                <span className="ml-auto text-2xs text-content-subtle">NOT NULL</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function SchemaDiffPanel({ connectionId }: { connectionId: string }) {
  const connections = useConnections((s) => s.connections);
  const connectedIds = useConnections((s) => s.connectedIds);
  const pushToast = useUi((s) => s.pushToast);
  const targets = connections.filter((c) => c.id !== connectionId);
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [diff, setDiff] = useState<SchemaDiff | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!targetId) return;
    setRunning(true);
    try {
      setDiff(
        await invoke('diff.schema', {
          sourceConnectionId: connectionId,
          targetConnectionId: targetId,
        }),
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card className="mb-5 p-4">
      <div className="flex items-center gap-2">
        <span className="text-xs text-content-muted">Compare this database against</span>
        <select
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="h-7 rounded-md border border-border bg-surface px-2 text-xs outline-none focus:border-accent"
        >
          {targets.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {connectedIds.includes(c.id) ? '' : ' (not connected)'}
            </option>
          ))}
        </select>
        <button
          onClick={run}
          disabled={!targetId || running}
          className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-fg hover:bg-accent/90 disabled:opacity-50"
        >
          <Play className="h-3 w-3" /> {running ? 'Comparing…' : 'Run diff'}
        </button>
      </div>

      {diff && (
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            {diff.entries.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs"
              >
                <DiffBadge change={e.change} />
                <span className="text-content-subtle">{e.objectType}</span>
                <span className="font-mono">{e.object}</span>
                <span className="ml-auto truncate text-content-muted">{e.detail}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium">Migration script</span>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(diff.migrationSql);
                    pushToast('Migration copied', 'success');
                  }}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs text-content-muted hover:bg-surface-2"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
                <button
                  onClick={() =>
                    openEditor(connectionId, diff.migrationSql, String(Date.now()), {
                      newTab: true,
                    })
                  }
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs text-content-muted hover:bg-surface-2"
                >
                  <Download className="h-3 w-3" /> Open in editor
                </button>
              </div>
            </div>
            <pre className="max-h-48 overflow-auto rounded-md border border-border bg-surface-2 p-3 font-mono text-2xs">
              {diff.migrationSql}
            </pre>
          </div>
        </div>
      )}
    </Card>
  );
}

const DIFF_STYLES: Record<DiffChange, string> = {
  added: 'bg-success/10 text-success',
  removed: 'bg-danger/10 text-danger',
  changed: 'bg-warning/10 text-warning',
};

export function DiffBadge({ change }: { change: DiffChange }) {
  return (
    <span
      className={cn('rounded px-1.5 py-0.5 text-2xs font-medium capitalize', DIFF_STYLES[change])}
    >
      {change}
    </span>
  );
}
