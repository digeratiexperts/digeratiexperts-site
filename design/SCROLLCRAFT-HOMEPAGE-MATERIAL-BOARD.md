# Digerati Experts — Homepage Scrollcraft Material Board

**Status:** PRE-PRODUCTION GATE — material/storyboard planning only  
**Owner:** ChatGPT / issue #174  
**Experience class:** Level A — Flagship Narrative  
**Production rule:** no homepage implementation begins from this board until the material set is visually approved.  
**Current live-site authority:** the existing SPA homepage remains the production homepage; Version B remains available as `/v2` reference after PR #177 reverted the attempted #173 homepage swap.

> **Test:** if every animation is removed, the still frames, diagrams, real evidence, typography, and photography must already look exceptional and explain the DE story. Motion is allowed to amplify meaning; it is not allowed to rescue weak material.

---

## 0. What this board decides

This board converts the approved `SCROLLCRAFT-EXPERIENCE-PLAN.md` into the concrete pre-production package for the homepage.

It decides, before code:

1. the homepage's final narrative device;
2. what is retained from the current SPA homepage and `/v2`;
3. what is redesigned rather than copied;
4. what existing assets are kept, recaptured, demoted, or rejected;
5. every new material required by scene;
6. whether each material is **REUSE / CAPTURE / CREATE / GENERATE / FIND-LICENSE**;
7. evidence classification and provenance requirements;
8. desktop / tablet / mobile composition intent;
9. reduced-motion/static keyframes;
10. the build order after the material gate is approved.

This is deliberately **not** a component specification and not permission to start a second homepage implementation in parallel with the lead integrator.

---

# 1. Homepage design thesis

## 1.1 What the visitor should understand

The finished homepage should make one idea unmistakable:

> **A business does not have an IT problem, a security problem, a cloud problem, and an automation problem separately. It has one operating environment. DE makes the layers work together.**

The current Version B proves the storytelling direction, especially fragmentation → coherence. The final homepage should retain that strategic argument while materially and compositionally surpassing the existing `/v2` execution.

## 1.2 Signature concept: THE OPERATING BLUEPRINT

The new signature device is **not another node map and not another persistent margin folio**.

The business environment is represented as a stack of precision-drafted, semi-transparent **operating layers** — closer to architectural vellum, registration film, and a technical service blueprint than a software dashboard:

- people / work;
- identity / access;
- devices;
- network / connectivity;
- cloud / data;
- security controls;
- business systems;
- automation / AI;
- continuity / recovery;
- DE operating cadence.

At first the layers are slightly misregistered: each layer is internally plausible, but the system does not line up. Dependencies cross the wrong boundaries. Ownership gaps appear in the margins. The visitor recognizes the real problem without seeing a pile of vendor logos.

At the peak, DE is introduced **as the operating layer / registration system**, not as a giant logo. The sheets align. Shared anchors register. Dependencies become explicit. Security boundaries close. Recovery paths become visible. The composition changes from a collection of competent parts into one legible operating blueprint.

Then the same aligned blueprint becomes interactive: selecting a business outcome reveals which layers and relationships matter to produce that outcome.

### Why this is stronger than simply reusing the `/v2` map

- keeps the proven fragmentation → coherence argument;
- changes the **visual grammar**, not just the skin;
- introduces tactile, physical-feeling material that matches DE's premium editorial direction;
- can exist as an excellent static composition before motion;
- can reuse DE's diagram primitives rather than inventing fake telemetry;
- translates to mobile as stacked registration layers rather than a tiny unreadable network graph;
- does not repeat the fixed-margin live-map signature already claimed by both existing Scrollcraft fingerprints.

## 1.3 Tell-someone sentence

> **“It’s the site where the layers of a company look almost right but don’t line up — then DE brings them into register and you can see the whole business operating as one system.”**

If the finished homepage cannot earn that sentence visually, the concept has failed.

---

# 2. Experience grammar

The homepage should no longer default to “chaptered editorial + fixed margin map.”

## Chosen grammar: **Sectional atlas / material registration**

The page behaves like a premium technical monograph in which the visitor moves through different **scales of the same operating system**, but no fixed miniature map accompanies every section.

Core grammar:

- global DE navigation remains normal site chrome;
- hero is a quiet threshold, not a scrolling demo immediately;
- the signature material appears progressively as independent plates/layers;
- only the alignment peak is allowed a substantial held/pinned span;
- post-peak sections return to normal document flow more often than not;
- evidence chapters use real artifacts and paper-like editorial staging;
- human/place chapter releases the technical tension;
- the close reuses the now-aligned blueprint as a quiet resolved background, not a second animation peak.

