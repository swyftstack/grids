# Code Signing & the "Windows protected your PC" Warning

When you download an unsigned installer, the OS shows a scary warning:

- **Windows** — _"Windows protected your PC"_ (Microsoft Defender SmartScreen). You have to click
  **More info → Run anyway** to install.
- **macOS** — _"cannot be opened because the developer cannot be verified"_ (Gatekeeper). You have
  to right-click → **Open**, or allow it in **System Settings → Privacy & Security**.
- **Linux** — AppImages aren't signed the same way; users just need to mark them executable.

This is **not a bug in Swyftgrids** — it is the OS telling the user the binary isn't signed with a
recognised code-signing certificate. The only real fix is to **sign the installers with a
certificate**. There is no code change that removes the warning.

This page explains how Swyftgrids' release pipeline signs builds and what you need to provide.

## TL;DR

The release workflow ([.github/workflows/release.yml](../.github/workflows/release.yml)) already has
signing wired in. It is **gated on repository secrets** — if the secrets aren't set, builds are
produced unsigned (today's behaviour). Add the secrets below and tagged releases get signed
automatically; no workflow edits required.

| Platform | What you need                                 | Secrets to set                                                                                                              |
| -------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Windows  | An OV or **EV** Authenticode certificate      | `WINDOWS_CERTIFICATE`, `WINDOWS_CERTIFICATE_PASSWORD`                                                                       |
| macOS    | An Apple **Developer ID Application** cert     | `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID` |
| Linux    | Nothing required (AppImage/.deb are unsigned) | —                                                                                                                          |

> **Important about SmartScreen:** signing with a **standard OV certificate stops the "Unknown
> publisher" wording**, but SmartScreen may still warn until the signed installer builds up
> *download reputation* (a few hundred installs). An **EV certificate** gets instant SmartScreen
> reputation but requires a hardware token / cloud HSM. If you want zero warnings on day one, buy
> an EV cert (or use Azure Trusted Signing — see below).

## Windows

1. Obtain an Authenticode code-signing certificate from a CA (DigiCert, Sectigo, SSL.com, …).
   - **OV** (Organization Validation) — cheaper, but SmartScreen needs reputation to warm up.
   - **EV** (Extended Validation) — instant SmartScreen trust; ships on a hardware token or HSM.
2. Export it as a password-protected `.pfx` file, then base64-encode it:
   ```bash
   # macOS/Linux
   base64 -w0 code-sign.pfx > cert.b64
   # Windows (PowerShell)
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("code-sign.pfx")) | Set-Content cert.b64
   ```
3. In the GitHub repo: **Settings → Secrets and variables → Actions** add:
   - `WINDOWS_CERTIFICATE` — the contents of `cert.b64`.
   - `WINDOWS_CERTIFICATE_PASSWORD` — the `.pfx` password.

On the next tagged release, the **Set up Windows code signing** step imports the cert into the
runner's store, pins its thumbprint into `tauri.conf.json`, and Tauri signs the NSIS installer
(SHA-256, timestamped against DigiCert).

> **EV certs on a hardware token** can't be base64-exported. Use **[Azure Trusted Signing]** (a
> cloud-based signing service that gives EV-grade SmartScreen reputation without a physical token).
> Configure it via a custom `bundle.windows.signCommand` in `tauri.conf.json` and the
> `azure/trusted-signing-action` step — see the Tauri docs linked below.

[Azure Trusted Signing]: https://learn.microsoft.com/azure/trusted-signing/

## macOS

1. Enroll in the **Apple Developer Program** ($99/yr).
2. Create a **Developer ID Application** certificate, export it as a `.p12`, and base64-encode it
   (same as the Windows `.pfx` step above).
3. Create an **app-specific password** for your Apple ID (for notarization).
4. Add these repo secrets:
   - `APPLE_CERTIFICATE` — base64 of the `.p12`.
   - `APPLE_CERTIFICATE_PASSWORD` — the `.p12` password.
   - `APPLE_SIGNING_IDENTITY` — e.g. `Developer ID Application: Your Name (TEAMID)`.
   - `APPLE_ID` — your Apple ID email.
   - `APPLE_PASSWORD` — the app-specific password.
   - `APPLE_TEAM_ID` — your 10-character Team ID.

`tauri-action` signs **and notarizes** the `.dmg` automatically when these are present, so Gatekeeper
opens it without warnings.

## Verifying a signed build

- **Windows:** right-click the installer → **Properties → Digital Signatures**, or
  `Get-AuthenticodeSignature .\Swyftgrids-Setup.exe`.
- **macOS:** `codesign -dv --verbose=4 Swyftgrids.app` and
  `spctl -a -vvv -t install Swyftgrids.dmg`.

## References

- Tauri — [Windows code signing](https://v2.tauri.app/distribute/sign/windows/)
- Tauri — [macOS code signing](https://v2.tauri.app/distribute/sign/macos/)
- [Releasing](./releasing.md) — the full release pipeline.
