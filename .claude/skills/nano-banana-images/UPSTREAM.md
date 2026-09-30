# Vendored nano-banana-images skill

- Source: "Nano Banana 2 Image Generation Master" skill pack (Nate's Nano Banana 2
  project), supplied by Joe as uploads on 2026-09-02: `SKILL.md`, `gemini.md`,
  `master_prompt_reference.md`, `generate_kie.py`, `get_kie_image.py`.
- Installed for: Claude Code project skill discovery (`/nano-banana-images`).
- Audited: 2026-09-02

## Layout

The upstream install spreads files across the project root (`gemini.md`,
`master_prompt_reference.md`, `scripts/`). Here everything is contained in this
directory so it cannot collide with the repository's operational `scripts/`
folder, the DE `GEMINI.md`, or the ChatGPT Kie connector from PR #168:

| Upstream | Here |
|---|---|
| `.claude/skills/nano-banana-images/SKILL.md` | `SKILL.md` (adapted, see below) |
| `master_prompt_reference.md` | `references/master_prompt_reference.md` (verbatim) |
| `gemini.md` | `references/gemini-project-organizer.md` (verbatim, reference only; not a root `GEMINI.md`) |
| `scripts/generate_kie.py` | `scripts/generate_kie.py` (rewritten, same CLI) |
| `scripts/get_kie_image.py` | `scripts/get_kie_image.py` (rewritten, same CLI) |
| — | `scripts/_kie.py` (shared helpers), `scripts/kie_credit.py` (credit probe) |

## Local deviations from the upload

- `SKILL.md`: frontmatter `name` changed to the slug `nano-banana-images` so the
  slash command matches the directory; a labelled DE note added after the
  frontmatter; "Prerequisites", "Master Reference Guide", "Execution via Kie.ai"
  and "How to use this skill" rewritten for this repository (no `generate_image`
  tool exists here; relative paths; bash instead of PowerShell). The schema,
  Dense Narrative format and best-practice sections are verbatim.
- Scripts: key is read from `KIE_AI_API_KEY` or `KIE_API_KEY` (env, then a
  `.env` found by walking up from the working directory) instead of a fixed
  `../.env` next to the script; `--dry-run` added; output directory is created;
  polling uses backoff with a 10-minute ceiling; a provenance manifest is
  written next to each image. Endpoints, model (`nano-banana-2`) and payload
  shape are unchanged.

## External-service boundary

`scripts/generate_kie.py`, `get_kie_image.py` and `kie_credit.py` call
`api.kie.ai` with the bearer key and download result files from the URLs kie.ai
returns. Generation incurs third-party charges. Installing the skill makes no
call and adds no credential; the key lives only in the environment or the
gitignored `.env`.
