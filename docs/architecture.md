# Architecture

Swyftgrids is a **pnpm monorepo** with one shared frontend that runs on two interchangeable backends:
a Rust core on the desktop, and a Node HTTP server for self-hosting. A single typed **IPC contract**
is the seam between them.

## Repository layout

```
swyftgrid/
├── apps/
│   ├── desktop/            Tauri desktop app
│   │   ├── src/            React + TypeScript + Tailwind UI
│   │   └── src-tauri/      Rust core (PostgreSQL driver + SQLite store)
│   └── web/                Self-hosted web server (Fastify + node-postgres)
├── packages/
│   ├── core/               Shared types, the IPC contract, SQL helpers
│   └── ui/                 Design system: Tailwind preset + primitives
├── docs/                   You are here
└── docker/                 Dockerfile + docker-compose for self-hosting
```

## The big picture

```
        ┌──────────────────────────────────────────────┐
        │                React UI (apps/desktop/src)     │
        │  Zustand stores · components · CodeMirror      │
        └───────────────┬───────────────────────────────┘
                        │  invoke<K>(command, params)     ← typed, from @swyftgrid/core
        ┌───────────────▼───────────────┐
        │     IPC bridge (lib/ipc.ts)    │
        │  Tauri?  → Rust commands        │
        │  HTTP?   → POST /api/invoke     │
        │  else    → in-memory mock       │
        └───────┬───────────────┬─────────┘
                │               │
   ┌────────────▼───┐   ┌───────▼────────────┐
   │  Desktop (Rust) │   │  Web (Node)         │
   │  tokio-postgres │   │  node-postgres      │
   │  rusqlite store │   │  JSON file store    │
   │  OS keychain    │   │                     │
   └────────┬────────┘   └─────────┬───────────┘
            │                      │
            ▼                      ▼
        PostgreSQL             PostgreSQL
```

## The IPC contract

[`packages/core/src/ipc/contract.ts`](../packages/core/src/ipc/contract.ts) defines every operation
the UI can request, as a map of command → `{ params, result }`:

```ts
export interface IpcContract {
  'connections.list': {
    params: void;
    result: { connections: Connection[]; folders: ConnectionFolder[] };
  };
  'query.execute': {
    params: { connectionId: string; sql: string; maxRows?: number };
    result: QueryExecution;
  };
  // …~30 commands
}
```

The UI calls everything through one function:

```ts
const { dashboard } = await invoke('db.connect', { connectionId });
```

`invoke<K>` is fully type-safe: params and the return type are inferred from the command name. Adding
a capability is a three-step change — declare it in the contract, implement it in Rust, implement it
in the web server — and the compiler enforces that callers stay correct.

### The three implementations

| Bridge    | When                                                        | Implementation                                                                                      |
| --------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Tauri** | Packaged desktop app (`window.__TAURI_INTERNALS__` present) | Rust commands in `apps/desktop/src-tauri`. Contract names map `table.updateRow → table_update_row`. |
| **HTTP**  | Self-hosted web (`window.__SWYFTGRID_API__` injected)       | `POST /api/invoke` in `apps/web`.                                                                   |
| **Mock**  | `pnpm dev` in a plain browser                               | `apps/desktop/src/lib/mock.ts` — sample data, persisted to `localStorage`.                          |

This is why the same React code runs as a desktop app, a hosted web app, and a no-backend demo.

## Desktop core (Rust)

[`apps/desktop/src-tauri/src`](../apps/desktop/src-tauri/src):

| Module             | Responsibility                                                                 |
| ------------------ | ------------------------------------------------------------------------------ |
| `commands.rs`      | Thin Tauri command handlers — validate and delegate.                           |
| `db/pool.rs`       | One `tokio-postgres` client per connected database; TLS via rustls.            |
| `db/tunnel.rs`     | SSH tunnelling (tunnel/bastion/jump host) with `russh`; host-key verification. |
| `db/introspect.rs` | Catalog queries: schema tree, table detail, dashboard, snapshot.               |
| `db/query.rs`      | Query execution, table pagination, row mutations, statement splitting.         |
| `db/convert.rs`    | PostgreSQL values → JSON-friendly cells.                                       |
| `store.rs`         | Local SQLite (`rusqlite`): connections, history, saved queries, settings.      |
| `models.rs`        | Serde structs mirroring the TypeScript types (camelCase).                      |
| `io.rs`            | CSV/JSON import & export.                                                      |
| `error.rs`         | Unified error that serializes to the UI's error shape (with SQLSTATE/hint).    |

