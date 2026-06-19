import type { ReactNode } from 'react';
import { cn } from '@swyftgrid/ui';

/** Shared scaffolding for the standalone pages (Downloads / Releases / Changelog). */

export function PageHero({
  eyebrow,
  title,
  sub,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-0 hero-grid" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-5 pb-12 pt-16 text-center sm:pt-20">
        <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">
          {eyebrow}
        </div>
        <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        {sub && (
          <p className="mx-auto mt-4 max-w-2xl text-balance text-lg text-content-muted">{sub}</p>
        )}
        {children && <div className="mt-7">{children}</div>}
      </div>
    </div>
  );
}

export function PageSection({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn('mx-auto max-w-5xl px-5 py-14', className)}>{children}</section>;
}
