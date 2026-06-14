import {
  LayoutDashboard,
  Table2,
  TerminalSquare,
  FolderTree,
  Network,
  Gauge,
  HeartPulse,
  GitBranch,
  Sparkles,
  Bookmark,
  History,
  Archive,
  Settings as SettingsIcon,
  Database,
  X,
  Pin,
  PinOff,
  Plus,
} from 'lucide-react';
import { cn } from '@swyftgrid/ui';
import { useWorkspace, type Tab, type TabKind } from '@/stores/workspace';
import { useConnections } from '@/stores/connections';
import { useUi } from '@/stores/ui';
import { openEditor } from '@/lib/actions';

const ICONS: Record<TabKind, typeof Table2> = {
  connections: Database,
  dashboard: LayoutDashboard,
  tables: Table2,
  table: Table2,
  editor: TerminalSquare,
  schema: FolderTree,
  erd: Network,
  performance: Gauge,
  health: HeartPulse,
  timeline: GitBranch,
  ai: Sparkles,
  saved: Bookmark,
  history: History,
  backups: Archive,
  settings: SettingsIcon,
};

export function TabBar() {
  const { tabs, activeTabId, setActive, close, togglePin } = useWorkspace();
  const activeConnectionId = useConnections((s) => s.activeConnectionId);
  const openContextMenu = useUi((s) => s.openContextMenu);

  if (tabs.length === 0) return <div className="h-9 border-b border-border bg-surface" />;

  // Pinned tabs first, preserving relative order.
  const ordered = [...tabs].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned));

  const closeOthers = (keepId: string) =>
    tabs.filter((t) => t.id !== keepId && !t.pinned).forEach((t) => close(t.id));

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-border bg-surface">
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {ordered.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            onSelect={() => setActive(tab.id)}
            onClose={() => close(tab.id)}
            onContextMenu={(e) =>
              openContextMenu(e, [
                {
                  label: tab.pinned ? 'Unpin Tab' : 'Pin Tab',
                  icon: tab.pinned ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  ),
                  onSelect: () => togglePin(tab.id),
                },
                {
                  label: 'Close Tab',
                  icon: <X className="h-3.5 w-3.5" />,
                  onSelect: () => close(tab.id),
                  disabled: tab.pinned,
                },
                {
                  label: 'Close Others',
                  onSelect: () => closeOthers(tab.id),
                  separator: true,
                },
              ])
            }
          />
        ))}
      </div>
      {activeConnectionId && (
        <button
          aria-label="New SQL editor"
          title="New SQL editor tab"
          onClick={() =>
            openEditor(activeConnectionId, undefined, String(Date.now()), { newTab: true })
          }
          className="grid w-9 shrink-0 place-items-center border-l border-border text-content-subtle transition-colors hover:bg-surface-2 hover:text-content"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function TabButton({
  tab,
  active,
  onSelect,
  onClose,
  onContextMenu,
}: {
  tab: Tab;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const Icon = ICONS[tab.kind];
  return (
    <div
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onAuxClick={(e) => {
        if (e.button === 1 && !tab.pinned) onClose();
      }}
      className={cn(
        'group flex h-full max-w-[200px] cursor-pointer items-center gap-2 border-r border-border px-3 text-xs',
        active
          ? 'bg-bg text-content'
          : 'text-content-muted transition-colors hover:bg-surface-2 hover:text-content',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', active && 'text-accent')} />
      <span className="truncate">{tab.title}</span>
      {tab.pinned ? (
        <Pin className="h-3 w-3 shrink-0 fill-content-subtle text-content-subtle" />
      ) : (
        <button
          aria-label="Close tab"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className={cn(
            'grid h-4 w-4 shrink-0 place-items-center rounded opacity-0 transition-opacity hover:bg-border-strong group-hover:opacity-100',
            active && 'opacity-60',
          )}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
