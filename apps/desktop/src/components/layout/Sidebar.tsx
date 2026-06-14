import {
  Database,
  Bookmark,
  Archive,
  Settings as SettingsIcon,
  Plus,
  Star,
  ShieldAlert,
  Circle,
  ExternalLink,
  Search,
  LayoutDashboard,
  Table2,
  TerminalSquare,
  FolderTree,
  Gauge,
  Sparkles,
} from 'lucide-react';
import { cn, Kbd } from '@swyftgrid/ui';
import { modSymbol } from '@/lib/platform';
import type { Connection } from '@swyftgrid/core';
import { useConnections } from '@/stores/connections';
import { useSettings } from '@/stores/settings';
import { useUi } from '@/stores/ui';
import { useWorkspace, type TabKind } from '@/stores/workspace';
import { isDemo } from '@/lib/demo';
import {
  openConnections,
  openSaved,
  openBackups,
  openSettings,
  switchConnection,
  openDashboard,
  openTables,
  openEditor,
  openSchema,
  openPerformance,
  openAi,
  type OpenOpts,
} from '@/lib/actions';

type SectionKey = 'dashboard' | 'tables' | 'editor' | 'schema' | 'performance' | 'ai';

interface Section {
  key: SectionKey;
  label: string;
  icon: typeof Table2;
  open: (connectionId: string, opts?: OpenOpts) => void;
  /** Tab kinds that should light this section as active. */
  match: TabKind[];
}

// The per-database views that used to live in the top navbar. Schema folds in the ER diagram +
// change history; Performance folds in health + live monitoring.
const SECTIONS: Section[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    open: openDashboard,
    match: ['dashboard'],
  },
  { key: 'tables', label: 'Tables', icon: Table2, open: openTables, match: ['tables', 'table'] },
  {
    key: 'editor',
    label: 'SQL Editor',
    icon: TerminalSquare,
    open: (c, o) => openEditor(c, undefined, undefined, o),
    match: ['editor'],
  },
  {
    key: 'schema',
    label: 'Schema',
    icon: FolderTree,
    open: openSchema,
    match: ['schema', 'erd', 'timeline'],
  },
  {
    key: 'performance',
    label: 'Performance',
    icon: Gauge,
    open: openPerformance,
    match: ['performance', 'health'],
  },
  { key: 'ai', label: 'AI', icon: Sparkles, open: openAi, match: ['ai'] },
];

