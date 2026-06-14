# Security

Swyftgrids is designed to be trustworthy with your databases. This page summarizes the security model;
to **report a vulnerability**, follow the [Security Policy](../SECURITY.md) (please do not open a
public issue).

## Threat model & principles

- **Local-first.** On the desktop, all connection metadata and settings live on your machine. There
  is no Swyftgrids account and no cloud.
- **No telemetry.** Swyftgrids makes no analytics or "phone-home" requests. The only outbound network
  traffic is to the databases you connect to and, if you explicitly enable it, your chosen AI provider.
- **Least surprise.** Anything that leaves your machine (export to a service, AI requests) is an
  explicit, visible action.

## Credentials

- **Desktop:** the database password and every SSH secret (SSH password, private key, passphrase) are
  stored in the **OS keychain** (Windows Credential Manager, macOS Keychain, Linux Secret Service),
  never in the app's metadata database, and are never returned to the UI in connection listings. See
  [credential storage](./configuration.md#credential-storage).
- **Self-hosted web:** there is typically no OS keychain in a container, so secrets are stored in the
  JSON data file — always stripped from listings and never logged. Protect that file and put the
  server behind authentication — see [Self-Hosting › Security](./self-hosting.md#security).

## Transport & tunnel security

Database connections honor PostgreSQL `sslmode`. The desktop core uses **rustls** (a memory-safe,
pure-Rust TLS stack) with the Mozilla root set for `require`/`verify-*` modes. Set `verify-full` for
the strongest guarantee that you're talking to the intended server; when tunnelling, the certificate
is still validated against the real database hostname.

**SSH tunnels** (SSH tunnel, bastion, jump host) connect with the pure-Rust [`russh`] client on the
desktop and [`ssh2`] on the self-hosted server. The SSH server's **host key is verified**: a pinned
`SHA256` fingerprint must match (a mismatch is refused as a possible man-in-the-middle), and on first
connect the fingerprint is surfaced so you can pin it. See [Connections › Host-key verification](./connections.md#host-key-verification).

[`russh`]: https://crates.io/crates/russh
[`ssh2`]: https://www.npmjs.com/package/ssh2

## SQL safety

- Identifiers are always quoted and escaped before interpolation (`"` doubled).
- Filter, sort, and row-edit values are rendered as **escaped SQL literals** (single quotes doubled),
  so generic grid edits can't inject SQL.

<a id="production-safety"></a>

## Production safety

Production Safety is a set of guard rails that make it hard to damage a production database by
accident. Set a connection's **Environment** to `production` (see [Connections](./connections.md)) to
activate them: a red **PRODUCTION** indicator in the status bar, a badge on the card and Table Browser,
and a confirmation dialog before dangerous statements.

Before a statement runs, Swyftgrids assesses it with fast, conservative heuristics
([`core/sql/safety.ts`](../packages/core/src/sql/safety.ts)) and asks you to confirm when it sees:

| Situation                                | Why                              |
| ---------------------------------------- | -------------------------------- |
| `DROP TABLE/SCHEMA/…`                    | Irreversible structural change   |
| `TRUNCATE`                               | Empties a table instantly        |
| `DELETE FROM …`                          | Removes data                     |
| `UPDATE` **without** `WHERE`             | Touches every row                |
| Any write on a **production** connection | Extra care where it matters most |

Comments and string literals are stripped first, so a keyword inside `'… do not DROP …'` never
triggers a false alarm. The dialog shows the exact statement and, when available, an **estimated
affected-row count** from the planner (`EXPLAIN`). It is intentionally conservative — it would rather
ask once too often. None of this replaces good database hygiene: use least-privilege/read-only users
and keep backups for production.

<a id="ai-data-handling"></a>

## AI data handling

AI features are **off by default** and require your own API key. When enabled, the **context mode**
controls what may be transmitted:

| Mode        | Sends                                                                 |
| ----------- | --------------------------------------------------------------------- |
| Schema only | Table/column names and types — no row data                            |
| Manual      | Only what you explicitly select                                       |
| Full        | Schema **and** selected database content (requires explicit approval) |

You are shown a privacy warning before AI can be enabled. The AI tab is visible by default but
transmits nothing until you activate it with your own key, and you can hide it from Settings.

## Reporting

See [SECURITY.md](../SECURITY.md). We aim to acknowledge reports within 48 hours.