### Explicitly banned homepage defaults

- fixed right-side folio carrying a live map throughout;
- another scattered node lattice as the central visual language;
- endless rounded cards;
- full-page purple gradients;
- fake SOC dashboards;
- floating 3D lock/shield/laptop objects;
- a giant AI orb;
- full-site continuous 3D fly-through;
- a different motion trick in every viewport;
- vendor logo walls as proof;
- stock hacker imagery;
- decorative HUD chrome on ordinary prose.

---

# 3. Emotional / motion curve

| Scene | Feeling | Motion level | Why |
|---|---|---:|---|
| 1. Threshold | calm / intrigue | 1 | Visitor should read before being impressed |
| 2. Misregistration | recognition / unease | 2 | The business problem becomes visible |
| 3. Pressure | consequence | 2 | Facts/evidence sharpen the stakes without doom theatre |
| 4. Alignment | revelation / awe | **4 peak** | One major transformation earns the motion budget |
| 5. Outcomes | agency | 2 | Visitor controls the resolved system |
| 6. Who this is for | seen / relevance | 1 | Editorial dossier, not another spectacle |
| 7. Operated continuously | confidence | 2 | Cadence and ownership become legible |
| 8. Proof | belief | 1 | Real artifacts carry the chapter |
| 9. Human / Arizona | warmth | 1 | Technical tension releases |
| 10. Assessment / close | resolve / calm | 1 | One clear next action |

**Budget:** one major peak; no second peak. Supporting transitions must remain subordinate.

---

# 4. Existing material audit — `/v2`

The current `/v2` runtime has a small, understandable material set: DE mark/favicon, Arizona dusk, founder portrait, DE Desk support capture, six Graphite Illumination plates, plus coded diagrams and typography.

## 4.1 File-by-file decision

| Existing asset | Current role | Decision | Final-homepage role |
|---|---|---|---|
| `assets/de-logo.png` | brand | **KEEP** | canonical brand mark / masthead only |
| `assets/favicon.png` | brand utility | **KEEP** | utility only |
| `assets/arizona-dusk.webp` | Arizona / human chapter | **KEEP / RE-CROP** | late-page place plate; optional subtle closing bookend, not default hero |
| `assets/joe-petro.webp` | founder | **KEEP / RE-SOURCE FROM ORIGINAL** | human chapter; use best available original derivative, not the small copied `/v2` file |
| `assets/de-desk-support.webp` | proof | **KEEP CONCEPT / RECAPTURE** | DE product proof; current ~20KB derivative is too small to be the final flagship evidence image |
| `assets/gen/interference.webp` | fragmentation field | **ARCHIVE / REJECT AS PRIMARY** | lab/reference only; generic abstract field cannot carry the final problem scene |
| `assets/gen/peakground.webp` | peak atmosphere | **REDESIGN** | concept of controlled illumination survives; final peak requires material tied to the Operating Blueprint |
| `assets/gen/assembly.webp` | proof/assembly atmosphere | **REDESIGN** | replace abstract assembly texture with legible real or explanatory content |
| `assets/gen/railflow.webp` | pan rail atmosphere | **REJECT FOR HOMEPAGE** | tied to old rail grammar; may remain archived with `/v2` |
| `assets/gen/strata.webp` | cadence texture | **DEMOTE** | may contribute subtle texture study; cannot be the main cadence material |
| `assets/gen/ink.webp` | ruling / dossier texture | **KEEP AS MICRO-MATERIAL** | hairline / ink / registration texture only, never a large hero plate |

## 4.2 Existing `/v2` concept decisions

| Concept | Decision | Note |
|---|---|---|
| Story-first flow | **KEEP** | Core strength |
| Fragmentation → coherence | **KEEP** | Strategic argument remains excellent |
| “Environment wakes up” as the only major peak | **KEEP / EVOLVE** | Re-expressed as Operating Blueprint alignment |
| Outcome-controlled system | **KEEP / EVOLVE** | Use aligned operating layers instead of map nodes |
| Authored silence | **KEEP** | Essential restraint |
| Real proof before fabricated polish | **KEEP** | Hard rule |
| Paper + graphite chapter contrast | **KEEP** | Fits brand; use with more material sophistication |
| Fixed folio + live mini map | **RETIRE FOR FINAL HOMEPAGE** | Already fingerprinted twice; repetition lowers distinctiveness |
| Persistent node-map visual language | **RETIRE FOR FINAL HOMEPAGE** | Useful reference, wrong as universal answer |
| Graphite Illumination as primary imagery | **RETIRE** | Too abstract/generative to support every story beat |
| Quiet-tier pages | **KEEP AS REFERENCE** | Strong lesson: ordinary pages should remain ordinary |

