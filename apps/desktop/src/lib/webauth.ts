/**
 * Client helpers for the self-hosted web build's authentication.
 *
 * These are **no-ops in the desktop app** — there is no auth there (the OS account is the boundary).
 * They only do anything when the server injected `window.__SWYFTGRID_API__`, i.e. the web build.
 */

export interface AuthStatus {
  authEnabled: boolean;
  authenticated?: boolean;
  needsSetup?: boolean;
  mustChangePassword?: boolean;
  csrfToken?: string | null;
  user?: { email: string; createdAt: string; lastLoginAt: string | null } | null;
}

/** True only in the self-hosted web build (the server injects the API endpoint). */
export function isWebMode(): boolean {
  return typeof window !== 'undefined' && !!window.__SWYFTGRID_API__;
}

function csrfHeader(): Record<string, string> {
  if (typeof document === 'undefined') return {};
  const match = document.cookie.match(/(?:^|; )swyft_csrf=([^;]*)/);
  return match ? { 'x-csrf-token': decodeURIComponent(match[1]!) } : {};
}

export async function fetchAuthStatus(): Promise<AuthStatus | null> {
  if (!isWebMode()) return null;
  try {
    const res = await fetch('/api/auth/status', { credentials: 'same-origin' });
    if (!res.ok) return null;
    return (await res.json()) as AuthStatus;
  } catch {
    return null;
  }
}

export async function changeAdminPassword(
  current: string,
  password: string,
  confirm: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...csrfHeader() },
      body: JSON.stringify({ current, password, confirm }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body?.error?.message ?? 'Could not change password' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: csrfHeader(),
    });
  } finally {
    if (typeof window !== 'undefined') window.location.assign('/login');
  }
}
