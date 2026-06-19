import { useEffect, useState } from 'react';
import { DOWNLOADS, type DownloadTarget, type OsKey } from './brand';

/** Best-effort client-side OS detection so we can offer the right installer up front. */
export function detectOS(): OsKey {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  if (/mac|iphone|ipad|ipod/.test(ua) || platform.startsWith('mac')) return 'mac';
  if (/linux|x11|ubuntu|debian|fedora|cros/.test(ua) || platform.includes('linux')) return 'linux';
  return 'windows';
}

/** React hook form of {@link detectOS}; defaults to Windows until the client effect runs. */
export function useDetectedOS(): OsKey {
  const [os, setOS] = useState<OsKey>('windows');
  useEffect(() => setOS(detectOS()), []);
  return os;
}

export function primaryDownload(): DownloadTarget {
  return DOWNLOADS[detectOS()];
}
