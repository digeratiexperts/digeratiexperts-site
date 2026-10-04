# recraft-icons provenance

- Source: written in-house on 2026-10-04 for Digerati Experts, on Joe's request
  "build the Recraft icon skill" (step 2 of `docs/CONTENT-TOOLING-PLAN.md`).
  No third-party skill text is vendored.
- Installed for: Claude Code project skill discovery (`/recraft-icons`), the
  `.agents/skills/` mirror for Codex / Cursor / Gemini, and machine-wide use
  through `.claude/install-user-skills.sh`.
- Audited: 2026-10-04

## API reference used

Recraft's own documentation (`recraft.ai/docs`) and API host were not reachable
from the build environment. The request shape was taken from ComfyUI's
maintained Recraft integration (`comfy_api_nodes/apis/recraft.py` and
`nodes_recraft.py`, read 2026-10-04) and cross-checked with search results for
Recraft's API reference and Joe's pasted example (`client.images.generate(...,
model='recraftv4_1')` on the OpenAI-compatible endpoint):

- `POST https://external.api.recraft.ai/v1/images/generations`, bearer key,
  JSON `{prompt, model, n, size, negative_prompt?, controls{colors[{rgb}],
  background_color{rgb}, no_text}, style_id?, style_match?, response_format}`,
  response `{created, credits, data[{image_id, url}], style_id?}`.
- `POST /v1/styles` (multipart `style`, `model`, `file1..file5`) returns `{id}`.
- `GET /v1/users/me` for the key check.
- Vector models: `recraftv4_1_vector`, `recraftv4_1_utility_vector` (icons and
  logos), `recraftv4_1_pro_vector`, `recraftv4_styles_vector`.

The first live run is the confirmation. If Recraft rejects an optional field the
script retries once without it and records that in the manifest.

## External-service boundary

`scripts/recraft.mjs check | generate | create-style` call
`external.api.recraft.ai` with the bearer key and download the returned file
URLs. `generate` and `create-style` incur Recraft charges. `clean`,
`--dry-run` and the tests make no network call. Installing the skill adds no
credential; the key lives only in the environment or the gitignored `.env`.
