import { create } from 'zustand';
import type { Connection, ConnectionFolder, DatabaseDashboard } from '@swyftgrid/core';
import { invoke, toBackendError } from '@/lib/ipc';
import { useUi } from './ui';

interface ConnectionsState {
  connections: Connection[];
  folders: ConnectionFolder[];
  loading: boolean;
  /** The connection whose workspace is currently in focus. */
  activeConnectionId: string | null;
  /** Connection ids with a live session. */
  connectedIds: string[];
  /** Whether a connect attempt is in flight, per connection id. */
  connecting: Record<string, boolean>;
  dashboards: Record<string, DatabaseDashboard>;

  load: () => Promise<void>;
  save: (connection: Connection) => Promise<Connection>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  connect: (id: string) => Promise<boolean>;
  disconnect: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
}

export const useConnections = create<ConnectionsState>((set, get) => ({
  connections: [],
  folders: [],
  loading: true,
  activeConnectionId: null,
  connectedIds: [],
  connecting: {},
  dashboards: {},

  load: async () => {
    set({ loading: true });
    const { connections, folders } = await invoke('connections.list', undefined);
    set({ connections, folders, loading: false });
  },

  save: async (connection) => {
    const saved = await invoke('connections.save', { connection });
    set((s) => {
      const exists = s.connections.some((c) => c.id === saved.id);
      return {
        connections: exists
          ? s.connections.map((c) => (c.id === saved.id ? saved : c))
          : [...s.connections, saved],
      };
    });
    return saved;
  },

  remove: async (id) => {
    await invoke('connections.delete', { id });
    set((s) => ({
      connections: s.connections.filter((c) => c.id !== id),
      connectedIds: s.connectedIds.filter((c) => c !== id),
      activeConnectionId: s.activeConnectionId === id ? null : s.activeConnectionId,
    }));
  },

  duplicate: async (id) => {
    const copy = await invoke('connections.duplicate', { id });
    set((s) => ({ connections: [...s.connections, copy] }));
  },

  toggleFavorite: async (id) => {
    const conn = get().connections.find((c) => c.id === id);
    if (!conn) return;
    await get().save({ ...conn, isFavorite: !conn.isFavorite });
  },

  connect: async (id) => {
    set((s) => ({ connecting: { ...s.connecting, [id]: true } }));
    try {
      const { dashboard } = await invoke('db.connect', { connectionId: id });
      set((s) => ({
        connectedIds: s.connectedIds.includes(id) ? s.connectedIds : [...s.connectedIds, id],
        dashboards: { ...s.dashboards, [id]: dashboard },
        activeConnectionId: id,
        connecting: { ...s.connecting, [id]: false },
      }));
      return true;
    } catch (err) {
      set((s) => ({ connecting: { ...s.connecting, [id]: false } }));
      useUi.getState().pushToast(toBackendError(err).message, 'error');
      return false;
    }
  },

  disconnect: async (id) => {
    await invoke('db.disconnect', { connectionId: id });
    set((s) => ({
      connectedIds: s.connectedIds.filter((c) => c !== id),
      activeConnectionId: s.activeConnectionId === id ? null : s.activeConnectionId,
    }));
  },

  setActive: (id) => set({ activeConnectionId: id }),
}));
