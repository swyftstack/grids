import { useEffect, useState } from 'react';
import { Loader2, FileText, ExternalLink } from 'lucide-react';
import { PageHero, PageSection } from '@/components/Page';
import { outlineClass } from '@/components/cta';
import { Link } from '@/lib/router';
import { GITHUB_RAW, LINKS, ROUTES } from '@/lib/brand';
import { Markdown } from '@/lib/markdown';

const CHANGELOG_URL = `${GITHUB_RAW}/CHANGELOG.md`;
const CHANGELOG_PAGE = `${LINKS.github}/blob/main/CHANGELOG.md`;

type State = { status: 'loading' | 'ok' | 'error'; text: string };

export function Changelog() {
  const [state, setState] = useState<State>({ status: 'loading', text: '' });

  useEffect(() => {
    let alive = true;
    fetch(CHANGELOG_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => alive && setState({ status: 'ok', text }))
      .catch(() => alive && setState({ status: 'error', text: '' }));
    return () => {
      alive = false;
    };
  }, []);

  // Drop the leading "# Changelog" H1 — the page already has its own title.
  const body = state.text.replace(/^#\s+Changelog\s*\n/, '');

  return (
    <main>
      <PageHero
        eyebrow="Changelog"
        title="What's new"
        sub="A human-readable history of every notable change, grouped into Added, Changed, and Fixed."
      >
        <a href={CHANGELOG_PAGE} target="_blank" rel="noreferrer" className={outlineClass}>
          <FileText className="h-4 w-4" /> View CHANGELOG.md
        </a>
      </PageHero>

      <PageSection>
        {state.status === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-16 text-content-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading changelog…
          </div>
        )}

        {state.status === 'error' && (
          <div className="rounded-2xl border border-border bg-surface p-10 text-center">
            <p className="text-content-muted">Couldn't load the changelog right now.</p>
            <a
              href={CHANGELOG_PAGE}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1.5 font-medium text-accent hover:underline"
            >
              Read it on GitHub <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}

        {state.status === 'ok' && (
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
            <Markdown source={body} />
          </div>
        )}

        <p className="mt-10 text-center text-sm text-content-muted">
          See downloadable builds on the{' '}
          <Link to={ROUTES.releases} className="font-medium text-accent hover:underline">
            Releases page
          </Link>{' '}
          or grab the latest from{' '}
          <Link to={ROUTES.downloads} className="font-medium text-accent hover:underline">
            Downloads
          </Link>
          .
        </p>
      </PageSection>
    </main>
  );
}
