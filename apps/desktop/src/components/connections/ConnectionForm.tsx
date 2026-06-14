import { useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Plug,
  Server,
  Network,
  ArrowUpFromLine,
  Database,
  Plus,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import {
  defaultConnectionConfig,
  defaultSshHostConfig,
  newId,
  type Connection,
  type ConnectionConfig,
  type ConnectionEnvironment,
  type ConnectionMethod,
  type ConnectionTestResult,
  type SshHostConfig,
  type SslMode,
} from '@swyftgrid/core';
import { Button, Input, cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { useConnections } from '@/stores/connections';
import { useUi } from '@/stores/ui';

const SSL_MODES: SslMode[] = ['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'];
const ENVIRONMENTS: ConnectionEnvironment[] = ['development', 'staging', 'production'];

/** Connection methods, in display order — SSH tunnelling is the primary way to connect. */
const METHODS: { key: ConnectionMethod; label: string; icon: typeof Server; hint: string }[] = [
  { key: 'ssh-tunnel', label: 'SSH Tunnel', icon: Server, hint: 'Forward through an SSH server' },
  { key: 'bastion', label: 'Bastion Host', icon: ShieldCheck, hint: 'Forward through a gateway' },
  { key: 'jump-host', label: 'Jump Host', icon: Network, hint: 'Chain through jump hosts' },
  { key: 'direct', label: 'Direct', icon: Database, hint: 'Connect straight to the database' },
];

function blank(): Connection {
  return {
    id: '',
    name: '',
    environment: 'development',
    folderId: null,
    isFavorite: false,
    createdAt: '',
    updatedAt: '',
    config: structuredClone(defaultConnectionConfig),
  };
}

/** Ensure the hop array matches the chosen method (1 hop for tunnel/bastion, 2+ for jump host). */
function hopsForMethod(method: ConnectionMethod, hops: SshHostConfig[]): SshHostConfig[] {
  const existing = hops.length ? hops : [{ ...defaultSshHostConfig }];
  if (method === 'jump-host') {
    return existing.length >= 2 ? existing : [...existing, { ...defaultSshHostConfig }];
  }
  return [existing[0]!];
}

export function ConnectionForm({
  initial,
  onClose,
}: {
  initial?: Connection;
  onClose: () => void;
}) {
  const save = useConnections((s) => s.save);
  const pushToast = useUi((s) => s.pushToast);
  const [draft, setDraft] = useState<Connection>(initial ? structuredClone(initial) : blank());
  const [useConnString, setUseConnString] = useState(!!initial?.config.connectionString);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [saving, setSaving] = useState(false);

  const method: ConnectionMethod = draft.config.method ?? 'direct';
  const hops = draft.config.ssh?.hops ?? [];

  const setConfig = (patch: Partial<ConnectionConfig>) =>
    setDraft((d) => ({ ...d, config: { ...d.config, ...patch } }));

  const setMethod = (next: ConnectionMethod) => {
    if (next === 'direct') {
      setConfig({ method: 'direct' });
      return;
    }
    setConfig({ method: next, ssh: { hops: hopsForMethod(next, hops) } });
  };

  const setHop = (index: number, patch: Partial<SshHostConfig>) =>
    setDraft((d) => {
      const current = d.config.ssh?.hops ?? [];
      const nextHops = current.map((h, i) => (i === index ? { ...h, ...patch } : h));
      return { ...d, config: { ...d.config, ssh: { hops: nextHops } } };
    });

  const addHop = () =>
    setDraft((d) => ({
      ...d,
      config: {
        ...d.config,
        ssh: { hops: [...(d.config.ssh?.hops ?? []), { ...defaultSshHostConfig }] },
      },
    }));

  const removeHop = (index: number) =>
    setDraft((d) => {
      const nextHops = (d.config.ssh?.hops ?? []).filter((_, i) => i !== index);
      return { ...d, config: { ...d.config, ssh: { hops: nextHops } } };
    });

  /** Block test/save with a clear message when SSH fields are incomplete. */
  const sshProblem = (): string | null => {
    if (method === 'direct') return null;
    if (!hops.length) return 'Add at least one SSH host.';
    for (const [i, hop] of hops.entries()) {
      const where = hops.length > 1 ? ` (hop ${i + 1})` : '';
      if (!hop.host.trim()) return `SSH host is required${where}.`;
      if (!hop.username.trim()) return `SSH username is required${where}.`;
      if (hop.auth === 'password' && !hop.password && !initial) {
        return `SSH password is required${where}.`;
      }
      if (hop.auth === 'key' && !hop.privateKey && !hop.privateKeyPath && !initial) {
        return `SSH private key is required${where}.`;
      }
    }
    return null;
  };

  const test = async () => {
    const problem = sshProblem();
    if (problem) {
      pushToast(problem, 'error');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      setTestResult(await invoke('connections.test', { config: draft.config }));
    } finally {
      setTesting(false);
    }
  };

  /** Pin the host keys observed during a successful test so future connections verify them. */
  const pinFingerprints = () => {
    const fps = testResult?.sshHostFingerprints;
    if (!fps?.length) return;
    setDraft((d) => {
      const current = d.config.ssh?.hops ?? [];
      const nextHops = current.map((h, i) =>
        h.hostFingerprint ? h : { ...h, hostFingerprint: fps[i] },
      );
      return { ...d, config: { ...d.config, ssh: { hops: nextHops } } };
    });
    pushToast('Host keys pinned.', 'success');
  };

  const submit = async () => {
    if (!draft.name.trim()) {
      pushToast('Give the connection a name first.', 'error');
      return;
    }
    const problem = sshProblem();
    if (problem) {
      pushToast(problem, 'error');
      return;
    }
    setSaving(true);
    try {
      await save({ ...draft, id: draft.id || newId('conn') });
      pushToast('Connection saved.', 'success');
      onClose();
    } catch {
      pushToast('Could not save connection.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} />
      <div className="relative z-10 flex max-h-[88vh] w-full max-w-lg animate-scale-in flex-col overflow-hidden rounded-xl border border-border bg-overlay shadow-popover">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">
            {initial ? 'Edit connection' : 'New connection'}
          </h2>
          <p className="mt-0.5 text-xs text-content-muted">
            Connection details are stored locally; passwords and SSH keys are kept in your OS
            keychain.
          </p>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <Field label="Name">
            <Input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Production Database"
            />
          </Field>

          <Field label="Environment">
            <div className="flex gap-1.5">
              {ENVIRONMENTS.map((env) => (
                <button
                  key={env}
                  onClick={() => setDraft({ ...draft, environment: env })}
                  className={cn(
                    'flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors',
                    draft.environment === env
                      ? env === 'production'
                        ? 'border-danger bg-danger-soft text-danger'
                        : 'border-accent bg-accent-soft text-accent'
                      : 'border-border text-content-muted hover:border-border-strong',
                  )}
                >
                  {env}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Connection type">
            <div className="grid grid-cols-2 gap-1.5">
              {METHODS.map((m) => {
                const Icon = m.icon;
                const active = method === m.key;
                return (
                  <button
                    key={m.key}
                    onClick={() => setMethod(m.key)}
                    className={cn(
                      'flex items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors',
                      active
                        ? 'border-accent bg-accent-soft'
                        : 'border-border hover:border-border-strong',
                    )}
                  >
                    <Icon
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        active ? 'text-accent' : 'text-content-muted',
                      )}
                    />
                    <span className="min-w-0">
                      <span className={cn('block text-xs font-medium', active && 'text-accent')}>
                        {m.label}
                      </span>
                      <span className="block text-[11px] leading-tight text-content-muted">
                        {m.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          {/* ── SSH section ───────────────────────────────────────────────── */}
          {method !== 'direct' && (
            <div className="space-y-3 rounded-lg border border-border bg-surface/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-content">
                  {method === 'jump-host'
                    ? 'SSH jump chain'
                    : method === 'bastion'
                      ? 'Bastion host'
                      : 'SSH server'}
                </span>
                {method === 'jump-host' && (
                  <button
                    onClick={addHop}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-accent hover:bg-accent-soft"
                  >
                    <Plus className="h-3 w-3" /> Add hop
                  </button>
                )}
              </div>
              {hops.map((hop, i) => (
                <SshHopCard
                  key={i}
                  hop={hop}
                  index={i}
                  showLabel={method === 'jump-host'}
                  isLast={i === hops.length - 1}
                  editing={!!initial}
                  onChange={(patch) => setHop(i, patch)}
                  onRemove={
                    method === 'jump-host' && hops.length > 2 ? () => removeHop(i) : undefined
                  }
                />
              ))}
            </div>
          )}

          {/* ── Database section ──────────────────────────────────────────── */}
          <div className="space-y-3 rounded-lg border border-border bg-surface/40 p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-content">
              <Database className="h-3.5 w-3.5 text-content-muted" /> Database
              {method !== 'direct' && (
                <span className="font-normal text-content-muted">
                  · as reached from the {method === 'jump-host' ? 'final hop' : 'SSH server'}
                </span>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-content-muted">
              <input
                type="checkbox"
                checked={useConnString}
                onChange={(e) => {
                  setUseConnString(e.target.checked);
                  if (!e.target.checked) setConfig({ connectionString: undefined });
                }}
              />
              Use a connection string
            </label>

            {useConnString ? (
              <Field label="Connection string">
                <Input
                  value={draft.config.connectionString ?? ''}
                  onChange={(e) => setConfig({ connectionString: e.target.value })}
                  placeholder="postgres://user:password@host:5432/database"
                />
              </Field>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Field label="Host">
                      <Input
                        value={draft.config.host}
                        onChange={(e) => setConfig({ host: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label="Port">
                    <Input
                      type="number"
                      value={draft.config.port}
                      onChange={(e) => setConfig({ port: Number(e.target.value) || 5432 })}
                    />
                  </Field>
                </div>
                <Field label="Database">
                  <Input
                    value={draft.config.database}
                    onChange={(e) => setConfig({ database: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Username">
                    <Input
                      value={draft.config.username}
                      onChange={(e) => setConfig({ username: e.target.value })}
                    />
                  </Field>
                  <Field label="Password">
                    <Input
                      type="password"
                      value={draft.config.password ?? ''}
                      onChange={(e) => setConfig({ password: e.target.value })}
                      placeholder={initial ? '•••••••• (unchanged)' : ''}
                    />
                  </Field>
                </div>
                <Field label="SSL mode">
                  <select
                    value={draft.config.ssl.mode}
                    onChange={(e) =>
                      setConfig({ ssl: { ...draft.config.ssl, mode: e.target.value as SslMode } })
                    }
                    className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-accent"
                  >
                    {SSL_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
          </div>

          {testResult && (
            <div
              className={cn(
                'space-y-2 rounded-md border px-3 py-2 text-xs',
                testResult.ok
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-danger/30 bg-danger/10 text-danger',
              )}
            >
              <div className="flex items-center gap-2">
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {testResult.ok
                  ? `Connected in ${testResult.latencyMs} ms · ${testResult.serverVersion ?? ''}`
                  : testResult.error}
              </div>
              {testResult.ok && testResult.sshHostFingerprints?.length ? (
                <div className="flex flex-wrap items-center gap-2 text-content-muted">
                  <span className="font-mono text-[11px] break-all">
                    {testResult.sshHostFingerprints.join(' · ')}
                  </span>
                  <button
                    onClick={pinFingerprints}
                    className="rounded-md border border-success/40 px-1.5 py-0.5 text-[11px] text-success hover:bg-success/10"
                  >
                    Pin host key{testResult.sshHostFingerprints.length > 1 ? 's' : ''}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <Button variant="outline" onClick={test} disabled={testing}>
            {testing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plug className="h-3.5 w-3.5" />
            )}
            Test connection
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SshHopCard({
  hop,
  index,
  showLabel,
  isLast,
  editing,
  onChange,
  onRemove,
}: {
  hop: SshHostConfig;
  index: number;
  showLabel: boolean;
  isLast: boolean;
  editing: boolean;
  onChange: (patch: Partial<SshHostConfig>) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="space-y-2.5 rounded-md border border-border/70 bg-bg/40 p-2.5">
      {showLabel && (
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-content-muted">
            <ArrowUpFromLine className="h-3 w-3" />
            {isLast ? 'Target SSH host' : `Jump host ${index + 1}`}
          </span>
          {onRemove && (
            <button
              onClick={onRemove}
              aria-label="Remove hop"
              className="text-content-muted hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Field label="SSH host">
            <Input
              value={hop.host}
              onChange={(e) => onChange({ host: e.target.value })}
              placeholder="bastion.example.com"
            />
          </Field>
        </div>
        <Field label="Port">
          <Input
            type="number"
            value={hop.port}
            onChange={(e) => onChange({ port: Number(e.target.value) || 22 })}
          />
        </Field>
      </div>
      <Field label="SSH username">
        <Input
          value={hop.username}
          onChange={(e) => onChange({ username: e.target.value })}
          placeholder="ubuntu"
        />
      </Field>
      <Field label="Authentication">
        <div className="flex gap-1.5">
          {(['key', 'password'] as const).map((a) => (
            <button
              key={a}
              onClick={() => onChange({ auth: a })}
              className={cn(
                'flex-1 rounded-md border px-2 py-1.5 text-xs capitalize transition-colors',
                hop.auth === a
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border text-content-muted hover:border-border-strong',
              )}
            >
              {a === 'key' ? 'Private key' : 'Password'}
            </button>
          ))}
        </div>
      </Field>
      {hop.auth === 'password' ? (
        <Field label="SSH password">
          <Input
            type="password"
            value={hop.password ?? ''}
            onChange={(e) => onChange({ password: e.target.value })}
            placeholder={editing ? '•••••••• (unchanged)' : ''}
          />
        </Field>
      ) : (
        <>
          <Field label="Private key path">
            <Input
              value={hop.privateKeyPath ?? ''}
              onChange={(e) => onChange({ privateKeyPath: e.target.value })}
              placeholder="~/.ssh/id_ed25519"
            />
          </Field>
          <Field label="Key passphrase (optional)">
            <Input
              type="password"
              value={hop.passphrase ?? ''}
              onChange={(e) => onChange({ passphrase: e.target.value })}
              placeholder={editing ? '•••••••• (unchanged)' : ''}
            />
          </Field>
        </>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-content-muted">{label}</span>
      {children}
    </label>
  );
}
