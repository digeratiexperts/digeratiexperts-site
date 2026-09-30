# Vendored web-design-rules skill

- Source: "Web Design CLAUDE.md" (Frontend Website Rules), supplied by Joe as an
  upload on 2026-09-02. Upstream ships it as a project-root `CLAUDE.md`.
- Installed for: Claude Code project skill discovery (`/web-design-rules`), as a
  reference skill rather than a replacement for this repository's `CLAUDE.md`.
- Audited: 2026-09-02

## Local deviations from the upload

Frontmatter (`name`, `description`) and a labelled DE note were added at the
top. The note scopes the rules to standalone pages, replaces the author's
`serve.mjs` / `screenshot.mjs` / Puppeteer workflow with two dependency-light
helpers in `scripts/` (a static server and a Playwright screenshot tool that
write the same `temporary screenshots/screenshot-N.png` files), and points brand-asset lookup at DE's real
locations. The original rules text is verbatim below the note.

## External-service boundary

Pages built under these rules load Tailwind from `cdn.tailwindcss.com` and
placeholder images from `placehold.co` at runtime. No API keys are involved.