---

# 5. Existing SPA homepage audit — what must survive the redesign

The existing homepage remains the live authority and contains functionality/content that should not disappear merely because the Scrollcraft narrative is stronger.

## Preserve as product/content requirements

- global `MegaMenu` and normal site navigation;
- site bottom bar / conversion access where still approved;
- canonical SEO / structured-data behavior;
- real Cyber Risk Assessment commercial path;
- accurate company contact information;
- honest threat facts with sources;
- ProActive positioning and package truth;
- industry fit;
- proof surfaces that do not invent testimonials;
- real founder / principal-led identity;
- FAQ/contact access without forcing visitors through cinematic scroll;
- accessibility and responsive behavior;
- Store / Journal / Portal color and interaction boundaries.

## Redesign rather than port component-for-component

- current “many separate homepage sections” should be edited into one coherent narrative rather than mechanically preserving every module in its current order;
- dashboard-like decorative hero graphics should not compete with the new signature material;
- repeated cards should collapse into stronger editorial spreads where possible;
- proof, trust, team, and industries should be condensed into fewer, more meaningful compositions;
- the current full-page-scroll behavior should not dictate the final Scrollcraft timeline; use it only where it helps the chosen grammar.

## Do not move into Scrollcraft theatrics

- FAQ;
- newsletter/form fields;
- contact form;
- transactional booking mechanics;
- legal/trust utility links.

Those remain clear normal UI surfaces even inside a flagship homepage.

---

# 6. Material family — “REGISTER / OPERATE”

The homepage needs a material system designed as a **set**, not one-off images.

## 6.1 Physical vocabulary

Use:

- warm uncoated paper / vellum;
- smoked translucent film;
- graphite anodized metal;
- precise ink lines;
- registration crosses / crop marks used sparingly and functionally;
- shallow depth / cast shadows from stacked layers;
- restrained violet transmitted light at moments of coherence;
- electric magenta only for brand/action/registration emphasis;
- tactile grain at very low amplitude;
- high-quality neutral photography where reality is stronger than illustration.

Avoid:

- literal blueprint-blue backgrounds;
- plastic “futuristic” panels;
- chrome sci-fi UI;
- holograms;
- excessive glassmorphism;
- colorful translucent blobs;
- neon circuit-board clichés.

## 6.2 Material logic

**Graphite = operating field**  
**Paper/vellum = explanation / evidence / human readability**  
**Smoked film = system layer**  
**Magenta registration = DE intervention / action**  
**Violet transmitted light = coherence / system energy, never a painted panel**

This gives every material a semantic job.

---

# 7. Asset production matrix

Legend:

- **REUSE** — use an existing approved asset, preferably its best original/derivative.
- **CAPTURE** — create from a real DE product, room, process, or person.
- **CREATE** — author in SVG/Canvas/WebGL/3D/vector; deterministic and DE-owned.
- **GENERATE** — use approved image-generation tooling for non-human illustrative/environment candidates; candidate until reviewed.
- **FIND-LICENSE** — source a rights-cleared real image only where it materially beats creating/capturing.

