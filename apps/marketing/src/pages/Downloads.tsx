import { type ComponentType, type ReactNode } from 'react';
import {
  Monitor,
  Apple,
  Terminal,
  Download,
  ShieldCheck,
  FileCheck2,
  Boxes,
  History,
  Play,
} from 'lucide-react';
import { cn } from '@swyftgrid/ui';
import { PageHero, PageSection } from '@/components/Page';
import { PrimaryLink, OutlineLink, outlineClass } from '@/components/cta';
import { Link } from '@/lib/router';
import { DOWNLOADS, LINKS, ROUTES, VERSION_LABEL, type OsKey } from '@/lib/brand';
import { useDetectedOS } from '@/lib/os';
import {
  useLatestRelease,
  assetFor,
  checksumsAsset,
  downloadHref,
  formatBytes,
  formatDate,
} from '@/lib/releases';

const PLATFORM_ICON: Record<OsKey, ComponentType<{ className?: string }>> = {
  windows: Monitor,
  mac: Apple,
  linux: Terminal,
};

export function Downloads() {
  const os = useDetectedOS();
  const { data: latest, loading } = useLatestRelease();
  const platforms = [DOWNLOADS.windows, DOWNLOADS.mac, DOWNLOADS.linux];

  const versionLabel = latest?.tag ?? (loading ? '' : VERSION_LABEL);
  const dateLabel = latest ? formatDate(latest.date) : '';
  const checksums = latest ? checksumsAsset(latest.assets) : undefined;

  return (
    <main>
      <PageHero
        eyebrow="Download"
        title="Get Swyftgrids"
        sub="Free for Windows, macOS, and Linux. No account needed — one click and the installer downloads."
      >
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-content-muted">
          {versionLabel && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Latest release <strong className="font-semibold text-content">{versionLabel}</strong>
            </span>
          )}
          {dateLabel && <span className="text-content-subtle">Released {dateLabel}</span>}
        </div>
      </PageHero>

      <PageSection>
        <div className="grid gap-5 sm:grid-cols-3">
          {platforms.map((p) => {
            const Icon = PLATFORM_ICON[p.os];
            const detected = p.os === os;
            const asset = latest ? assetFor(p.os, latest.assets) : undefined;
            const href = downloadHref(p.os, latest);
            const size = asset ? formatBytes(asset.size) : '';
            return (
              <div
                key={p.os}
                className={cn(
                  'relative flex flex-col items-center rounded-2xl border bg-surface p-7 text-center',
                  detected ? 'border-accent' : 'border-border',
                )}
              >
                {detected && (
                  <span className="absolute right-3 top-3 rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-semibold text-accent">
                    Your platform
                  </span>
                )}
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-content">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-base font-semibold">{p.label}</h2>
                <p className="mt-1 text-xs text-content-subtle">{p.note}</p>
                <PrimaryLink href={href} download className="mt-5 w-full">
                  <Download className="h-4 w-4" /> Download
                </PrimaryLink>
                <code className="mt-3 text-2xs text-content-subtle">{asset?.name ?? p.file}</code>
                {size && <span className="mt-1 text-2xs text-content-subtle">{size}</span>}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-content-muted">
          Prefer not to install? Try the{' '}
          <a
            href={LINKS.demo}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            live demo
          </a>{' '}
          first — sample data, no signup.
        </p>
      </PageSection>

      {/* Verify + Docker */}
      <div className="border-y border-border bg-surface/40">
        <PageSection className="grid gap-8 lg:grid-cols-2">
          <InfoCard
            icon={<ShieldCheck className="h-5 w-5 text-accent" />}
            title="Verify your download"
          >
            <p className="text-sm text-content-muted">
              Every release ships a <code className="text-content">checksums.txt</code> with SHA-256
              hashes for all installers. Compare it after downloading:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-[#0c0c0f] p-3 font-mono text-xs text-content-muted">
              {`# macOS / Linux\nshasum -a 256 -c checksums.txt\n\n# Windows (PowerShell)\nGet-FileHash .\\Swyftgrids-Setup.exe -Algorithm SHA256`}
            </pre>
            {checksums ? (
              <OutlineLink href={checksums.url} download className="mt-4">
                <FileCheck2 className="h-4 w-4" /> Download checksums.txt
              </OutlineLink>
            ) : (
              <OutlineLink href={LINKS.releases} target="_blank" rel="noreferrer" className="mt-4">
                <FileCheck2 className="h-4 w-4" /> Checksums on the release page
              </OutlineLink>
            )}
          </InfoCard>

          <InfoCard icon={<Boxes className="h-5 w-5 text-accent" />} title="Run the web version">
            <p className="text-sm text-content-muted">
              Self-host the web app with Docker — a single admin account, no external services.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-border bg-[#0c0c0f] p-3 font-mono text-xs text-content-muted">
              {`docker run -d --name swyftgrids \\\n  -p 4000:4000 -v swyftgrids-data:/data \\\n  ghcr.io/swyftstack/grids:latest`}
            </pre>
            <OutlineLink
              href={`${LINKS.github}/blob/main/docs/self-hosting.md`}
              target="_blank"
              rel="noreferrer"
              className="mt-4"
            >
              <Boxes className="h-4 w-4" /> Self-hosting guide
            </OutlineLink>
          </InfoCard>
        </PageSection>
      </div>

      <PageSection className="text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to={ROUTES.releases} className={outlineClass}>
            <History className="h-4 w-4" /> Release history
          </Link>
          <a href={LINKS.demo} target="_blank" rel="noreferrer" className={outlineClass}>
            <Play className="h-4 w-4" /> Live demo
          </a>
        </div>
      </PageSection>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="mb-3 flex items-center gap-2 text-base font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}
