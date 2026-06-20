# Swyftgrids Documentation

Swyftgrids is a modern, fast, keyboard-first PostgreSQL client — the open-source alternative to
pgAdmin and DBeaver. Run it as a desktop app, or self-host the web version for your team.

> **New here?** Start with [Getting Started](./getting-started.md).

## Guides

| Doc                                         | What's inside                                                        |
| ------------------------------------------- | -------------------------------------------------------------------- |
| [Getting Started](./getting-started.md)     | Install, connect, run your first query, key shortcuts.               |
| [Connections](./connections.md)             | Connection types — direct, **SSH tunnel, bastion, jump host** — SSL. |
| [Configuration](./configuration.md)         | Settings, timeouts, where data lives, credential storage.            |
| [Security](./security.md)                   | Threat model, secret storage, host-key verification, SQL safety, AI. |
| [Self-Hosting](./self-hosting.md)           | Run the web version with Docker, including admin authentication.     |
| [Architecture](./architecture.md)           | How it's built, the IPC contract, and how to work on Swyftgrids.     |
| [Cloudflare Deploy](./cloudflare-deploy.md) | Deploy the marketing site + live demo to Cloudflare Pages.           |
| [Releasing](./releasing.md)                 | The automated release pipeline: tag, build, publish, downloads.      |
| [Code Signing](./code-signing.md)           | Sign installers so Windows SmartScreen / macOS Gatekeeper don't warn. |

See also: [Contributing](../CONTRIBUTING.md) · [Security Policy](../SECURITY.md) ·
[Code of Conduct](../CODE_OF_CONDUCT.md).

## Principles

| Principle            | What it means                                                                    |
| -------------------- | -------------------------------------------------------------------------------- |
| **Fast**             | Rust core, virtualized rendering, server-side pagination. Sub-second navigation. |
| **Minimal memory**   | Built on Tauri, not Electron. Tens of MB at rest.                                |
| **Keyboard-first**   | `Cmd/Ctrl+K` drives everything.                                                  |
| **Connect anywhere** | Direct, SSH tunnel, bastion, or jump host — reach databases behind any gateway.  |
| **Local-first**      | Connections and settings live on your machine. No account, no telemetry.         |
| **PostgreSQL-first** | One database, done exceptionally well in v1.                                     |
| **Open source**      | MIT licensed. Self-host the web version freely.                                  |

## Getting help

- 🐛 [Open an issue](https://github.com/swyftstack/grids/issues/new/choose)
- 💬 [Discussions](https://github.com/swyftstack/grids/discussions)
- 🔒 [Security policy](../SECURITY.md)
