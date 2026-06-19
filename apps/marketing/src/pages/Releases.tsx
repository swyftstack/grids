import { Github, Download, Loader2, Tag, ExternalLink } from 'lucide-react';
import { cn } from '@swyftgrid/ui';
import { PageHero, PageSection } from '@/components/Page';
import { outlineClass } from '@/components/cta';
import { Link } from '@/lib/router';
import { LINKS, ROUTES } from '@/lib/brand';
import { Markdown } from '@/lib/markdown';
import { useReleases, formatDate, formatBytes, type Release } from '@/lib/releases';

export function Releases() {
  const { data: releases, loading } = useReleases();

  return (
    <main>
      <PageHero
        eyebrow="Releases"
        title="Release history"
        sub="Every version of Swyftgrids, with notes and downloadable assets — pulled live from GitHub Releases."
      >
        <a href={LINKS.releases} target="_blank" rel="noreferrer" className={outlineClass}>
          <Github className="h-4 w-4" /> View on GitHub
        </a>
      </PageHero>

      <PageSection>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-content-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading releases…
          </div>
        )}

        {!loading && releases.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="text-content-muted">
              No published releases yet, or the GitHub API is temporarily unavailable.
            </p>
            <a
              href={LINKS.releases}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
            >
              Check the Releases page on GitHub <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        <div className="space-y-6">
          {releases.map((r, i) => (
            <ReleaseCard key={r.tag} release={r} latest={i === 0} />
          ))}
        </div>

        {!loading && releases.length > 0 && (
          <p className="mt-10 text-center text-sm text-content-muted">
            Looking for the latest installer?{' '}
            <Link to={ROUTES.downloads} className="font-medium text-accent hover:underline">
              Go to Downloads
            </Link>
            .
          </p>
        )}
      </PageSection>
    </main>
  );
}

function ReleaseCard({ release, latest }: { release: Release; latest: boolean }) {
  return (
    <article className="rounded-2xl border border-border bg-surface p-6">
      <header className="flex flex-wrap items-center gap-3 border-b border-border pb-4">
        <Tag className="h-4 w-4 text-accent" />
        <a
          href={release.url}
          target="_blank"
          rel="noreferrer"
          className="text-lg font-bold tracking-tight hover:text-accent"
        >
          {release.name}
        </a>
        {latest && (
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-semibold text-accent">
            Latest
          </span>
        )}
        {release.prerelease && (
          <span className="rounded-full border border-border px-2 py-0.5 text-2xs font-semibold text-content-muted">
            Pre-release
          </span>
        )}
        {release.date && (
          <span className="ml-auto text-xs text-content-subtle">{formatDate(release.date)}</span>
        )}
      </header>

      {release.body.trim() ? (
        <Markdown source={release.body} />
      ) : (
        <p className="my-3 text-sm text-content-muted">No release notes provided.</p>
      )}

      {release.assets.length > 0 && (
        <div className="mt-4 border-t border-border pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-subtle">
            Assets
          </div>
          <ul className="flex flex-wrap gap-2">
            {release.assets.map((a) => (
              <li key={a.name}>
                <a
                  href={a.url}
                  download
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/50 px-3 py-1.5 text-xs text-content-muted transition-colors hover:border-accent/40 hover:text-content',
                  )}
                >
                  <Download className="h-3.5 w-3.5" />
                  {a.name}
                  {a.size > 0 && (
                    <span className="text-content-subtle">· {formatBytes(a.size)}</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