| ID | Material | Method | Evidence class | Needed for | Priority |
|---|---|---|---|---|---|
| HP-M01 | Master Operating Blueprint — aligned state | **CREATE** SVG/vector | ILLUSTRATIVE explanatory diagram | peak/outcomes/close | P0 |
| HP-M02 | Master Operating Blueprint — misregistered state set | **CREATE** from same source | ILLUSTRATIVE | problem | P0 |
| HP-M03 | Layer masks: people, identity, endpoint, network, cloud/data, security, business systems, automation, recovery | **CREATE** | ILLUSTRATIVE | blueprint system | P0 |
| HP-M04 | Outcome highlight matrices (Protect / Productivity / Automate / Compliance / Recover) | **CREATE** | ILLUSTRATIVE | interactive outcomes | P0 |
| HP-M05 | Blueprint mobile fold/stack state | **CREATE** | ILLUSTRATIVE | 390px composition | P0 |
| HP-M06 | “Misregistration” atmospheric transmission plate | **GENERATE + COMPOSITE** | ILLUSTRATIVE | problem background | P0 |
| HP-M07 | “Alignment light” transmission plate | **GENERATE + COMPOSITE** | ILLUSTRATIVE | peak background | P0 |
| HP-M08 | Vellum / ink / paper macro texture set | **CREATE or GENERATE** | decorative | paper/diagram stages | P1 |
| HP-M09 | Graphite registration surface set | **CREATE or GENERATE** | decorative | dark stages | P1 |
| HP-M10 | DE Desk high-resolution product capture | **CAPTURE** | LIVE or SANITIZED REAL | proof | P0 |
| HP-M11 | Cyber Risk Assessment sample/report capture | **CAPTURE** | SANITIZED REAL or EXAMPLE | proof / assessment | P0 |
| HP-M12 | Roadmap/QBR artifact capture | **CAPTURE** | SANITIZED REAL or EXAMPLE | operate/proof | P0 |
| HP-M13 | Solution builder / business-needs artifact capture | **CAPTURE** | LIVE or SANITIZED REAL | range/proof | P1 |
| HP-M14 | Portal/client-experience artifact capture | **CAPTURE** | SANITIZED REAL | proof | P1 |
| HP-M15 | Founder portrait original | **REUSE** | REAL PERSON | human | P0 |
| HP-M16 | Founder working-session set | **CAPTURE** | REAL PERSON | human/proof | P1 |
| HP-M17 | Assessment/whiteboard hands/process set | **CAPTURE** | REAL PEOPLE/PROCESS | proof/human | P1 |
| HP-M18 | Chandler/Phoenix environmental plate | **REUSE first; CAPTURE/FIND-LICENSE only if stronger** | REAL PLACE | human/place | P0 |
| HP-M19 | Industry dossier marks/pressure diagrams | **CREATE** | ILLUSTRATIVE + sourced text facts | who this is for | P1 |
| HP-M20 | Operating cadence diagram | **CREATE** | ILLUSTRATIVE | operate continuously | P0 |
| HP-M21 | Security-boundary overlay | **CREATE** from diagram system | ILLUSTRATIVE | peak/protection | P1 |
| HP-M22 | Recovery path overlay | **CREATE** | ILLUSTRATIVE | peak/outcome Recover | P1 |
| HP-M23 | Compliance evidence tag vocabulary | **CREATE** from existing EvidenceFrame rules | EXAMPLE/real depending content | outcomes/proof | P1 |
| HP-M24 | Final static social/OG composition | **CREATE** from approved still materials | marketing image | SEO/social | P1 |

### P0 material gate

No homepage implementation begins until **HP-M01 through HP-M12, HP-M15, HP-M18, and HP-M20** have either approved finished assets or approved static comps demonstrating exactly how the final asset will look.

---

# 8. Scene-by-scene material board

## Scene 1 — THRESHOLD

### Job

“This is not another MSP page.” Establish scale, confidence, and restraint before showing complexity.

### Composition

- normal site navigation;
- largely typographic opening;
- graphite field with a narrow warm-paper or translucent-vellum material edge/plane entering the composition;
- one subtle registration mark, not a screen full of HUD;
- no hero dashboard;
- no logo explosion;
- one primary assessment path.

### Materials

- HP-M08 paper/vellum texture;
- HP-M09 graphite registration surface;
- brand mark / type;
- optional extremely subtle Arizona atmosphere only if it does not compete with the proposition.

### Static keyframe

Must work as an editorial cover without motion.

### Mobile

Headline remains the composition. No miniature desktop diagram above the fold.

---

## Scene 2 — MISREGISTRATION

### Job

Make the visitor recognize the actual operational problem: systems can all be “working” yet the business still feels fragmented.

### Composition

The Operating Blueprint layers enter individually. They are not chaotic or broken; they are **slightly out of register**.

Examples of visible misregistration:

- user identity exists but application ownership is unclear;
- devices exist without an obvious lifecycle tie to the person;
- network connects systems but monitoring/responsibility annotations terminate inconsistently;
- backup exists but recovery priority is not connected to business process;
- security controls sit beside business systems rather than enclosing them;
- automation arrows stop at manual handoffs.

No invented client specifics. Labels remain archetypal.

### Materials

- HP-M02 / M03;
- HP-M06 transmission plate;
- sourced industry facts as small editorial annotations where relevant.

### Motion

Low/medium. Layers arrive with different physical depth and slight offset. Do not jitter everything for “glitch.”

### Mobile

Layers become vertically stacked cards/films with one anchor point drifting out of register per layer. Readability beats completeness.

---

## Scene 3 — PRESSURE

### Job

Show why fragmentation matters without becoming fear-marketing theatre.

### Composition

Facts and business consequences appear as annotations on the misregistered system:

