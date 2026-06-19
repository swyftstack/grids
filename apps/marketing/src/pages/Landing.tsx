import { useState, type ComponentType, type ReactNode } from 'react';
import {
  Play,
  Github,
  ShieldCheck,
  Lock,
  Zap,
  Boxes,
  Search,
  Gauge,
  Activity,
  GitCompare,
  Archive,
  ShieldAlert,
  Sparkles,
  LayoutDashboard,
  ListChecks,
  Check,
  Apple,
  Monitor,
  Terminal,
  Download,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@swyftgrid/ui';
import { AppPreview } from '@/components/AppPreview';
import { SqlEditorShot, TableBrowserShot, ErdShot, HealthShot } from '@/components/Shots';
import { PrimaryLink, OutlineLink } from '@/components/cta';
import { Link } from '@/lib/router';
import { LINKS, DOWNLOADS, ROUTES, VERSION_LABEL, type OsKey } from '@/lib/brand';
import { useDetectedOS } from '@/lib/os';
import { useLatestRelease, downloadHref } from '@/lib/releases';

export function Landing() {
  return (
    <main>
      <Hero />
      <TrustStrip />
      <Showcase />
      <Features />
      <AiSection />
      <SelfHosting />
      <Pricing />
      <Downloads />
      <Faq />
      <FinalCta />
    </main>
  );
}

function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn('mx-auto max-w-6xl px-5 py-20', className)}>
      {children}
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-accent">{children}</div>
  );
}

