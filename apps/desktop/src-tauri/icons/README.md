# App icons

Tauri reads the icon files referenced in `tauri.conf.json` from this folder. They are binary assets
and are **not** checked in to keep the repo lean.

Generate the full icon set from a single 1024×1024 PNG with:

```bash
pnpm --filter @swyftgrid/desktop tauri icon path/to/logo.png
```

This produces `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns` (macOS), and `icon.ico`
(Windows) in this directory.
