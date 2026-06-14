/**
 * File-backed application store for the self-hosted server.
 *
 * Mirrors the desktop's SQLite store but persists to a single JSON file so the container has no
 * native dependencies. The path is configurable via `SWYFTGRID_DATA_DIR` (default `./data`).
 *
 * Note: in this server build, connection secrets (database passwords and SSH passwords / private
 * keys / passphrases) are stored in the data file. They are always stripped from listings and never
 * logged, but the file itself must be protected (e.g. a mounted secret volume / restricted volume) —
 * see docs/self-hosting.md#security.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  defaultSettings,
  newId,
  type Connection,
  type ConnectionFolder,
  type Dashboard,
  type DashboardInput,
  type QueryHistoryEntry,
  type SavedQuery,
  type SavedQueryFolder,
  type Settings,
} from '@swyftgrid/core';

interface StoreData {
  connections: Connection[];
  folders: ConnectionFolder[];
  settings: Settings;
  history: QueryHistoryEntry[];
  savedQueries: SavedQuery[];
  savedQueryFolders: SavedQueryFolder[];
  dashboards: Dashboard[];
}

const empty: StoreData = {
  connections: [],
  folders: [],
  settings: defaultSettings,
  history: [],
  savedQueries: [],
  savedQueryFolders: [],
  dashboards: [],
};

/** Return a connection with every secret (DB password + SSH hop secrets) removed. */
function withoutSecrets(c: Connection): Connection {
  return {
    ...c,
    config: {
      ...c.config,
      password: undefined,
      ssh: c.config.ssh
        ? {
            hops: c.config.ssh.hops.map((h) => ({
              ...h,
              password: undefined,
              privateKey: undefined,
              passphrase: undefined,
            })),
          }
        : c.config.ssh,
    },
  };
}

/** A blank submission keeps the stored secret; a non-empty one replaces it. */
function pickSecret(incoming: string | undefined, existing: string | undefined) {
  return incoming && incoming.length > 0 ? incoming : existing;
}

/** Carry secrets forward from `prev` for any field the form submitted blank. */
function mergeSecrets(next: Connection, prev?: Connection): Connection {
  const config = { ...next.config };
  config.password = pickSecret(config.password, prev?.config.password);
  if (config.ssh) {
    config.ssh = {
      hops: config.ssh.hops.map((hop, i) => {
        const old = prev?.config.ssh?.hops?.[i];
        return {
          ...hop,
          password: pickSecret(hop.password, old?.password),
          privateKey: pickSecret(hop.privateKey, old?.privateKey),
          passphrase: pickSecret(hop.passphrase, old?.passphrase),
        };
      }),
    };
  }
  return { ...next, config };
}

export class Store {
  private data: StoreData;
  private readonly file: string;