function Heading({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-base text-content-muted">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────── Hero ───────────────────────────────

function Hero() {
  const os = useDetectedOS();
  const { data: latest } = useLatestRelease();
  const target = DOWNLOADS[os];
  const href = downloadHref(os, latest);
  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 hero-grid" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-16 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <a
            href={LINKS.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-content-muted backdrop-blur transition-colors hover:text-content"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Open source · PostgreSQL-first · {VERSION_LABEL}
          </a>

          <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            The modern <span className="text-gradient">PostgreSQL</span> client.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-balance text-lg text-content-muted">
            A fast, clean Postgres client with a SQL editor, schema diagrams, query analysis,
            backups, and optional AI. Without the bloat.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <PrimaryLink href={href} download>
              <Download className="h-4 w-4" /> Download for {target.short}
            </PrimaryLink>
            <OutlineLink href={LINKS.demo} target="_blank" rel="noreferrer">
              <Play className="h-4 w-4" /> Live demo
            </OutlineLink>
          </div>
          <div className="mt-3 text-xs text-content-subtle">
            Free · {target.file} ·{' '}
            <Link
              to={ROUTES.downloads}
              className="text-content-muted hover:text-content hover:underline"
            >
              all platforms
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-content-subtle">
            <Trust icon={<ShieldCheck className="h-3.5 w-3.5" />}>SSL supported</Trust>
            <Trust icon={<Lock className="h-3.5 w-3.5" />}>Private by design</Trust>
            <Trust icon={<Boxes className="h-3.5 w-3.5" />}>Open source</Trust>
            <Trust icon={<Zap className="h-3.5 w-3.5" />}>Windows · macOS · Linux</Trust>
          </div>
        </div>

        <div className="mx-auto mt-14 max-w-5xl">
          <AppPreview />
        </div>
      </div>
    </div>
  );
}

function Trust({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-accent">{icon}</span>
      {children}
    </span>
  );
}

// ─────────────────────────────── Trust strip ───────────────────────────────

function TrustStrip() {
  const stats = [
    { value: '100%', label: 'Local-first. Your data never touches our servers' },
    { value: '6+', label: 'PostgreSQL versions supported (12 to 17)' },
    { value: '20+', label: 'Built-in tools, no plugins to install' },
    { value: 'MIT', label: 'Fully open source' },
  ];
  return (
    <div className="border-y border-border bg-surface/50">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-5 py-10 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="px-3 text-center">
            <div className="text-2xl font-bold text-accent sm:text-3xl">{s.value}</div>
            <div className="mt-1 text-xs text-content-muted">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────── Showcase ───────────────────────────────

const SHOWCASE: {
  shot: ComponentType;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
}[] = [
  {
    shot: SqlEditorShot,
    eyebrow: 'SQL editor',
    title: 'Write, run, and reuse SQL',
    body: 'A multi-tab editor with PostgreSQL autocomplete, formatting, query history, and saved queries.',
    points: ['Execution stats', 'CSV and JSON export'],
  },
  {
    shot: TableBrowserShot,
    eyebrow: 'Table browser',
    title: 'Browse data like a spreadsheet',
    body: 'Fast, virtualized rows with inline editing, filtering, and one-click foreign-key navigation.',
    points: ['Inline editing', 'Follow relationships'],
  },
  {
    shot: ErdShot,
    eyebrow: 'ER diagrams',
    title: 'See your schema at a glance',
    body: 'Interactive diagrams generated automatically, with zoom, pan, search, and image export.',
    points: ['Auto-generated', 'Export to PNG or SVG'],
  },
  {
    shot: HealthShot,
    eyebrow: 'Health and performance',
    title: 'Know your database is healthy',
    body: 'One health score across indexes, bloat, dead tuples, query performance, and storage.',
    points: ['Missing-index hints', 'Slow-query insights'],
  },
];

function Showcase() {
  return (
    <Section className="space-y-16 lg:space-y-24">
      {SHOWCASE.map((s, i) => (
        <div key={s.title} className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          <div className={cn(i % 2 === 1 && 'lg:order-2')}>
            <Eyebrow>{s.eyebrow}</Eyebrow>
            <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">{s.title}</h3>
            <p className="mt-3 max-w-md text-base text-content-muted">{s.body}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {s.points.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-content-muted"
                >
                  <Check className="h-3.5 w-3.5 text-accent" /> {p}
                </span>
              ))}
            </div>
          </div>
          <div className={cn(i % 2 === 1 && 'lg:order-1')}>
            <s.shot />
          </div>
        </div>
      ))}
    </Section>
  );
}

// ─────────────────────────────── Features ───────────────────────────────

interface Feature {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}

const FEATURES: Feature[] = [
  {
    icon: Search,
    title: 'Universal search',
    body: 'Jump to any table, column, view, function, index, or saved query.',
  },
  {
    icon: Gauge,
    title: 'Visual query plans',
    body: 'EXPLAIN output turned into readable insights and bottlenecks.',
  },
  {
    icon: ListChecks,
    title: 'Index inspector',
    body: 'Spot missing, duplicate, and unused indexes with fixes.',
  },
  {
    icon: Activity,
    title: 'Realtime monitoring',
    body: 'Live connections, TPS, cache hit ratio, CPU and memory.',
  },
  {
    icon: GitCompare,
    title: 'Schema and data diff',
    body: 'Compare environments and generate migration scripts.',
  },
  {
    icon: Archive,
    title: 'Backup and restore',
    body: 'SQL and pg_dump backups: full, schema-only, or data-only.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboards',
    body: 'Chart your queries and save dashboards side by side.',
  },
  {
    icon: ShieldAlert,
    title: 'Production safety',
    body: 'Banners, dangerous-query detection, and confirmations.',
  },
];

function Features() {
  return (
    <div className="border-y border-border bg-surface/40">
      <Section id="features">
        <Eyebrow>And more, built in</Eyebrow>
        <Heading
          title="Everything you need to work with Postgres"
          sub="Powerful database tooling in one lightweight app. No plugins to install."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-surface p-5 transition-all hover:border-accent/40 hover:shadow-[0_10px_40px_-20px_rgba(249,115,22,0.5)]"
            >
              <f.icon className="h-5 w-5 text-accent" />
              <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-xs text-content-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────── AI ───────────────────────────────

const AI_FEATURES = [
  'Natural Language → SQL',
  'SQL explanation',
  'Query optimization',
  'Error explanation',
  'Schema understanding',
  'Data discovery',
  'Documentation generation',
  'Migration generation',
  'Query refactoring',
  'Test data generation',
  'Business questions',
  'Query reviews',
];

function AiSection() {
  return (
    <Section id="ai">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Eyebrow>AI workspace · optional</Eyebrow>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            AI that respects your data
          </h2>
          <p className="mt-4 text-base text-content-muted">
            Optional and off until you turn it on. Bring your own key for OpenAI, Anthropic, Gemini,
            or OpenRouter, or run fully local with Ollama. Requests never pass through our servers.
          </p>
          <ul className="mt-6 space-y-2">
            {[
              'Bring your own API key, with no Swyftgrids proxy',
              'Local models via Ollama, so nothing leaves your machine',
              'A clear privacy notice before anything is shared',
            ].map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="text-content-muted">{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4 text-accent" /> Available AI features
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {AI_FEATURES.map((f) => (
              <div
                key={f}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2 text-sm"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

// ─────────────────────────────── Self-hosting ───────────────────────────────

function SelfHosting() {
  const compose = `services:
  swyftgrids:
    image: ghcr.io/swyftstack/grids:latest
    ports:
      - "4000:4000"
    volumes:
      - swyftgrids_data:/data

volumes:
  swyftgrids_data:`;

  return (
    <div className="border-y border-border bg-surface/40">
      <Section id="self-hosting">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Self-hosting</Eyebrow>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Run it inside your own infrastructure
            </h2>
            <p className="mt-4 text-base text-content-muted">
              Deploy the web version with Docker for internal tools and private networks. A single
              admin account is created on first launch, with no SMTP, OAuth, SSO, or invitations.
              Password recovery is handled locally with built-in CLI commands.
            </p>
            <ul className="mt-6 space-y-2">
              {[
                'One container, one volume, zero external services',
                'Single admin account · 30-day cookie sessions',
                'Local CLI recovery: reset-password, create-admin, disable-auth',
              ].map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  <span className="text-content-muted">{p}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <OutlineLink href={LINKS.github} target="_blank" rel="noreferrer">
                <Github className="h-4 w-4" /> View the repo
              </OutlineLink>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-[#0c0c0f]">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5 text-2xs text-content-subtle">
              <Terminal className="h-3.5 w-3.5" /> docker-compose.yml
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-content-muted">
              {compose}
            </pre>
            <div className="border-t border-border/60 px-4 py-3 font-mono text-xs text-content-muted">
              <span className="text-accent">$</span> docker compose up -d
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}

// ─────────────────────────────── Pricing ───────────────────────────────

function Pricing() {
  const tiers = [
    {
      name: 'Desktop',
      price: 'Free',
      note: 'forever',
      desc: 'The full app for Windows, macOS, and Linux.',
      features: [
        'All features included',
        'Unlimited connections',
        'Optional AI (bring your key)',
        'No account required',
      ],
      cta: { label: 'Download', href: '#download', primary: true },
    },
    {
      name: 'Self-hosted',
      price: 'Free',
      note: 'open source',
      desc: 'Run the web version with Docker on your own infrastructure.',
      features: [
        'Single admin account',
        'Cookie sessions + CSRF',
        'CLI recovery commands',
        'MIT licensed',
      ],
      cta: { label: 'View on GitHub', href: LINKS.github, primary: false, external: true },
      featured: true,
    },
    {
      name: 'Managed Postgres',
      price: 'SwyftStack',
      note: 'by the same team',
      desc: 'Managed PostgreSQL, object storage, and verified backups.',
      features: [
        'Provisioned in seconds',
        'Daily verified backups',
        'SSL by default',
        'Scoped credentials',
      ],
      cta: { label: 'Learn more', href: LINKS.swyftstack, primary: false, external: true },
    },
  ];

  return (
    <Section id="pricing">
      <Eyebrow>Pricing</Eyebrow>
      <Heading
        title="Free and open source"
        sub="The client is free forever. Need managed Postgres? Our sister product has you covered."
      />
      <div className="mt-12 grid gap-5 lg:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={cn(
              'flex flex-col rounded-2xl border bg-surface p-6',
              t.featured
                ? 'border-accent shadow-[0_20px_60px_-30px_rgba(249,115,22,0.7)]'
                : 'border-border',
            )}
          >
            {t.featured && (
              <span className="mb-3 inline-flex w-fit rounded-full bg-accent px-2.5 py-0.5 text-2xs font-semibold text-white">
                Most popular
              </span>
            )}
            <h3 className="text-sm font-semibold text-content-muted">{t.name}</h3>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight">{t.price}</span>
              <span className="text-sm text-content-subtle">{t.note}</span>
            </div>
            <p className="mt-2 text-sm text-content-muted">{t.desc}</p>
            <ul className="mt-5 flex-1 space-y-2">
              {t.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-accent" />
                  {f}
                </li>
              ))}
            </ul>
            <a
              href={t.cta.href}
              {...(t.cta.external ? { target: '_blank', rel: 'noreferrer' } : {})}
              className={cn(
                'mt-6 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
                t.cta.primary
                  ? 'bg-accent text-white hover:bg-[#ea6a0c]'
                  : 'border border-border-strong text-content hover:bg-surface-2',
              )}
            >
              {t.cta.label}
            </a>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─────────────────────────────── Downloads ───────────────────────────────

const PLATFORM_ICON: Record<OsKey, ComponentType<{ className?: string }>> = {
  windows: Monitor,
  mac: Apple,
  linux: Terminal,
};

function Downloads() {
  const os = useDetectedOS();
  const { data: latest } = useLatestRelease();
  const platforms = [DOWNLOADS.windows, DOWNLOADS.mac, DOWNLOADS.linux];
  return (
    <div className="border-y border-border bg-surface/40">
      <Section id="download">
        <Eyebrow>Download</Eyebrow>
        <Heading
          title="Get Swyftgrids"
          sub="Free for Windows, macOS, and Linux. One click and the installer downloads, no account needed."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {platforms.map((p) => {
            const Icon = PLATFORM_ICON[p.os];
            const detected = p.os === os;
            const href = downloadHref(p.os, latest);
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
                <h3 className="mt-4 text-base font-semibold">{p.label}</h3>
                <p className="mt-1 text-xs text-content-subtle">{p.note}</p>
                <PrimaryLink href={href} download className="mt-5 w-full">
                  <Download className="h-4 w-4" /> Download
                </PrimaryLink>
                <code className="mt-3 text-2xs text-content-subtle">{p.file}</code>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-content-muted">
          Prefer not to install? Try a live demo first.{' '}
          <a
            href={LINKS.demo}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Sample data, no signup.
          </a>
        </p>
      </Section>
    </div>
  );
}

// ─────────────────────────────── FAQ ───────────────────────────────

const FAQS = [
  {
    q: 'Is Swyftgrids free?',
    a: 'Yes. Swyftgrids is open source and free to download and self-host.',
  },
  {
    q: 'Does my data leave my machine?',
    a: 'No. Swyftgrids connects directly to your database. No database contents are sent to our servers, and there is no telemetry.',
  },
  {
    q: 'Does it support databases other than PostgreSQL?',
    a: 'Not yet. Swyftgrids focuses entirely on PostgreSQL so it can offer the best possible experience.',
  },
  {
    q: 'Are AI features required?',
    a: 'No. AI is completely optional and disabled by default. Swyftgrids works fully without it.',
  },
  {
    q: 'Can I use local AI models?',
    a: 'Yes. Swyftgrids supports Ollama, so AI can run entirely on your own machine with no external providers.',
  },
  {
    q: 'Can I self-host it?',
    a: 'Yes. Docker deployment is fully supported, with a simple single-admin login and local CLI recovery. No SMTP, OAuth, or SSO.',
  },
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <Section id="faq" className="max-w-3xl">
      <Eyebrow>FAQ</Eyebrow>
      <Heading title="Frequently asked questions" />
      <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-surface">
        {FAQS.map((f, i) => (
          <div key={f.q}>
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-sm font-medium">{f.q}</span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 shrink-0 text-content-subtle transition-transform',
                  open === i && 'rotate-180',
                )}
              />
            </button>
            {open === i && <p className="px-5 pb-4 text-sm text-content-muted">{f.a}</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─────────────────────────────── Final CTA ───────────────────────────────

function FinalCta() {
  const os = useDetectedOS();
  const { data: latest } = useLatestRelease();
  const target = DOWNLOADS[os];
  const href = downloadHref(os, latest);
  return (
    <Section className="py-24">
      <div className="relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-b from-accent-soft/60 to-surface px-6 py-16 text-center">
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
          A faster, cleaner way to work with PostgreSQL
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-content-muted">
          Download it free, or explore the live demo right now in your browser.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <PrimaryLink href={href} download>
            <Download className="h-4 w-4" /> Download for {target.short}
          </PrimaryLink>
          <OutlineLink href={LINKS.demo} target="_blank" rel="noreferrer">
            <Play className="h-4 w-4" /> Live demo
          </OutlineLink>
        </div>
      </div>
    </Section>
  );
}
