import type { ReactNode } from 'react';
import { cn } from '@swyftgrid/ui';
import type { HealthStatus } from '@swyftgrid/core';

/** A standard scrollable page with a centered column and a header. */
export function Page({
  title,
  description,
  actions,
  children,
  width = 'max-w-5xl',
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={cn('mx-auto px-8 py-8', width)}>
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="mt-1 text-sm text-content-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
        {children}
      </div>
    </div>
  );
}

export function Card({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface', className)}>{children}</div>
  );
}

const STATUS_STYLES: Record<HealthStatus, string> = {
  healthy: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  critical: 'bg-danger/10 text-danger',
};

const STATUS_DOT: Record<HealthStatus, string> = {
  healthy: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-danger',
};

export function StatusPill({ status, children }: { status: HealthStatus; children?: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-medium capitalize',
        STATUS_STYLES[status],
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[status])} />
      {children ?? status}
    </span>
  );
}

export function StatusDot({ status }: { status: HealthStatus }) {
  return <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[status])} />;
}
