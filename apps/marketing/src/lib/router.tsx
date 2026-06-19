/**
 * Minimal history-based router for the marketing SPA — no dependency, four routes.
 *
 * `Link` only intercepts clicks for known internal routes, so external links, the `/demo`
 * app, and static assets still trigger a full browser navigation. Direct loads of
 * `/downloads`, `/releases`, `/changelog` work because Cloudflare Pages falls back to
 * index.html (see public/_redirects).
 */
import {
  useCallback,
  useEffect,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';
import type { ROUTES } from './brand';

export type RouteKey = keyof typeof ROUTES;

const PATH_TO_KEY: Record<string, RouteKey> = {
  '/': 'home',
  '/downloads': 'downloads',
  '/releases': 'releases',
  '/changelog': 'changelog',
};

function normalize(pathname: string): string {
  return pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/** Resolve a pathname to a route key, defaulting to the landing page for anything unknown. */
export function matchRoute(pathname: string): RouteKey {
  return PATH_TO_KEY[normalize(pathname)] ?? 'home';
}

function isInternalRoute(pathname: string): boolean {
  return normalize(pathname) in PATH_TO_KEY;
}

const NAV_EVENT = 'spa:navigate';

function scrollToHashOrTop(hash: string) {
  if (hash) {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    // Two frames so a freshly-rendered page has its sections in the DOM before we scroll.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        else window.scrollTo({ top: 0 });
      }),
    );
  } else {
    window.scrollTo({ top: 0 });
  }
}

export function navigate(to: string) {
  const url = new URL(to, window.location.origin);
  const samePage = url.pathname === window.location.pathname;

  // Anything off-origin or not an SPA route (e.g. /demo, a binary): hand off to the browser.
  if (url.origin !== window.location.origin || (!isInternalRoute(url.pathname) && !samePage)) {
    window.location.assign(to);
    return;
  }

  if (samePage) {
    window.history.replaceState({}, '', url.pathname + url.hash);
  } else {
    window.history.pushState({}, '', url.pathname + url.hash);
    window.dispatchEvent(new Event(NAV_EVENT));
  }
  scrollToHashOrTop(url.hash);
}

export function useRoute(): RouteKey {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onChange = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onChange);
    window.addEventListener(NAV_EVENT, onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener(NAV_EVENT, onChange);
    };
  }, []);

  // Honor a hash deep-link on first load (e.g. opening /#features directly).
  useEffect(() => {
    if (window.location.hash) scrollToHashOrTop(window.location.hash);
  }, []);

  return matchRoute(path);
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string;
  children: ReactNode;
}

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const handle = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      if (to.startsWith('/') && !to.startsWith('//')) {
        const url = new URL(to, window.location.origin);
        if (isInternalRoute(url.pathname) || url.pathname === window.location.pathname) {
          e.preventDefault();
          navigate(to);
        }
      }
    },
    [to, onClick],
  );

  return (
    <a href={to} onClick={handle} {...rest}>
      {children}
    </a>
  );
}
