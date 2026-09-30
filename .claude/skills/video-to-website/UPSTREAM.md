# Vendored video-to-website skill

- Source: "Video to Website" skill pack, supplied by Joe as an upload on 2026-09-02
  (`SKILL.md` only).
- Installed for: Claude Code project skill discovery (`/video-to-website`).
- Audited: 2026-09-02

## Local deviations from the upload

One line in "Workflow" that pointed at the author's personal Windows path for
FFmpeg (`C:\Users\nateh\bin\`) was replaced with an environment-neutral
requirement (FFmpeg/FFprobe on PATH; do not download binaries; build under an
isolated experiment directory, never inside `client/`). No other text was changed.

Pairs with `.claude/skills/frontend-design/` (this skill delegates styling to it)
and overlaps in purpose with `.claude/skills/scrollcraft/`; the scrollcraft skill
remains the DE lane for site-v2 work (issue #165 / PR #178).

## External-service boundary

Generated pages load Lenis and GSAP from jsDelivr at runtime. Frame extraction
runs locally with FFmpeg. No API keys are involved.
