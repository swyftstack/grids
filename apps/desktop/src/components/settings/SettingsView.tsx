import { useEffect, useState } from 'react';
import {
  Paintbrush,
  TerminalSquare,
  Database,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Lock,
  LogOut,
  KeyRound,
} from 'lucide-react';
import type { AiProvider, AiContextMode, ThemeMode } from '@swyftgrid/core';
import { Input, Switch, Button, cn } from '@swyftgrid/ui';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import {
  changeAdminPassword,
  fetchAuthStatus,
  isWebMode,
  logout,
  type AuthStatus,
} from '@/lib/webauth';

export function SettingsView() {
  const { settings, patch } = useSettings();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-8 py-8">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">Settings</h1>

        <Section icon={<Paintbrush className="h-4 w-4" />} title="Appearance">
          <Row label="Theme">
            <Segmented<ThemeMode>
              value={settings.appearance.theme}
              options={['light', 'dark', 'system']}
              onChange={(theme) => patch('appearance', { theme })}
            />
          </Row>
          <Row label="Density">
            <Segmented
              value={settings.appearance.density}
              options={['comfortable', 'compact']}
              onChange={(density) => patch('appearance', { density })}
            />
          </Row>
          <Row label="Reduce motion" hint="Minimise animations">
            <Switch
              checked={settings.appearance.reduceMotion}
              onChange={(reduceMotion) => patch('appearance', { reduceMotion })}
            />
          </Row>
        </Section>

        <Section icon={<TerminalSquare className="h-4 w-4" />} title="Editor">
          <Row label="Font size">
            <NumberInput
              value={settings.editor.fontSize}
              min={10}
              max={24}
              onChange={(fontSize) => patch('editor', { fontSize })}
            />
          </Row>
          <Row label="Tab size">
            <NumberInput
              value={settings.editor.tabSize}
              min={2}
              max={8}
              onChange={(tabSize) => patch('editor', { tabSize })}
            />
          </Row>
          <Row label="Word wrap">
            <Switch
              checked={settings.editor.wordWrap}
              onChange={(wordWrap) => patch('editor', { wordWrap })}
            />
          </Row>
          <Row label="Format on run">
            <Switch
              checked={settings.editor.formatOnRun}
              onChange={(formatOnRun) => patch('editor', { formatOnRun })}
            />
          </Row>
        </Section>

        <Section icon={<Database className="h-4 w-4" />} title="Database">
          <Row label="Connection timeout (s)">
            <NumberInput
              value={settings.database.connectTimeoutSecs}
              min={1}
              max={120}
              onChange={(connectTimeoutSecs) => patch('database', { connectTimeoutSecs })}
            />
          </Row>
          <Row label="Query timeout (s)" hint="0 = no limit">
            <NumberInput
              value={settings.database.queryTimeoutSecs}
              min={0}
              max={600}
              onChange={(queryTimeoutSecs) => patch('database', { queryTimeoutSecs })}
            />
          </Row>
          <Row label="Default page size">
            <NumberInput
              value={settings.database.defaultPageSize}
              min={25}
              max={1000}
              onChange={(defaultPageSize) => patch('database', { defaultPageSize })}
            />
          </Row>
          <Row label="Max result rows" hint="Protects memory in the editor">
            <NumberInput
              value={settings.database.maxResultRows}
              min={1000}
              max={500000}
              step={1000}
              onChange={(maxResultRows) => patch('database', { maxResultRows })}
            />
          </Row>
          <Row label="Search within tables" hint="⌘K search also looks inside table data">
            <Switch
              checked={settings.database.searchWithinTables}
              onChange={(searchWithinTables) => patch('database', { searchWithinTables })}
            />
          </Row>
        </Section>

        <Section icon={<ShieldCheck className="h-4 w-4" />} title="Safety">
          <Row
            label="Always require confirmation"
            hint="Confirm every destructive statement (DELETE / TRUNCATE / DROP)"
          >
            <Switch
              checked={settings.safety.alwaysConfirmDestructive}
              onChange={(alwaysConfirmDestructive) => patch('safety', { alwaysConfirmDestructive })}
            />
          </Row>
          <Row label="Type to confirm" hint="Require typing a phrase for the riskiest operations">
            <Switch
              checked={settings.safety.requireTypeToConfirm}
              onChange={(requireTypeToConfirm) => patch('safety', { requireTypeToConfirm })}
            />
          </Row>
          <Row
            label="Extra confirmation on production"
            hint="Confirm all writes on production databases"
          >
            <Switch
              checked={settings.safety.productionExtraConfirm}
              onChange={(productionExtraConfirm) => patch('safety', { productionExtraConfirm })}
            />
          </Row>
        </Section>

        <AiSection />
        <SecuritySection />
      </div>
    </div>
  );
}

