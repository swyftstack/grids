import { useMemo, useState } from 'react';
import { Grid3x3, Braces, MessageSquare, Download, AlertCircle, Copy } from 'lucide-react';
import type { CellValue, QueryExecution, QueryResult } from '@swyftgrid/core';
import { formatDuration, formatNumber } from '@swyftgrid/core';
import { cn } from '@swyftgrid/ui';
import { useUi } from '@/stores/ui';

type View = 'grid' | 'json' | 'messages';

export function ResultsPanel({ execution }: { execution: QueryExecution | null }) {
  const [view, setView] = useState<View>('grid');
  const pushToast = useUi((s) => s.pushToast);

  const { result, error, messages } = useMemo(() => summarise(execution), [execution]);

  if (!execution) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-content-subtle">
        Run a query to see results · ⌘↵
      </div>
    );
  }

  const rowsAsObjects = (r: QueryResult) =>
    r.rows.map((row) => Object.fromEntries(r.fields.map((f, i) => [f.name, row[i] ?? null])));

  const exportFile = (format: 'csv' | 'json') => {
    if (!result) return;
    const content =
      format === 'json' ? JSON.stringify(rowsAsObjects(result), null, 2) : toCsv(result);
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swyftgrid-export.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast(`Exported ${format.toUpperCase()}`, 'success');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Tab bar */}
      <div className="flex h-8 shrink-0 items-center gap-1 border-b border-border bg-surface px-2">
        <Tab
          active={view === 'grid'}
          onClick={() => setView('grid')}
          icon={<Grid3x3 className="h-3.5 w-3.5" />}
        >
          Grid
        </Tab>
        <Tab
          active={view === 'json'}
          onClick={() => setView('json')}
          icon={<Braces className="h-3.5 w-3.5" />}
        >
          JSON
        </Tab>
        <Tab
          active={view === 'messages'}
          onClick={() => setView('messages')}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
        >
          Messages
        </Tab>

        <div className="ml-auto flex items-center gap-2 text-2xs text-content-muted">
          {result && (
            <>
              <span>{formatNumber(result.rows.length)} rows</span>
              <span className="text-content-subtle">·</span>
              <span>{formatDuration(execution.totalMs)}</span>
              {result.truncated && <span className="text-warning">truncated</span>}
              <button
                onClick={() => exportFile('csv')}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-surface-2 hover:text-content"
              >
                <Download className="h-3 w-3" /> CSV
              </button>
              <button
                onClick={() => exportFile('json')}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-surface-2 hover:text-content"
              >
                <Download className="h-3 w-3" /> JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto bg-bg">
        {error ? (
          <ErrorView error={error} />
        ) : view === 'grid' && result ? (
          <ResultGrid result={result} />
        ) : view === 'json' && result ? (
          <div className="relative">
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(rowsAsObjects(result), null, 2));
                pushToast('Copied JSON', 'success');
              }}
              className="absolute right-2 top-2 flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-2xs hover:bg-surface-2"
            >
              <Copy className="h-3 w-3" /> Copy
            </button>
            <pre className="p-3 font-mono text-xs leading-relaxed text-content">
              {JSON.stringify(rowsAsObjects(result), null, 2)}
            </pre>
          </div>
        ) : (
          <div className="space-y-1 p-3 font-mono text-xs">
            {messages.map((m, i) => (
              <div key={i} className="text-content-muted">
                {m}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function summarise(execution: QueryExecution | null) {
  if (!execution) return { result: null, error: null, messages: [] as string[] };
  const errored = execution.statements.find((s) => s.error);
  const withResult = [...execution.statements].reverse().find((s) => s.result);
  const messages = execution.statements.map((s) =>
    s.error
      ? `ERROR: ${s.error.message}`
      : s.result
        ? `${s.result.commandTag}${s.result.rowsAffected !== null ? '' : ` (${s.result.rows.length} rows)`}`
        : 'OK',
  );
  return { result: withResult?.result ?? null, error: errored?.error ?? null, messages };
}

function ResultGrid({ result }: { result: QueryResult }) {
  const display = result.rows.slice(0, 1000);
  return (
    <table className="w-full border-collapse text-xs">
      <thead className="sticky top-0 z-10 bg-surface">
        <tr>
          <th className="border-b border-r border-border px-2 py-1 text-right font-medium text-content-subtle">
            #
          </th>
          {result.fields.map((f) => (
            <th
              key={f.name}
              className="whitespace-nowrap border-b border-r border-border px-2 py-1 text-left font-medium text-content-muted"
            >
              {f.name}
              <span className="ml-1 font-normal text-content-subtle/60">{f.dataTypeName}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {display.map((row, i) => (
          <tr key={i} className="hover:bg-surface-2/50">
            <td className="border-b border-r border-border/60 px-2 py-1 text-right text-content-subtle">
              {i + 1}
            </td>
            {row.map((cell, j) => (
              <Cell key={j} value={cell} />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Cell({ value }: { value: CellValue }) {
  return (
    <td
      className={cn(
        'max-w-xs truncate border-b border-r border-border/60 px-2 py-1 font-mono',
        value === null && 'italic text-content-subtle/60',
      )}
      title={value === null ? 'NULL' : String(value)}
    >
      {value === null ? 'NULL' : String(value)}
    </td>
  );
}

function ErrorView({ error }: { error: NonNullable<ReturnType<typeof summarise>['error']> }) {
  return (
    <div className="m-3 rounded-lg border border-danger/30 bg-danger/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-danger">
        <AlertCircle className="h-4 w-4" />
        {error.code ? `Error ${error.code}` : 'Query error'}
      </div>
      <p className="mt-2 font-mono text-xs text-content">{error.message}</p>
      {error.detail && <p className="mt-2 text-xs text-content-muted">Detail: {error.detail}</p>}
      {error.hint && <p className="mt-1 text-xs text-success">Hint: {error.hint}</p>}
    </div>
  );
}

function Tab({
  children,
  active,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex h-6 items-center gap-1.5 rounded-md px-2 text-xs transition-colors',
        active ? 'bg-surface-2 text-content' : 'text-content-muted hover:text-content',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function toCsv(result: QueryResult): string {
  const escape = (v: CellValue) => {
    if (v === null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = result.fields.map((f) => f.name).join(',');
  const lines = result.rows.map((r) => r.map(escape).join(','));
  return [header, ...lines].join('\n');
}
