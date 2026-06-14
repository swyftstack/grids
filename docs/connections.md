# Connections

The Connection Manager is where you create, organize, and open PostgreSQL connections. Open it from
the sidebar (**New connection**) or via `Cmd/Ctrl+K`.

## Connection types

Production databases are rarely reachable directly — they sit inside a VPC, behind a bastion, or
across a jump host. When you add a connection you first choose **how to reach it**. SSH tunnelling is
the default.

| Type             | Use it when                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- |
| **SSH Tunnel**   | The database is reachable from one SSH server you can log into. _(default)_            |
| **Bastion Host** | You reach the network through a single hardened gateway, then the database behind it.  |
| **Jump Host**    | You must chain through one or more intermediate SSH hosts before the final hop.        |
| **Direct**       | The database is directly reachable (local dev, same network, managed public endpoint). |

Under the hood every non-direct type is an ordered chain of SSH hops: SSH Tunnel and Bastion use one
hop, Jump Host uses two or more. The database connects over the forwarded channel from the final hop —
so the **Host / Port** you enter for the database are resolved _from that last hop's network_, exactly
like running `psql` there.

## Database details

These describe the PostgreSQL server itself, for every connection type:

| Field                   | Notes                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Name**                | A friendly label, e.g. _Production Database_.                                                                        |
| **Environment**         | `development`, `staging`, or `production`. Production turns on [Production Safety](./security.md#production-safety). |
| **Host / Port**         | The database endpoint (from the final SSH hop when tunnelling). Defaults to `localhost:5432`.                        |
| **Database**            | The database name.                                                                                                   |
| **Username / Password** | The DB user. The password is kept in your OS keychain — never in the metadata store.                                 |
| **SSL mode**            | `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`. Use `verify-full` for the strongest guarantee.  |

Prefer a single URL? Toggle **Use a connection string** and paste
`postgres://user:password@host:5432/database?sslmode=require`. SSH tunnelling still applies on top.

## SSH details

For SSH Tunnel, Bastion, and Jump Host you configure each SSH hop:

| Field               | Notes                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------- |
| **SSH host / port** | The SSH server to connect to. Port defaults to `22`.                                           |
| **SSH username**    | The login user on that host.                                                                   |
| **Authentication**  | **Private key** (recommended) or **Password**.                                                 |
| **Private key**     | Path to a key file on disk (e.g. `~/.ssh/id_ed25519`). Add a **passphrase** if it's encrypted. |
| **Password**        | Used only with password auth.                                                                  |

For **Jump Host**, add a hop per intermediate server with **Add hop**; the last card is the host that
reaches the database. Hops connect in order, each tunnelled through the previous one (ProxyJump-style).

SSH passwords, private keys, and passphrases are secrets: they are stored in the OS keychain on the
desktop (and in the protected data file on the self-hosted server), stripped from connection
listings, and never logged. See [credential storage](./configuration.md#credential-storage).

### Host-key verification

The SSH server's host key is verified on every connection:

- The first time you connect, **Test connection** shows the server's `SHA256:…` fingerprint. Click
  **Pin host key** to remember it.
- On later connections a **mismatched** host key is refused (a possible man-in-the-middle), so pin the
  fingerprint once you've confirmed it out of band.

## Test before saving

Click **Test connection** to open the tunnel (if any), negotiate TLS, and run a round-trip against the
database. You'll see the latency and detected server version, the SSH fingerprints to pin, or a clear
error naming what failed.

## Organizing connections

- **Favorites** — click the ★ to pin a connection to the top and surface it first in `Cmd/Ctrl+K`.
- **Folders** — group related connections (e.g. by project or environment).
- **Duplicate** — copy a connection's settings as a starting point for a similar one.
- **Rename / Edit** — adjust any field; leave password/key fields blank to keep the stored secrets.
- **Delete** — removes the connection, its keychain secrets, history, and saved queries.

## Connecting & switching

- Click **Connect** (or **Open** if already connected) on a card.
- Or press `Cmd/Ctrl+K` and pick any connection — Swyftgrids opens the tunnel and its dashboard.
- Connected databases show a green dot; the active one drives the sidebar's Schema Explorer.

Give production connections the `production` environment and a distinct color so they're unmistakable;
the status bar then shows a red **PRODUCTION** indicator. See [Security](./security.md).
