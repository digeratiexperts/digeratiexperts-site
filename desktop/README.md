# Digerati Experts Desktop

Private, independently buildable Electron package for the Windows, macOS, and Linux DE Portal companion.

The current foundation provides:

- a DE system-tray menu for Portal, DE Desk, Knowledge Base, tickets, agents/software, forms, and account settings;
- allowlisted `digeratiexperts://open/<destination>` deep links;
- origin-locked Portal navigation and a sandboxed renderer;
- an origin-checked, narrowly scoped desktop-notification bridge for future Portal event wiring; and
- an independent compiler, test suite, lockfile, and packaging configuration.

It intentionally does **not** provide arbitrary shell commands, unrestricted filesystem access, silent software installation, or privileged endpoint control. Those capabilities require the separate broker described in [SECURITY.md](./SECURITY.md).

## Local verification

```powershell
npm ci
npm test
npm run package:dir
```

Use Node.js 22.12 or newer for this independent package. `DE_PORTAL_ORIGIN` defaults to `https://portal.digeratiexperts.com` in packaged builds. Only loopback HTTP is accepted during development.

The Portal does not yet publish account events to the desktop notification bridge, and external vendor, payment, file-download, and agent-install flows remain blocked until each destination has an explicit browser/download policy. This package is the secure shell foundation, not a completed endpoint-management agent.

Release artifacts are not production-ready until Windows code signing, Apple Developer ID signing/notarization, Linux package signing, signed auto-update metadata, and the release gates in `SECURITY.md` are configured.
