# Vendored trigger-dev skill

- Source: "Trigger.dev CLAUDE.md" pack (Claude Workflow Builder), supplied by
  Joe as uploads on 2026-09-02: `CLAUDE.md`, `trigger-ref.md`, `mcp.json`.
- Installed for: Claude Code project skill discovery (`/trigger-dev`), as a
  reference skill rather than a replacement for this repository's `CLAUDE.md`.
  The companion reference is `.claude/skills/trigger-ref/`; the MCP server
  config is the repository root `.mcp.json`.
- Audited: 2026-09-02

## Local deviations from the upload

Frontmatter and a labelled DE note were added at the top. The note states that
this website repo is not a Trigger.dev project, that the upstream "push to
master auto-deploys" rule must not be applied here (this repo's CI deploys the
public website from `main`), and where secrets, the MCP config and the
reference skill live. The original text is verbatim below the note.

## External-service boundary

Automations built under these rules run on cloud.trigger.dev and call whatever
third-party APIs the automation needs. The MCP server (`.mcp.json`) runs
`npx trigger.dev@4.4.0 mcp` locally and talks to the Trigger.dev API with the
user's login; it can deploy and trigger runs, so it must only be enabled by
Joe. Installing these files makes no network call.
