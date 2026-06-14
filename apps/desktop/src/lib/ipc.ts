/**
 * The single typed gateway between the UI and a backend.
 *
 * - In the Tauri desktop app it forwards to Rust commands (mapping contract names like
 *   `table.updateRow` to the snake_case `table_update_row`).
 * - Everywhere else (e.g. `pnpm dev` in a browser, Storybook, tests) it falls back to an in-memory
 *   mock so the entire UI is explorable without Rust or a database.
 *
 * The self-hosted web build swaps in an HTTP implementation with the same signature.
 */
import type { IpcCommand, IpcParams, IpcResult } from '@swyftgrid/core';
import { mockInvoke } from './mock';

/** True when running inside a Tauri webview. */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * The self-hosted web server injects `window.__SWYFTGRID_API__` (the invoke endpoint) into the
 * served HTML. When present, the bridge talks HTTP instead of using the mock.
 */
declare global {
  interface Window {
    __SWYFTGRID_API__?: string;
  }
}
function httpEndpoint(): string | undefined {
  return typeof window !== 'undefined' ? window.__SWYFTGRID_API__ : undefined;
}

/** Read a non-HttpOnly cookie value by name (used for the CSRF double-submit token). */
function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]!) : undefined;
}

async function httpInvoke<K extends IpcCommand>(
  endpoint: string,
  command: K,
  params: IpcParams<K>,
): Promise<IpcResult<K>> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  // Self-hosted auth uses a double-submit CSRF token; echo the cookie back as a header.
  const csrf = readCookie('swyft_csrf');
  if (csrf) headers['x-csrf-token'] = csrf;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify({ command, params: params ?? {} }),
  });
  if (res.status === 401 || res.status === 403) {
    // The session expired or auth is required — reload so the server can route to login/setup.
    if (typeof window !== 'undefined') window.location.reload();
  }
  const body = await res.json();
  if (!res.ok) throw body.error ?? { message: `Request failed (${res.status})` };
  return body.result as IpcResult<K>;
}

/** Convert a contract command (`savedQueries.saveFolder`) to a Rust command (`saved_queries_save_folder`). */
function toTauriName(command: string): string {
  return command
    .split('.')
    .map((segment) => segment.replace(/([A-Z])/g, '_$1').toLowerCase())
    .join('_');
}

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
let cachedInvoke: TauriInvoke | null = null;

/** Invoke a backend command with full type-safety on params and result. */
export async function invoke<K extends IpcCommand>(
  command: K,
  params: IpcParams<K>,
): Promise<IpcResult<K>> {
  if (isTauri()) {
    if (!cachedInvoke) {
      const core = await import('@tauri-apps/api/core');
      cachedInvoke = core.invoke as TauriInvoke;
    }
    return cachedInvoke<IpcResult<K>>(
      toTauriName(command),
      (params ?? {}) as Record<string, unknown>,
    );
  }
  const endpoint = httpEndpoint();
  if (endpoint) {
    return httpInvoke(endpoint, command, params);
  }
  return mockInvoke(command, params);
}

/** A backend error normalised to the `QueryError` shape the UI renders. */
export interface BackendError {
  message: string;
  code?: string;
  detail?: string;
  hint?: string;
}

/** Coerce an unknown thrown value into a {@link BackendError}. */
export function toBackendError(err: unknown): BackendError {
  if (err && typeof err === 'object' && 'message' in err) {
    return err as BackendError;
  }
  return { message: typeof err === 'string' ? err : 'Unexpected error' };
}