  constructor(dir = process.env.SWYFTGRID_DATA_DIR ?? './data') {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, 'swyftgrid.json');
    this.data = existsSync(this.file)
      ? { ...empty, ...JSON.parse(readFileSync(this.file, 'utf8')) }
      : structuredClone(empty);
  }

  private flush() {
    writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  // Connections
  listConnections() {
    // Strip every secret from the listing.
    const connections = this.data.connections.map(withoutSecrets);
    return { connections, folders: this.data.folders };
  }

  connectionWithSecret(id: string): Connection | undefined {
    return this.data.connections.find((c) => c.id === id);
  }

  saveConnection(connection: Connection): Connection {
    const now = new Date().toISOString();
    const existing = this.data.connections.find((c) => c.id === connection.id);
    // Preserve any DB password / SSH secrets the form left blank on edit.
    const saved: Connection = mergeSecrets(
      {
        ...connection,
        id: connection.id || newId('conn'),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      },
      existing,
    );
    this.data.connections = existing
      ? this.data.connections.map((c) => (c.id === saved.id ? saved : c))
      : [...this.data.connections, saved];
    this.flush();
    return withoutSecrets(saved);
  }

  deleteConnection(id: string) {
    this.data.connections = this.data.connections.filter((c) => c.id !== id);
    this.data.history = this.data.history.filter((h) => h.connectionId !== id);
    this.data.savedQueries = this.data.savedQueries.filter((q) => q.connectionId !== id);
    this.flush();
  }

  duplicateConnection(id: string): Connection {
    const src = this.connectionWithSecret(id);
    if (!src) throw new Error('connection not found');
    const copy: Connection = {
      ...structuredClone(src),
      id: newId('conn'),
      name: `${src.name} copy`,
      isFavorite: false,
    };
    this.data.connections.push(copy);
    this.flush();
    return withoutSecrets(copy);
  }

  touchConnection(id: string) {
    const c = this.data.connections.find((x) => x.id === id);
    if (c) {
      c.lastConnectedAt = new Date().toISOString();
      this.flush();
    }
  }

  saveFolder(folder: ConnectionFolder): ConnectionFolder {
    const saved = { ...folder, id: folder.id || newId('folder') };
    this.data.folders = this.data.folders.some((f) => f.id === saved.id)
      ? this.data.folders.map((f) => (f.id === saved.id ? saved : f))
      : [...this.data.folders, saved];
    this.flush();
    return saved;
  }

  deleteFolder(id: string) {
    this.data.folders = this.data.folders.filter((f) => f.id !== id);
    this.flush();
  }

  // Settings
  getSettings(): Settings {
    return this.data.settings;
  }
  setSettings(settings: Settings): Settings {
    this.data.settings = settings;
    this.flush();
    return settings;
  }

  // History
  listHistory(connectionId: string, search?: string): QueryHistoryEntry[] {
    return this.data.history
      .filter((h) => h.connectionId === connectionId && (!search || h.sql.includes(search)))
      .slice(0, 200);
  }
  addHistory(entry: Omit<QueryHistoryEntry, 'id'>): QueryHistoryEntry {
    const saved = { ...entry, id: newId('hist') } as QueryHistoryEntry;
    this.data.history = [saved, ...this.data.history].slice(0, 1000);
    this.flush();
    return saved;
  }
  toggleHistoryFavorite(id: string) {
    this.data.history = this.data.history.map((h) =>
      h.id === id ? { ...h, isFavorite: !h.isFavorite } : h,
    );
    this.flush();
  }
  clearHistory(connectionId: string) {
    this.data.history = this.data.history.filter(
      (h) => h.connectionId !== connectionId || h.isFavorite,
    );
    this.flush();
  }

  // Saved queries
  listSavedQueries(connectionId: string) {
    return {
      queries: this.data.savedQueries.filter((q) => q.connectionId === connectionId),
      folders: this.data.savedQueryFolders.filter((f) => f.connectionId === connectionId),
    };
  }
  saveSavedQuery(query: SavedQuery): SavedQuery {
    const now = new Date().toISOString();
    const existing = this.data.savedQueries.find((q) => q.id === query.id);
    const saved: SavedQuery = {
      ...query,
      id: query.id || newId('sq'),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.data.savedQueries = existing
      ? this.data.savedQueries.map((q) => (q.id === saved.id ? saved : q))
      : [...this.data.savedQueries, saved];
    this.flush();
    return saved;
  }
  deleteSavedQuery(id: string) {
    this.data.savedQueries = this.data.savedQueries.filter((q) => q.id !== id);
    this.flush();
  }
  duplicateSavedQuery(id: string): SavedQuery {
    const src = this.data.savedQueries.find((q) => q.id === id);
    if (!src) throw new Error('saved query not found');
    return this.saveSavedQuery({ ...src, id: '', name: `${src.name} copy` } as SavedQuery);
  }
  saveSavedQueryFolder(folder: SavedQueryFolder): SavedQueryFolder {
    const saved = { ...folder, id: folder.id || newId('sqf') };
    this.data.savedQueryFolders = this.data.savedQueryFolders.some((f) => f.id === saved.id)
      ? this.data.savedQueryFolders.map((f) => (f.id === saved.id ? saved : f))
      : [...this.data.savedQueryFolders, saved];
    this.flush();
    return saved;
  }

  // Dashboards
  listDashboards(connectionId: string): Dashboard[] {
    return this.data.dashboards.filter((d) => d.connectionId === connectionId);
  }
  saveDashboard(input: DashboardInput): Dashboard {
    const now = new Date().toISOString();
    const existing = input.id ? this.data.dashboards.find((d) => d.id === input.id) : undefined;
    const saved: Dashboard = {
      ...input,
      id: input.id || newId('dash'),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.data.dashboards = existing
      ? this.data.dashboards.map((d) => (d.id === saved.id ? saved : d))
      : [...this.data.dashboards, saved];
    this.flush();
    return saved;
  }
  deleteDashboard(id: string) {
    this.data.dashboards = this.data.dashboards.filter((d) => d.id !== id);
    this.flush();
  }
}
