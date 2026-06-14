import { FlaskConical, ArrowUpRight } from 'lucide-react';
import { isDemo } from '@/lib/demo';

/**
 * Shown only in the public demo. Makes it obvious this is sample data and points back to the real
 * product. No-op in the desktop app and the self-hosted build.
 */
export function DemoBanner() {
  if (!isDemo()) return null;

  return (
    <div className="flex h-7 shrink-0 items-center justify-center gap-2 bg-accent px-3 text-accent-fg">
      <FlaskConical className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">
        Live demo: sample data, changes stay in your browser
      </span>
      <a
        href="https://github.com/swyftstack/grids"
        target="_blank"
        rel="noreferrer"
        className="ml-1 hidden items-center gap-0.5 text-2xs font-semibold underline-offset-2 hover:underline sm:inline-flex"
      >
        Get Swyftgrids <ArrowUpRight className="h-3 w-3" />
      </a>
    </div>
  );
}
