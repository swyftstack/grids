import { Github } from 'lucide-react';
import { Logo } from './Logo';
import { LINKS } from '@/lib/brand';

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-content-muted">
            The modern PostgreSQL client. Fast, lightweight, open source.
          </p>
          <a
            href={LINKS.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-content-muted hover:text-content"
          >
            <Github className="h-4 w-4" /> Star on GitHub
          </a>
        </div>

        <FooterCol
          title="Product"
          links={[
            { label: 'Features', href: '#features' },
            { label: 'AI workspace', href: '#ai' },
            { label: 'Self-hosting', href: '#self-hosting' },
            { label: 'Pricing', href: '#pricing' },
            { label: 'Live demo', href: LINKS.demo, external: true },
          ]}
        />
        <FooterCol
          title="Resources"
          links={[
            { label: 'Documentation', href: `${LINKS.github}#readme`, external: true },
            { label: 'Download', href: '#download' },
            { label: 'FAQ', href: '#faq' },
            { label: 'Report an issue', href: `${LINKS.github}/issues`, external: true },
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            { label: 'SwyftStack', href: LINKS.swyftstack, external: true },
            { label: 'GitHub', href: LINKS.github, external: true },
          ]}
        />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-content-subtle sm:flex-row">
          <span>© {new Date().getFullYear()} SwyftStack. MIT licensed.</span>
          <span>Built by the team behind SwyftStack.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-content-subtle">
        {title}
      </h3>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              {...(l.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              className="text-sm text-content-muted transition-colors hover:text-content"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
