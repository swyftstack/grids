/**
 * Application settings. Persisted in the local SQLite store and applied app-wide.
 */

export type ThemeMode = 'light' | 'dark' | 'system';

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'ollama';

/** How much database context the user permits AI features to transmit. Defaults to the safest. */
export type AiContextMode = 'schema_only' | 'manual' | 'full';

export interface AppearanceSettings {
  theme: ThemeMode;
  /** UI density. */
  density: 'comfortable' | 'compact';
  /** Reduce motion for subtle-vs-none animation preference. */
  reduceMotion: boolean;
}

export interface EditorSettings {
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  /** Format SQL automatically on run. */
  formatOnRun: boolean;
  fontFamily: string;
}

export interface DatabaseSettings {
  /** Default connection timeout in seconds. */
  connectTimeoutSecs: number;
  /** Default statement timeout in seconds (0 = no limit). */
  queryTimeoutSecs: number;
  /** Default page size for the table browser. */
  defaultPageSize: number;
  /** Hard cap on rows returned by the SQL editor to protect memory. */
  maxResultRows: number;
  /** When enabled, the ⌘K search also looks inside table data (not just the schema). */
  searchWithinTables: boolean;
}

export interface AiSettings {
  /**
   * Whether the AI area is available in the app. Controls visibility of the AI tab; turning it off
   * hides AI entirely. Independent of {@link AiSettings.privacyAcknowledged}, which gates whether
   * any data may actually be transmitted.
   */
  enabled: boolean;
  provider: AiProvider;
  contextMode: AiContextMode;
  /** Model identifier, provider-specific (e.g. `gpt-4o`, `claude-sonnet-4-6`, `llama3.1`). */
  model: string;
  /** Base URL override — required for Ollama / self-hosted gateways. */
  baseUrl?: string;
  /**
   * API keys are NOT stored here. They live in the OS keychain, keyed by provider.
   * This flag records whether a key has been configured so the UI can reflect it.
   */
  hasApiKey: boolean;
  /** The user has acknowledged the privacy warning. AI cannot be used until true. */
  privacyAcknowledged: boolean;
}

export interface SafetySettings {
  /** Require a confirmation dialog for every destructive statement, on any environment. */
  alwaysConfirmDestructive: boolean;
  /** Require typing a confirmation phrase (e.g. "DROP users") for the most dangerous operations. */
  requireTypeToConfirm: boolean;
  /** Treat production connections with extra care (confirm all writes). */
  productionExtraConfirm: boolean;
}

export interface Settings {
  appearance: AppearanceSettings;
  editor: EditorSettings;
  database: DatabaseSettings;
  safety: SafetySettings;
  ai: AiSettings;
}

export const defaultSettings: Settings = {
  appearance: {
    theme: 'system',
    density: 'comfortable',
    reduceMotion: false,
  },
  editor: {
    fontSize: 13,
    tabSize: 2,
    wordWrap: false,
    formatOnRun: false,
    fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
  },
  database: {
    connectTimeoutSecs: 15,
    queryTimeoutSecs: 30,
    defaultPageSize: 100,
    maxResultRows: 50_000,
    searchWithinTables: false,
  },
  safety: {
    alwaysConfirmDestructive: true,
    requireTypeToConfirm: true,
    productionExtraConfirm: true,
  },
  ai: {
    // The AI area is surfaced by default (the tab is visible). Turning this off in Settings hides
    // the AI tab entirely. No data is ever sent until the user explicitly activates AI and
    // acknowledges the privacy notice (`privacyAcknowledged`), so "visible" ≠ "transmitting".
    enabled: true,
    provider: 'anthropic',
    contextMode: 'schema_only',
    model: 'claude-sonnet-4-6',
    hasApiKey: false,
    privacyAcknowledged: false,
  },
};