- business interruption;
- identity compromise;
- recovery uncertainty;
- compliance evidence gaps;
- tool/vendor sprawl;
- onboarding/offboarding friction.

Only sourced public facts or clearly qualitative consequences. No DE performance claims unless real.

### Materials

- same blueprint; no new hero asset;
- evidence tags using existing classification rules;
- optional paper “case note” inserts.

### Motion

Annotations accumulate; system itself does not yet resolve.

---

## Scene 4 — ALIGNMENT — THE PEAK

### Job

The one tell-someone moment.

### Composition

The misregistered layers move into precise registration around a handful of shared operating anchors. DE enters as the **operating registration layer**:

- ownership aligns;
- identity follows the person across systems;
- devices attach to lifecycle and control;
- security boundaries wrap relevant domains;
- observability paths connect;
- recovery sequence becomes explicit;
- automation traverses business-system boundaries;
- cadence/ownership labels appear.

The mark “DE” may appear once as an architectural notation, not as a giant branded object.

### Materials

- HP-M01 / M03;
- HP-M07 alignment light;
- HP-M21 security boundary;
- HP-M22 recovery path;
- HP-M20 cadence anchor.

### Motion

**Highest motion budget on the page.** One precise alignment event. No confetti, no explosion, no gratuitous particle field.

The most satisfying motion should be **registration**: independent sheets/lines settle into a coherent geometry and the violet transmitted light appears only after alignment.

### Static keyframe

The fully aligned state must be a premium standalone poster/diagram worthy of use in a sales deck.

### Mobile

Do not shrink the desktop blueprint. Use a 4–5-state sectional reveal: layers stack → shared anchors appear → boundary closes → outcome path illuminates.

---

## Scene 5 — OUTCOMES

### Job

Turn the resolved architecture into visitor agency: technology exists to produce business outcomes.

### Controls

Suggested outcome set:

1. Protect my business
2. Make employees more productive
3. Automate the company
4. Meet a compliance requirement
5. Keep the business recoverable

### Materials

- HP-M04 outcome matrices;
- aligned HP-M01;
- plain-language explanation beneath each state.

### Interaction

Selecting an outcome highlights the exact relevant layers and cross-layer relationships. This is explanatory—not a fake configurator and not a sales quote calculator.

### Motion

Fast state transitions, not scroll theatre. User input owns the chapter.

---

## Scene 6 — WHO THIS IS FOR

### Job

Make the ideal client feel seen without turning the homepage into five separate industry microsites.

### Composition

Editorial dossiers / pressure profiles for core professional-service industries. Each dossier names the business pressure first, then the relevant DE operating layers.

No stock portrait carousel.

### Materials

- HP-M19 dossier system;
- optional real/environmental details only when rights-cleared and coherent.

### Motion

Minimal: line drawing / editorial reveal only.

---

## Scene 7 — OPERATED CONTINUOUSLY

### Job

Explain the ProActive idea: the integrated environment is not a one-time project; it is operated, measured, improved, and owned on cadence.

### Composition

A clean cadence strip or circular/linear service blueprint:

**Observe → Decide → Protect → Improve**

Supporting sub-activities may include assessment, remediation, verification, documentation, strategy, support, and change management where canonically accurate.

### Materials

- HP-M20 cadence diagram;
- real roadmap/QBR artifact HP-M12 in a secondary evidence stage;
- no rolling price counters.

### Motion

One continuous progress pass tied to meaning; no looped dashboard animation.

---

## Scene 8 — PROOF

### Job

Prove DE builds and operates real things.

### Composition

A small number of large, captioned evidence frames rather than a grid of tiny screenshots.

Recommended proof order:

1. Cyber Risk Assessment artifact — HP-M11
2. DE Desk / Ask DE — HP-M10
3. Roadmap/QBR — HP-M12
4. Solution builder/client experience — HP-M13/M14 if sufficiently polished

### Material rules

- capture at high native resolution;
- sanitize real customer/client information;
- classify every frame correctly;
- do not put fake telemetry around screenshots;
- include provenance/date when helpful;
- if a product surface is not polished enough for flagship use, redesign the product surface separately or omit it—do not hide it behind blur/glow.

### Motion

Almost none. Evidence needs time to read.

---

## Scene 9 — HUMAN / ARIZONA

### Job

Release technical tension and remind the visitor that a real principal-led Arizona company is accountable for the system.

### Materials

- HP-M15 founder portrait from original;
- HP-M18 Arizona/Chandler plate;
- HP-M16 working session if captured well;
- real phone/location/contact facts.

### Composition

Photography gets room. No HUD over faces. No fake team photo.

### Motion

