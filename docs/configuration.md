# Configuration

Swyftgrids is local-first: your configuration lives on your machine, and most of it is editable from
the in-app **Settings** screen (`Cmd/Ctrl+K` → _Open settings_).

## Settings

### Appearance

| Setting       | Options               | Default     |
| ------------- | --------------------- | ----------- |
| Theme         | Light · Dark · System | System      |
| Density       | Comfortable · Compact | Comfortable |
| Reduce motion | On · Off              | Off         |

### Editor

| Setting       | Description                  | Default |
| ------------- | ---------------------------- | ------- |
| Font size     | SQL editor font size (px)    | 13      |
| Tab size      | Spaces per tab               | 2       |
| Word wrap     | Wrap long lines              | Off     |
| Format on run | Auto-format before executing | Off     |

### Database

| Setting            | Description                                               | Default |
| ------------------ | --------------------------------------------------------- | ------- |
| Connection timeout | Seconds to wait when opening a connection                 | 15      |
| Query timeout      | Seconds before a statement is cancelled (0 = no limit)    | 30      |
| Default page size  | Rows per page in the Table Browser                        | 100     |
| Max result rows    | Hard cap on rows returned to the editor (protects memory) | 50,000  |

### AI

Off by default. See [Security › AI data handling](./security.md#ai-data-handling).

## Where data is stored

### Desktop

| Data                                                   | Location                                           |
| ------------------------------------------------------ | -------------------------------------------------- |
| Connections, folders, history, saved queries, settings | SQLite at the OS app-data dir (`swyftgrid.sqlite`) |
| Passwords and SSH secrets                              | OS keychain (see below)                            |

App-data directory by platform:

- **Windows** — `%APPDATA%\dev.swyftgrid.app\`
- **macOS** — `~/Library/Application Support/dev.swyftgrid.app/`
- **Linux** — `~/.local/share/dev.swyftgrid.app/`

### Self-hosted web

A single JSON file under `SWYFTGRID_DATA_DIR` (default `./data`, mounted as a Docker volume). See
[Self-Hosting](./self-hosting.md).

## <a id="credential-storage"></a> Credential storage

On the **desktop**, secrets are never written to the metadata database. The database password and
every SSH secret (SSH password, private key, passphrase) are stored in the operating system's secure
credential store via the [`keyring`](https://crates.io/crates/keyring) crate:

- **Windows** — Windows Credential Manager
- **macOS** — Keychain
- **Linux** — the Secret Service API (GNOME Keyring / KWallet)

Secrets are looked up only when a connection is opened, and are never sent to the UI in connection
listings. SSH **private key paths** are not secrets and stay in the metadata store; the key contents
and passphrase do not.

On the **self-hosted web** build there is no OS keychain in a typical container, so secrets are stored
in the JSON data file (always stripped from listings and never logged). Protect that file — restricted
volume or secret mount — see [Self-Hosting › Security](./self-hosting.md#security).

## Environment variables (web server)

| Variable               | Default           | Purpose                         |
| ---------------------- | ----------------- | ------------------------------- |
| `PORT`                 | `4000`            | HTTP port                       |
| `HOST`                 | `0.0.0.0`         | Bind address                    |
| `SWYFTGRID_DATA_DIR`   | `./data`          | Where the JSON store is written |
| `SWYFTGRID_STATIC_DIR` | `../desktop/dist` | Built frontend to serve         |
| `LOG_LEVEL`            | `info`            | Fastify log level               |

## Telemetry

There is none. Swyftgrids makes no network calls except to the databases you connect to and, if you
explicitly enable it, your chosen AI provider.
