import { Minus, Square, X } from 'lucide-react';
import { cn } from '@swyftgrid/ui';
import { appWindow } from '@/lib/window';
import { isTauri } from '@/lib/ipc';

export function TitleBar() {
  // Only the desktop (Tauri) window needs a draggable title bar with window controls. In the
  // browser/web build the brand lives at the top of the sidebar instead.
  if (!isTauri()) return null;

  return (
    <header
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center justify-end border-b border-border bg-surface px-2"
    >
      <div className="no-drag flex items-center gap-1">
        <WindowButton onClick={appWindow.minimize} label="Minimize">
          <Minus className="h-3.5 w-3.5" />
        </WindowButton>
        <WindowButton onClick={appWindow.toggleMaximize} label="Maximize">
          <Square className="h-3 w-3" />
        </WindowButton>
        <WindowButton onClick={appWindow.close} label="Close" danger>
          <X className="h-3.5 w-3.5" />
        </WindowButton>
      </div>
    </header>
  );
}

function WindowButton({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn(
        'grid h-7 w-7 place-items-center rounded-md text-content-muted transition-colors',
        danger ? 'hover:bg-danger hover:text-white' : 'hover:bg-surface-2 hover:text-content',
      )}
    >
      {children}
    </button>
  );
}
