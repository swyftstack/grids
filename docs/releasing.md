# Releasing

Swyftgrids ships through a fully automated pipeline. Pushing a version tag produces signed-off
installers for every platform, a Docker image, checksums, and auto-generated release notes — then
publishes a GitHub Release. There is **no manual release process**.

## Cut a release

1. Update [`CHANGELOG.md`](../CHANGELOG.md): move items from `[Unreleased]` into a new
   `## [X.Y.Z] - YYYY-MM-DD` section.
2. Bump the version in [`apps/desktop/src-tauri/tauri.conf.json`](../apps/desktop/src-tauri/tauri.conf.json)
   (this is what names the installers).
3. Commit, then tag and push:

   ```bash
   git commit -am "release: vX.Y.Z"
   git tag vX.Y.Z
   git push origin main vX.Y.Z
   ```

That's it. The [Release workflow](../.github/workflows/release.yml) takes over.

## What the workflow does

Triggered by any tag matching `v*`:

| Job          | What it produces                                                                                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **verify**   | Lint, typecheck, test, and build — fails fast before any installers are built.                                                               |
| **desktop**  | Windows `.exe`, macOS universal `.dmg`, Linux `.AppImage` + `.deb` (via `tauri-action`). Uploaded to a **draft** GitHub Release.             |
| **docker**   | Builds and pushes `ghcr.io/swyftstack/grids:{vX.Y.Z, X.Y, latest}` (and Docker Hub if configured).                                           |
| **finalize** | Downloads all installers, writes `checksums.txt` (SHA-256), generates release notes from commits, and **publishes** the release as `latest`. |

The release ends up containing: release notes, the Windows/macOS/Linux installers, `checksums.txt`,
and the auto-attached **Source code** archives.

## Versioning

[Semantic Versioning](https://semver.org): `vMAJOR.MINOR.PATCH` (e.g. `v1.0.0`, `v1.2.3`).

Release notes are grouped into **Added / Changed / Fixed** by
[`scripts/release-notes.mjs`](../scripts/release-notes.mjs), which classifies commits by their
[Conventional Commit](https://www.conventionalcommits.org/) prefix:

| Prefix                       | Section   |
| ---------------------------- | --------- |
| `feat:` / `feature:`         | Added     |
| `fix:` / `bugfix:`           | Fixed     |
| `perf:` / `refactor:` / etc. | Changed   |
| `chore/docs/test/ci/build`   | _skipped_ |

Preview the notes for the next tag locally:

```bash
node scripts/release-notes.mjs v1.2.0
```

## Downloads update automatically

Nothing about a version is hardcoded on the website:

- The [Downloads](https://grids.swyftstack.com/downloads), [Releases](https://grids.swyftstack.com/releases),
  and [Changelog](https://grids.swyftstack.com/changelog) pages read live from the GitHub Releases
  API (and `CHANGELOG.md`). As soon as `finalize` publishes, they show the new version, date, sizes,
  notes, and download links.
- The README badges (latest release, downloads) update from GitHub automatically.

## Optional secrets

The pipeline works with **zero configuration** (GitHub Releases + GHCR use the built-in
`GITHUB_TOKEN`). Add these repo secrets only if you want the extra publishing targets:

| Secret(s)                                                                | Enables                                                      |
| ------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`                                  | Also push the image to Docker Hub (`<user>/grids`).          |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Mirror installers to Cloudflare R2 for direct CDN downloads. |

To point the website's download buttons at the R2 mirror instead of GitHub, set the marketing build
vars `VITE_DL_WINDOWS`, `VITE_DL_MAC`, `VITE_DL_LINUX` (see [`apps/marketing/src/lib/brand.ts`](../apps/marketing/src/lib/brand.ts)).

## Verifying a download

```bash
# macOS / Linux
shasum -a 256 -c checksums.txt

# Windows (PowerShell)
Get-FileHash .\Swyftgrids-Setup.exe -Algorithm SHA256
```

## Troubleshooting

- **A platform's installer is missing.** `desktop` uses `fail-fast: false`, so one platform failing
  doesn't block the others. Re-run that job, or delete the draft/release and re-push the tag.
- **Re-running a tag.** Delete the existing release and tag first
  (`gh release delete vX.Y.Z --cleanup-tag`), then re-tag and push.
- **Code signing.** Builds are currently unsigned/unnotarized (see the install notes in the README).
  Add Apple/Windows signing secrets to `tauri-action` when certificates are available.
