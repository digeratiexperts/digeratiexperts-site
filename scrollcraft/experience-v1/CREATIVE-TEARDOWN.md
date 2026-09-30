# CREATIVE-TEARDOWN — why the current work disappoints, and what survives (Phase 1)

Reviewed 2026-09-03: the production homepage (`main` @ `80ce2f4`), the sections
library at `/scrollcraft/sections/` (PR #178, live), Version B at `/v2`, the
ProActive amplification (`scrollcraft/builds/proactive-ecosystem-amplify`), the
Why DE passage (PR #186), the diagram system, the six generated plates, the
evidence primitives, the motion engine, the fonts and tokens. Joe's verdict on
the lot, 2026-09-02: "everything looks like shit… you start to feel like it's
too much generated crap instead of feel like it's a storyboard."

## What actually made the Scrollcraft direction visually disappointing

"Needs more polish" is not the finding. The finding is structural, in six parts.

1. **The unit of design was the section, so the page became a slideshow.**
   Every act was built as *plate + heading + copy + one figure*, and the
   engine's job was to slide the next plate in. The visitor never enters a
   place; they are shown a sequence of panels about a place. That is why the
   pages read as "PowerPoint with scroll triggers" no matter how the
   transitions are tuned.
2. **The environment was drawn as documentation.** "One environment", the
   layered-protection rings, the environment assembly, the eight-block rail:
   all of them are labelled rectangles joined by hairlines. That is the grammar
   of an architecture document, and it was used as the identity of the site.
   Rectangles with labels cannot make anyone feel that a business is alive.
3. **Nothing persists and transforms.** With two exceptions (the course line
   and bearing gauge, and the heading correction in the Why DE passage), no
   object introduced in one act is the same object changed in the next. Each
   act constructs its own figure, so scrolling accumulates nothing. Joe's rule
   names this exactly: prefer transformation over replacement.
4. **The evidence vocabulary leaked into the story.** Hairlines, 10 px
   technical labels, `ILLUSTRATIVE` badges, corner marks and status tokens are
   a good language for proof. Applied to every act they make the story look
   like an internal compliance review, and they cap the emotional range at
   "tidy".
5. **The generated plates were atmosphere, not story.** Six Graphite
   Illumination plates were made before any scene needed them, so they could
   only ever be backgrounds. Backgrounds read as wallpaper, and wallpaper made
   with a model reads as "generated crap".
6. **One palette move, applied uniformly.** Dark well, thin border, magenta
   active state, repeated on every section, at every scale, on mobile as a
   single stack. A palette is not a composition. Without depth, light,
   material contrast and negative space, the same three moves become "a
   competent 2023 SaaS site wearing cyber clothes".

Each of the six is a decision about *what a scene is*, not a finish problem.
That is why the next pass must change the unit of design (a scene the visitor
is inside of, with objects that persist and transform) rather than the polish.

## Decisions

Decision key: **KEEP** (use as is, in its proper layer) · **REWORK** (the idea
survives, the execution does not) · **ARCHIVE** (kept as a reference, never a
baseline) · **DELETE** (removed from the new direction entirely).

| Existing concept | Decision | Why | Possible reuse |
| --- | --- | --- | --- |
| **Thesis "your business is one system" and the "environment wakes up" idea** (Version B, Experience Plan) | KEEP | The one idea every review agreed with; the execution is what failed. | The spine of Acts 1–5. |
| **Chaptered-editorial grammar** (Version B `/v2`, ProActive amplification): plates, margin folio, live map | DELETE | Section cuts by construction; occupied twice; the folio and map are navigation dressed as story. | None. |
| **Six Graphite Illumination plates** (generated) | DELETE | Atmosphere without a scene; the "generated crap" signal. | None. The asset plan's audit stays as a record. |
| **Hero city-lights WebP** (real photograph at 30% under the hero) | ARCHIVE | A photograph used as a tint has no narrative role. | Photography returns only through the asset bible with a scene. |
| **Passage grammar of the Why DE build** (PR #186) | ARCHIVE | Type and motion on a graphite ground with no environment; its own brief admits acts 4–6 are three separate constructions. | Reference for pacing and restraint. |
| **The heading correction** (the world sits 1.2° off true and rolls level at the operating principle) | KEEP as a device | The single existing move that transforms the world instead of replacing it. | Candidate for the Act 3 → Act 4 turn: the environment tilts under disruption and DE levels it. |
| **Course line + bearing gauge** (persistent instrument) | REWORK | Right instinct (one persistent object that changes state), wrong object for a business environment. | Becomes the persistent "system state" readout in the evidence layer, not a nautical instrument. |
| **Published refusals** ("we may pause your work", "we may say no") as the close | KEEP the content | Genuinely different from every competitor; it is trust as fact. | The close of the homepage or the assessment page, in the evidence layer. |
| **Assess-first entry door above three pathways** (PR #186 Act 6) | KEEP the structure, REWORK the visual | Correct DE architecture (assessment above Handle Our IT / Solve a Business Need / Client Marketplace); rendered as buttons. | Act 6–10 routing; never a button row as the visual. |
| **Eight-block lateral rail** (PR #186 Act 5) | DELETE the rail; KEEP the correction | A sideways card carousel is still cards; the architecture correction (eight blocks, Risk & Exposure continuous) is right. | Act 5 must show the blocks as parts of the environment the visitor already entered, not a new rail. |
| **Sections library trust strip** (PR #178) | REWORK | Copy tone is the best on the site ("Evidence, not claims"); it is still a four-column strip. | Copy lines survive; the strip form does not. |
| **Layered-protection rings** (diagram system) | ARCHIVE → evidence only | Documentation grammar; "strong" as an explainer, wrong as a hero. | Evidence layer beside the story, QBRs, proposals (its real jobs). |
| **Protection command deck** (tabs + three columns of lists) | ARCHIVE → evidence only | Lists inside cards inside a frame; the densest "cards and labels" surface on the site. | At most a collapsed explainer under Act 5; likely a service page. |
| **Operating cadence** (lifecycle diagram + four steps) | REWORK | The sequence is DE's real methodology and reads well; the flowchart form must go. | Act 6, drawn in the same visual universe as Acts 1–5 (the environment itself moves through the stages). |
| **ProActive ecosystem diagram** | REWORK | "Good idea, too technical": architecture documentation on a marketing page. | Act 7: depth of involvement per tier, shown as the operating layer thickening around the same environment. |
| **Coverage rings (pricing depth)** | REWORK | The idea that tiers are depth, not "more products", is right; rings are another diagram. | Act 7 input. |
| **Assessment "inspection" figure** | KEEP the idea | The strongest conversion section; it shows the machinery of the outcome. | Act 10, built as a real inspection of the environment the visitor has been inside. |
| **DE Desk proof section** | REWORK | Accurate, but a screenshot given hero-sized real estate. | Act 9: product screens appear selectively as proof inside the story, one component of a control surface. |
| **Human / Joe section** | REWORK | Principal-led is a differentiator; the treatment is a founder profile. | Act 9 or About: human presence as art direction, not a bio card. |
| **Evidence-classification badges in the composition** (`ILLUSTRATIVE`, `EXAMPLE, NOT A CLIENT REPORT`) | REWORK | Correct governance, wrong place; it shouts at buyers. | Machine-readable attribute stays; visible text moves to a quiet footnote or tooltip, kept only where legally or materially necessary. |
| **Evidence primitives** (`ProofChip`, `EvidenceFrame`, `DiagramPrimitives`, `StatusToken`) | KEEP selectively | Good for the evidence layer. | Evidence layer only; never inside a cinematic act. |
| **`HUDFrame` corner marks** | DELETE from the story layer | Reads as dashboard chrome. | Internal tools only. |
| **Diagram system as a whole** (five staged SVG diagrams, framework-free) | KEEP as evidence tooling | Well engineered, reusable for deliverables, sales decks and QBRs. | Evidence layer, deliverables. Never hero art. |
| **Hairline / grid vocabulary** | KEEP for evidence, DELETE as identity | Fine as the grammar of proof; as the whole site it is "boxes, borders, nodes, tiny labels, lines, lists". | Evidence layer. |
| **Typography** (Space Grotesk display, Inter body, Oxanium utility; served locally) | KEEP | Locked, good, not the problem. | Everywhere, with a new scale (Phase 6). |
| **Magenta interaction state on graphite** | KEEP | Right brand move. | Everywhere, but as light and material, not only as a border colour. |
| **Dark cards with thin borders as the primary surface** | DELETE as primary identity | Rule 4: cards are allowed; a site composed of cards is not. | Occasional evidence cards. |
| **Scrollcraft engine** (flow / pin / pan / scrub acts, cues, kinetic text, reveals) | KEEP as the engine | It is a means; it was mistaken for the design. | Drives scroll progress into the WebGL stage; typography cues on top. |
| **"Cue in, cue out" copy motion as the dominant motion** | DELETE | Motion for motion's sake; nothing is learned when a paragraph fades. | Copy still cues, but the environment is what moves. |
| **Fingerprint registry discipline** (no two builds share a grammar) | KEEP | Prevents exactly the repetition that happened. | New row for this build. |
| **Asset plan families F-01…F-06** | REWORK | Families were named by material, not by scene role. | Re-cut into the asset bible with an ID per scene. |
| **kie.ai spend gate and provenance tooling** | KEEP | Correct and independent of direction. | Phase 4 onward, only with a bible entry. |
| **Homepage version archive** (`/versions`, `/version-1..3`) | KEEP | A record, not a design. | Reference gallery for the before/after Joe asked for. |

## The two ideas worth carrying forward, stated plainly

- **One environment that the visitor is inside of**, built as a dimensional
  place with light, depth and material, whose objects persist through every
  act and change state: connect, expose, get hit, get contained, get pulled
  back into one system. This is the concept the old direction talked about and
  never built.
- **Proof as machinery, not as claims**: the assessment as an inspection of
  that same environment; product screens as components inside a control
  surface; refusals published in the same type as promises.

Everything else in the current work is reference material.

## STOP GATE 1

The disappointment is named in six structural causes (unit of design,
documentation grammar, no persistence, evidence vocabulary in the story,
assets before scenes, one palette move applied uniformly). None of them is
"needs more polish". Gate 1 is passed.
