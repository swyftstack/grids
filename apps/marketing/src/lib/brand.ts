/** Brand constants, external links, and the desktop download targets. */

/** The marketing site's canonical home. */
export const HOMEPAGE = 'https://grids.swyftstack.com';

export const VERSION = '0.1.0';
export const VERSION_LABEL = 'v0.1 beta';

export const LINKS = {
  /** Source, issues, and self-hosting all live here. Only self-hosters need GitHub. */
  github: 'https://github.com/swyftstack/grids',
  swyftstack: 'https://swyftstack.com',
  /**
   * The live demo runs the real Swyftgrids app against sample data. It is built into this same
   * static deploy at /demo (no API, no subdomain). Override with VITE_DEMO_URL at build time.
   */
  demo: (import.meta.env.VITE_DEMO_URL as string | undefined) ?? '/demo/',
};

export type OsKey = 'windows' | 'mac' | 'linux';

export interface DownloadTarget {
  os: OsKey;
  label: string;
  /** Short, human label for the file (used on the button). */
  short: string;
  note: string;
  file: string;
  /** Direct file URL. Same-origin /downloads by default so the browser just downloads it. */
  url: string;
}

/**
 * Direct desktop installers. By default they are served as static files from this site under
 * `/downloads`, so a click downloads the binary immediately, with no GitHub, no extra page, no API.
 * Each URL can be overridden at build time (e.g. to point at R2 or a CDN) without code changes.
 */
const env = import.meta.env as Record<string, string | undefined>;
const dl = (file: string, override?: string) => override ?? `/downloads/${file}`;

export const DOWNLOADS: Record<OsKey, DownloadTarget> = {
  windows: {
    os: 'windows',
    label: 'Windows',
    short: 'Windows',
    note: 'Windows 10 & 11 · 64-bit',
    file: 'Swyftgrids-Setup.exe',
    url: dl('Swyftgrids-Setup.exe', env.VITE_DL_WINDOWS),
  },
  mac: {
    os: 'mac',
    label: 'macOS',
    short: 'macOS',
    note: 'macOS 13+ · Apple Silicon & Intel',
    file: 'Swyftgrids.dmg',
    url: dl('Swyftgrids.dmg', env.VITE_DL_MAC),
  },
  linux: {
    os: 'linux',
    label: 'Linux',
    short: 'Linux',
    note: 'AppImage · Ubuntu, Debian, Fedora, Arch',
    file: 'Swyftgrids.AppImage',
    url: dl('Swyftgrids.AppImage', env.VITE_DL_LINUX),
  },
};

export const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'AI', href: '#ai' },
  { label: 'Self-hosting', href: '#self-hosting' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

export const THEME_KEY = 'swyftgrid-marketing-theme';
