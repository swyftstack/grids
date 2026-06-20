<div align="center">

# Swyftgrids

**The modern, fast, beautiful PostgreSQL client developers wish existed.**

A keyboard-first, local-first open-source alternative to pgAdmin and DBeaver — built for speed,
simplicity, and exceptional design. Connect to anything, even databases behind an SSH bastion or jump host.

[![Latest release](https://img.shields.io/github/v/release/swyftstack/grids?sort=semver&label=release&color=f97316)](https://github.com/swyftstack/grids/releases/latest)
[![CI](https://github.com/swyftstack/grids/actions/workflows/ci.yml/badge.svg)](https://github.com/swyftstack/grids/actions/workflows/ci.yml)
[![Downloads](https://img.shields.io/github/downloads/swyftstack/grids/total?color=22c55e&label=downloads)](https://github.com/swyftstack/grids/releases)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-2496ED?logo=docker&logoColor=white)](https://github.com/swyftstack/grids/pkgs/container/grids)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-555)](#installation)
[![License: MIT](https://img.shields.io/badge/license-MIT-black.svg)](./LICENSE)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12--17-336791.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri-24C8DB.svg?logo=tauri)](https://tauri.app/)

[**Live demo**](https://grids.swyftstack.com/demo) · [**Download**](#installation) · [Documentation](./docs/README.md) · [Changelog](./CHANGELOG.md) · [Self-hosting](./docs/self-hosting.md) · [Contributing](./CONTRIBUTING.md)

</div>

---

<div align="center">

[![Swyftgrids — the modern PostgreSQL client](./assets/screenshots/swyftgrids-dashboard.png)](https://grids.swyftstack.com/demo)

</div>

## Why Swyftgrids?

Existing PostgreSQL clients are either heavy and dated (pgAdmin, DBeaver) or closed-source and limited.
Swyftgrids is the tool we wanted in 2026:

- ⚡ **Extremely fast** — Rust core, virtualized rendering, sub-second navigation.
- 🪶 **Minimal footprint** — built on [Tauri](https://tauri.app/), not Electron. Tens of MB, not hundreds.
- 🔐 **Connect anywhere** — direct, **SSH tunnel, bastion, or jump host**. Reach production databases behind any gateway.
- ⌨️ **Keyboard-first** — a `Cmd/Ctrl+K` command palette drives everything.
- 🎨 **Beautiful** — design inspired by Linear, Raycast, Arc, Vercel, and Cursor.
- 🏠 **Local-first** — connections and settings live on your machine; secrets in your OS keychain. No telemetry, no account.
- 🧩 **Open source** — MIT licensed. Self-host the web version with Docker.

> **PostgreSQL only in v1.** The architecture is designed so MySQL and MariaDB can be added later
> behind the same contract — but we are doing one database exceptionally well first.

## Features

| Area                              | Highlights                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Connectivity**                  | Direct, **SSH tunnel, bastion, jump host**; key/password auth, host-key pinning, SSL modes, connection strings    |
| **Connection Manager**            | Unlimited connections, folders, favorites, duplicate, test-before-save                                            |
| **Dashboard**                     | DB size, table/schema/view counts, active connections, server version at a glance                                 |
| **Schema Explorer**               | Schemas, tables, views, materialized views, functions, triggers, indexes, constraints, extensions                 |
| **Table Browser**                 | Spreadsheet UX, virtualized rows, server-side pagination, sort, filter, inline edit, copy row as JSON             |
| **SQL Editor**                    | Multi-tab, syntax highlighting, autocomplete, formatting, run-selection, execution stats                          |
| **Saved Queries & History**       | Per-database, folders, tags, favorites, search, re-run                                                            |
| **ER Diagrams**                   | Auto-generated, zoom/pan, drag, export PNG/SVG                                                                    |
| **Universal Search**              | Instant search across tables, columns, views, functions, indexes, saved queries                                   |
| **Import / Export**               | Import CSV; export CSV & JSON                                                                                     |
| **Production Safety**             | Confirmation for `DELETE` / `TRUNCATE` / `DROP`, estimated affected rows, production banner                       |
| **AI (optional, off by default)** | NL→SQL, explain, optimize, error explanation — bring your own key (OpenAI, Anthropic, Gemini, OpenRouter, Ollama) |

## Screenshots

|                                                          |                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| ![Schema explorer](./assets/screenshots/swyftgrids-schema.png) | ![ER diagram](./assets/screenshots/swyftgrids-er-diagram.png) |
| ![Database health](./assets/screenshots/swyftgrids-health.png) | ![Realtime monitoring](./assets/screenshots/swyftgrids-monitoring.png) |

<div align="center">

![Schema changes](./assets/screenshots/swyftgrids-schema-changes.png)

</div>

## Installation

Grab the latest installer from the [**Downloads page**](https://grids.swyftstack.com/downloads) or
directly from [**GitHub Releases**](https://github.com/swyftstack/grids/releases/latest). Every
release ships a `checksums.txt` (SHA-256) so you can verify your download.

| Platform    | File                                                         |
| ----------- | ------------------------------------------------------------ |
| **Windows** | `Swyftgrids_<version>_x64-setup.exe` (NSIS)                  |
| **macOS**   | `Swyftgrids_<version>_universal.dmg` (Apple Silicon + Intel) |
| **Linux**   | `Swyftgrids_<version>_amd64.AppImage` (also `.deb`)          |

### Windows

Download and run `Swyftgrids-Setup.exe`, then follow the installer. Until a release is built with a
code-signing certificate, SmartScreen ("Windows protected your PC") may warn on first launch —
choose **More info → Run anyway**. This is the OS flagging an unsigned binary, not a problem with
the app; verify your download against `checksums.txt` if unsure. See
[Code Signing](./docs/code-signing.md) for how releases get signed.

### macOS

Open the `.dmg` and drag **Swyftgrids** to Applications. Until a release is built with an Apple
Developer ID certificate, Gatekeeper requires **right-click → Open** on first launch (or
`xattr -dr com.apple.quarantine /Applications/Swyftgrids.app`). The DMG is universal — it runs
natively on Apple Silicon and Intel. See [Code Signing](./docs/code-signing.md).

### Linux

```bash
chmod +x Swyftgrids_*_amd64.AppImage
./Swyftgrids_*_amd64.AppImage
```

Prefer a package? Install the `.deb` with `sudo apt install ./Swyftgrids_*_amd64.deb`.

### Docker (self-hosted web version)

Run the web app on your own infrastructure with a single admin login:

```bash
docker run -d --name swyftgrids -p 4000:4000 -v swyftgrids-data:/data ghcr.io/swyftstack/grids:latest
# open http://localhost:4000
```

Or with Compose: `docker compose -f docker/docker-compose.yml up -d`. Images are published to
`ghcr.io/swyftstack/grids` (tags: `latest` and each `vX.Y.Z`). See the
[self-hosting guide](./docs/self-hosting.md).

### Verify your download

```bash
# macOS / Linux
shasum -a 256 -c checksums.txt

# Windows (PowerShell)
Get-FileHash .\Swyftgrids-Setup.exe -Algorithm SHA256
```

Prefer the browser first? Try the [**live demo**](https://grids.swyftstack.com/demo) — sample data,
no signup.

## Quick start

Once you have a connection, see [Getting Started](./docs/getting-started.md). To connect through a
bastion or jump host, see [Connections](./docs/connections.md).

### Build from source

**Prerequisites:** [Node.js](https://nodejs.org/) ≥ 20 and [pnpm](https://pnpm.io/) ≥ 9
(`corepack enable pnpm`); [Rust](https://www.rust-lang.org/tools/install) (stable) and the
[Tauri platform deps](https://tauri.app/start/prerequisites/) for the desktop app.

```bash
git clone https://github.com/swyftstack/grids.git
cd grids
corepack pnpm install

# Run the desktop app (Tauri + Vite + Rust core)
corepack pnpm tauri dev

# Or preview just the UI in a browser with mock data — no Rust, no database
corepack pnpm dev

# Build installers
corepack pnpm tauri build
```

> `corepack pnpm dev` runs the React UI against an in-memory mock backend, so you can explore the whole
> interface without Rust or a database.

## Architecture

Swyftgrids is a **pnpm monorepo** with one shared frontend on two interchangeable backends:

```
grids/
├── apps/
│   ├── desktop/        # Tauri desktop app — React UI (src/) + Rust core (src-tauri/)
│   └── web/            # Self-hosted web server (Fastify + node-postgres)
├── packages/
│   ├── core/           # Shared TS: types, IPC contract, SQL safety helpers
│   └── ui/             # Design system (Tailwind preset + primitives)
├── docs/               # Documentation
└── docker/             # Docker + docker-compose for self-hosting
```

The UI talks to a backend through a single typed **IPC contract**
([`packages/core`](./packages/core/src/ipc/contract.ts)), implemented twice: **Tauri commands** (Rust)
on the desktop, and an **HTTP server** for self-hosting. The same React code runs in both. Read the
full [Architecture guide](./docs/architecture.md).

## Documentation

- [Getting Started](./docs/getting-started.md) — install, connect, first query
- [Connections](./docs/connections.md) — direct, SSH tunnel, bastion, jump host, SSL
- [Configuration](./docs/configuration.md) — settings, data locations, credential storage
- [Security](./docs/security.md) — threat model, secrets, host-key verification, production safety
- [Self-Hosting](./docs/self-hosting.md) — Docker + admin authentication
- [Architecture](./docs/architecture.md) — internals, IPC contract, working on Swyftgrids
- [Releasing](./docs/releasing.md) — the automated release & distribution pipeline
- [Changelog](./CHANGELOG.md) — version history (Added / Changed / Fixed)

## Contributing

Contributions are welcome! Read the [Contributing Guide](./CONTRIBUTING.md) and our
[Code of Conduct](./CODE_OF_CONDUCT.md). Good first issues are labeled
[`good first issue`](https://github.com/swyftstack/grids/labels/good%20first%20issue).

## Security

Found a vulnerability? Please follow our [Security Policy](./SECURITY.md) — do **not** open a public issue.

## License

[MIT](./LICENSE) © Swyftgrids Contributors