Gentle spatial reveal / crop shift only.

---

## Scene 10 — ASSESSMENT / CLOSE

### Job

Make the Cyber Risk Assessment feel like the logical next action rather than an appended CTA banner.

### Composition

- aligned blueprint returns quietly in low contrast;
- one short conviction statement;
- one canonical assessment action;
- secondary plain text paths for existing clients/support as needed;
- normal footer below.

### Materials

- aligned HP-M01 in quiet state;
- brand type;
- no new plate.

### Motion

Almost none. The page should finish settled.

---

# 9. Real artifact capture plan

The proof chapter will be weak if the source products are captured casually. Captures are treated as photography/product-media work.

## Capture standard

For every product/evidence surface:

- use a dedicated demo/sanitized record set;
- 2× or native high-DPI capture;
- no browser personal chrome unless intentionally part of context;
- no passwords, customer names, ticket bodies, IP addresses, tokens, emails, invoices, or internal secrets;
- stable test data and date labels;
- desktop master plus a mobile crop if the product is responsive;
- save original PNG and optimized web derivative;
- record provenance in the asset manifest;
- classify LIVE / SANITIZED REAL / EXAMPLE / ILLUSTRATIVE before placement.

## Required capture shot list

### Cyber Risk Assessment

1. assessment overview / scorecard;
2. prioritized findings;
3. roadmap or remediation sequencing;
4. executive-facing summary/detail if genuinely available.

### DE Desk / Ask DE

1. launcher/context shot;
2. actual support/Ask DE surface with sanitized/example content;
3. optional client-tool surface if it communicates breadth without clutter.

### Roadmap / QBR

1. technology/security roadmap;
2. cadence/review artifact;
3. evidence of ownership and next actions.

### Solution Builder / Client Experience

Only include if current visual quality clears the flagship bar. The homepage is not the place to advertise unfinished product UI merely because it exists.

---

# 10. Photography production plan

Existing portrait and Arizona dusk assets can support the first material board, but a flagship site should eventually have a deliberately shot DE set.

## Shot family A — founder / principal

Required:

- controlled environmental portrait, horizontal with negative space;
- vertical portrait;
- working profile/detail, not looking at camera;
- seated/standing review moment with real documentation.

## Shot family B — assessment / engineering process

Required:

- hands + printed/onscreen assessment material;
- whiteboard/architecture discussion;
- physical notebook / marked-up plan / device detail;
- no staged “point at generic laptop” shot.

## Shot family C — place

Required:

- Chandler/Phoenix after-dark/blue-hour environmental context;
- architectural detail rather than postcard skyline when possible;
- one quiet daytime Arizona texture for paper chapters if useful.

## Grade

- same camera height/focal feel across set;
- graphite/gunmetal neutrals;
- warm practicals;
- restrained violet may exist naturally/as subtle accent light, never a magenta/violet gel bath;
- preserve skin accurately.

No generated people.

---

# 11. Generated / illustrative material briefs

Generation is allowed only for **non-human illustrative/environment material** and stays candidate until human review.

The repo already has a proposed Kie AI asset connector in PR #168. If that path is used, generated material must remain outside runtime code, retain provenance, and be explicitly marked ILLUSTRATIVE until approved. No API key enters client code or repository content.

## Generation brief G1 — MISREGISTRATION TRANSMISSION

**Purpose:** atmospheric substrate behind the misregistered operating layers.

**Subject:** close, abstract material study of stacked translucent smoked vellum / technical drafting films, slightly offset registration holes and fine graphite lines, shallow physical depth, controlled studio shadow, black graphite field, almost no color, a trace of restrained violet transmission where layers overlap.

**Must feel:** architectural model photography + premium print production + technical instrument.

**Must not contain:** text, UI, computer circuit boards, holograms, servers, locks, shields, neon, colored glass blobs, generic AI geometry.

**Composition:** 16:9 and 4:5 masters; negative space; edges usable under typography.

## Generation brief G2 — ALIGNMENT LIGHT

**Purpose:** provide physical light/depth behind the peak without competing with the created SVG blueprint.

**Subject:** perfectly registered translucent technical films suspended over a deep graphite surface; crisp registration points; shallow, controlled violet transmitted light emerging only through aligned openings; tiny magenta registration mark; precise shadow hierarchy.

**Must feel:** expensive product/architectural photography, not fantasy sci-fi.

## Generation brief G3 — GRAPHITE REGISTRATION SURFACE

**Purpose:** dark-field material texture for chapter transitions and diagram stages.

