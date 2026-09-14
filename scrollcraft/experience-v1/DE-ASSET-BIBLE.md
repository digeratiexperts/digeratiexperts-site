# DE-ASSET-BIBLE — every asset has a scene and a job (Phase 4)

Version 1, 2026-09-03. Governed by `docs/kie/KIE-RULES.md` and Joe's asset
rules: no asset without a storyboard role; no paid generation until the asset
appears here with a role; approval and a cap in the same message for every
paid generation; candidate status until Joe has seen it; never auto-published.

**Spend in Phases 0–5: zero.** Every asset the flagship prototype needs is
built in code from this bible. The kie.ai entries at the end are candidates
with roles, not requests.

## Conventions

- IDs: `DE-HOME-<series><nn>`. Series: **W** the world (code), **S** stills
  rendered from the world, **P** product proof (sanitized captures), **H**
  human presence (real photography), **K** kie.ai candidates.
- Every record carries: scene, purpose, type, camera, lighting, brand
  integration, motion role, generation method, reuse.
- Brand integration applies to all: graphite ground; magenta `#D3126A` only
  where DE acts; violet as lighting only; warm dawn / cool exposure / narrow
  amber disruption / clean white resolution; type in negative space; no logos
  in the scene.

## W — the world (code, Acts 1–5)

