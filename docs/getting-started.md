# Getting Started

This guide gets you from zero to browsing a database in a few minutes.

## 1. Install Swyftgrids

The fastest path is a prebuilt installer from the
[Releases page](https://github.com/swyftstack/grids/releases):

| Platform | File                              |
| -------- | --------------------------------- |
| Windows  | `Swyftgrids_x.y.z_x64-setup.exe`  |
| macOS    | `Swyftgrids_x.y.z_universal.dmg`  |
| Linux    | `Swyftgrids_x.y.z_amd64.AppImage` |

Prefer not to install anything? Run the [self-hosted web version](./self-hosting.md) with Docker, or
build from source — see the [README](../README.md#build-from-source).

> **Just want to look around?** Run `corepack pnpm dev` from a source checkout to open the UI in your
> browser against built-in sample data — no Rust, no database. Or try the
> [live demo](https://grids.swyftstack.com/demo).

## 2. Create a connection

1. Press **`Cmd/Ctrl+K`** and choose **New connection** (or click **New connection** in the sidebar).
2. Pick a **connection type** — most production databases need an **SSH Tunnel**, **Bastion Host**, or
   **Jump Host**; use **Direct** for local or directly reachable databases. See
   [Connections](./connections.md) for the full breakdown.
3. Fill in the **database** details — name, environment, host/port, database, username/password (or a
   `postgres://…` connection string), and SSL mode. For SSH types, add the SSH host(s) and either a
   private key or password.
4. Click **Test connection** to verify (and pin the SSH host key on first connect), then **Save**.

Marking the **Environment** as `production` turns on [Production Safety](./security.md#production-safety).
Passwords and SSH keys are stored in your OS keychain, not the app database — see
[credential storage](./configuration.md#credential-storage).

## 3. Connect and explore

- Click **Connect** on the connection card (or pick it from `Cmd/Ctrl+K`).
- The **Dashboard** opens with database size, table/schema/view counts, active connections, and the
  server version.
- The **sidebar** shows the Schema Explorer. Expand a schema → **Tables** → click a table to open it in
  the Table Browser.

## 4. Run a query

- Press **`Cmd/Ctrl+K`** → **New SQL editor**, or click the editor icon in the sidebar.
- Type a query and press **`Cmd/Ctrl+Enter`** to run it (or select text to run just that part).
- Results appear below as a grid; switch to **JSON** or export to **CSV/JSON**.
- Every query is recorded in Query History. Save your best ones as Saved Queries.

## 5. Make it yours

- Open **Settings** (sidebar gear or `Cmd/Ctrl+K` → _Open settings_) to pick a theme, editor font
  size, and database timeouts. See [Configuration](./configuration.md).
- Optionally activate AI features with your own API key. The AI tab is visible by default but transmits
  nothing until you activate it — see [Security › AI data handling](./security.md#ai-data-handling).

## Keyboard shortcuts

Swyftgrids is keyboard-first. On macOS use **⌘**; on Windows/Linux use **Ctrl**.

| Shortcut             | Action                                                                  |
| -------------------- | ----------------------------------------------------------------------- |
| `⌘/Ctrl + K`         | Search tables, columns, views, functions, saved queries                 |
| `⌘/Ctrl + Shift + P` | Command palette — switch databases, open sections, run commands         |
| `⌘/Ctrl + Enter`     | Run the selected text, or the whole buffer if nothing is selected       |
| `Esc`                | Close the search / palette / dialog / inline editor                     |
| Double-click cell    | Inline edit (tables with a primary key); `Enter` commits, `Esc` cancels |
| Click column header  | Cycle sort: ascending → descending → none                               |

## Next steps

- Learn the [connection types](./connections.md) in depth — SSH tunnels, bastions, jump hosts.
- Understand the [architecture](./architecture.md) if you'd like to contribute.