export function Sidebar() {
  const { connections, activeConnectionId, connectedIds, connect } = useConnections();
  const activeTab = useWorkspace((s) => s.tabs.find((t) => t.id === s.activeTabId));
  const active = connections.find((c) => c.id === activeConnectionId);
  const activeKind = activeTab?.kind;
  const connected = active ? connectedIds.includes(active.id) : false;
  const aiEnabled = useSettings((s) => s.settings.ai.enabled);

  const favorites = connections.filter((c) => c.isFavorite);
  const others = connections.filter((c) => !c.isFavorite);

  const openSearch = useUi((s) => s.openSearch);
  const openContextMenu = useUi((s) => s.openContextMenu);

  // Hide the AI view entirely when AI is turned off in Settings.
  const sections = SECTIONS.filter((s) => s.key !== 'ai' || aiEnabled);

  const runSection = async (section: Section, opts?: OpenOpts) => {
    if (!active) return;
    if (!connected) {
      const ok = await connect(active.id);
      if (!ok) return;
    }
    section.open(active.id, opts);
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-surface">
      {/* Brand */}
      <div className="flex items-center gap-2 px-3 pb-1 pt-3">
        <div className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[11px] font-bold text-accent-fg">
          S
        </div>
        <span className="select-none text-sm font-semibold tracking-tight">Swyftgrids</span>
      </div>

      {/* Universal search — the single ⌘/Ctrl+K search across schema, data, and saved queries. */}
      <div className="p-2 pb-0">
        <button
          onClick={openSearch}
          disabled={!active}
          className={cn(
            'flex h-8 w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-content-subtle transition-colors',
            'hover:border-border-strong disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 truncate text-left">Search tables, columns, data…</span>
          <span className="flex shrink-0 items-center gap-0.5">
            <Kbd>{modSymbol}</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
      </div>

      {/* Per-database views (moved here from the old top navbar). */}
      <nav className="space-y-0.5 p-2 pb-0">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeTab ? section.match.includes(activeTab.kind) : false;
          return (
            <NavItem
              key={section.key}
              label={section.label}
              icon={<Icon className="h-4 w-4" />}
              active={isActive}
              disabled={!active}
              onClick={() => runSection(section)}
              onContextMenu={(e) =>
                openContextMenu(e, [
                  {
                    label: 'Open',
                    icon: <ExternalLink className="h-3.5 w-3.5" />,
                    onSelect: () => runSection(section),
                  },
                  {
                    label: 'Open in New Tab',
                    icon: <Plus className="h-3.5 w-3.5" />,
                    onSelect: () => runSection(section, { newTab: true }),
                  },
                ])
              }
            />
          );
        })}
      </nav>

      <div className="mx-3 my-2 h-px bg-border" />

      {/* Connection-level tools */}
      <nav className="space-y-0.5 px-2">
        <NavItem
          label="Connections"
          icon={<Database className="h-4 w-4" />}
          active={activeKind === 'connections'}
          onClick={() => openConnections()}
        />
        <NavItem
          label="Saved Queries"
          icon={<Bookmark className="h-4 w-4" />}
          active={activeKind === 'saved'}
          disabled={!active}
          onClick={() => active && openSaved(active.id)}
        />
        <NavItem
          label="Backups"
          icon={<Archive className="h-4 w-4" />}
          active={activeKind === 'backups'}
          disabled={!active}
          onClick={() => active && openBackups(active.id)}
        />
      </nav>

      {/* Databases / workspaces */}
      <div className="flex items-center justify-between px-3 pb-1 pt-3">
        <span className="text-2xs font-medium uppercase tracking-wide text-content-subtle">
          Databases
        </span>
        {!isDemo() && (
          <button
            aria-label="New connection"
            onClick={() => openConnections()}
            className="grid h-5 w-5 place-items-center rounded text-content-subtle hover:bg-surface-2 hover:text-content"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {connections.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <Circle className="h-7 w-7 text-content-subtle/40" />
            <p className="text-xs text-content-muted">No connections yet</p>
            <button
              onClick={() => openConnections()}
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-fg hover:bg-accent/90"
            >
              Add one
            </button>
          </div>
        ) : (
          <>
            {favorites.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                active={c.id === activeConnectionId}
                connected={connectedIds.includes(c.id)}
              />
            ))}
            {favorites.length > 0 && others.length > 0 && <div className="my-1.5 h-px bg-border" />}
            {others.map((c) => (
              <ConnectionRow
                key={c.id}
                connection={c}
                active={c.id === activeConnectionId}
                connected={connectedIds.includes(c.id)}
              />
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-2">
        <NavItem
          label="Settings"
          icon={<SettingsIcon className="h-4 w-4" />}
          active={activeKind === 'settings'}
          onClick={() => openSettings()}
        />
      </div>
    </aside>
  );
}

function NavItem({
  label,
  icon,
  active,
  disabled,
  onClick,
  onContextMenu,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        active
          ? 'bg-accent-soft font-medium text-accent'
          : 'text-content-muted hover:bg-surface-2 hover:text-content',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ConnectionRow({
  connection: c,
  active,
  connected,
}: {
  connection: Connection;
  active: boolean;
  connected: boolean;
}) {
  const openContextMenu = useUi((s) => s.openContextMenu);
  const isProd = c.environment === 'production';

  return (
    <button
      onClick={() => switchConnection(c.id)}
      onContextMenu={(e) =>
        openContextMenu(e, [
          {
            label: 'Open',
            icon: <ExternalLink className="h-3.5 w-3.5" />,
            onSelect: () => switchConnection(c.id),
          },
          {
            label: 'Manage connections',
            icon: <Database className="h-3.5 w-3.5" />,
            onSelect: () => openConnections(),
          },
        ])
      }
      className={cn(
        'group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
        active ? 'bg-surface-2' : 'hover:bg-surface-2',
      )}
    >
      <span
        className="grid h-5 w-5 shrink-0 place-items-center rounded text-accent-fg"
        style={{ backgroundColor: c.color ?? 'rgb(var(--sg-accent))' }}
      >
        <Database className="h-3 w-3" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-sm">{c.name}</span>
          {c.isFavorite && <Star className="h-3 w-3 shrink-0 fill-warning text-warning" />}
          {isProd && <ShieldAlert className="h-3 w-3 shrink-0 text-danger" />}
        </span>
      </span>
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          connected ? 'bg-success' : 'bg-transparent ring-1 ring-border-strong',
        )}
      />
    </button>
  );
}