| ID | Scene | Purpose | Type | Camera | Lighting | Motion role | Method | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DE-HOME-W01 The floor | Act 1 → 5 | The place the visitor enters: open floor, two rows of three desks, meeting table, door, window wall, closet, ceiling access point | 3D environment | Eye height at the door (Act 1) rising to elevated three-quarter (Act 2), dolly to desk three (Act 3), pull-back (Act 5); 35–50 mm feel | Warm directional from the window side, low; violet ambient at 15%; screens emissive | The one persistent stage; its materials go to glass in Act 2, tilt in Act 3, level in Act 4, shrink to one object in Act 5 | three.js geometry + materials (no textures) | Acts 6–10 miniatures and stills; assessment page; sales decks (rendered stills) |
| DE-HOME-W02 People as presence | Act 1 → 5 | Human presence without portraits: four soft luminous figures (two seated, one at the table, one walking in) | 3D objects | as W01 | Fresnel-lit, slightly warmer than the room | Walk-in in Act 1; identity rings bloom above them in Act 2; person three is the one affected in Act 3 | three.js capsule meshes with a fresnel material | Any scene needing presence; never faces |
| DE-HOME-W03 Screens and phones | Act 1 → 4 | The brightest objects in the room; the endpoint state carrier | 3D objects | as W01 | Emissive cool white; amber in Act 3 on one; white again in Act 4 | Flicker on in Act 1; the amber endpoint in Act 3; reset in Act 4 | three.js emissive planes and slabs | Endpoint scenes on service pages |
| DE-HOME-W04 The closet and access point | Act 1 → 4 | The site infrastructure: network switch glow, ceiling ring | 3D objects | as W01 | Small emissives | The access point breathes in Act 1 (idle micro-motion), stops in Act 3, resumes in Act 4; the switch is the lateral-movement target | three.js | Network scenes |
| DE-HOME-W05 Window light | Act 1 → 5 | Dawn: the light that says "a real morning", and the state carrier for the whole arc | Light rig + emissive plane | as W01 | Warm (≈3000 K feel) low angle → cool graphite (Act 2) → cooler with the tilt (Act 3) → warm and level (Act 4) → soft (Act 5) | Colour temperature and intensity keyed to the timeline | three.js lights + gradient plane | Every act |
| DE-HOME-W06 Glass materials | Act 2 → 5 | The reveal: floor and walls become dark glass so the layers above and below read | Material state | — | Transmission-like look via opacity and fresnel | Opacity lerp during Act 2's first quarter | three.js materials | Any "make the invisible visible" moment |
| DE-HOME-W07 Threads | Act 2 → 5 | Identity, data and network paths: person → ring → device → slab; device → switch → edge → outside; slab → vault | Path geometry | — | Hair-thin luminous, cool white; amber when stressed; magenta when DE acts | Draw with a travelling head in Act 2; the attack path in Act 3; severed and healed in Act 4; gathered in Act 5 | three.js tube geometry with a draw range | Every connection scene |
| DE-HOME-W08 Identity rings | Act 2 → 4 | Identity as the spine: a ring above each person | 3D object | — | Fresnel white; magenta flash on reset | Bloom in Act 2; reset in Act 4 | three.js torus | Identity solution page |
| DE-HOME-W09 Cloud slabs | Act 2 → 5 | Mail and collaboration, files and apps, the line-of-business system, as glass slabs above the floor; unlabelled, no vendor marks | 3D objects | — | Glass, faintly lit from below by the screens | Descend into place in Act 2; the mail slab pulses amber in Act 3; clears in Act 4 | three.js | Cloud and email scenes |
| DE-HOME-W10 The vault | Act 2 → 5 | Backup and recovery as a translucent block below the floor: continuity is under everything | 3D object | — | Cool, low | Appears last in Act 2; unaffected in Act 3 (the point); part of the one object in Act 5 | three.js | Continuity and recovery pages |
| DE-HOME-W11 Labels | Act 2, Act 5 | Six one-word labels at thread ends (four on mobile); domain lights around the shell in Act 5 | DOM type projected from 3D anchors | — | — | Fade at the moment a thread completes | DOM + projection | Never texture; always type |
| DE-HOME-W12 Misalignment and exceptions | Act 1 → 3 | The disconnected state: every desk, slab and the access point slightly off the grid; threads that stop short; partial boundaries; four hollow amber markers (backup untested, unpatched, shared mailbox, guest network open); the world 1.2° off true from the first frame | Object offsets + path gaps + material state + camera roll | — | Narrow amber `#F2A13A` on the markers only; no alarm red | Static in Act 1, revealed in Act 2, dissolved by the correction in Act 3 | three.js (seeded, deterministic) | The "drifting" state, reusable on the assessment page |
| DE-HOME-W13 The correction and DE light | Act 3 | The signature move from #186 applied to the world: the roll to level, objects easing onto the grid, gaps closing, boundaries completing, exceptions receding; DE entering as magenta light running the identity chains, then a magenta hairline completing around the perimeter | Objects + light | — | Magenta only here | The whole of Act 3 | three.js | The DE signature move; reusable wherever DE acts |
| DE-HOME-W14 Structures and the continuous layer | Act 4 → 9 | The managed-system states (Act 4), the seven block structures gathering from the environment's own parts and Risk & Exposure rising through the floor as the continuous layer (Act 5), capabilities carried on the same threads (Act 6), routes (Act 7), contraction to the assessment door and the three-way fork (Acts 8–9) | 3D objects + DOM labels | Held, then pull-back | Clean level light; the layer as soft fresnel through the glass floor | State changes only | three.js + DOM | Acts 4–9, ProActive and solution pages |
| DE-HOME-W15 The event (optional, Act 5) | Act 5, as Detection & Response converges | One signal on one endpoint caught and contained, so the block is seen working before it is named; from the Sept 2 plan, kept brief, Joe's call | Path + material state | — | Amber signal, magenta containment | A few seconds inside Act 5 | three.js | Security explainers |

## S — stills rendered from the world (code → WebP)

