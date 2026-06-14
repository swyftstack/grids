import { useRef, useState } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { sql, PostgreSQL } from '@codemirror/lang-sql';
import { Play, SquareCode, WandSparkles, Save, ShieldAlert } from 'lucide-react';
import {
  assessDanger,
  formatSql,
  requiresConfirmation,
  type QueryExecution,
} from '@swyftgrid/core';
import { Button, cn } from '@swyftgrid/ui';
import { invoke, toBackendError } from '@/lib/ipc';
import { useConnections } from '@/stores/connections';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { useIsDark } from '@/lib/hooks';
import { isModifier } from '@/lib/platform';
import { ResultsPanel } from './ResultsPanel';

const STARTER = 'SELECT * FROM users\nORDER BY created_at DESC\nLIMIT 100;';

export function SqlEditor({
  connectionId,
  initialSql,
}: {
  tabId: string;
  connectionId: string;
  initialSql?: string;
}) {
  const dark = useIsDark();
  const maxResultRows = useSettings((s) => s.settings.database.maxResultRows);
  const fontSize = useSettings((s) => s.settings.editor.fontSize);
  const safety = useSettings((s) => s.settings.safety);
  const requestConfirm = useUi((s) => s.requestConfirm);
  const pushToast = useUi((s) => s.pushToast);
  const isProduction = useConnections(
    (s) => s.connections.find((c) => c.id === connectionId)?.environment === 'production',
  );

  const [value, setValue] = useState(initialSql ?? STARTER);
  const [execution, setExecution] = useState<QueryExecution | null>(null);
  const [running, setRunning] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOrAll = (): string => {
    const view = editorRef.current?.view;
    if (view) {
      const { from, to } = view.state.selection.main;
      if (from !== to) return view.state.sliceDoc(from, to);
    }
    return value;
  };

  const execute = async (sqlText: string) => {
    const text = sqlText.trim();
    if (!text) return;
    setRunning(true);
    const started = Date.now();
    try {
      const result = await invoke('query.execute', {
        connectionId,
        sql: text,
        maxRows: maxResultRows,
      });
      setExecution(result);
      const last = result.statements.at(-1);
      void invoke('history.add', {
        entry: {
          connectionId,
          sql: text,
          executionMs: result.totalMs,
          rowsAffected: last?.result?.rowsAffected ?? undefined,
          success: !result.statements.some((s) => s.error),
          errorMessage: result.statements.find((s) => s.error)?.error?.message,
          isFavorite: false,
          executedAt: new Date(started).toISOString(),
        },
      });
    } catch (err) {
      pushToast(toBackendError(err).message, 'error');
    } finally {
      setRunning(false);
    }
  };

  /** Run, prompting for confirmation first when the statement is destructive or we're on prod. */
  const run = async (sqlText: string) => {
    const text = sqlText.trim();
    if (!text) return;
    if (requiresConfirmation(text, isProduction)) {
      const { estimatedRows } = await invoke('query.estimateImpact', {
        connectionId,
        sql: text,
      }).catch(() => ({ estimatedRows: null }));
      const danger = assessDanger(text);
      // The riskiest operations get a type-to-confirm gate when enabled in Safety settings.
      const isDestructive = danger.level === 'destructive';
      const confirmPhrase =
        safety.requireTypeToConfirm && isDestructive ? (danger.reasons[0] ?? 'CONFIRM') : undefined;
      requestConfirm({
        title: 'Run this statement?',
        message:
          (isProduction ? 'You are connected to PRODUCTION. ' : '') +
          `This will run a ${danger.reasons.join(', ') || 'write'} operation` +
          (estimatedRows !== null ? ` affecting ~${estimatedRows.toLocaleString()} rows.` : '.'),
        detail: text,
        confirmLabel: 'Run anyway',
        tone: 'danger',
        confirmPhrase,
        onConfirm: () => void execute(text),
      });
      return;
    }
    void execute(text);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (isModifier(e) && e.key === 'Enter') {
      e.preventDefault();
      void run(selectedOrAll());
    }
  };

  const danger = assessDanger(value);

  const startSplitDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const move = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const ratio = (ev.clientY - rect.top - 40) / (rect.height - 40);
      setSplitRatio(Math.min(0.85, Math.max(0.15, ratio)));
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div ref={containerRef} className="flex h-full flex-col" onKeyDown={onKeyDown}>
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
        <Button size="sm" variant="primary" onClick={() => run(selectedOrAll())} disabled={running}>
          <Play className="h-3.5 w-3.5" /> Run
        </Button>
        <Button size="sm" variant="ghost" onClick={() => run(value)} disabled={running}>
          <SquareCode className="h-3.5 w-3.5" /> Run all
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setValue(formatSql(value))}>
          <WandSparkles className="h-3.5 w-3.5" /> Format
        </Button>
        <SaveQueryButton connectionId={connectionId} sql={value} />

        {danger.level !== 'safe' && (
          <span
            className={cn(
              'ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium',
              danger.level === 'destructive'
                ? 'bg-danger-soft text-danger'
                : 'bg-warning/10 text-warning',
            )}
          >
            <ShieldAlert className="h-3 w-3" />
            {danger.reasons.join(', ')}
          </span>
        )}
      </div>

      {/* Editor */}
      <div className="overflow-hidden" style={{ height: `${splitRatio * 100}%` }}>
        <CodeMirror
          ref={editorRef}
          value={value}
          onChange={setValue}
          theme={dark ? 'dark' : 'light'}
          extensions={[sql({ dialect: PostgreSQL, upperCaseKeywords: true })]}
          height="100%"
          style={{ height: '100%', fontSize }}
          basicSetup={{ highlightActiveLine: true, foldGutter: false }}
        />
      </div>

      {/* Split handle */}
      <div
        onMouseDown={startSplitDrag}
        className="h-1 shrink-0 cursor-row-resize bg-border transition-colors hover:bg-accent"
      />

      {/* Results */}
      <div className="min-h-0 flex-1">
        <ResultsPanel execution={execution} />
      </div>
    </div>
  );
}

function SaveQueryButton({ connectionId, sql }: { connectionId: string; sql: string }) {
  const pushToast = useUi((s) => s.pushToast);
  const save = async () => {
    const name = window.prompt('Save query as:');
    if (!name) return;
    await invoke('savedQueries.save', {
      query: {
        connectionId,
        name,
        sql,
        folderId: null,
        tags: [],
        isFavorite: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    pushToast(`Saved “${name}”`, 'success');
  };
  return (
    <Button size="sm" variant="ghost" onClick={save}>
      <Save className="h-3.5 w-3.5" /> Save
    </Button>
  );
}
