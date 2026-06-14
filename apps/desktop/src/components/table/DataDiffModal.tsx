import { useState } from 'react';
import { X, GitCompare, Play, Plus, Minus, Pencil } from 'lucide-react';
import type { DataDiff } from '@swyftgrid/core';
import { Button, cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { useConnections } from '@/stores/connections';

/** Compare this table's data against the same table in another database (Part 8). */
export function DataDiffModal({
  connectionId,
  schema,
  table,
  onClose,
}: {
  connectionId: string;
  schema: string;
  table: string;
  onClose: () => void;
}) {
  const connections = useConnections((s) => s.connections);
  const targets = connections.filter((c) => c.id !== connectionId);
  const [targetId, setTargetId] = useState(targets[0]?.id ?? '');
  const [diff, setDiff] = useState<DataDiff | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    if (!targetId) return;
    setRunning(true);
    try {
      setDiff(
        await invoke('diff.data', {
          sourceConnectionId: connectionId,
          targetConnectionId: targetId,
          schema,
          table,
        }),
      );
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg animate-scale-in flex-col overflow-hidden rounded-xl border border-border bg-overlay shadow-popover">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <GitCompare className="h-4 w-4" /> Compare data — {table}
          </h2>
          <button onClick={onClose} className="text-content-subtle hover:text-content">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-xs text-content-muted">Target database</span>
          <select
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="h-7 flex-1 rounded-md border border-border bg-surface px-2 text-xs outline-none focus:border-accent"
          >
            {targets.length === 0 && <option value="">No other connections</option>}
            {targets.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Button size="sm" variant="primary" onClick={run} disabled={!targetId || running}>
            <Play className="h-3 w-3" /> {running ? 'Comparing…' : 'Compare'}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {!diff ? (
            <p className="py-8 text-center text-xs text-content-subtle">
              Pick a target database and compare. Differences are matched by primary key.
            </p>
          ) : (
            <>
              <div className="mb-3 flex gap-2">
                <Stat
                  icon={<Plus className="h-3 w-3" />}
                  label="Added"
                  value={diff.added}
                  tone="text-success"
                />
                <Stat
                  icon={<Minus className="h-3 w-3" />}
                  label="Removed"
                  value={diff.removed}
                  tone="text-danger"
                />
                <Stat
                  icon={<Pencil className="h-3 w-3" />}
                  label="Modified"
                  value={diff.modified}
                  tone="text-warning"
                />
              </div>
              <div className="space-y-1">
                {diff.rows.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs"
                  >
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-2xs font-medium capitalize',
                        r.change === 'added'
                          ? 'bg-success/10 text-success'
                          : r.change === 'removed'
                            ? 'bg-danger/10 text-danger'
                            : 'bg-warning/10 text-warning',
                      )}
                    >
                      {r.change}
                    </span>
                    <span className="font-mono">{r.key}</span>
                    <span className="ml-auto truncate text-content-muted">{r.detail}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex flex-1 items-center gap-2 rounded-lg border border-border px-3 py-2">
      <span className={tone}>{icon}</span>
      <div>
        <div className="text-base font-semibold">{value}</div>
        <div className="text-2xs text-content-subtle">{label}</div>
      </div>
    </div>
  );
}
