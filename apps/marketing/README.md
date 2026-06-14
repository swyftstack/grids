# Swyftgrids marketing site

The landing site for [Swyftgrids](https://grids.swyftstack.com), the modern PostgreSQL client.

It is a fully static Vite + React app. It makes **no API calls**, so it deploys cleanly to
Cloudflare Pages (or any static host).

## Develop

```bash
corepack pnpm install
corepack pnpm --filter @swyftgrid/marketing dev
```

## Build

```bash
corepack pnpm --filter @swyftgrid/marketing build      # site only -> apps/marketing/dist
corepack pnpm --filter @swyftgrid/marketing build:cf   # site + live demo at /demo -> apps/marketing/dist
```

`build:cf` also builds the desktop app (with `base=/demo/`) into `dist/demo`, so a single deploy
serves both the site and the live demo. See [../desktop/DEMO.md](../desktop/DEMO.md).

## Deploy to Cloudflare Pages

One project serves the site **and** the demo (no subdomain, no Workers, no Wrangler).

**Dashboard:** create a Pages project from this repo with:

| Setting                | Value                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| Build command          | `corepack pnpm install && corepack pnpm --filter @swyftgrid/marketing build:cf` |
| Build output directory | `apps/marketing/dist`                                                           |
| Root directory         | (repo root)                                                                     |

This gives you `grids.swyftstack.com` and `grids.swyftstack.com/demo`.

**Wrangler (optional):** `npx wrangler pages deploy apps/marketing/dist` (see `wrangler.toml`).

`public/_headers` is copied into the build and configures caching, security headers, and the
download behavior for `/downloads/*` (served as attachments).

## Downloads

Download buttons link directly to the installers under `/downloads`, so a click starts the
download immediately with no GitHub redirect:

| Platform | File                   |
| -------- | ---------------------- |
| Windows  | `Swyftgrids-Setup.exe` |
| macOS    | `Swyftgrids.dmg`       |
| Linux    | `Swyftgrids.AppImage`  |

Place the built binaries in `public/downloads/` before deploying (they are git-ignored), or
point at an external store with the env vars below.

### Where the binaries come from

The installers are produced by `.github/workflows/release.yml`. **Push a tag** (e.g. `v0.1.0`) and
CI builds the Windows/macOS/Linux installers with Tauri and attaches them to a GitHub release. You
can also build one locally: `corepack pnpm --filter @swyftgrid/desktop tauri build` (output under
`apps/desktop/src-tauri/target/release/bundle/`).

### Getting the binaries into production

The installers are git-ignored, so a **git-connected** Cloudflare Pages build won't contain them and
the download would 404. Pick one:

1. **R2 + custom domain (recommended).** The release workflow already uploads each installer to R2 —
   see [Hosting binaries on R2](#hosting-binaries-on-r2). Point the site at them with `VITE_DL_*`.
   Keeps binaries out of git and off GitHub, and dodges the 25 MiB Pages limit.
2. **Wrangler direct upload (simplest one-off).** Build locally so `dist/downloads/` holds the
   binaries, then upload the folder as-is:
   ```bash
   corepack pnpm --filter @swyftgrid/marketing build:cf
   npx wrangler pages deploy apps/marketing/dist --project-name swyftgrids
   ```
3. **Commit them.** Force-add (`git add -f apps/marketing/public/downloads/*`). Easiest, bloats the
   repo; fine for a small beta.

### Hosting binaries on R2

1. **Create a bucket** in Cloudflare (R2 → Create bucket), e.g. `swyftgrids-downloads`.
2. **Expose it on your domain (masks the R2 URL):** bucket → Settings → **Public access → Custom
   domains** → add `files.grids.swyftstack.com`. Cloudflare creates the DNS + TLS. Objects are then
   public at `https://files.grids.swyftstack.com/<key>`.
3. **Give CI write access:** R2 → Manage API tokens → create an **S3 Auth** token (Object
   Read & Write) scoped to the bucket. Add these repo secrets (Settings → Secrets → Actions):
   `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
4. **Release:** push a tag. CI uploads each installer to `latest/<file>` (stable) and `<tag>/<file>`
   (archived) in the bucket.
5. **Point the site at R2** with the env vars below, e.g.
   `VITE_DL_WINDOWS=https://files.grids.swyftstack.com/latest/Swyftgrids-Setup.exe`.

(Skip the R2 secrets and the upload step is a no-op — the workflow still builds the GitHub release.)

## Environment overrides

All optional. Set at build time (Pages → Settings → Environment variables):

| Variable          | Default                           | Purpose                                   |
| ----------------- | --------------------------------- | ----------------------------------------- |
| `VITE_DEMO_URL`   | `/demo/`                          | Where "Live demo" points                  |
| `VITE_DL_WINDOWS` | `/downloads/Swyftgrids-Setup.exe` | Windows installer URL (set to R2 in prod) |
| `VITE_DL_MAC`     | `/downloads/Swyftgrids.dmg`       | macOS installer URL (set to R2 in prod)   |
| `VITE_DL_LINUX`   | `/downloads/Swyftgrids.AppImage`  | Linux installer URL (set to R2 in prod)   |

Example production values (after the R2 custom domain is set up):

```
VITE_DL_WINDOWS=https://files.grids.swyftstack.com/latest/Swyftgrids-Setup.exe
VITE_DL_MAC=https://files.grids.swyftstack.com/latest/Swyftgrids.dmg
VITE_DL_LINUX=https://files.grids.swyftstack.com/latest/Swyftgrids.AppImage
```

## Social card

`public/og.svg` is the Open Graph / Twitter card. SVG renders on most platforms; for maximum
compatibility (e.g. X/Twitter) export it to a 1200×630 `og.png`, drop it in `public/`, and
update the `og:image` / `twitter:image` tags in `index.html`.
