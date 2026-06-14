import type { ComponentType } from 'react';
import { cn } from '@swyftgrid/ui';
import { useWorkspace } from '@/stores/workspace';

/**
 * Read/write the active sub-view of a tab, persisted in the tab's `payload.view`. This keeps the
 * sub-view in workspace state, so it survives tab switches and supports deep links from the nav.
 */
export function useTabView<T extends string>(tabId: string, fallback: T): [T, (view: T) => void] {
  const view = useWorkspace(
    (s) => (s.tabs.find((t) => t.id === tabId)?.payload?.view as T | undefined) ?? fallback,
  );
  const setView = (next: T) => useWorkspace.getState().update(tabId, { payload: { view: next } });
  return [view, setView];
}

export interface SubTab<T extends string> {
  value: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

/** A secondary tab bar shown at the top of a view that hosts several related sub-views. */
export function SubTabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: SubTab<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border bg-surface px-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors',
              active
                ? 'bg-accent-soft text-accent'
                : 'text-content-muted hover:bg-surface-2 hover:text-content',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