Credentials are kept out of the metadata store and live in the OS keychain (`keyring`).

## Web server (Node)

[`apps/web/src`](../apps/web/src) implements the same contract with `node-postgres` and a JSON file
store, then serves the prebuilt frontend, injecting `window.__SWYFTGRID_API__` so the bridge talks
HTTP. SSH tunnelling is handled by `tunnel.ts` (the `ssh2` client opening a local TCP forward).
See [Self-Hosting](./self-hosting.md).

## Frontend

- **State** — [Zustand](https://github.com/pmndrs/zustand) stores: `connections`, `workspace` (tabs),
  `settings`, `ui` (palette, dialogs, toasts).
- **Editor** — CodeMirror 6 with the PostgreSQL dialect.
- **Grid** — `@tanstack/react-virtual` for windowed rendering of large result sets.
- **Design system** — `@swyftgrid/ui` exposes the Tailwind preset (semantic tokens in
  [`tokens.css`](../packages/ui/src/tokens.css)) and primitives.

## Data flow example: running a query

1. User presses `Cmd+Enter` in the SQL editor.
2. `assessDanger(sql)` ([`core/sql/safety.ts`](../packages/core/src/sql/safety.ts)) runs; if the
   statement is destructive (or the connection is production) a confirmation is shown, with an
   estimated row count from `query.estimateImpact`.
3. `invoke('query.execute', { connectionId, sql, maxRows })` crosses the bridge.
4. The backend splits statements, runs each, converts rows, and returns a `QueryExecution`.
5. The results panel renders the grid/JSON; `history.add` records the run.

## <a id="future-databases"></a> Designed for more databases later

The schema and query types in `@swyftgrid/core` are deliberately database-agnostic in shape, and all
SQL lives behind the backend boundary. Adding MySQL/MariaDB later means implementing a new driver
behind the existing contract — **not** changing the UI. We are intentionally **not** doing this in
v1; PostgreSQL comes first and best.

## Working on Swyftgrids

Prerequisites: Node ≥ 20, pnpm ≥ 9 (`corepack enable pnpm`), and — for the desktop app — Rust plus the
[Tauri platform deps](https://tauri.app/start/prerequisites/). For conventions (commits, PRs), see
[CONTRIBUTING.md](../CONTRIBUTING.md).

| Command                         | What it does                                                        |
| ------------------------------- | ------------------------------------------------------------------- |
| `corepack pnpm dev`             | Vite dev server against the mock backend — fastest loop, no Rust/DB |
| `corepack pnpm tauri dev`       | Full desktop app (Rust core + Vite)                                 |
| `corepack pnpm dev:web`         | Self-hosted web server with hot reload                              |
| `corepack pnpm typecheck`       | Type-check every workspace                                          |
| `corepack pnpm lint` / `format` | ESLint / Prettier                                                   |
| `corepack pnpm test`            | Unit tests (Vitest)                                                 |
| `corepack pnpm tauri build`     | Produce platform installers                                         |

Rust lives in `apps/desktop/src-tauri`; run `cargo fmt --all`, `cargo clippy --all-targets -- -D
warnings`, and `cargo check` there before pushing.

### Adding a backend capability

Because there are two real backends, a new operation is a three-step change the type checker enforces:

1. **Declare it** in [`contract.ts`](../packages/core/src/ipc/contract.ts) (and add the name to the
   `IPC_COMMANDS` array).
2. **Implement it in Rust** — a handler in `commands.rs` (registered in `lib.rs`'s `generate_handler!`).
   Names map by lower-snake-casing each dotted segment: `table.updateRow → table_update_row`.
3. **Implement it in the web server** — an entry in [`backend.ts`](../apps/web/src/backend.ts).

### CI & releasing

CI runs lint, typecheck, tests, a frontend build, `cargo fmt`/`clippy`, and a Docker build on every PR
([`ci.yml`](../.github/workflows/ci.yml)). Push a `vX.Y.Z` tag and
[`release.yml`](../.github/workflows/release.yml) builds desktop installers for all three platforms via
`tauri-action`, uploads them to R2, and builds/pushes the Docker image.
