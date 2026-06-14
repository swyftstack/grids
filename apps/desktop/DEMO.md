# The live demo (`grids.swyftstack.com/demo`)

The "Live demo" is **this desktop app, built for the web**. In a browser there is no Tauri and no
database, so it automatically runs against an in-memory **mock backend** with realistic sample data.
"Demo mode" additionally hides the "add connection" flow and shows a banner.

It makes **no API calls**, so it ships as plain static files **inside the marketing site's deploy at
`/demo`** — the same Cloudflare Pages project, no subdomain, no Workers, no Wrangler.

## How it's wired

`apps/marketing/scripts/build-with-demo.mjs` (run via `pnpm --filter @swyftgrid/marketing build:cf`):

1. builds the marketing site into `apps/marketing/dist`, then
2. builds this app with `vite build --base=/demo/` straight into `apps/marketing/dist/demo`.

Demo mode turns on by itself because `src/lib/demo.ts` enables it when the path ends with `/demo`
(it also accepts `?demo`, a `demo.` hostname, or `window.__SWYFTGRID_DEMO__`).

## Deploy (one Cloudflare Pages project for site + demo)

Connect the repo to a single Pages project:

| Setting                | Value                                                                           |
| ---------------------- | ------------------------------------------------------------------------------- |
| Build command          | `corepack pnpm install && corepack pnpm --filter @swyftgrid/marketing build:cf` |
| Build output directory | `apps/marketing/dist`                                                           |
| Root directory         | (repo root)                                                                     |

Result:

- `grids.swyftstack.com` → marketing site
- `grids.swyftstack.com/demo` → the live demo

The site's "Live demo" buttons already point at `/demo` (override with `VITE_DEMO_URL` if you ever
want to host it elsewhere).

## Preview locally

```bash
corepack pnpm --filter @swyftgrid/marketing build:cf
corepack pnpm --filter @swyftgrid/marketing preview     # open http://localhost:4173/demo/
```
