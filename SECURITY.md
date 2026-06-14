# Security Policy

## Supported versions

Swyftgrids is in active development. Security fixes are applied to the latest released minor version
and the `main` branch.

| Version        | Supported |
| -------------- | --------- |
| latest release | ✅        |
| `main`         | ✅        |
| older          | ❌        |

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, use one of the following private channels:

1. **GitHub Security Advisories** — open a [private advisory](https://github.com/swyftstack/grids/security/advisories/new) (preferred).
2. **Email** — send details to **security@swyftgrid.dev**.

Please include:

- A description of the vulnerability and its impact
- Steps to reproduce or a proof of concept
- Affected version(s) and platform(s)

We aim to acknowledge reports within **48 hours** and to provide a remediation timeline within
**7 days**.

## Our security model

Swyftgrids is **local-first**. By design:

- Connection details and credentials are stored locally (see [Configuration](./docs/configuration.md#credential-storage)).
- No database content is sent to any third party **unless** you explicitly enable AI features and
  approve the data-sharing mode. AI is **off by default**. See
  [Security › AI data handling](./docs/security.md#ai-data-handling).
- We collect **no telemetry**.

## Disclosure

We follow coordinated disclosure. We will credit reporters who wish to be acknowledged once a fix
is released.
