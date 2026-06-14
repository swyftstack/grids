import type { AnchorHTMLAttributes } from 'react';
import { cn } from '@swyftgrid/ui';

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors';

export function PrimaryLink({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        base,
        'bg-accent px-4 py-2.5 text-white shadow-[0_10px_30px_-10px_rgba(249,115,22,0.7)] hover:bg-[#ea6a0c]',
        className,
      )}
      {...props}
    />
  );
}

export function OutlineLink({ className, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      className={cn(
        base,
        'border border-border-strong bg-surface px-4 py-2.5 font-medium text-content hover:bg-surface-2',
        className,
      )}
      {...props}
    />
  );
}
