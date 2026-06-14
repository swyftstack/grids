import { ShieldAlert, Sun, Moon, MonitorSmartphone } from 'lucide-react';
import { cn } from '@swyftgrid/ui';
import { useConnections } from '@/stores/connections';
import { useSettings } from '@/stores/settings';
import type { ThemeMode } from '@swyftgrid/core';

export function StatusBar() {
  const { connections, activeConnectionId, connectedIds, dashboards } = useConnections();
  const active = connections.find((c) => c.id === activeConnectionId);
  const connected = active ? connectedIds.includes(active.id) : false;
  const dashboard = active ? dashboards[active.id] : undefined;
  const isProd = active?.environment === 'production';

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-surface px-3 text-2xs text-content-muted">
      <div className="flex items-center gap-3">
        {active ? (
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                connected ? 'bg-success' : 'bg-content-subtle',
              )}
            />
            {active.name}
          </span>
        ) : (
          <span>No connection</span>
        )}
        {isProd && (
          <span className="flex items-center gap-1 font-medium text-danger">
            <ShieldAlert className="h-3 w-3" /> PRODUCTION
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {dashboard && (
          <span className="hidden truncate sm:inline">{shortVersion(dashboard.serverVersion)}</span>
        )}
        <ThemeToggle />
      </div>
    </footer>
  );
}

function shortVersion(v: string): string {
  const m = /PostgreSQL\s+([\d.]+)/.exec(v);
  return m ? `PostgreSQL ${m[1]}` : v;
}

const ORDER: ThemeMode[] = ['light', 'dark', 'system'];

function ThemeToggle() {
  const theme = useSettings((s) => s.settings.appearance.theme);
  const patch = useSettings((s) => s.patch);
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : MonitorSmartphone;
  return (
    <button
      aria-label={`Theme: ${theme}`}
      title={`Theme: ${theme} (click for ${next})`}
      onClick={() => patch('appearance', { theme: next })}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-surface-2 hover:text-content"
    >
      <Icon className="h-3 w-3" />
      <span className="capitalize">{theme}</span>
    </button>
  );
}
