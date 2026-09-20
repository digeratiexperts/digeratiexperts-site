# Kie AI asset-generation workflow

Status: approved provider workflow for **Digerati Experts AI-generated asset candidates**.

Owner authorization: Joe explicitly authorized Kie AI for DE-generated assets on 2026-08-31. This approval authorizes the provider and workflow; it does **not** waive DE visual review, provenance, truthfulness, licensing, security, or release gates.

## Purpose

Kie AI is the generation gateway for DE-created image and video candidates when an AI-generated visual is appropriate. It is not a runtime dependency for public page loads. Generate, download, review, optimize, and then publish approved derivatives through the normal DE asset pipeline.

Canonical DE imagery direction remains `design/IMAGERY.md` and Visual System v2. The Kie connector automatically appends the locked DE art-direction constraints so separate agents do not create unrelated visual dialects.

## Security boundary

- API base: `https://api.kie.ai`
- Authentication: `Authorization: Bearer <KIE_API_KEY>`
- Secret name: `KIE_API_KEY`
- Never put the key in React/client code, a committed file, an issue, PR text, screenshot, log, or generated manifest.
- The repository already ignores `.env` and `.env.*`.
- Prefer separate development and production/provider-operation keys, with Kie usage caps and IP restrictions where practical.
- The CLI never prints the key.

This integration is intentionally a local/server-side CLI. The public website must not call Kie directly from the browser.

## Approved default models

| Asset type | Default | Alternate | Use |
|---|---|---|---|
| Image | `gpt-image-2-text-to-image` | `nano-banana-2` | Editorial hero plates, concept illustrations, controlled compositions |
| Video | `bytedance/seedance-2-5` | — | Short cinematic loops or image/video-reference motion assets |

Model additions require a deliberate update to `scripts/kie-assets.mjs`; arbitrary model IDs are rejected so the asset workflow stays reproducible.

## Kie endpoints used

- Credit check: `GET /api/v1/chat/credit`
- Market task creation: `POST /api/v1/jobs/createTask`
- Unified task status/result: `GET /api/v1/jobs/recordInfo?taskId=...`

The Market APIs return a task ID. Production-style integrations should prefer callbacks; the CLI supports an optional callback but can also poll with exponential backoff for interactive asset work.

## CLI

From the repository root:

```bash
export KIE_API_KEY='...'
node scripts/kie-assets.mjs credit
```

Generate a DE-branded image candidate and wait for the result:

```bash
node scripts/kie-assets.mjs create image \
  --prompt "A fragmented business technology environment resolving into one coherent managed architecture" \
  --aspect 16:9 \
  --wait
```

Use Nano Banana 2 with reference images:

```bash
node scripts/kie-assets.mjs create image \
  --model nano-banana-2 \
  --prompt "Preserve the reference composition while converting it into the DE editorial visual system" \
  --image "https://example.com/reference-01.png" \
  --aspect 16:9 \
  --resolution 2K \
  --format png \
  --wait
```

Generate a Seedance 2.5 motion candidate:

```bash
node scripts/kie-assets.mjs create video \
  --prompt "A technical environment map assembles from scattered graphite nodes into a precise coherent operating system; restrained camera motion" \
  --aspect 16:9 \
  --duration 10 \
  --resolution 720p \
  --wait
```

Inspect a task later:

```bash
node scripts/kie-assets.mjs status <taskId>
```

Validate the exact payload without making a paid/network request:

```bash
node scripts/kie-assets.mjs create image \
  --prompt "Concept description" \
  --aspect 16:9 \
  --dry-run
```

## Output and provenance

When `--wait` succeeds, results are downloaded immediately under:

`artifacts/kie-ai/<timestamp>-<prompt-slug>/`

Each generation receives a `manifest.json` containing:

- provider (`kie.ai`)
- Kie task ID
- model
- final prompt and model input
- generation timestamp
- credits consumed when reported
- returned source URLs
- downloaded filenames
- DE classification: `ILLUSTRATIVE`
- approval state: `candidate`

Generated URLs are temporary upstream artifacts. Keep the downloaded file and manifest together during review.

## Approval gate

A Kie result is **never automatically an approved website asset**. It remains a candidate until reviewed against `design/IMAGERY.md`, Visual System v2, and the actual rendered component.

Reject/regenerate when any of the following are true:

- it reads as generic AI art;
- it uses cyberpunk/neon-grid/hacker/shield clichés;
- it invents clients, metrics, incidents, telemetry, partnerships, certifications, product behavior, or other factual evidence;
- it competes with page typography or fails responsive crops;
- it does not belong to the same visual family as neighboring approved assets;
- it includes vendor logos or copyrighted/trademarked material that was not deliberately supplied and cleared;
- it is visually weaker than type + diagram + real artifact alternatives.

Preferred evidence order remains: real artifact -> real data -> real person -> diagram -> sanitized UI -> illustrative scenario -> editorial photography -> environment plate -> icon.

## Publishing

Do not wire `artifacts/kie-ai/` directly into production pages.

After approval:

1. choose the final candidate;
2. optimize/crop it for the actual component and responsive breakpoints;
3. move only approved public derivatives to the appropriate `client/public/images/...` path;
4. add/update provenance and the public asset registry when applicable;
5. render the real page at 390 / 768 / 1440;
6. critique and refine before PR sign-off.

## Scrollcraft / site-v2 usage

The isolated Scrollcraft site-v2 lane may consume Kie-generated candidates after its own brief/preflight rules are satisfied. This document does not transfer ownership of issue #165 or PR #166, and the Kie connector does not modify the Scrollcraft build directory. Claude Code remains the default lead website integrator unless Joe explicitly reassigns that role.

## Current implementation boundary

The connector is deliberately narrow:

- text-to-image via GPT Image 2;
- text/reference-to-image via Nano Banana 2;
- text/reference-to-video via Seedance 2.5;
- credit check, task status, polling, download, manifest.

Local-file upload, browser UI, automatic publishing, and automatic production placement are intentionally excluded. Those would expand the trust/security surface and should be designed separately if needed.
