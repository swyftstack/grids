/**
 * Live release data from the GitHub Releases API. Versions, dates, notes, and download URLs are
 * always read from the latest published release — nothing about a specific version is hardcoded.
 *
 * Unauthenticated GitHub API calls are rate-limited (60/hour per IP); results are cached in
 * sessionStorage and de-duplicated per page load so a visit makes at most one request per endpoint.
 */
import { useEffect, useState } from 'react';
import { DL_OVERRIDE, GITHUB_API, LINKS, type OsKey } from './brand';

export interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
  downloads: number;
}

export interface Release {
  tag: string;
  name: string;
  body: string;
  date: string; // ISO published_at
  url: string; // html_url
  prerelease: boolean;
  assets: ReleaseAsset[];
}

interface RawAsset {
  name: string;
  browser_download_url: string;
  size: number;
  download_count: number;
}
interface RawRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  assets: RawAsset[];
}

function mapRelease(r: RawRelease): Release {
  return {
    tag: r.tag_name,
    name: r.name || r.tag_name,
    body: r.body || '',
    date: r.published_at,
    url: r.html_url,
    prerelease: r.prerelease,
    assets: (r.assets || []).map((a) => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size,
      downloads: a.download_count,
    })),
  };
}

/** Match a release asset to a platform by file extension (Tauri names include the version). */
const ASSET_PATTERN: Record<OsKey, RegExp> = {
  windows: /\.exe$/i,
  mac: /\.dmg$/i,
  linux: /\.appimage$/i,
};

export function assetFor(os: OsKey, assets: ReleaseAsset[]): ReleaseAsset | undefined {
  return assets.find((a) => ASSET_PATTERN[os].test(a.name));
}

export function checksumsAsset(assets: ReleaseAsset[]): ReleaseAsset | undefined {
  return assets.find((a) => /^checksums\.txt$/i.test(a.name));
}

/**
 * Resolve the best download URL for a platform:
 *   1. a build-time VITE_DL_* override (CDN/R2 mirror), else
 *   2. the matching asset from the latest release, else
 *   3. the GitHub Releases page (always works, even before the first release).
 */
export function downloadHref(os: OsKey, latest: Release | null): string {
  if (DL_OVERRIDE[os]) return DL_OVERRIDE[os] as string;
  const asset = latest ? assetFor(os, latest.assets) : undefined;
  return asset?.url ?? LINKS.releases;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Fetching, with a per-load promise cache + sessionStorage backing ──────────

async function getJson<T>(path: string): Promise<T> {
  const cacheKey = `sg-gh:${path}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached) as T;
  } catch {
    /* sessionStorage may be unavailable; ignore */
  }
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = (await res.json()) as T;
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
  return data;
}

let latestPromise: Promise<Release | null> | null = null;
let listPromise: Promise<Release[]> | null = null;

function fetchLatest(): Promise<Release | null> {
  if (!latestPromise) {
    latestPromise = getJson<RawRelease>('/releases/latest')
      .then(mapRelease)
      .catch(() => null);
  }
  return latestPromise;
}

function fetchAll(): Promise<Release[]> {
  if (!listPromise) {
    listPromise = getJson<RawRelease[]>('/releases?per_page=30')
      .then((rs) => rs.filter((r) => !r.draft).map(mapRelease))
      .catch(() => []);
  }
  return listPromise;
}

interface AsyncState<T> {
  data: T;
  loading: boolean;
  error: boolean;
}

export function useLatestRelease(): AsyncState<Release | null> {
  const [state, setState] = useState<AsyncState<Release | null>>({
    data: null,
    loading: true,
    error: false,
  });
  useEffect(() => {
    let alive = true;
    fetchLatest().then((data) => {
      if (alive) setState({ data, loading: false, error: data === null });
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}

export function useReleases(): AsyncState<Release[]> {
  const [state, setState] = useState<AsyncState<Release[]>>({
    data: [],
    loading: true,
    error: false,
  });
  useEffect(() => {
    let alive = true;
    fetchAll().then((data) => {
      if (alive) setState({ data, loading: false, error: data.length === 0 });
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
