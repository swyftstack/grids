import { useMemo, useState } from 'react';
import {
  Sparkles,
  WandSparkles,
  BookOpen,
  Gauge,
  TriangleAlert,
  Network,
  Search,
  FileText,
  GitBranch,
  Rows3,
  MessageCircleQuestion,
  ShieldCheck,
  Lock,
  ShieldAlert,
  Play,
  Copy,
  ExternalLink,
  Settings as SettingsIcon,
  Check,
  LayoutDashboard,
} from 'lucide-react';
import {
  AI_FEATURES,
  isFeatureAvailable,
  type AiContextMode,
  type AiFeature,
  type AiResult,
} from '@swyftgrid/core';
import { Button, cn } from '@swyftgrid/ui';
import { invoke } from '@/lib/ipc';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { openEditor, openSettings } from '@/lib/actions';
import { Page, Card } from '@/components/common/Page';
import { DashboardsView } from './DashboardsView';

const ICONS: Record<string, typeof Sparkles> = {
  WandSparkles,
  BookOpen,
  Gauge,
  TriangleAlert,
  Network,
  Search,
  FileText,
  GitBranch,
  Sparkles,
  Rows3,
  MessageCircleQuestion,
  ShieldCheck,
};

export function AiView({ connectionId }: { connectionId: string }) {
  const ai = useSettings((s) => s.settings.ai);
  const ready = ai.enabled && ai.privacyAcknowledged;
  return ready ? <AiWorkspace connectionId={connectionId} /> : <AiConsent />;
}

// ─────────────────────────── consent / onboarding ───────────────────────────

const SCOPES: { key: AiContextMode; label: string; shares: string }[] = [
  {
    key: 'schema_only',
    label: 'Schema only',
    shares: 'Table & column names and types. No row data ever leaves your machine.',
  },
  {
    key: 'manual',
    label: 'Manual',
    shares: 'Only the data you explicitly select for each request.',
  },
  {
    key: 'full',
    label: 'Full context',
    shares: 'Schema and selected database content (rows) may be sent.',
  },
];

