# Self-Hosting

Swyftgrids ships a web build of the exact same UI as the desktop app, backed by a small Node server.
It's ideal for teams that want a shared, browser-based client behind their own auth/VPN.

## Quick start with Docker Compose

```bash
git clone https://github.com/swyftstack/grids.git
cd swyftgrid
docker compose -f docker/docker-compose.yml up -d
```

Open **http://localhost:4000**. On first launch you'll be taken to a **setup wizard** to create the
single admin account — see [Authentication](#authentication) below.

The Compose file also starts an optional demo PostgreSQL (`postgres:16`). Connect to it from the UI
with:

| Field    | Value                                         |
| -------- | --------------------------------------------- |
| Host     | `postgres` (or `localhost` from your machine) |
| Port     | `5432`                                        |
| Database | `swyftgrid_demo`                              |
| Username | `swyftgrid`                                   |
| Password | `swyftgrid`                                   |

Remove the `postgres` service from the Compose file to connect only to your own databases.

## Running the image directly

```bash
docker run -d \
  --name swyftgrid \
  -p 4000:4000 \
  -v swyftgrid-data:/data \
  ghcr.io/swyftstack/grids:latest
```

| Option                    | Purpose                                         |
| ------------------------- | ----------------------------------------------- |
| `-p 4000:4000`            | Expose the web UI                               |
| `-v swyftgrid-data:/data` | Persist connections, history, and saved queries |

## Building the image yourself

```bash
docker build -f docker/Dockerfile -t swyftgrid:local .
docker run -p 4000:4000 -v $(pwd)/data:/data swyftgrid:local
```

The [multi-stage Dockerfile](../docker/Dockerfile):

1. installs dependencies with pnpm,
2. builds `@swyftgrid/core`, the Vite frontend, and the web server,
3. prunes to production dependencies, and
4. copies everything into a slim `node:24` runtime that runs as a non-root user.

> The runtime uses **Node 24** for its built-in `node:sqlite` module, which backs the authentication
> store with no native dependencies. The image also installs the recovery CLI commands
> (`reset-password`, `reset-admin-password`, `create-admin`, `disable-auth`).

## Configuration

Configure with environment variables (see [Configuration](./configuration.md#environment-variables-web-server)):

```yaml
environment:
  PORT: '4000'
  SWYFTGRID_DATA_DIR: /data
  LOG_LEVEL: info
```

## Health checks

`GET /healthz` returns `{ "status": "ok" }`. The image declares a Docker `HEALTHCHECK` against it.

<a id="authentication"></a>

## Authentication

Authentication exists **only** for the self-hosted web version. The desktop apps need none — your OS
account is the boundary. The model is intentionally tiny: a **single admin account**, built for one
developer or a small trusted team. There are no teams, roles, OAuth, SSO, SMTP, or email recovery by
design.

- **bcrypt** password hashing (cost 12); plaintext is never stored or logged.
- **HTTP-only cookie sessions** (`swyft_session`, `SameSite=Lax`, `Secure` over HTTPS), 30-day default
  lifetime (`SWYFT_SESSION_DAYS`).
- **Double-submit CSRF protection** on every state-changing request.
- **Rate limiting** on `/login`, `/setup`, and password-change endpoints (10/min/IP).
- The user store is a local **SQLite** database (`auth.sqlite`) using Node's built-in `node:sqlite`
  (no native modules).

### First run

Open the app and you're redirected to **Create Admin Account** (`/setup`): enter an email and a
password (min 8 characters). Only one account is ever allowed. After that, visitors hit `/login`.

### Authentication environment variables

| Variable               | Default | Purpose                                                               |
| ---------------------- | ------- | --------------------------------------------------------------------- |
| `SWYFT_ADMIN_EMAIL`    | —       | Bootstrap admin email (automated installs). Applied once, if no user. |
| `SWYFT_ADMIN_PASSWORD` | —       | Bootstrap admin password. Used once, never echoed to logs/UI.         |
| `SWYFT_AUTH_DISABLED`  | `false` | Skip authentication entirely (trusted networks / auth proxy only).    |
| `SWYFT_SESSION_DAYS`   | `30`    | Session cookie lifetime in days.                                      |
| `SWYFT_COOKIE_SECURE`  | `auto`  | `auto` (Secure on HTTPS), or force `true` / `false`.                  |

Set both bootstrap variables for unattended deploys; the admin is created on first startup and the
variables are then ignored.

### Disabling auth & password recovery (CLI)

If Swyftgrids already sits behind a VPN, Tailscale, Cloudflare Access, or an authenticating proxy, you
can turn auth off — a persistent banner is then shown in the app:

```bash
docker exec swyftgrids disable-auth     # or set SWYFT_AUTH_DISABLED=true
docker exec swyftgrids enable-auth
```

There is **no email recovery**. Recover locally inside the container:

```bash
docker exec swyftgrids reset-password               # prints a one-time temp password
docker exec -it swyftgrids reset-admin-password     # set a new password interactively
docker exec -it swyftgrids create-admin             # only if no admin exists yet
```

A temporary password flags the account `must_change_password`, forcing a change on next login. In the
app, **Settings → Security** shows auth status, admin email, last login, and a change-password action.

## Reverse proxy & TLS

Run Swyftgrids behind a reverse proxy (Caddy, nginx, Traefik) to terminate TLS. The server trusts
`X-Forwarded-Proto`, so session cookies are automatically marked `Secure` over HTTPS. Minimal Caddy
example:

```caddy
db.example.com {
    reverse_proxy localhost:4000
}
```

## <a id="security"></a> Security considerations

Authentication is **on by default**. Still, treat the instance with care:

- **Enable TLS** at your proxy so session cookies are sent securely.
- **Protect the data directory.** Connection secrets (database passwords and SSH passwords / private
  keys / passphrases) and the auth database live in `/data` (`swyftgrid.json` and `auth.sqlite`) —
  there is no OS keychain in a container. They are always stripped from API listings and never logged,
  but use a restricted volume or secret mount, and consider read-only databases for shared instances.
- **Use least-privilege database users**, especially for production connections.
- Only use `SWYFT_AUTH_DISABLED=true` behind a trusted network, VPN, or authenticating proxy.

For the strongest isolation, prefer the **desktop app**, where credentials live in the OS keychain
and nothing is shared.

## Updating

```bash
docker compose -f docker/docker-compose.yml pull
docker compose -f docker/docker-compose.yml up -d
```

Your `/data` volume carries connections and saved queries across upgrades.