**Subject:** matte anodized graphite plate with subtle machining/ruling, microscopic grain, sparse precision marks, soft edge falloff, no content-bearing symbols.

## Generation brief G4 — VELLUM / INK MACRO

**Purpose:** light/paper editorial relief.

**Subject:** warm off-white vellum/paper macro with black technical ink, minute fiber texture, embossed or blind-debossed alignment marks; premium print quality; no readable words.

### Candidate policy

Generate variants, then choose **one coherent set**. Do not mix models/styles merely because individual images look impressive.

---

# 12. Bespoke diagram specification

The Operating Blueprint is the most important created asset and should receive more design time than any generated plate.

## Source format

Author one canonical semantic data model and render it to SVG/HTML layers. Do not hand-maintain unrelated desktop/mobile drawings.

Conceptual schema:

```text
BusinessOutcome
  -> requires Layer[]
  -> requires Relationship[]

Layer
  -> id
  -> title
  -> responsibility
  -> anchors[]
  -> controls[]

Relationship
  -> from
  -> to
  -> type: access | data | control | support | recovery | automation

OperatingAnchor
  -> owner | identity | observability | policy | documentation | recovery
```

The visual implementation should reuse/extend the approved DE diagram vocabulary rather than introducing a second system.

## Visual primitives

- fine graphite/white line;
- solid node only for actual anchor, not every noun;
- layer outline/film boundary;
- registration cross;
- security boundary;
- control gate;
- recovery path;
- plain-language annotation;
- tiny Oxanium metadata only where metadata has real meaning.

## Static-state deliverables

Before animation:

1. desktop misregistered poster;
2. desktop aligned poster;
3. desktop outcome-highlight poster for each outcome;
4. tablet aligned poster;
5. mobile stacked aligned poster;
6. reduced-motion before/after states.

These should be reviewed like standalone design work.

---

# 13. Responsive composition plan

## 1440+

- full-width editorial stage;
- blueprint may occupy 50–65% of frame at the peak;
- body copy width stays readable and does not sit on top of dense lines;
- the system can show 8–10 layers because space exists.

## 768

- reduce labels, not conceptual relationships;
- move explanations below/adjacent rather than shrinking typography;
- blueprint can show 6–8 grouped layers;
- outcome control remains tappable and immediately changes diagram state.

## 390

Mobile is **not desktop scaled down**.

- hero remains typographic;
- misregistration is shown through 4–5 grouped layer films;
- peak uses sequential sectional states, not a huge all-at-once network;
- outcome controls are horizontal pills/tabs or vertical compact choices with 44px targets;
- proof artifacts are one per viewport width;
- no fixed side rail;
- no tiny diagram labels under ~12–13px equivalent;
- no required hover.

---

# 14. Reduced-motion / no-motion plan

Reduced motion must preserve the argument.

## Reduced motion

- misregistered composition loads visibly misregistered;
- user advances through crossfaded/stepped states rather than long transforms;
- alignment switches through two or three short state changes;
- outcome interaction remains fully functional;
- proof/human scenes remain normal.

## No-motion/static fallback

The page still works with:

1. misregistered poster;
2. “DE brings the operating layers into register” transition copy;
3. aligned poster;
4. clickable/tabbed outcome states;
5. real proof and human photography.

If that static version is not compelling, the design is not ready.

---

# 15. Find vs create decision

## Create ourselves

- Operating Blueprint master;
- all layer states;
- outcome logic/visual states;
- cadence diagram;
- security/recovery overlays;
- industry dossier grammar;
- evidence framing/composition;
- all motion choreography.

These are proprietary DE explanatory assets and should become long-lived brand IP.

## Capture ourselves

- DE Desk;
- Assessment artifact;
- roadmap/QBR;
- portal/solution builder where useful;
- founder/working sessions;
- local/process photography.

Reality is stronger than generated substitutes here.

## Generate candidates

- non-human atmospheric transmission materials;
- graphite/paper/vellum macro materials;
- optional abstract light/shadow studies.

Generation is subordinate to the created explanatory system.

## Find/license only if it materially wins

- Arizona/environmental photography when the existing/captured set is not strong enough;
- rare editorial architectural/business-environment plate that matches the entire set.

Do not buy a generic cybersecurity stock pack simply to fill slots.

---

# 16. Quality scorecard for every material

Score 0–2 each. Anything under **15/20** is rejected; P0 signature material should target **18+/20**.

