# Contributing to Swyftgrids

Thanks for your interest in making Swyftgrids better! This guide explains how to set up your
environment, the conventions we follow, and how to get changes merged.

By participating, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Development setup](#development-setup)
- [Project layout](#project-layout)
- [Running the app](#running-the-app)
- [Coding standards](#coding-standards)
- [Commit conventions](#commit-conventions)
- [Pull request process](#pull-request-process)
- [Reporting bugs & requesting features](#reporting-bugs--requesting-features)

## Ways to contribute

- 🐛 **Report bugs** using the [bug report template](./.github/ISSUE_TEMPLATE/bug_report.yml).
- 💡 **Request features** using the [feature request template](./.github/ISSUE_TEMPLATE/feature_request.yml).
- 📖 **Improve docs** in [`docs/`](./docs) — typos and clarifications are very welcome.
- 🧑‍💻 **Write code** — look for [`good first issue`](https://github.com/swyftstack/grids/labels/good%20first%20issue) labels.

## Development setup

### Prerequisites

| Tool                               | Version | Notes                                                             |
| ---------------------------------- | ------- | ----------------------------------------------------------------- |
| [Node.js](https://nodejs.org/)     | >= 20   | LTS recommended                                                   |
| [pnpm](https://pnpm.io/)           | >= 9    | `corepack enable pnpm`                                            |
| [Rust](https://www.rust-lang.org/) | stable  | Required for the desktop (Tauri) build                            |
| Platform deps                      | —       | See [Tauri prerequisites](https://tauri.app/start/prerequisites/) |

### Install

```bash
git clone https://github.com/swyftstack/grids.git
cd swyftgrid
pnpm install
```

## Project layout

```
apps/desktop      Tauri desktop app (React UI in src/, Rust core in src-tauri/)
apps/web          Self-hosted web server
packages/core     Shared types, IPC contract, SQL safety helpers
packages/ui       Shared design system
docs/             Documentation
docker/           Container + compose files
```

See [docs/architecture.md](./docs/architecture.md) for the full picture.

## Running the app

```bash
# Full desktop app (requires Rust)
pnpm tauri dev

# UI only, in a browser, against a mock backend (no Rust / no database needed)
pnpm dev

# Self-hosted web server
pnpm dev:web
```

## Coding standards

- **TypeScript** everywhere on the frontend; `strict` mode is on. No `any` without justification.
- **Rust** for the desktop core — run `cargo fmt` and `cargo clippy` before committing.
- **Formatting** is enforced by Prettier and ESLint:
  ```bash
  pnpm format        # auto-fix
  pnpm lint          # check
  pnpm typecheck     # type-check all packages
  ```
- Keep components small and focused. Prefer composition over configuration.
- Match the surrounding code style — naming, structure, and comment density.
- New backend capabilities must be added to the **IPC contract** in
  [`packages/core/src/ipc/contract.ts`](./packages/core/src/ipc/contract.ts) and implemented in
  **both** the Tauri backend and the web server.

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(editor): add multi-cursor support
fix(table): correct pagination off-by-one
docs(readme): clarify install steps
chore(ci): bump actions/checkout to v4
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.

## Pull request process

1. Fork and create a branch: `git checkout -b feat/my-feature`.
2. Make your change with tests where applicable.
3. Run `pnpm lint && pnpm typecheck && pnpm test` and `cargo clippy` (if you touched Rust).
4. Open a PR against `main` using the PR template. Link the issue it closes.
5. A maintainer reviews. CI must be green. Squash-merge is the default.

Keep PRs focused and reasonably small — they are much easier to review and merge.

## Reporting bugs & requesting features

Use the issue templates. For security issues, **do not** open a public issue — follow the
[Security Policy](./SECURITY.md) instead.

---

Happy hacking! 💜
