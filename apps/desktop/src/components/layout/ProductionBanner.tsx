import { ShieldAlert } from 'lucide-react';
import { useConnections } from '@/stores/connections';

/**
 * Persistent, unmissable banner shown whenever the active database is a production environment.
 * Part of Production Mode (Part 10) — makes it impossible to forget where you are.
 */
export function ProductionBanner() {
  const active = useConnections((s) => s.connections.find((c) => c.id === s.activeConnectionId));
  if (active?.environment !== 'production') return null;

  return (
    <div className="flex h-7 shrink-0 items-center justify-center gap-2 border-b border-red-700/60 bg-red-600 text-white dark:border-red-900/60 dark:bg-red-950/80 dark:text-red-200">
      <ShieldAlert className="h-3.5 w-3.5" />
      <span className="text-xs font-semibold uppercase tracking-wide">
        Production Database — {active.name}
      </span>
      <span className="hidden text-2xs font-medium text-white/80 sm:inline dark:text-red-200/70">
        · destructive operations require confirmation
      </span>
    </div>
  );
}