/** Self-hosted only: account + authentication status. No-op in the desktop app. */
function SecuritySection() {
  const pushToast = useUi((s) => s.pushToast);
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAuthStatus().then(setStatus);
  }, []);

  if (!isWebMode() || !status) return null;

  const submit = async () => {
    setError(null);
    setBusy(true);
    const res = await changeAdminPassword(current, next, confirm);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Could not change password');
      return;
    }
    setOpen(false);
    setCurrent('');
    setNext('');
    setConfirm('');
    pushToast('Password updated', 'success');
  };

  return (
    <Section icon={<Lock className="h-4 w-4" />} title="Security">
      <Row label="Authentication">
        <span
          className={cn(
            'rounded-md px-2 py-0.5 text-xs font-medium',
            status.authEnabled ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
          )}
        >
          {status.authEnabled ? 'Enabled' : 'Disabled'}
        </span>
      </Row>
      {status.user && (
        <>
          <Row label="Admin email">
            <span className="text-sm text-content-muted">{status.user.email}</span>
          </Row>
          <Row label="Last login">
            <span className="text-sm text-content-muted">
              {status.user.lastLoginAt ? new Date(status.user.lastLoginAt).toLocaleString() : '—'}
            </span>
          </Row>
          <Row label="Account created">
            <span className="text-sm text-content-muted">
              {new Date(status.user.createdAt).toLocaleDateString()}
            </span>
          </Row>
        </>
      )}

      {status.authEnabled && status.user && (
        <div className="px-4 py-3">
          {!open ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <KeyRound className="h-3.5 w-3.5" /> Change password
              </Button>
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                <LogOut className="h-3.5 w-3.5" /> Log out
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Current password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <Input
                type="password"
                placeholder="New password (min 8 chars)"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <Input
                type="password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              {error && <p className="text-xs text-danger">{error}</p>}
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={submit} disabled={busy}>
                  {busy ? 'Saving…' : 'Update password'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function AiSection() {
  const { settings, patch } = useSettings();
  const requestConfirm = useUi((s) => s.requestConfirm);
  const ai = settings.ai;

  const enable = () => {
    if (ai.privacyAcknowledged) {
      patch('ai', { enabled: true });
      return;
    }
    requestConfirm({
      title: 'Enable AI features?',
      message:
        'AI features use your own API key. Depending on the feature, schema definitions, query text, and selected database content may be transmitted to your chosen AI provider. Do not enable AI on sensitive databases unless approved by your organization.',
      confirmLabel: 'I understand, enable',
      onConfirm: () => patch('ai', { enabled: true, privacyAcknowledged: true }),
    });
  };

  return (
    <Section icon={<Sparkles className="h-4 w-4" />} title="AI (optional)">
      <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-content-muted">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p>
          You provide your own API key (stored in your OS keychain). Nothing is ever transmitted
          until you activate AI and acknowledge the{' '}
          <span className="font-medium text-content">privacy implications</span>. Turning this off
          hides the AI tab entirely.
        </p>
      </div>

      <Row label="Enable AI features" hint="Shows the AI tab; turn off to hide it">
        <Switch
          checked={ai.enabled}
          onChange={(v) => (v ? enable() : patch('ai', { enabled: false }))}
        />
      </Row>

      {ai.enabled && (
        <>
          <Row label="Provider">
            <Segmented<AiProvider>
              value={ai.provider}
              options={['openai', 'anthropic', 'gemini', 'openrouter', 'ollama']}
              onChange={(provider) => patch('ai', { provider })}
            />
          </Row>
          <Row label="Model">
            <Input
              className="max-w-[200px]"
              value={ai.model}
              onChange={(e) => patch('ai', { model: e.target.value })}
            />
          </Row>
          {ai.provider === 'ollama' && (
            <Row label="Base URL" hint="Local Ollama endpoint">
              <Input
                className="max-w-[220px]"
                value={ai.baseUrl ?? 'http://localhost:11434'}
                onChange={(e) => patch('ai', { baseUrl: e.target.value })}
              />
            </Row>
          )}
          <Row label="Context mode" hint="How much data AI may see">
            <Segmented<AiContextMode>
              value={ai.contextMode}
              options={['schema_only', 'manual', 'full']}
              onChange={(contextMode) => patch('ai', { contextMode })}
            />
          </Row>
        </>
      )}
    </Section>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className="text-content-muted">{icon}</span>
        {title}
      </h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-content-subtle">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-md border border-border bg-surface-2 p-0.5">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={cn(
            'rounded px-2.5 py-1 text-xs capitalize transition-colors',
            value === opt ? 'bg-accent text-accent-fg' : 'text-content-muted hover:text-content',
          )}
        >
          {opt.replace('_', ' ')}
        </button>
      ))}
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <Input
      type="number"
      className="w-28"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}
