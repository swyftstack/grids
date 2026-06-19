# Changelog

All notable changes to Swyftgrids are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each tagged release also has auto-generated notes on the
[GitHub Releases page](https://github.com/swyftstack/grids/releases), grouped into
**Added**, **Changed**, and **Fixed**.

## [Unreleased]

### Added

- Automated release pipeline: pushing a `v*` tag builds Windows, macOS, and Linux
  installers plus a Docker image, generates SHA-256 checksums and release notes, and
  publishes a GitHub Release with no manual steps.
- Downloads, Releases, and Changelog pages on the marketing site, driven live by the
  GitHub Releases API (versions are never hardcoded).

## [0.1.0] - 2026-06-14

Initial public release.

### Added

- **Connectivity** — direct connections plus SSH tunnel, bastion, and jump-host support;
  key/password auth, host-key pinning, SSL modes, and connection strings.
- **Connection manager** — unlimited connections, folders, favorites, duplicate, and
  test-before-save.
- **Dashboard** — database size, table/schema/view counts, active connections, and server
  version at a glance.
- **Schema explorer** — schemas, tables, views, materialized views, functions, triggers,
  indexes, constraints, and extensions.
- **Table browser** — spreadsheet UX with virtualized rows, server-side pagination, sort,
  filter, inline edit, and copy-row-as-JSON.
- **SQL editor** — multi-tab editor with syntax highlighting, autocomplete, formatting,
  run-selection, and execution stats.
- **Saved queries & history** — per database, with folders, tags, favorites, search, and
  re-run.
- **ER diagrams** — auto-generated, with zoom/pan, drag, and PNG/SVG export.
- **Universal search** across tables, columns, views, functions, indexes, and saved
  queries.
- **Performance & health** — query plan visualization, index inspector, realtime
  monitoring, and a single database health score.
- **Import / export** — import CSV; export CSV and JSON.
- **Production safety** — confirmations for `DELETE` / `TRUNCATE` / `DROP`, estimated
  affected rows, and a production banner.
- **AI workspace (optional, off by default)** — NL→SQL, explain, optimize, and error
  explanation. Bring your own key (OpenAI, Anthropic, Gemini, OpenRouter) or run locally
  with Ollama. Requests never pass through Swyftgrids servers.
- **Self-hosted web version** — Docker image with a single-admin login, cookie sessions +
  CSRF, and local CLI recovery commands.

[Unreleased]: https://github.com/swyftstack/grids/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/swyftstack/grids/releases/tag/v0.1.0
