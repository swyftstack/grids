import { Grid2x2 } from 'lucide-react';

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-white shadow-[0_0_22px_rgba(249,115,22,0.5)]">
        <Grid2x2 className="h-4 w-4" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Swyftgrids</span>
    </span>
  );
}
