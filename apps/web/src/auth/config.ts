/**
 * Authentication configuration, read from the environment.
 *
 * Authentication only exists for the self-hosted web build. Desktop apps rely on the operating
 * system's user account and never authenticate. Everything here is intentionally simple: a single
 * admin account, cookie sessions, and a handful of env switches for automated deployments.
 */
function boolEnv(value: string | undefined): boolean {
  if (!value) return false;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export interface AuthConfig {
  /** Directory for the auth database (shared with the JSON store). */
  dataDir: string;
  /** Session lifetime in days. */
  sessionDays: number;
  /** `true`/`false` to force, or `'auto'` to set Secure only on HTTPS requests. */
  cookieSecure: boolean | 'auto';
  /** Authentication disabled via `SWYFT_AUTH_DISABLED` (a CLI flag can also disable it at runtime). */
  envDisabled: boolean;
  /** Bootstrap admin (automated installs). Applied once, only when no user exists. */
  bootstrapEmail?: string;
  bootstrapPassword?: string;
}

export function loadAuthConfig(): AuthConfig {
  const secureRaw = process.env.SWYFT_COOKIE_SECURE?.trim().toLowerCase();
  const cookieSecure: boolean | 'auto' =
    secureRaw === undefined || secureRaw === 'auto' ? 'auto' : boolEnv(secureRaw);

  const days = Number(process.env.SWYFT_SESSION_DAYS);
  return {
    dataDir: process.env.SWYFTGRID_DATA_DIR ?? './data',
    sessionDays: Number.isFinite(days) && days > 0 ? days : 30,
    cookieSecure,
    envDisabled: boolEnv(process.env.SWYFT_AUTH_DISABLED),
    bootstrapEmail: process.env.SWYFT_ADMIN_EMAIL?.trim() || undefined,
    bootstrapPassword: process.env.SWYFT_ADMIN_PASSWORD || undefined,
  };
}

export const COOKIE_SESSION = 'swyft_session';
export const COOKIE_CSRF = 'swyft_csrf';
