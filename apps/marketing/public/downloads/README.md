# Desktop installers

Drop the built desktop installers in this folder. They are served as static files
from the marketing site, so the download buttons start a download immediately with
no GitHub redirect and no API call.

Expected filenames (referenced by the site, see `src/lib/brand.ts`):

| Platform | File                   |
| -------- | ---------------------- |
| Windows  | `Swyftgrids-Setup.exe` |
| macOS    | `Swyftgrids.dmg`       |
| Linux    | `Swyftgrids.AppImage`  |

These binaries are intentionally **not** committed to git (see the repo
`.gitignore`). Place them here during the deploy/build step, or override the URLs
with the `VITE_DL_WINDOWS` / `VITE_DL_MAC` / `VITE_DL_LINUX` environment variables
to point at an external store (for example Cloudflare R2) instead.

> Cloudflare Pages has a 25 MiB per-file limit on uploaded assets. Swyftgrids
> installers are well under that; if a binary ever exceeds it, host that file on
> R2 and set the matching `VITE_DL_*` variable.
