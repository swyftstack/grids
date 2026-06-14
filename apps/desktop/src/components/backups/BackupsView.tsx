import { useEffect, useState } from 'react';
import {
  Archive,
  Download,
  Trash2,
  Upload,
  Database,
  FileCode,
  Loader2,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import type { BackupFormat, BackupRecord, BackupScope } from '@swyftgrid/core';
import { formatBytes, timeAgo } from '@swyftgrid/core';
import { Button, cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { useConnections } from '@/stores/connections';
import { useUi } from '@/stores/ui';
import { Page, Card } from '@/components/common/Page';
import { EmptyState } from '@/components/common/EmptyState';

const SCOPES: { key: BackupScope; label: string; hint: string }[] = [
  { key: 'full', label: 'Full backup', hint: 'Schema + data' },
  { key: 'schema_only', label: 'Schema only', hint: 'Structure, no rows' },
  { key: 'data_only', label: 'Data only', hint: 'Rows, no DDL' },
];

export function BackupsView({ connectionId }: { connectionId: string }) {
  const isProd = useConnections(
    (s) => s.connections.find((c) => c.id === connectionId)?.environment === 'production',
  );
  const pushToast = useUi((s) => s.pushToast);
  const requestConfirm = useUi((s) => s.requestConfirm);
  const [records, setRecords] = useState<BackupRecord[]>([]);
  const [scope, setScope] = useState<BackupScope>('full');
  const [format, setFormat] = useState<BackupFormat>('sql');
  const [creating, setCreating] = useState(false);

  const reload = () => invoke('backups.list', { connectionId }).then(setRecords);
  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId]);

  const create = async () => {
    setCreating(true);
    try {
      await invoke('backups.create', { connectionId, scope, format });
      await reload();
      pushToast('Backup created', 'success');
    } finally {
      setCreating(false);
    }
  };

  const restore = () =>
    requestConfirm({
      title: 'Restore a backup?',
      message:
        (isProd ? 'You are connected to PRODUCTION. ' : '') +
        'Restoring overwrites data in the selected database. This cannot be undone.',
      confirmLabel: 'Choose file & restore',
      tone: 'danger',
      onConfirm: async () => {
        const res = await invoke('backups.restore', {
          connectionId,
          fileName: 'backup.sql',
          sizeBytes: 0,
        });
        pushToast(res.message, res.ok ? 'success' : 'error');
      },
    });

  return (
    <Page
      title="Database Operations"
      description="Create and restore PostgreSQL backups"
      actions={
        <Button variant="outline" onClick={restore}>
          <Upload className="h-3.5 w-3.5" /> Restore
        </Button>
      }
    >
      {/* Create backup */}
      <Card className="mb-6 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Database className="h-4 w-4 text-content-muted" /> Create backup
        </h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                scope === s.key
                  ? 'border-accent bg-accent-soft'
                  : 'border-border hover:border-border-strong',
              )}
            >
              <div className="text-sm font-medium">{s.label}</div>
              <div className="text-2xs text-content-subtle">{s.hint}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex rounded-md border border-border bg-surface-2 p-0.5">
            {(['sql', 'custom'] as BackupFormat[]).map((f) => (
              <button
                key={f}
                onClick={() => setFormat(f)}
                className={cn(
                  'flex items-center gap-1 rounded px-2.5 py-1 text-xs capitalize transition-colors',
                  format === f
                    ? 'bg-accent text-accent-fg'
                    : 'text-content-muted hover:text-content',
                )}
              >
                <FileCode className="h-3 w-3" /> {f === 'sql' ? 'SQL' : 'Custom (pg_dump)'}
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={create} disabled={creating} className="ml-auto">
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Create backup
          </Button>
        </div>
        {isProd && (
          <p className="mt-2 flex items-center gap-1.5 text-2xs text-danger">
            <ShieldAlert className="h-3 w-3" /> Production database — backups may be large and
            impact load.
          </p>
        )}
      </Card>

      {/* History */}
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-subtle">
        Backup history
      </h2>
      {records.length === 0 ? (
        <EmptyState icon={<Archive className="h-10 w-10" />} title="No backups yet" />
      ) : (
        <Card>
          {records.map((b, i) => (
            <div
              key={b.id}
              className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t border-border')}
            >
              <Archive className="h-4 w-4 text-content-subtle" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize">
                    {b.scope.replace('_', ' ')}
                  </span>
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-2xs uppercase text-content-subtle">
                    {b.format}
                  </span>
                  {b.status === 'complete' && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                </div>
                <div className="text-2xs text-content-subtle">
                  {formatBytes(b.sizeBytes)} · {timeAgo(b.createdAt)}
                </div>
              </div>
              <button
                onClick={() => pushToast('Re-downloading backup (mock)', 'info')}
                className="grid h-7 w-7 place-items-center rounded-md text-content-muted hover:bg-surface-2 hover:text-content"
                title="Re-download"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={async () => {
                  await invoke('backups.delete', { id: b.id });
                  void reload();
                }}
                className="grid h-7 w-7 place-items-center rounded-md text-content-muted hover:bg-danger/10 hover:text-danger"
                title="Delete record"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </Card>
      )}
    </Page>
  );
}
