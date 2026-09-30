# Vendored wat-framework skill

- Source: "Agent Instructions" for the WAT framework (Workflows, Agents, Tools),
  pasted by Joe into the session on 2026-09-02. Upstream ships it as a
  project-level agent-instructions file (CLAUDE.md / AGENTS.md style).
- Installed for: Claude Code project skill discovery (`/wat-framework`), as a
  reference skill rather than a replacement for this repository's governance
  files.
- Audited: 2026-09-02

## Local deviations from the paste

Frontmatter (`name`, `description`) and a labelled DE note were added at the
top. The note scopes the pattern to automation projects, maps `workflows/` and
`tools/` onto this repository's vendored-skill layout, and records the secrets
and cloud-deliverable conventions available here. The original text is
verbatim below the note.

## External-service boundary

None by itself. Tools built under this pattern call whatever APIs their
workflow names; keys stay in the gitignored `.env`.