| ID | Scene | Purpose | Type | Method | Reuse |
| --- | --- | --- | --- | --- | --- |
| DE-HOME-S01…S05 | Flagship beats (the door, disconnected · what's underneath · drifting, 348° · corrected, DE entering · DE sees the whole environment) | Poster before the library loads; no-WebGL fallback; reduced-motion frames; mobile low-power path | Still, ≤ 60 KB WebP each at two sizes | Rendered by the build's own script from the world at fixed timeline values (reproducible) | Social/OG (with Joe's approval), decks, the review gallery |
| DE-HOME-S07…S13 | Act 4 states | The managed-system states as light | Still | same | Methodology pages |
| DE-HOME-S14…S16 | Act 9 arrangements | The three responsibility boundaries | Still | same | Pathway pages |

## P — product proof (sanitized captures, Act 9–10; Phase 8)

| ID | Scene | Purpose | Type | Framing | Method | Rules |
| --- | --- | --- | --- | --- | --- | --- |
| DE-HOME-P01 DE Desk | Act 9 | Support as machinery: the real interface, inside the control surface | Sanitized capture | Cropped to one workflow, never a full-window screenshot; labelled "Real, details removed" in the footnote | Capture from the running product, provenance recorded | No client data; DE's own product only |
| DE-HOME-P02 Assessment output structure | Act 9–10 | What the business receives | Sanitized capture or rebuilt structure | The structure of a deliverable, not a result | Capture or rebuilt from the template | Labelled example, never a client report |
| DE-HOME-P03 Roadmap artifact | Act 9 | The plan as an object | Sanitized capture | One view | Capture | Same |
| DE-HOME-P04 Client marketplace glimpse | Act 9 / doors | Existing clients have a shaped, curated route | Sanitized capture | Small, secondary | Capture | Authenticated experience stays separate |

## H — human presence (real photography; never generated)

| ID | Scene | Purpose | Type | Camera | Lighting | Method |
| --- | --- | --- | --- | --- | --- | --- |
| DE-HOME-H01 The principal | Act 9 / About | Principal-led is the differentiator; art-directed presence, not a founder profile | Photograph | Environmental, three-quarter, in the working environment, looking at the work not the lens | Available light plus one soft source; graphite-friendly | A real half-day shoot (Experience Plan §05); the asset plan's F-04/F-05 rows |
| DE-HOME-H02 The team at work | Act 9 | Competence as evidence | Photograph | Mid-distance, hands and screens | as H01 | Same shoot |

## K — kie.ai candidates (roles defined; **none requested, none approved, zero spend**)

Each would need Joe's approval and a cap in the same message, and Excalidraw
is explainers only. Listed so that if a scene ever needs generated material,
the role already exists; the prototype needs none of them.

| ID | Scene | Role it would fill | Why code might not be enough | Type | Model / method | Decision now |
| --- | --- | --- | --- | --- | --- | --- |
| DE-HOME-K01 Dawn beyond the window | Act 1 | A soft, out-of-focus East Valley dawn behind the window wall: depth cue, no subject | A gradient plane may read flat at large sizes | Still, 16:9, heavily defocused, no landmarks | Nano Banana 2 or GPT Image 2 with the Dense Narrative prompt method; reference-chained | Not needed: the prototype uses a gradient with slow drift; revisit only if Quality Gate A names flatness here |
| DE-HOME-K02 Material study: matte graphite with brushed edge | Acts 1–5 | A tileable surface texture for desks and closet, under 200 KB | Procedural noise may read as plastic | Texture, tileable, 1K | Nano Banana 2 | Not needed: untextured PBR with roughness variation first |
| DE-HOME-K03 OG / social still of the one-system object | Off page | Sharing image | Rendered from the scene instead | Still | none (rendered from W14) | Rendered, not generated |

## Rules restated

- Do not spend on generic office photos, cyber backgrounds, circuit boards,
  hooded hackers, padlocks, server rooms, or any asset without an ID here.
- Generated humans are never DE staff; presence in the story layer is W02.
- Every generated file, if one is ever approved, lands as a candidate with a
  manifest (`kie.mjs`), is reviewed by Joe, and only then is optimized into
  the build.

## STOP GATE 4

No paid generation is proposed. The flagship prototype's asset list is
W01–W13 and S01–S05, all built or rendered in code. The canonical storyboard
needs fewer generated assets than the current build: none. Gate 4 is passed
for Phase 5.
