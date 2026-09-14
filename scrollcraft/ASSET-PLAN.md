# DE asset plan — scene by scene

Status: DRAFT for Joe's approval · 2026-09-02 · owner: Claude Code (lead
website implementation agent) · gate: **no kie.ai credit is spent until the
row for that asset is approved here.**

This plan answers the 2026-09-02 review of PR #178: the six Graphite
Illumination plates are variations of one flowing-line texture and do not
depict DE's services, outcomes, Arizona identity, clients, or operating
model; the diagrams explain architecture but are not persuasive hero
visuals; and no asset should be generated until it has a defined page,
buyer purpose, composition, crop, and conversion role. It also carries Joe's
asset rule: existing site imagery is reference only unless independently
judged exceptional; new purpose-built, DE-owned, royalty-free assets are the
default, designed after their scene is known.

## 0 · Three kinds of material, three jobs

| Material | Job | Where it leads | Where it never leads |
| --- | --- | --- | --- |
| **Evidence** (real captures of DE's product, people, place; Class A/B) | Prove | "How DE delivers", team, local, assessment deliverables | Never presented as a client's environment |
| **Asset families** (purpose-built photography and generated plates, composited; Class B/D) | Persuade, set atmosphere, carry the belief shift | Hero frames, the peak scene, chapter openers, industry moments | Never a diagram's job; never fake dashboards or fake people |
| **DE diagram system** (Class C, `client/src/diagrams`) | Explain one mechanism per frame | Beside copy on service pages, inside the assessment, in proposals and sales conversations | Never the hero image; never more than one idea per mobile viewport |

The review's density finding is answered by the split, not by making the
diagrams prettier: a diagram appears next to a persuasive frame, after the
frame has done the emotional work, and shows exactly one idea. On a phone it
takes its narrow layout with the stepped-up type (14 px labels) and one
stage per viewport.

## 1 · Verdict on the six existing plates

| Plate | Verdict | Allowed use |
| --- | --- | --- |
| `peakground.webp` | **Keep** as atmospheric support | Under the peak scene at ≤ 40% opacity, behind the diagram, never alone |
| `ink.webp` | **Keep** as atmospheric support | Warm-paper dossier bands (assessment, proposal) as texture at ≤ 25% |
| `interference.webp` | Retire from any hero or chapter role | Texture only, ≤ 12% opacity, or unused |
| `railflow.webp` | Retire | Same |
| `strata.webp` | Retire | Same |
| `assembly.webp` | Retire | Same |

The generator (`scrollcraft/builds/de-v2/lab/plates/`) stays in the repo
for provenance and can produce a texture on demand. It is not an asset
system and will not be extended.

## 2 · Art direction that every asset must pass

One DE visual world, as if commissioned for one campaign: **premium
editorial · physical technology · Arizona atmosphere · technically credible
infrastructure · an intelligent, independent character.** Locked
foundation: graphite `#050312`, warm paper, magenta `#D3126A` used once per
frame at most, restrained violet illumination, no glow.

Forbidden in any prompt or frame: hooded hackers, floating padlocks and
shields, holograms, meaningless data streams, fake dashboards and SOC video
walls, blue stock-photo offices, generic robots, AI-generated humans passing
as staff or clients, neon cyberpunk, decorative server racks, logos or
protected characters, the style of any named living artist, another
company's campaign imagery.

Required in every generated frame: physical materials with real texture
(brushed aluminium, matte plastic, paper, glass, desert light), one warm key
light from the right (the Arizona evening), a graphite or warm-paper field,
and a composition that leaves room for type where the layout needs it.

## 3 · Asset families for the homepage (first production batch)

Each family is designed as a set: establishing → intermediate → resolved
frame, foreground/background layers where the scene composites, a mobile
alternate composition, a poster fallback, and a 5–8 s motion plate only
where it materially improves the scene.

### F-01 · The Arizona evening office (hero)

- **Page · scene:** Homepage hero, behind the locked H1 "Cybersecurity-First IT That Powers Your Business".
- **Buyer purpose:** "These are real people, near me, calm and in control." Local and credible before any claim is made.
- **Primary material:** Photography (Class B), DE's Chandler office at dusk with one working screen showing DE Desk. Until the shoot, the existing real Arizona dusk plate stays; no generated substitute.
- **Composition:** Wide, horizon low, warm dusk on the right third, a dark field on the left two thirds for the H1 and CTAs.
- **Crops:** 1440 → 21:9 · 768 → 3:2 · 390 → 4:5 vertical alternate (the screen and the window, not the room).
- **Motion:** parallax ≤ 6 px; static under reduced motion.
- **Conversion role:** the hero CTA (`button-hero-schedule`) sits over the dark field; nothing in the frame competes with it.
- **Classification:** real photograph. **Route:** photographer, half-day shoot. **KIE spend:** none.

### F-02 · The environment, fragmented → designed → operated (the peak)

- **Page · scene:** Homepage peak ("The Environment Wakes Up", rebuilt), later reused by the Cyber Risk Assessment flagship and the "Why DE" story.
- **Buyer purpose:** the belief shift from "IT providers are interchangeable ticket-takers" to "my environment could be secured and run as one designed system, and DE does that."
- **Primary material:** generated plate family (Class D), composited with the diagram system.
- **Composition:** a small professional-services office's technology as separate physical objects on a desk plane, seen from a 30° tilt: laptop, phone, small router, NAS, printer, badge card, a paper binder. Establishing frame: objects apart, gaps and hard shadows, no connections. Intermediate: same scene, same camera, hairline connections drawn in code (not in the image). Resolved: same scene inside one soft-lit boundary, one console glow, the badge card lit.
- **Crops:** 1440 → 16:9 · 768 → 4:3 · 390 → 4:5 mobile alternate with the objects rearranged into a vertical stack (a second generation, same seed family).
- **Motion:** one 6 s motion plate of the resolved lighting coming up (scrub-driven under scroll, poster fallback = resolved frame, static under reduced motion).
- **Conversion role:** "Start with a Cyber Risk Assessment" appears at the resolved frame, first viewport after the peak.
- **Classification:** Illustration, labelled in the caption. **Route:** kie.ai image model for four stills (three frames + mobile alternate), one video model plate. **KIE spend:** 4 stills + 1 clip, only after this row is approved.

### F-03 · Physical evidence of the six controls

- **Page · scene:** "What we protect" (beside the Layered protection diagram) and the How We Protect flagship, one macro frame per domain.
- **Buyer purpose:** the six domains become tangible objects a business owner recognises, instead of abstract labels.
- **Primary material:** six generated macro stills (Class D), one material family.
- **Composition:** identity → a hardware security key beside a badge on a desk · endpoint → a laptop lid half-closed with an asset tag · email → a phone face-up with a flagged message thread, text unreadable · network → a small labelled switch with tidy cabling in an office closet · backup → a NAS with one drive tray pulled · compliance → a binder with printed tabs on warm paper. Shallow depth of field, warm key from the right, graphite field.
- **Crops:** 1440 → 3:2 · 768 → 3:2 · 390 → 1:1.
- **Motion:** none; the diagram beside them carries the state.
- **Conversion role:** each frame is the visual for a deck domain; the deck's "How we operate it" CTA is unchanged.
- **Classification:** Illustration. **Route:** kie.ai image model, six stills. **KIE spend:** 6 stills.

### F-04 · The cadence, one office over one day

- **Page · scene:** "How protection works" band on the homepage and the ProActive Ecosystem flagship (Observe → Decide → Protect → Improve).
- **Buyer purpose:** "operated, not watched": the same environment at four moments of a day, quietly maintained.
- **Primary material:** photography first (Class B, DE's own office and an engineer at work; never a client site without permission); generated only for the two moments that cannot be photographed (a 6 am patch window, an 8 pm restore drill).
- **Composition:** one fixed camera, four times of day: 06:00 patch window (screens updating, empty chairs), 10:00 badge tap and normal work, 15:00 an engineer handling an alert at DE, 20:00 the NAS drill lights. Warm light moves across the frame.
- **Crops:** 1440 → 16:9 · 390 → 4:5 (the desk, not the room).
- **Motion:** optional 8 s time-lapse plate for the flagship only.
- **Conversion role:** "See the ProActive Ecosystem" link at the fourth frame.
- **Classification:** real photograph where shot; Illustration where generated, labelled. **Route:** shoot + up to 2 generated stills + 1 clip. **KIE spend:** 2 stills + 1 clip, flagship only.

### F-05 · Chandler, Arizona

- **Page · scene:** local block on the homepage, location pages, the "Why DE" story close.
- **Buyer purpose:** DE is here, in the East Valley, and the place is part of the identity.
- **Primary material:** photography (Class B): the office exterior at evening (one exists), the street, the desert horizon from Chandler at dusk. No generated landmarks.
- **Crops:** 1440 → 21:9 · 390 → 4:5.
- **Motion:** none. **Conversion role:** address, phone, "Book a time" beside it.
- **Classification:** real photograph. **Route:** the same half-day shoot. **KIE spend:** none.

### F-06 · Evidence captures (Class A)

Sanitized captures with provenance, each labelled "Real, details removed":
DE Desk (exists), the client portal, the solution builder, the structure of
an assessment deliverable, a roadmap view, a QBR page. No client names,
figures, or telemetry. **KIE spend:** none.

## 4 · Asset families for the service flagships (second batch)

| ID | Flagship | Scene | Material | Route | KIE spend |
| --- | --- | --- | --- | --- | --- |
| F-02 (reuse) | Cyber Risk Assessment | The unknown environment inspected, annotated, prioritised | F-02 establishing frame + assessment diagram + the sanitized assessment desk capture | none new | 0 |
| F-03 (reuse) | How We Protect | An attack path failing layer by layer | F-03 macro set + protection diagram driving the failing path in code | none new | 0 |
| F-04 (reuse) | ProActive Ecosystem | The living cadence | F-04 day family + coverage rings | shoot + 2 stills + 1 clip | as above |
| F-07 | Automation + AI (last) | Handoffs collapse into one path with a lit human approval gate | Three generated frames: paper forms and sticky notes on a desk → one printed runbook → a signature line under a desk lamp. No robots, no AI imagery. | kie.ai image model | 3 stills, built only after the four service flagships |
| F-08 | Industries (Level B) | Arizona sector environments: a medical front desk, a law office, an accounting firm, a job site trailer | Generated environments without people, or the shoot with DE staff in DE's own office | kie.ai image model | 4 stills, after the flagships |

## 5 · Production order

1. Approve the rows above (Joe). Any row not approved is not produced.
2. Book the half-day shoot (F-01, F-04, F-05, founder in context, hands-on
   engineering, equipment, a meeting). This removes most generation.
3. First kie.ai batch, homepage only: F-02 (4 stills + 1 clip) and F-03 (6
   stills). Board test: the eleven frames as one campaign board before any
   page is coded.
4. Second batch after the homepage ships: F-04 gaps, then F-07 and F-08.

Spend shape: the first batch is eleven stills and one clip. Per the
Scrollcraft skill a still costs cents and a clip costs more; the exact
balance is read with `kie.mjs probe` before the batch and reported.

## 6 · Provenance record, kept for every generated asset

Stored beside the asset in `scrollcraft/assets/<family>/manifest.json`:
family and frame id · page and scene it serves · provider and model · prompt
specification and negative constraints · seed or task id · generation date ·
source output file and hash · derivative files (sizes, formats) · license
basis (DE-generated under the provider's commercial terms; Joe confirms the
provider terms once) · usage map (every route that mounts it) · reviewer and
approval date. Real photographs record photographer, date, location,
subjects' consent, and usage rights.

## 7 · Reference bar (open)

Joe supplied a video reference for the level of design expected
(YouTube `QUI6Ug4cHnE`). The build environment's network policy blocks
YouTube and every transcript proxy, so the examples have not been seen.
This section is to be filled with the concrete rules taken from it (type,
motion, framing, pacing) once the transcript or the examples are supplied,
before the first batch is generated.

## 8 · What this plan does not do

It does not spend credits, does not add assets to any page, and does not
change the freeze in `.ai/ACTIVE_WORK.yaml`. Every asset produced from it is
classified per `design/VISUAL_EVIDENCE.md` and disclosed in plain language on
the page.
