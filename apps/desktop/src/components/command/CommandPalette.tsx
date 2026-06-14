import { useEffect } from 'react';
import { Command } from 'cmdk';
import {
  Database,
  LayoutDashboard,
  Table2,
  TerminalSquare,
  FolderTree,
  Network,
  Gauge,
  HeartPulse,
  Activity,
  GitBranch,
  Sparkles,
  Archive,
  Bookmark,
  History,
  Settings as SettingsIcon,
  Plus,
  Sun,
  Moon,
  MonitorSmartphone,
  Star,
} from 'lucide-react';
import { cn } from '@swyftgrid/ui';
import { useUi } from '@/stores/ui';
import { useConnections } from '@/stores/connections';
import { useSettings } from '@/stores/settings';
import {
  switchConnection,
  openDashboard,
  openTables,
  openEditor,
  openSchema,
  openErd,
  openPerformance,
  openHealth,
  openMonitoring,
  openTimeline,
  openAi,
  openSaved,
  openHistory,
  openBackups,
  openConnections,
  openSettings,
} from '@/lib/actions';

export function CommandPalette() {
  const open = useUi((s) => s.commandPaletteOpen);
  const close = useUi((s) => s.closeCommandPalette);
  const { connections, activeConnectionId, connectedIds } = useConnections();
  const patchSettings = useSettings((s) => s.patch);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;
  const active = connections.find((c) => c.id === activeConnectionId);
  const connected = active ? connectedIds.includes(active.id) : false;

  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  return (
    <Overlay onClose={close}>
      <Command
        className="flex max-h-[60vh] flex-col"
        loop
        // Match on name + keywords.
        filter={(value, search, keywords) =>
          (value + ' ' + (keywords ?? []).join(' ')).toLowerCase().includes(search.toLowerCase())
            ? 1
            : 0
        }
      >
        <Command.Input
          autoFocus
          placeholder="Search connections, run a command…"
          className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none placeholder:text-content-subtle"
        />
        <Command.List className="overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-8 text-center text-sm text-content-subtle">
            No results found.
          </Command.Empty>

          <Command.Group heading={<GroupHeading>Connections</GroupHeading>}>
            {connections.map((c) => (
              <Item
                key={c.id}
                value={`connect ${c.name} ${c.config.database}`}
                onSelect={run(() => switchConnection(c.id))}
              >
                <span
                  className="grid h-4 w-4 place-items-center rounded-sm text-accent-fg"
                  style={{ backgroundColor: c.color ?? 'rgb(var(--sg-accent))' }}
                >
                  <Database className="h-2.5 w-2.5" />
                </span>
                <span className="flex-1">{c.name}</span>
                {c.isFavorite && <Star className="h-3 w-3 fill-warning text-warning" />}
                {connectedIds.includes(c.id) && (
                  <span className="text-2xs text-success">connected</span>
                )}
              </Item>
            ))}
          </Command.Group>

          {active && connected && (
            <Command.Group heading={<GroupHeading>{active.name}</GroupHeading>}>
              <Item value="open dashboard" onSelect={run(() => openDashboard(active.id))}>
                <LayoutDashboard className="h-4 w-4 text-content-muted" /> Open dashboard
              </Item>
              <Item value="open tables list" onSelect={run(() => openTables(active.id))}>
                <Table2 className="h-4 w-4 text-content-muted" /> Open tables
              </Item>
              <Item
                value="new sql editor query"
                onSelect={run(() => openEditor(active.id, undefined, String(Date.now())))}
              >
                <TerminalSquare className="h-4 w-4 text-content-muted" /> New SQL editor
              </Item>
              <Item
                value="open schema explorer objects"
                onSelect={run(() => openSchema(active.id))}
              >
                <FolderTree className="h-4 w-4 text-content-muted" /> Open schema
              </Item>
              <Item
                value="er diagram schema visualization"
                onSelect={run(() => openErd(active.id))}
              >
                <Network className="h-4 w-4 text-content-muted" /> Show ER diagram
              </Item>
              <Item
                value="performance query plans slow queries"
                onSelect={run(() => openPerformance(active.id))}
              >
                <Gauge className="h-4 w-4 text-content-muted" /> Performance
              </Item>
              <Item
                value="health score connection indexes"
                onSelect={run(() => openHealth(active.id))}
              >
                <HeartPulse className="h-4 w-4 text-content-muted" /> Health
              </Item>
              <Item
                value="monitoring realtime cpu ram disk connections"
                onSelect={run(() => openMonitoring(active.id))}
              >
                <Activity className="h-4 w-4 text-content-muted" /> Monitoring
              </Item>
              <Item
                value="timeline schema changes history"
                onSelect={run(() => openTimeline(active.id))}
              >
                <GitBranch className="h-4 w-4 text-content-muted" /> Schema changes
              </Item>
              <Item value="ai assistant natural language" onSelect={run(() => openAi(active.id))}>
                <Sparkles className="h-4 w-4 text-content-muted" /> AI workspace
              </Item>
              <Item value="backups backup restore" onSelect={run(() => openBackups(active.id))}>
                <Archive className="h-4 w-4 text-content-muted" /> Backups
              </Item>
              <Item value="saved queries" onSelect={run(() => openSaved(active.id))}>
                <Bookmark className="h-4 w-4 text-content-muted" /> Saved queries
              </Item>
              <Item value="query history" onSelect={run(() => openHistory(active.id))}>
                <History className="h-4 w-4 text-content-muted" /> Query history
              </Item>
            </Command.Group>
          )}

          <Command.Group heading={<GroupHeading>General</GroupHeading>}>
            <Item value="new connection manager" onSelect={run(openConnections)}>
              <Plus className="h-4 w-4 text-content-muted" /> New connection
            </Item>
            <Item value="open settings preferences" onSelect={run(openSettings)}>
              <SettingsIcon className="h-4 w-4 text-content-muted" /> Open settings
            </Item>
            <Item
              value="theme light"
              onSelect={run(() => patchSettings('appearance', { theme: 'light' }))}
            >
              <Sun className="h-4 w-4 text-content-muted" /> Theme: Light
            </Item>
            <Item
              value="theme dark"
              onSelect={run(() => patchSettings('appearance', { theme: 'dark' }))}
            >
              <Moon className="h-4 w-4 text-content-muted" /> Theme: Dark
            </Item>
            <Item
              value="theme system"
              onSelect={run(() => patchSettings('appearance', { theme: 'system' }))}
            >
              <MonitorSmartphone className="h-4 w-4 text-content-muted" /> Theme: System
            </Item>
          </Command.Group>
        </Command.List>
      </Command>
    </Overlay>
  );
}

export function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl animate-scale-in overflow-hidden rounded-xl border border-border bg-overlay shadow-popover">
        {children}
      </div>
    </div>
  );
}

export function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 text-2xs font-medium uppercase tracking-wide text-content-subtle">
      {children}
    </span>
  );
}

export function Item({
  children,
  value,
  onSelect,
  keywords,
}: {
  children: React.ReactNode;
  value: string;
  onSelect: () => void;
  keywords?: string[];
}) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className={cn(
        'flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm text-content',
        'data-[selected=true]:bg-accent data-[selected=true]:text-accent-fg',
      )}
    >
      {children}
    </Command.Item>
  );
}
