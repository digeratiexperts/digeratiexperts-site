# Archived Electron prototype

This directory preserves the former desktop-shell prototype for reference. It is not part of the supported website, server build, CI, or production deployment.

The prototype was removed from the web application's dependency graph because it had no package scripts or release pipeline and contained incomplete desktop-only behavior. Do not restore Electron dependencies to the root `package.json`.

If a desktop client is resumed, create a separately versioned package with its own security audit, build configuration, signed artifacts, update strategy, and portal authentication design before using this source.
