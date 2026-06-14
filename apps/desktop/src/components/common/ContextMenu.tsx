import { useEffect, useRef, useState } from 'react';
import { cn } from '@swyftgrid/ui';
import { useUi } from '@/stores/ui';

/** A single floating context menu driven by the UI store (`openContextMenu`). */
export function ContextMenu() {
  const menu = useUi((s) => s.contextMenu);
  const close = useUi((s) => s.closeContextMenu);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!menu) return;
    // Keep the menu inside the viewport.
    const el = ref.current;
    const w = el?.offsetWidth ?? 200;
    const h = el?.offsetHeight ?? 240;
    setPos({
      x: Math.min(menu.x, window.innerWidth - w - 8),
      y: Math.min(menu.y, window.innerHeight - h - 8),
    });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [menu, close]);

  if (!menu) return null;

  return (
    <div
      className="fixed inset-0 z-[60]"
      onMouseDown={close}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        ref={ref}
        style={{ left: pos.x, top: pos.y }}
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute min-w-[180px] animate-scale-in overflow-hidden rounded-lg border border-border bg-overlay p-1 shadow-popover"
      >
        {menu.items.map((item, i) => (
          <div key={i}>
            {item.separator && <div className="my-1 h-px bg-border" />}
            <button
              disabled={item.disabled}
              onClick={() => {
                item.onSelect();
                close();
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-xs',
                'transition-colors disabled:opacity-40',
                item.danger ? 'text-danger hover:bg-danger/10' : 'text-content hover:bg-surface-2',
              )}
            >
              {item.icon && <span className="text-content-muted">{item.icon}</span>}
              {item.label}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
