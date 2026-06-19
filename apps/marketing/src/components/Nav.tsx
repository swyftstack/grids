import { useState } from 'react';
import { Github, Moon, Sun, Menu, X, Play, Download } from 'lucide-react';
import { cn } from '@swyftgrid/ui';
import { Logo } from './Logo';
import { primaryClass } from './cta';
import { Link } from '@/lib/router';
import { LINKS, NAV_LINKS, ROUTES, type NavLink } from '@/lib/brand';

const linkCls =
  'rounded-md px-3 py-1.5 text-sm text-content-muted transition-colors hover:text-content';

function NavItem({
  link,
  onClick,
  className,
}: {
  link: NavLink;
  onClick?: () => void;
  className?: string;
}) {
  const cls = cn(linkCls, className);
  if (link.to) {
    return (
      <Link to={link.to} onClick={onClick} className={cls}>
        {link.label}
      </Link>
    );
  }
  return (
    <a href={link.href} onClick={onClick} className={cls}>
      {link.label}
    </a>
  );
}

export function Nav({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link to={ROUTES.home} aria-label="Swyftgrids home">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV_LINKS.map((l) => (
            <NavItem key={l.label} link={l} />
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
          <Link
            to={ROUTES.downloads}
            className={cn(primaryClass, 'hidden px-3.5 py-2 sm:inline-flex')}
          >
            <Download className="h-3.5 w-3.5" /> Download
          </Link>
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
              <NavItem
                key={l.label}
                link={l}
                onClick={() => setOpen(false)}
                className="px-2 py-2 hover:bg-surface-2"
              />
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
              <Link
                to={ROUTES.downloads}
                onClick={() => setOpen(false)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ea6a0c]"
              >
                <Download className="h-3.5 w-3.5" /> Download
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
