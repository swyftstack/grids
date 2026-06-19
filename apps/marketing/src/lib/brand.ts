/** Brand constants, external links, routes, and the desktop download targets. */

/** The marketing site's canonical home. */
export const HOMEPAGE = 'https://grids.swyftstack.com';

/** Display version, used as a label until the live GitHub release loads. */
export const VERSION = '0.1.0';
export const VERSION_LABEL = 'v0.1 beta';

/** `owner/repo` on GitHub — the single source of truth for releases, the changelog, and issues. */
export const REPO = 'swyftstack/grids';
/** GitHub REST endpoint for this repo (used by the Downloads & Releases pages). */
export const GITHUB_API = `https://api.github.com/repos/${REPO}`;
/** Raw file base on the default branch (used by the Changelog page to read CHANGELOG.md). */
export const GITHUB_RAW = `https://raw.githubusercontent.com/${REPO}/main`;

export const LINKS = {
  /** Source, issues, and self-hosting all live here. Only self-hosters need GitHub. */
  github: `https://github.com/${REPO}`,
  releases: `https://github.com/${REPO}/releases`,
  swyftstack: 'https://swyftstack.com',
  /**
   * The live demo runs the real Swyftgrids app against sample data. It is built into this same
   * static deploy at /demo (no API, no subdomain). Override with VITE_DEMO_URL at build time.
   */
  demo: (import.meta.env.VITE_DEMO_URL as string | undefined) ?? '/demo/',
};

/** Internal SPA routes served by this site (see lib/router.tsx). */
export const ROUTES = {
  home: '/',
  downloads: '/downloads',
  releases: '/releases',
  changelog: '/changelog',
} as const;

export type OsKey = 'windows' | 'mac' | 'linux';

export interface DownloadTarget {
  os: OsKey;
  label: string;
  /** Short, human label for the file (used on the button). */
  short: string;
  note: string;
  /** Display name of the installer for this platform. */
  file: string;
  /**
   * Fallback URL when the live release asset can't be resolved (API offline / no release yet).
   * Points at the GitHub Releases page unless overridden by a VITE_DL_* env var (e.g. an R2 CDN).
   */
  url: string;
}

/**
 * Optional build-time overrides for each platform's download URL. Set these (e.g. to
 * `https://files.grids.swyftstack.com/latest/Swyftgrids-Setup.exe`) to bypass the GitHub API and
 * point downloads at a CDN/R2 mirror. When unset, downloads resolve live from the latest GitHub
 * Release (see lib/releases.ts), falling back to the Releases page.
 */
const env = import.meta.env as Record<string, string | undefined>;
export const DL_OVERRIDE: Record<OsKey, string | undefined> = {
  windows: env.VITE_DL_WINDOWS,
  mac: env.VITE_DL_MAC,
  linux: env.VITE_DL_LINUX,
};

export const DOWNLOADS: Record<OsKey, DownloadTarget> = {
  windows: {
    os: 'windows',
    label: 'Windows',
    short: 'Windows',
    note: 'Windows 10 & 11 · 64-bit',
    file: 'Swyftgrids-Setup.exe',
    url: DL_OVERRIDE.windows ?? LINKS.releases,
  },
  mac: {
    os: 'mac',
    label: 'macOS',
    short: 'macOS',
    note: 'macOS 13+ · Apple Silicon & Intel',
    file: 'Swyftgrids.dmg',
    url: DL_OVERRIDE.mac ?? LINKS.releases,
  },
  linux: {
    os: 'linux',
    label: 'Linux',
    short: 'Linux',
    note: 'AppImage · Ubuntu, Debian, Fedora, Arch',
    file: 'Swyftgrids.AppImage',
    url: DL_OVERRIDE.linux ?? LINKS.releases,
  },
};

export interface NavLink {
  label: string;
  /** Anchor or external link (rendered as a plain <a>). */
  href?: string;
  /** Internal SPA route (rendered with the router's <Link>). */
  to?: string;
}

export const NAV_LINKS: NavLink[] = [
  { label: 'Features', href: '/#features' },
  { label: 'AI', href: '/#ai' },
  { label: 'Self-hosting', href: '/#self-hosting' },
  { label: 'Downloads', to: ROUTES.downloads },
  { label: 'Releases', to: ROUTES.releases },
  { label: 'Changelog', to: ROUTES.changelog },
];

export const THEME_KEY = 'swyftgrid-marketing-theme';
