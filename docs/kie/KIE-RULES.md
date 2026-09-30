# kie.ai rules for this repository

Source: Joe, 2026-09-02 (two messages, quoted in substance). These bind every
agent and every session. `.claude/skills/scrollcraft/scripts/kie.mjs`
enforces the parts a script can enforce; the rest is conduct.

## The rules

1. **No generation without Joe's explicit approval in that same message.**
   Network access working, a key being present, or a plan being written is
   not approval.
2. **Pay-per-use, capped.** Every paid call obeys the spend cap Joe gives in
   the approving message. With no cap given, the default maximum is **$0.50
   per call**. At kie.ai's listed $0.005 per credit that is 100 credits.
3. **Never buy or top up credits, never change billing or payment settings.**
4. **Never retry a failed generation automatically.** A retry needs approval.
5. **If a generation would exceed the available budget or cap, stop.**
6. **kie.ai is for asset creation only**: hero and section imagery,
   backgrounds, textures, illustrations, diagrams, icons, decorative motion,
   optional social/OG graphics.
7. **kie.ai does not design the website.** No layout, UX, routing, forms,
   authentication, checkout, page structure, copy, or application logic.
8. **Scrollcraft/Claude designs the experience; kie.ai supplies purpose-built
   assets when the design actually calls for them.**
9. **Use existing good assets before generating replacements.**
10. **Zero new spend until the six existing generated plates were audited**
    KEEP / MODIFY / REPLACE (done: `scrollcraft/ASSET-PLAN.md` §1) **and the
    existing kie.ai/Scrollcraft work is reviewed.**
11. **Prefer controlled storyboard and reference-image workflows** so assets
    can be reproduced and stay visually consistent (`--ref` in `kie.mjs`).
12. **Every generated asset carries provenance**: `manifest.json` beside it
    (model, prompt, refs, task id, result URLs, hash, credits, cap, approval,
    classification, usage). No mystery files.
13. **Generated work starts as a candidate / illustrative asset**, never as
    approved production material.
14. **Never publish a generated asset to the live site automatically.** Review
    first; a page mounts an asset only after Joe has seen it.
15. **The asset must represent DE's identity, offering, message, and the
    specific scene or section.** No generic AI eye candy; no assets made from
    whatever happens to be on the server.

## Addendum, 2026-09-02 (same day, later message)

- **Worker:** the cloud environment.
- **Image-generation models only.** No kie.ai video, audio, LLM, or other
  paid model calls. `kie.mjs shot` is gated behind `KIE_ALLOW_VIDEO=1`, which
  only Joe's written instruction may set.
- **Preferred image models, in order:** GPT Image 2 · Nano Banana 2 · Imagen 4
  Ultra / Imagen 4 Fast · Flux-2 Pro · Seedream 5 Pro.
- **Allowed without approval:** connectivity, authentication, model
  availability, and credit-endpoint checks that generate nothing.
- **Environment variable:** `KIE_AI_API_KEY` (canonical). `KIE_API_KEY` is
  accepted as an alias for the local Windows setup script.
- **Per paid generation:** approval in the same message, a cap from Joe, no
  automatic retry, never exceed the cap, never top up, never publish to
  production without review.
- **Process:** prepare the workflow, stop before the first paid generation,
  and show Joe exactly what is proposed (`scrollcraft/KIE-FIRST-GENERATION.md`).

## What the script refuses on its own

| Situation | `kie.mjs` behaviour |
| --- | --- |
| `still`/`shot` without `--approved` and `--cap` | refuses before any network call |
| model's listed price above `--cap` | refuses, nothing sent |
| balance below the listed price (or the cap when no price is listed) | refuses; never tops up |
| model marked `not-authorized` in the registry | refuses; pick another `--model` |
| `shot` without `KIE_ALLOW_VIDEO=1` | refuses |
| task fails | recorded in the manifest as `failed`, exit 1, no retry |
| spend above the cap after the fact | flagged `capExceeded: true` in the manifest and on stderr; report to Joe |
| `--dry-run` | prints the exact request and exits, no network |

## Record of spend

| Date (UTC) | Environment | Model | Task | Credits before → after | Outcome |
| --- | --- | --- | --- | --- | --- |
| 2026-09-02 04:59 | Digerati KIE Restricted | seedream/5-pro-text-to-image | none | 80 → 80 | Attempted **without Joe's approval** (a rule 1 breach by Claude, acknowledged); refused by kie.ai, API code 401 "not authorized to use this model"; nothing spent. |
