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

## Addendum 2, 2026-09-02 (evening, after PR #186)

- **The money gate is closed.** No paid generation is approved. Before any
  request is put to Joe again, the asset must be reconciled with the active
  flagship direction (PR #186, the Why DE passage) and the request must say
  specifically what the generated asset adds that code, typography, diagrams
  or the existing Scrollcraft mechanics cannot do better. The first such test
  withdrew the F-02 request (`scrollcraft/KIE-FIRST-GENERATION.md`).
- **Excalidraw visuals** are approved conceptually for explainers,
  documentation, proposals, blog, social and OG material, and are **not** the
  visual language of the flagship homepage.
- **Version 4 does not start**; no second homepage grammar opens while the
  flagship is under review. PR #184 stays a draft scoped to tooling and asset
  planning, and is not merged because CI is green; its scope is reconciled
  with PR #185 (the DE 2026 service-model source of truth plus the kie.ai
  tooling fixes) and PR #186 first.
- **The `HTTPS_PROXY` limitation** of the Excalidraw script stays parked.
- **Kept regardless of the homepage outcome:** the Nano Banana 2 workflow,
  the spend gate, reference chaining, image validation and the free re-fetch.

## Where the rules apply: three code paths, one gate

The skill packs vendored by PR #180 brought two more kie.ai scripts into the
repository. All three spend the same credits and answer to the same rules:

| Path | What it is | Guard today |
| --- | --- | --- |
| `.claude/skills/scrollcraft/scripts/kie.mjs` (`still`, `nb2`, `fetch`) | The spend gate: approval and cap flags, price and balance checks, one call, no retry, image-only download, provenance manifest | full |
| `.claude/skills/nano-banana-images/scripts/generate_kie.py` | The Nano Banana 2 JSON method as supplied; `--dry-run`, manifest sidecar, credit probe, `get_kie_image.py` recovery | conduct only: run it only inside a message of Joe's that approves and caps the run; in this repository prefer `kie.mjs nb2`, which sends the identical request |
| `.claude/skills/excalidraw-visuals/scripts/generate-visual.cjs` | Hand-drawn PNGs on `google/nano-banana`, style reference mandatory | conduct only; its download uses Node `https` and ignores the cloud proxy (PR #185), so in a cloud session recover results with `kie.mjs fetch <taskId>` |

Two hosts return finished images and both must be on a cloud environment's
allowed domains: `tempfile.redpandaai.co` and `tempfile.aiquickdraw.com`.
Never write a dollar figure as `$0.xx` inside a `SKILL.md`: Claude Code
substitutes `$0` with the first skill argument (the PR #185 finding).

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
| 2026-09-02 (afternoon) | another Claude session (PR #185, `excalidraw-visuals`) | google/nano-banana | `07e28b2162e4652fbbb953db853c01f4`, `5bd8276aa69a79021e252889613dae2d` | 80 → 68 | Light/dark A-B of the revised style prefix, 12 credits: three generations of which one download was lost to a proxy refusal saved as a ".png" and regenerated. Evidence under `artifacts/kie-ai/excalidraw/`. Recorded here for completeness; that session's approval record is its own. |
