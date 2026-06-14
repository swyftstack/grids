import type { HTMLAttributes } from 'react';
import { cn } from '../cn.js';

/** Render a keyboard shortcut chip, e.g. <Kbd>⌘</Kbd><Kbd>K</Kbd>. */
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border',
        'bg-surface-2 px-1 font-sans text-2xs font-medium text-content-muted',
        className,
      )}
      {...props}
    />
  );
}
