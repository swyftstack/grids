import { useState } from 'react';
import {
  Plus,
  Star,
  Database,
  Pencil,
  Copy,
  Trash2,
  Plug,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import type { Connection } from '@swyftgrid/core';
import { Badge, Button, cn } from '@swyftgrid/ui';
import { useConnections } from '@/stores/connections';
import { useUi } from '@/stores/ui';
import { switchConnection } from '@/lib/actions';
import { isDemo } from '@/lib/demo';
import { ConnectionForm } from './ConnectionForm';
import { EmptyState } from '@/components/common/EmptyState';

export function ConnectionsView() {
  const { connections, connectedIds, connecting, duplicate, remove, toggleFavorite } =
    useConnections();
  const requestConfirm = useUi((s) => s.requestConfirm);
  const [editing, setEditing] = useState<Connection | null>(null);
  const [creating, setCreating] = useState(false);
  const demo = isDemo();

  const favorites = connections.filter((c) => c.isFavorite);
  const others = connections.filter((c) => !c.isFavorite);

  const confirmDelete = (c: Connection) =>
    requestConfirm({
      title: `Delete “${c.name}”?`,
      message: 'This removes the saved connection and its history. This cannot be undone.',
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: () => void remove(c.id),
    });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-8 py-8">
        <header className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Connections</h1>
            <p className="mt-1 text-sm text-content-muted">
              {connections.length} saved {connections.length === 1 ? 'database' : 'databases'}
            </p>
          </div>
          {demo ? (
            <span className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs text-content-subtle">
              Adding databases is disabled in the demo
            </span>
          ) : (
            <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New connection
            </Button>
          )}
        </header>

        {connections.length === 0 ? (
          <EmptyState
            icon={<Database className="h-10 w-10" />}
            title="No connections yet"
            description="Add your first PostgreSQL database to get started."
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> New connection
              </Button>
            }
          />
        ) : (
          <div className="space-y-8">
            {favorites.length > 0 && (
              <Section title="Favorites">
                {favorites.map((c) => (
                  <ConnectionCard
                    key={c.id}
                    connection={c}
                    connected={connectedIds.includes(c.id)}
                    connecting={!!connecting[c.id]}
                    onEdit={() => setEditing(c)}
                    onDuplicate={() => duplicate(c.id)}
                    onDelete={() => confirmDelete(c)}
                    onToggleFavorite={() => toggleFavorite(c.id)}
                  />
                ))}
              </Section>
            )}
            <Section title="All connections">
              {others.map((c) => (
                <ConnectionCard
                  key={c.id}
                  connection={c}
                  connected={connectedIds.includes(c.id)}
                  connecting={!!connecting[c.id]}
                  onEdit={() => setEditing(c)}
                  onDuplicate={() => duplicate(c.id)}
                  onDelete={() => confirmDelete(c)}
                  onToggleFavorite={() => toggleFavorite(c.id)}
                />
              ))}
            </Section>
          </div>
        )}
      </div>

      {(creating || editing) && (
        <ConnectionForm
          initial={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-content-subtle">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function ConnectionCard({
  connection: c,
  connected,
  connecting,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleFavorite,
}: {
  connection: Connection;
  connected: boolean;
  connecting: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const isProd = c.environment === 'production';
  return (
    <div
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-4',
        'transition-all hover:border-border-strong hover:shadow-subtle',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-accent-fg"
          style={{ backgroundColor: c.color ?? 'rgb(var(--sg-accent))' }}
        >
          <Database className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-medium">{c.name}</h3>
            {connected && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
          </div>
          <p className="truncate text-xs text-content-subtle">
            {c.config.connectionString
              ? c.config.connectionString
              : `${c.config.username}@${c.config.host}:${c.config.port}/${c.config.database}`}
          </p>
        </div>
        <button
          aria-label="Toggle favorite"
          onClick={onToggleFavorite}
          className="text-content-subtle transition-colors hover:text-warning"
        >
          <Star className={cn('h-4 w-4', c.isFavorite && 'fill-warning text-warning')} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isProd ? (
            <Badge tone="danger">
              <ShieldAlert className="h-3 w-3" /> production
            </Badge>
          ) : (
            <Badge tone="neutral">{c.environment}</Badge>
          )}
          <Badge tone="neutral">SSL: {c.config.ssl.mode}</Badge>
        </div>

        <div className="flex items-center gap-0.5">
          <IconAction label="Edit" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </IconAction>
          <IconAction label="Duplicate" onClick={onDuplicate}>
            <Copy className="h-3.5 w-3.5" />
          </IconAction>
          <IconAction label="Delete" onClick={onDelete} danger>
            <Trash2 className="h-3.5 w-3.5" />
          </IconAction>
          <Button
            size="sm"
            variant="primary"
            onClick={() => switchConnection(c.id)}
            disabled={connecting}
          >
            {connecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plug className="h-3.5 w-3.5" />
            )}
            {connected ? 'Open' : 'Connect'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function IconAction({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md text-content-muted transition-colors',
        danger ? 'hover:bg-danger/10 hover:text-danger' : 'hover:bg-surface-2 hover:text-content',
      )}
    >
      {children}
    </button>
  );
}
