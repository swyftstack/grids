/**
 * Demo mode.
 *
 * The public "Live demo" runs this exact app against the in-memory mock backend. Demo mode is
 * enabled when the page is opened with `?demo` (or served under `/demo`, or with a global flag).
 * In demo mode the app is fully explorable but adding new databases is disabled, and everything the
 * mock persists (saved queries, history, layouts) lives only in the visitor's own browser storage.
 */
let cached: boolean | null = null;

export function isDemo(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') {
    cached = false;
    return cached;
  }
  try {
    const url = new URL(window.location.href);
    const path = url.pathname.replace(/\/+$/, '');
    cached =
      url.searchParams.has('demo') ||
      path.endsWith('/demo') ||
      // The public demo is hosted on its own subdomain (e.g. demo.grids.swyftstack.com).
      url.hostname.startsWith('demo.') ||
      Boolean((window as unknown as { __SWYFTGRID_DEMO__?: boolean }).__SWYFTGRID_DEMO__);
  } catch {
    cached = false;
  }
  return cached;
}
