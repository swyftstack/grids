import { create } from 'zustand';
import { defaultSettings, type Settings } from '@swyftgrid/core';
import { invoke } from '@/lib/ipc';

/**
 * Merge stored settings over the defaults, per section, so that settings persisted by an older
 * version (missing a newly-added section like `safety`) never produce `undefined` access and a
 * blank Settings page.
 */
function mergeSettings(stored: Partial<Settings> | null | undefined): Settings {
  const s = stored ?? {};
  return {
    appearance: { ...defaultSettings.appearance, ...s.appearance },
    editor: { ...defaultSettings.editor, ...s.editor },
    database: { ...defaultSettings.database, ...s.database },
    safety: { ...defaultSettings.safety, ...s.safety },
    ai: { ...defaultSettings.ai, ...s.ai },
  };
}

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  /** Merge a partial update into one settings section and persist. */
  patch: <K extends keyof Settings>(section: K, value: Partial<Settings[K]>) => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loaded: false,
  load: async () => {
    const stored = await invoke('settings.get', undefined);
    // The backend returns null until settings have been saved once; always merge with defaults.
    set({ settings: mergeSettings(stored as Partial<Settings> | null), loaded: true });
  },
  patch: async (section, value) => {
    const next: Settings = {
      ...get().settings,
      [section]: { ...get().settings[section], ...value },
    };
    set({ settings: next });
    await invoke('settings.set', { settings: next });
  },
}));
