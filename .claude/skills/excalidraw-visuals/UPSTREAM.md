# Vendored excalidraw-visuals skill

- Source: "Excalidraw Visuals" skill pack (`excalidrawvisuals.zip`), supplied by
  Joe as an upload on 2026-09-02. The zip's distributable `SKILL.md`
  (`name: excalidraw-visuals`) was installed; a second, personal variant of the
  skill (`name: visualizations`, with the author's own brand-asset rules) was
  uploaded alongside and intentionally not installed.
- Installed for: Claude Code project skill discovery (`/excalidraw-visuals`).
- Audited: 2026-09-02

## Layout

The upstream install spreads files across the project root. Here everything is
contained in this directory so it cannot collide with the repository's
operational `scripts/` folder or the ChatGPT Kie connector from PR #168:

| Upstream | Here |
|---|---|
| `.claude/skills/excalidraw-visuals/SKILL.md` | `SKILL.md` (paths rewritten, DE note added) |
| `.claude/skills/excalidraw-visuals/style-guide.md` | `style-guide.md` (two path rewrites) |
| `scripts/excalidraw-visuals/generate-visual.js` | `scripts/generate-visual.cjs` (see below) |
| `brand-assets/excalidraw-style-reference.png` | `brand-assets/excalidraw-style-reference.png` (verbatim, 1344x768) |
| `README.md` | `README.upstream.md` (verbatim; its paths describe the upstream layout) |
| `.env.example` | not installed (`.env.*` is gitignored here); see "Key" below |

## Local deviations from the upload

- Script renamed `.js` to `.cjs`: this repository's `package.json` declares
  `"type": "module"`, which makes Node treat a `.js` file as ESM and the
  upstream `require()` calls fail. The `.cjs` extension restores CommonJS.
- Key lookup replaced: `KIE_AI_API_KEY` or `KIE_API_KEY` from the environment,
  else from the first `.env` found walking up from the working directory
  (upstream read a fixed `../../.env` relative to the script). The key is never
  printed.
- Two JSON-parse guards added so a non-JSON gateway/proxy response prints the
  raw body instead of crashing with a `SyntaxError`. Everything else in the
  script (model `google/nano-banana`, upload endpoint, polling, download) is
  verbatim.
- Output path changed from `projects/excalidraw-visuals/` to
  `artifacts/kie-ai/excalidraw/` to sit beside the other kie.ai candidates.
- A labelled DE note was added after the frontmatter in `SKILL.md`.

## External-service boundary

`scripts/generate-visual.cjs` sends the prompt and any `--input` images to
`api.kie.ai` and uploads local reference images to
`kieai.redpandaai.co/api/file-base64-upload`, then downloads the result. Each
run incurs third-party charges. Installing the skill makes no call and adds no
credential.
