import { useState } from 'react';
import { Github, Moon, Sun, Menu, X, Play } from 'lucide-react';
import { cn } from '@swyftgrid/ui';
import { Logo } from './Logo';
import { PrimaryLink } from './cta';
import { LINKS, NAV_LINKS } from '@/lib/brand';

export function Nav({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="#top" aria-label="Swyftgrids home">
          <Logo />
        </a>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm text-content-muted transition-colors hover:text-content"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <a
            href={LINKS.github}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="hidden h-9 w-9 place-items-center rounded-lg text-content-muted hover:bg-surface-2 hover:text-content sm:grid"
          >
            <Github className="h-4 w-4" />
          </a>
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="grid h-9 w-9 place-items-center rounded-lg text-content-muted hover:bg-surface-2 hover:text-content"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <a
            href={LINKS.demo}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-content transition-colors hover:bg-surface-2 sm:inline-flex"
          >
            <Play className="h-3.5 w-3.5" /> Live demo
          </a>
          <PrimaryLink href="#download" className="hidden px-3.5 py-2 sm:inline-flex">
            Download
          </PrimaryLink>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            className="grid h-9 w-9 place-items-center rounded-lg text-content-muted hover:bg-surface-2 md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className={cn('border-t border-border bg-bg px-5 py-3 md:hidden')}>
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2 text-sm text-content-muted hover:bg-surface-2 hover:text-content"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              <a
                href={LINKS.demo}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border-strong px-3 py-2 text-sm font-medium"
              >
                <Play className="h-3.5 w-3.5" /> Live demo
              </a>
              <PrimaryLink href="#download" className="flex-1">
                Download
              </PrimaryLink>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