function AiConsent() {
  const patch = useSettings((s) => s.patch);
  const ai = useSettings((s) => s.settings.ai);
  const pushToast = useUi((s) => s.pushToast);
  const [scope, setScope] = useState<AiContextMode>(ai.contextMode);
  const [provider, setProvider] = useState(ai.provider);
  const [model, setModel] = useState(ai.model);
  const [apiKey, setApiKey] = useState('');

  const unavailable = useMemo(
    () => AI_FEATURES.filter((f) => !isFeatureAvailable(f.key, scope)),
    [scope],
  );

  const enable = async () => {
    await patch('ai', {
      enabled: true,
      privacyAcknowledged: true,
      contextMode: scope,
      provider,
      model,
      hasApiKey: provider === 'ollama' ? true : apiKey.length > 0,
    });
    pushToast('AI features enabled', 'success');
  };

  return (
    <Page
      title="AI"
      description="Set up AI features — disabled by default, bring your own key"
      width="max-w-3xl"
    >
      {/* Privacy warning */}
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="text-sm text-content">
          <p className="font-medium">Privacy notice</p>
          <p className="mt-1 text-content-muted">
            AI features use your own API key. Depending on the feature, schema definitions, query
            text, and selected database content may be transmitted to your chosen AI provider. Do
            not enable AI on sensitive databases unless approved by your organization.
          </p>
        </div>
      </div>

      {/* Data sharing choice */}
      <Card className="mb-5 p-4">
        <h2 className="mb-1 text-sm font-semibold">What data may AI access?</h2>
        <p className="mb-3 text-xs text-content-muted">
          This determines which features are available. You can change it any time.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SCOPES.map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                scope === s.key
                  ? 'border-accent bg-accent-soft'
                  : 'border-border hover:border-border-strong',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{s.label}</span>
                {scope === s.key && <Check className="h-4 w-4 text-accent" />}
              </div>
              <p className="mt-1 text-2xs text-content-muted">{s.shares}</p>
            </button>
          ))}
        </div>

        {/* Feature availability for the chosen scope */}
        <div className="mt-3 rounded-lg border border-border bg-surface-2 p-3">
          {unavailable.length === 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-success">
              <Check className="h-3.5 w-3.5" /> All 12 AI features are available with this choice.
            </p>
          ) : (
            <div className="text-xs">
              <p className="flex items-center gap-1.5 text-warning">
                <Lock className="h-3.5 w-3.5" />
                {unavailable.length} feature{unavailable.length > 1 ? 's' : ''} unavailable with “
                {SCOPES.find((s) => s.key === scope)?.label}”:
              </p>
              <ul className="mt-1.5 space-y-0.5 text-content-muted">
                {unavailable.map((f) => (
                  <li key={f.key}>
                    • <span className="font-medium">{f.label}</span> — needs at least “
                    {SCOPES.find((s) => s.key === f.minScope)?.label}” data sharing
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {/* Provider */}
      <Card className="mb-5 p-4">
        <h2 className="mb-3 text-sm font-semibold">Provider</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-content-muted">Provider</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
              className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-accent"
            >
              {['openai', 'anthropic', 'gemini', 'openrouter', 'ollama'].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-content-muted">Model</span>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>
        {provider === 'ollama' ? (
          <p className="mt-2 text-2xs text-success">
            Ollama runs locally — no data leaves your machine. Recommended for sensitive databases.
          </p>
        ) : (
          <label className="mt-3 block text-xs">
            <span className="mb-1 block font-medium text-content-muted">API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Stored in your OS keychain"
              className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-accent"
            />
          </label>
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" size="lg" onClick={enable}>
          <Sparkles className="h-4 w-4" /> Activate AI features
        </Button>
      </div>
    </Page>
  );
}

// ─────────────────────────── workspace ───────────────────────────

type Selection = 'dashboards' | AiFeature;

function AiWorkspace({ connectionId }: { connectionId: string }) {
  const ai = useSettings((s) => s.settings.ai);
  const [selected, setSelected] = useState<Selection>('nl_to_sql');

  const isDashboards = selected === 'dashboards';
  const feature = isDashboards ? null : selected;
  const meta = feature ? AI_FEATURES.find((f) => f.key === feature)! : null;
  const available = feature ? isFeatureAvailable(feature, ai.contextMode) : true;

  return (
    <div className="flex h-full">
      {/* Feature list */}
      <div className="w-64 shrink-0 overflow-y-auto border-r border-border bg-surface p-2">
        <div className="px-2 py-2 text-2xs font-medium uppercase tracking-wide text-content-subtle">
          Workspace
        </div>
        <button
          onClick={() => setSelected('dashboards')}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
            isDashboards
              ? 'bg-accent-soft text-accent'
              : 'text-content-muted hover:bg-surface-2 hover:text-content',
          )}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Dashboards</span>
        </button>

        <div className="my-2 h-px bg-border" />
        <div className="px-2 py-1 text-2xs font-medium uppercase tracking-wide text-content-subtle">
          AI Features
        </div>
        {AI_FEATURES.map((f) => {
          const Icon = ICONS[f.icon] ?? Sparkles;
          const ok = isFeatureAvailable(f.key, ai.contextMode);
          return (
            <button
              key={f.key}
              onClick={() => setSelected(f.key)}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                selected === f.key
                  ? 'bg-accent-soft text-accent'
                  : 'text-content-muted hover:bg-surface-2 hover:text-content',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">{f.label}</span>
              {!ok && <Lock className="h-3 w-3 shrink-0 text-content-subtle" />}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-2.5">
          <div className="flex items-center gap-2 text-2xs text-content-muted">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            {ai.provider} · {ai.model} · data: {ai.contextMode.replace('_', ' ')}
          </div>
          <button
            onClick={() => openSettings()}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs text-content-muted hover:bg-surface-2 hover:text-content"
          >
            <SettingsIcon className="h-3 w-3" /> AI settings
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isDashboards ? (
            <DashboardsView connectionId={connectionId} />
          ) : available && feature ? (
            <FeaturePanel connectionId={connectionId} feature={feature} key={feature} />
          ) : (
            meta && (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
                <Lock className="h-8 w-8 text-content-subtle/50" />
                <p className="text-sm font-medium">{meta.label} is unavailable</p>
                <p className="max-w-sm text-xs text-content-muted">
                  This feature needs at least “{meta.minScope.replace('_', ' ')}” data sharing.
                  Change your data scope in AI settings to enable it.
                </p>
                <Button variant="outline" onClick={() => openSettings()}>
                  Open AI settings
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function FeaturePanel({ connectionId, feature }: { connectionId: string; feature: AiFeature }) {
  const meta = AI_FEATURES.find((f) => f.key === feature)!;
  const pushToast = useUi((s) => s.pushToast);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<AiResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      setResult(await invoke('ai.run', { connectionId, feature, prompt }));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
      <h1 className="text-lg font-semibold tracking-tight">{meta.label}</h1>
      <p className="mt-1 text-sm text-content-muted">{meta.description}</p>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder={placeholderFor(feature)}
        className="mt-4 w-full resize-y rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-accent"
      />
      <div className="mt-2 flex justify-end">
        <Button variant="primary" onClick={run} disabled={running}>
          <Play className="h-3.5 w-3.5" /> {running ? 'Thinking…' : 'Run'}
        </Button>
      </div>

      {result && (
        <div className="mt-5 space-y-3">
          {result.warnings && result.warnings.length > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-1.5 text-xs text-danger"
                >
                  <TriangleAlert className="h-3.5 w-3.5" /> {w}
                </div>
              ))}
            </div>
          )}
          <Card className="p-4 text-sm leading-relaxed text-content">
            <Markdown text={result.text} />
          </Card>
          {result.sql && (
            <Card>
              <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                <span className="text-2xs font-medium uppercase tracking-wide text-content-subtle">
                  SQL
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.sql!);
                      pushToast('Copied SQL', 'success');
                    }}
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs text-content-muted hover:bg-surface-2"
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </button>
                  <button
                    onClick={() =>
                      openEditor(connectionId, result.sql, String(Date.now()), { newTab: true })
                    }
                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs text-content-muted hover:bg-surface-2"
                  >
                    <ExternalLink className="h-3 w-3" /> Open in editor
                  </button>
                </div>
              </div>
              <pre className="overflow-x-auto p-3 font-mono text-xs">{result.sql}</pre>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function placeholderFor(feature: AiFeature): string {
  switch (feature) {
    case 'nl_to_sql':
      return 'Show users created last week';
    case 'explain_sql':
    case 'optimize_query':
    case 'refactor':
    case 'query_review':
      return 'Paste a SQL query…';
    case 'explain_error':
      return 'Paste a PostgreSQL error message…';
    case 'schema_understanding':
      return 'How does authentication work?';
    case 'data_discovery':
      return 'Where are subscription records stored?';
    case 'business_question':
      return 'How many paying customers signed up last month?';
    case 'migration':
      return 'Add a user preferences table';
    case 'test_data':
      return 'Generate 5 realistic users';
    case 'documentation':
      return 'Document the public schema';
    default:
      return 'Ask anything…';
  }
}

/** A tiny markdown renderer (bold, inline code, headings, lists) — no dependency. */
function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('# '))
          return (
            <h3 key={i} className="text-base font-semibold">
              {line.slice(2)}
            </h3>
          );
        if (line.startsWith('## '))
          return (
            <h4 key={i} className="font-semibold">
              {line.slice(3)}
            </h4>
          );
        return <p key={i} dangerouslySetInnerHTML={{ __html: inline(line) }} />;
      })}
    </div>
  );
}

function inline(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code class="rounded bg-surface-2 px-1 font-mono text-xs">$1</code>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}
