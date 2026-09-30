# First kie.ai generation: proposal, not approved

Status: **PROPOSED, NOT APPROVED, NOTHING SENT.** Owner: Claude Code. Date:
2026-09-02. Governed by `docs/kie/KIE-RULES.md`. Joe approves or changes this
in a message that names the still and gives the cap; only then is one
`createTask` call made.

## What would be generated

One still. Family **F-02 "The environment: fragmented → designed → operated"**,
frame **environment-01 (establishing)**, for the homepage peak scene and the
Version 4 story (`scrollcraft/ASSET-PLAN.md` §3, F-02). This is the frame the
whole homepage story turns on, and the one that tests the art direction
hardest: real objects, one warm light, a graphite field, room for type.

| Field | Value |
| --- | --- |
| Model | First model marked AVAILABLE in Joe's order (GPT Image 2 → Nano Banana 2 → Imagen 4 Ultra/Fast → Flux-2 Pro → Seedream 5 Pro). The read-only probe of 2026-09-02 fills this in (`docs/kie/AVAIL-*.md`). Seedream 5 Pro is already known NOT-AUTHORIZED for this key. |
| Listed price | GPT Image 2: 9 credits ($0.045). Nano Banana 2: about 8 credits ($0.04). Flux-2 Pro: 5 credits at 1K ($0.025). Imagen 4: not listed in what could be read. At $0.005 per credit. Listed prices are pre-checks; the manifest records the real debit. |
| Proposed cap | **10 credits ($0.05)** for GPT Image 2 or Nano Banana 2; 6 credits for Flux-2 Pro. Joe sets the actual cap. |
| Aspect | 16:9 at the model's 1K tier (the desktop peak frame). The 4:5 mobile alternate is a separate, later approval. |
| Prompt | `scrollcraft/assets/f02/environment-01.prompt.txt`, reproduced below, sent verbatim. |
| Output | `scrollcraft/assets/f02/environment-01.png` plus a provenance entry in `scrollcraft/assets/f02/manifest.json` (model, prompt, task id, result URL, sha256, credits before/after/spent, cap, approval text). |
| Classification | ILLUSTRATIVE, status `candidate`. Labelled "Illustration" wherever it might later appear. |
| Where it goes | Nowhere on the site. The file lands on the PR #183 branch for Joe to see, with a crop sheet at 1440 / 768 / 390. No page mounts it until Joe approves that separately. |
| Retry | None. If kie.ai fails the task, the manifest records it and the run stops. |

The exact request, produced by `kie.mjs still ... --dry-run` (no network), is:

```json
{
  "model": "gpt-image-2-text-to-image",
  "input": {
    "prompt": "<the prompt file, verbatim>",
    "aspect_ratio": "16:9"
  }
}
```

(If a different model is first available, the `input` follows that model's
documented fields; the dry run prints it before Joe approves.)

## The prompt (verbatim)

```
Premium editorial product photograph, physical technology, technically credible, quiet Arizona evening atmosphere. Real materials with real texture: brushed aluminium, matte plastic, paper, glass. One warm key light from the right, like a low desert sun through a window. Graphite field: a near-black desk surface and background, restrained violet ambient fill, no glow, no neon. No people, no readable text, no logos, no padlocks, no shields, no holograms, no data streams, no dashboards, no screens showing content, no cyberpunk styling.

A small professional-services office's technology laid out as separate physical objects on one wide dark desk plane, seen from a 30-degree tilt: a closed laptop, a phone face down, a small router, a two-bay NAS, a compact printer, an employee badge card, and a paper binder. The objects sit apart from each other with clear gaps and hard shadows, no cables joining them, nothing lit up. Wide composition with the objects grouped in the right two thirds and the left third open and dark for typography. Photoreal, natural lens rendering, 16:9.
```

Why this scene represents DE (rule 15): it is the buyer's own office as
physical objects, not a hacker or a padlock; the "fragmented" state is the
belief DE changes; the same scene, same camera, becomes "designed" (hairline
connections drawn in code, not in the image) and "operated" (one soft-lit
boundary, the badge lit) in frames 02 and 03, which would be image-to-image
from this frame so the set stays consistent (rule 11).

## The command that would run, once approved

```
node .claude/skills/scrollcraft/scripts/kie.mjs still \
  @scrollcraft/assets/f02/environment-01.prompt.txt \
  scrollcraft/assets/f02/environment-01.png \
  --model gpt-image-2-text-to-image --ar 16:9 \
  --family F-02 --frame environment-01 --page "homepage / peak: the environment, fragmented" \
  --approved "Joe, <date and words of the approving message>" --cap <credits Joe gives>
```

The script refuses without `--approved` and `--cap`, refuses if the listed
price is above the cap or the balance cannot cover it, makes one
`createTask`, records the task id before polling, never retries, reads the
balance after, and flags any spend above the cap.

## What is deliberately not in this proposal

- No video. The F-02 motion plate in the asset plan is dropped under the
  image-only rule; the "lighting comes up" moment will be built in code
  (opacity and mask on the resolved frame) instead.
- No F-03 macros, no mobile alternate, no second frame. Each is its own
  approval with its own cap.
- No page changes and no publishing.

## After Joe sees the result

1. Keep / reroll / change direction. A reroll is a new approval.
2. If kept: frames 02 and 03 by image-to-image from frame 01 (two approvals),
   then the 4:5 mobile alternate, then F-03's six macros.
3. Only then does the Version 4 homepage work resume against real material.