| Criterion | 0 | 1 | 2 |
|---|---|---|---|
| Communicates intended idea | decorative/confusing | partly | immediate |
| Looks specifically DE | generic | brand-adjacent | unmistakably DE |
| Works without animation | no | passable | excellent |
| Works at final crop/size | no | compromised | strong |
| Material realism/craft | artificial | acceptable | premium/tactile |
| Restraint | noisy | mixed | disciplined |
| Neighbor consistency | clashes | tolerable | coherent set |
| Truth/provenance | unclear | classifiable | explicit/real |
| Responsive adaptability | desktop-only | adapted | designed for all |
| Six-month durability | trendy/disposable | okay | enduring |

**Automatic rejection regardless of score:** fake client/customer proof, generated employee likeness, unreadable fake telemetry, security claims implied by decorative visuals, unlicensed sources, secrets/PII in captures.

---

# 17. Material review wall

Before any implementation PR, assemble a review wall containing these **still images only**:

## Row A — signature system

1. misregistered desktop blueprint
2. aligned desktop blueprint
3. Protect outcome
4. Productivity outcome
5. Automate outcome
6. Compliance outcome
7. Recover outcome
8. mobile aligned blueprint

## Row B — physical material family

1. misregistration transmission plate
2. alignment-light plate
3. graphite surface
4. vellum/ink surface
5. paper/dark transition comp

## Row C — real evidence

1. assessment capture
2. DE Desk capture
3. roadmap/QBR capture
4. client/solution surface if accepted

## Row D — human/place

1. founder portrait
2. working/process shot
3. Arizona/Chandler environment

## Row E — full-page storyboard

Ten static scene frames at 1440 plus key 390 frames.

**Gate:** the review wall must look like one art-directed campaign, not four unrelated asset sources.

---

# 18. Build storyboard after material approval

Only after the review wall passes:

1. lock semantic blueprint data model;
2. implement static aligned/misaligned SVG states;
3. implement outcome interaction without Scrollcraft;
4. verify 390 / 768 / 1440 static composition;
5. integrate Scrollcraft only for narrative state progression;
6. add the single alignment peak;
7. add supporting scene transitions;
8. add reduced-motion mapping;
9. integrate real proof/human materials;
10. run visual QA, accessibility, performance, and concurrency audit.

This order prevents animation architecture from dictating the art direction.

---

# 19. Acceptance gate — before code

The homepage is cleared to implementation only when all are true:

- [ ] Operating Blueprint misregistered static comp approved
- [ ] Operating Blueprint aligned static comp approved
- [ ] all five outcome states approved
- [ ] 390px blueprint treatment approved
- [ ] transmission/alignment material pair approved as one family
- [ ] P0 real evidence captured and sanitized
- [ ] founder/place assets selected
- [ ] ten-scene 1440 storyboard approved
- [ ] key 390 storyboard approved
- [ ] reduced-motion keyframes approved
- [ ] all asset provenance/classification recorded
- [ ] final homepage narrative/content coverage checked against current SPA homepage so required functionality is not lost
- [ ] Scrollcraft fingerprint gate checked against `de-v2` and `proactive-ecosystem-amplify`
- [ ] lead integrator confirms no concurrent homepage implementation collision

Until then: **NO HOMEPAGE BUILD.**

---

# 20. Immediate production sequence

This board authorizes the next *material-production* work, not the homepage implementation.

## Wave 1 — P0 explanatory design

Create static comps for:

- HP-M01 aligned blueprint
- HP-M02 misregistered blueprint
- HP-M03 layer system
- HP-M04 five outcome states
- HP-M05 mobile state
- HP-M20 operating cadence

## Wave 2 — P0 atmosphere

Produce candidate coherent pairs for:

- HP-M06 misregistration transmission
- HP-M07 alignment light
- HP-M08/M09 supporting surfaces

## Wave 3 — P0 real evidence

Capture:

- HP-M10 DE Desk
- HP-M11 Assessment
- HP-M12 Roadmap/QBR

## Wave 4 — human/place

Select original founder image and current Arizona plate; determine whether a new dedicated photo session is needed before final implementation.

## Wave 5 — review wall + storyboard

Assemble all selected materials into static ten-scene desktop and mobile boards. Only then ask for implementation approval.

---

# 21. Release-state note

A short-lived concurrent release merged PR #173 to make Version B `/`, then PR #177 reverted that release. The repository's current design boundary is therefore the desired one for this program:

- **existing SPA homepage:** production homepage / integration baseline;
- **`/v2`:** isolated Scrollcraft reference and comparison surface;
- **this material board:** pre-production design authority for the next proposed flagship iteration;
- **no homepage replacement occurs from this document alone.**

This separation must remain until the material/storyboard gate is passed and a later implementation/release is explicitly approved.
