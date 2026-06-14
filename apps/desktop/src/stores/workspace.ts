import { create } from 'zustand';

export type TabKind =
  | 'connections'
  | 'dashboard'
  | 'tables'
  | 'table'
  | 'editor'
  | 'schema'
  | 'erd'
  | 'performance'
  | 'health'
  | 'timeline'
  | 'ai'
  | 'saved'
  | 'history'
  | 'backups'
  | 'settings';

export interface Tab {
  id: string;
  kind: TabKind;
  title: string;
  connectionId?: string;
  /** Pinned tabs are never reused by in-place navigation (IDE-style). */
  pinned?: boolean;
  /** Tab-specific payload (table coordinates, initial SQL, etc.). */
  payload?: Record<string, unknown>;
}

interface WorkspaceState {
  tabs: Tab[];
  activeTabId: string | null;

  /**
   * Navigate **within the current tab** (single-click behavior). Reuses the active tab unless it is
   * pinned, which prevents tab explosion. If a tab with the target id already exists, it's focused.
   */
  navigate: (tab: Tab) => void;
  /** Explicitly open a **new** tab (right-click → Open in New Tab). Focuses an existing match. */
  open: (tab: Tab) => void;
  close: (id: string) => void;
  setActive: (id: string) => void;
  togglePin: (id: string) => void;
  update: (id: string, patch: Partial<Tab>) => void;
  closeForConnection: (connectionId: string) => void;
}

export const useWorkspace = create<WorkspaceState>((set) => ({
  tabs: [],
  activeTabId: null,

  navigate: (tab) =>
    set((s) => {
      // Focus an existing tab with the same identity.
      if (s.tabs.some((t) => t.id === tab.id)) return { activeTabId: tab.id };
      const active = s.tabs.find((t) => t.id === s.activeTabId);
      // Reuse the active tab in place unless it's pinned (or there is none).
      if (active && !active.pinned) {
        return {
          tabs: s.tabs.map((t) => (t.id === active.id ? { ...tab } : t)),
          activeTabId: tab.id,
        };
      }
      return { tabs: [...s.tabs, tab], activeTabId: tab.id };
    }),

  open: (tab) =>
    set((s) => {
      if (s.tabs.some((t) => t.id === tab.id)) return { activeTabId: tab.id };
      return { tabs: [...s.tabs, tab], activeTabId: tab.id };
    }),

  close: (id) =>
    set((s) => {
      const index = s.tabs.findIndex((t) => t.id === id);
      const tabs = s.tabs.filter((t) => t.id !== id);
      let activeTabId = s.activeTabId;
      if (s.activeTabId === id) {
        const neighbour = tabs[index] ?? tabs[index - 1] ?? null;
        activeTabId = neighbour?.id ?? null;
      }
      return { tabs, activeTabId };
    }),

  setActive: (id) => set({ activeTabId: id }),

  togglePin: (id) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, pinned: !t.pinned } : t)) })),

  update: (id, patch) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  closeForConnection: (connectionId) =>
    set((s) => {
      const tabs = s.tabs.filter((t) => t.connectionId !== connectionId);
      const stillActive = tabs.some((t) => t.id === s.activeTabId);
      return { tabs, activeTabId: stillActive ? s.activeTabId : (tabs.at(-1)?.id ?? null) };
    }),
}));

// Tab id helpers keep dedupe consistent across the app.
export const tabIds = {
  connections: () => 'connections',
  settings: () => 'settings',
  dashboard: (c: string) => `dashboard:${c}`,
  tables: (c: string) => `tables:${c}`,
  table: (c: string, schema: string, table: string) => `table:${c}:${schema}.${table}`,
  editor: (c: string, key = 'scratch') => `editor:${c}:${key}`,
  schema: (c: string) => `schema:${c}`,
  erd: (c: string) => `erd:${c}`,
  performance: (c: string) => `performance:${c}`,
  health: (c: string) => `health:${c}`,
  timeline: (c: string) => `timeline:${c}`,
  ai: (c: string) => `ai:${c}`,
  saved: (c: string) => `saved:${c}`,
  history: (c: string) => `history:${c}`,
  backups: (c: string) => `backups:${c}`,
};
