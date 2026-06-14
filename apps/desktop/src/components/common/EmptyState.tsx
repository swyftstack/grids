import type { ReactNode } from 'react';
import { Kbd } from '@swyftgrid/ui';

export function EmptyState({
  title,
  description,
  hint,
  icon,
  action,
}: {
  title: string;
  description?: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
      {icon && <div className="text-content-subtle/50">{icon}</div>}
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="max-w-sm text-sm text-content-muted">{description}</p>}
      {hint && (
        <div className="flex items-center gap-1 text-xs text-content-subtle">
          Try{' '}
          {hint.split('').map((k, i) => (
            <Kbd key={i}>{k}</Kbd>
          ))}
        </div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
