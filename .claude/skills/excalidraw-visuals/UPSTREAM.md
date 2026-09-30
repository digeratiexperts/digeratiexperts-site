# Vendored excalidraw-visuals skill

- Source: "Excalidraw Visuals" skill pack (`excalidrawvisuals.zip`), supplied by
  Joe as an upload on 2026-09-02. The zip's distributable `SKILL.md`
  (`name: excalidraw-visuals`) was installed; a second, personal variant of the
  skill (`name: visualizations`, with the author's own brand-asset rules) was
  uploaded alongside and intentionally not installed.
- Revised 2026-09-02 (second pass): `AI Website Skills.rar` was supplied, and
  diffing it against this directory showed the `visualizations` variant is a
  **newer revision** of the same skill, not merely a personal fork. Four
  sections were back-ported from it (see "Back-ported from the newer variant"
  below). The distributable's `name`, DE paths and DE note are kept; the
  variant's own paths, `.env` URL mapping and Claude-specific brand asset are
  not adopted.
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

## Back-ported from the newer variant (2026-09-02, second pass)

Source: `AI Website Skills/Excalidraw Style Images/SKILL.md` in the supplied
`.rar` (17,105 B; `name: visualizations`). The four blocks below are verbatim
from it. Prose around them is DE-adapted.

| Section | Change | Verbatim |
|---|---|---|
| `## Style Prefixes (LOCKED)` | Replaces the single light prefix; adds Dark Mode | both prefixes |
| `## Step 4: Build the Prompt` | Revised template + "Critical rules for element descriptions" | template block |
| `## Golden Example` | New; worked exemplar plus the patterns it demands | whole block |
| `## Brand Assets` + `### Logo Prompt Rules` | New; adapted, see below | logo-placement block |

**This changes generated output.** The revised light prefix is not a superset of
the old one: handwriting is messier, outlines wobblier, fills are solid and flat,
and each shape's border now comes from its own fill colour family instead of a
uniform dark gray (#495057). Visuals generated before this revision will not
match visuals generated after it. A dated note in `SKILL.md` says so.

Adaptations in the brand-asset section, all of which correct upstream text that
would not work here:

- Upstream resolves `--input` paths to URLs through `.env` variables
  (`brand-assets/Claude.png` -> `CLAUDE_URL`). The vendored script uploads local
  files to kie.ai directly, so repository paths are passed as-is and no mapping
  is documented.
- Upstream's asset table lists `brand-assets/Claude.png`, which is not vendored
  here. The table points at `client/public/logo.png`; the logo-placement prompt
  block is parameterised as `[LOGO NAME]`.
- Upstream lists ten aspect ratios. `scripts/generate-visual.cjs` validates
  `16:9`, `1:1`, `4:5` and exits on anything else, so `SKILL.md` states the
  three and says the wider list does not apply.

## Download guard added to the script (2026-09-02)

`downloadImage()` followed redirects but never checked the HTTP status, so any
non-2xx body was written to the output path and reported as `Saved to:` with
exit 0. In a cloud session whose egress allowlist does not include kie.ai's
result host (`tempfile.aiquickdraw.com`), this wrote the proxy's 111-byte
"Host not in allowlist" text to a `.png` and exited successfully -- the
generation had already cost credits and looked like it had worked.

The script now rejects a non-2xx response and any body that does not begin with
PNG, JPEG or WebP magic bytes, and on a download failure prints the task id and
result url so the paid-for image can be fetched without generating again. This
is a local fix, not upstream text; upstream has the same defect.

Note for cloud environments: `api.kie.ai` and the upload host
`tempfile.redpandaai.co` are reachable, but the result host
`tempfile.aiquickdraw.com` must also be on the environment's egress allowlist or
no generated image can be downloaded.

Also corrected: the Notes line quoted the price as `$0.02-0.09`. Claude Code
substitutes `$0` with the first skill argument, so invoking the skill with any
argument corrupted the cost figure. Written as plain USD now. The same defect in
`nano-banana-images/SKILL.md` is fixed in the same commit.

The documentation back-port above changed no script; the download guard in
this section is the only code change.

## External-service boundary

`scripts/generate-visual.cjs` sends the prompt and any `--input` images to
`api.kie.ai` and uploads local reference images to
`kieai.redpandaai.co/api/file-base64-upload`, then downloads the result. Each
run incurs third-party charges. Installing the skill makes no call and adds no
credential.
