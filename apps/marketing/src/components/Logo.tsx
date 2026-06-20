export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <img
        src="/swyftgrids-logo.png"
        alt="Swyftgrids"
        width={28}
        height={28}
        className="h-7 w-7 rounded-lg"
      />
      <span className="text-[15px] font-semibold tracking-tight">Swyftgrids</span>
    </span>
  );
}
