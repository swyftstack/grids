import { useEffect, useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { fetchAuthStatus, isWebMode } from '@/lib/webauth';

/**
 * Self-hosted only: a persistent warning shown when authentication has been disabled
 * (`SWYFT_AUTH_DISABLED` or the `disable-auth` CLI command). No-op in the desktop app.
 */
export function WebAuthBanner() {
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    if (!isWebMode()) return;
    fetchAuthStatus().then((s) => setDisabled(!!s && s.authEnabled === false));
  }, []);

  if (!disabled) return null;

  return (
    <div className="flex h-7 shrink-0 items-center justify-center gap-2 border-b border-amber-700/60 bg-amber-500 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/80 dark:text-amber-200">
      <ShieldOff className="h-3.5 w-3.5" />
      <span className="text-xs font-semibold uppercase tracking-wide">Authentication Disabled</span>
      <span className="hidden text-2xs font-medium sm:inline">
        · only use behind a trusted network, VPN, or authenticating proxy
      </span>
    </div>
  );
}
