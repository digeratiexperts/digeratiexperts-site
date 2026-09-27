# Version 4 homepage — source of truth

**Status:** authoritative for the V4 build. One V4 branch, one source of truth.
**Branch:** `claude/homepage-v4` · **Preview route:** `/version-4` · **Production `/` is untouched.**
**Approval gate:** Joe, and only Joe, approves replacing production `/`.
**Roles:** Claude Code — implementation lead, visual and code execution. ChatGPT —
architecture reviewer, adversarial QA, flow reviewer, second design critic. Neither
produces a competing V4; both work against this document.

Opened 2026-09-27 from Joe's V4 mission brief. Everything below that is measured
says how it was measured. Everything that is a judgement says so.

---

## 0. The standard

Not "better than the current homepage." The standard Joe set:

> If V4 is placed beside every previous attempt, it should be obvious that we
> finally understood what Digerati Experts is and how the website should explain it.

And the rule that outranks design, from 2026-09-06:

> Whatever we create has to not distract from their profile types and why they are
> here. It takes precedence over everything else including design. It leads design.

---

## 1. What worked in every previous attempt

Measured or quoted, per attempt.

### v1 — production homepage (live at `/` now, restored 2026-09-03)

- **It survived.** Two replacements were shipped over it and both came back off. That
  is the only homepage with evidence of being kept.
- Sourced statistics with a named source and year, via `cyberAwarenessFacts.ts`. The
  discipline of `docs/CLAIMS-REGISTER.md` — every claim carrying a basis — is the
  strongest single asset any attempt has produced.
- Trust cards near the top answer "will this be safe" early.
- Zero horizontal overflow at every width (measured: `0px` at 1440 and 390).

### v2 — Version B, the Scrollcraft story page (static, preview at `/v2`)

- Proved the **story spine** works: recognition → tension → turn → substance → range
  → commitment. The order is right even where the visual execution was not.
- Proved DE will read as a company with a point of view rather than a vendor list.
- Real founder portrait and real Arizona material beat any generated plate.

### v3 — diagram-system sections (live 2026-09-02 → 2026-09-03, PR #178)

- The **diagram system** is genuinely DE's: explaining an operating model with a drawn
  model rather than eight decorated cards.
- Forced the **eight-block correction** — the site had been saying "six domains," the
  stale pre-2026 model. That correction is now canon and carries into V4.

### PR #186 — the Why DE passage

- **The strongest idea anyone has had on this project.** The environment begins subtly
  misaligned and becomes aligned; the 348° → 360° heading correction. It is the only
  concept that explains DE's value as an experience instead of a claim.
- Joe's own words on why it matters: *"I've never seen an IT company explain what it
  does like this."*

### Experience v1 / PR #200 — closed unmerged 2026-09-27

- The **engine and the gate work**. `tools/motion.mjs` walking 4 scroll speeds × 2
  viewports and failing on BLANK / FROZEN / STALE / FLASH is the right way to verify a
  moving page, and it caught real defects.
- Proved that "one picture of the world, never two and never none" is a testable
  invariant.
- Joe's closing verdict is itself the lesson: *"this revision is the visual build that
  was rejected. The visual reset supersedes it."* The **concept** was never rejected.

### directions-v1 / PR #230 — merged, live at `/scrollcraft/directions/`

- The reference board (22 real sites; Joe marked 10 yes, 9 maybe, 3 no) is the only
  time the project has had **evidence of taste** instead of assertions about it.
- Joe's correction, which now governs V4:
  > "Don't choose a whole website as 'the DE look.' The strongest answer is a
  > deliberate combination of visual base + motion language + product/technical
  > posture."

---

## 2. What failed in every previous attempt

### The production homepage, measured 2026-09-27 at 1440×900

Captured from the running app, not from reading source:

| Measure | Value | Why it is a failure |
|---|---|---|
| Document height | **21,157px** | — |
| Length in viewports | **23.5** | Nobody reaches the end. The close does no work. |
| Unique sections | **20** | Twenty things to hold in mind. |
| `<section>` elements | 34 | Nested wrappers; the DOM says the structure is unclear even to itself. |
| Links/buttons on the page | **279** | — |
| Links/buttons in the hero alone | **19** | The first screen offers nineteen ways to leave it. |
| Section heights | 0.71 – 2.43vh, nearly all 1.0–1.5 | **No rhythm.** Twenty near-identical blocks. Nothing is bigger because it matters more. |
| Horizontal overflow | 0px | The one thing that is right. |

**The core failure is flatness.** Not ugliness — sameness. Every section is the same
size, the same weight, the same distance from the reader. A page with no peak has no
memory. 23.5 viewports of uniform blocks is a document, not an argument.

**The second failure is choice overload.** 279 links, 19 of them before the first
scroll. A frightened buyer arriving from a breach scare or an insurance form is given
a menu, not a direction.

### v2 — Version B

- Shipped to `/`, then reverted. Story right, surface wrong.
- Depended on generated imagery that never passed `design/IMAGERY.md` review.

### v3 — diagram sections

- Live for roughly one day, then retired at Joe's direction.
- The diagrams were good; they were bolted onto the flat structure rather than
  replacing it, so the page got longer without getting clearer.

### Experience v1 / PR #200 — the rejection that matters most

Joe, 2026-09-09, on what the concept turned into visually:

> "I don't like almost any of it, at least 90 percent is really half baked or not the
> direction we need to go. Which is a huge waste of time and money."

Named failures, from his own list: dark rectangles; purple/magenta accents doing the
work; abstract lines; **dashboard-looking UI**; tiny labels; and basic "text moves
while scrolling" mistaken for motion design.

Defects found by its own gate, all of which V4 must not reproduce:

- Blank scroll states — ranges where nothing was on screen.
- Two pictures of the world at once (the stills and the live world both rendering).
- The world absent on phones, so mobile got a worse story rather than a different one.
- Invented telemetry on screen. Removed, and now a Tier 0 prohibition.
- A 109px horizontal overflow at 390 from an unscoped flex rule.

### The cross-cutting failure: a system fighting itself

The DE Desk carried **two token schemes plus a re-declaration back to the old theme,
plus an external `!important` file** dragging it back — three themes in one component,
and a test suite that asserted both at once. Fixed in PR #229. V4 must not be able to
develop this condition: **one token system, no nested re-declaration, no `!important`
patch layer.**

---

## 3. What V4 intentionally keeps

| Kept | From | Why |
|---|---|---|
| The misalignment → alignment signature | PR #186 | The single strongest idea the project has produced |
| 348° → 360° as a **restrained instrument** | PR #186 | Survives only if visual review passes it; never rotates the document |
| Story spine: recognition → tension → turn → substance → range → commitment | v2 | The order was never the problem |
| Eight-block architecture, Risk & Exposure continuous | v3 / PR #185 | Canon. `design/PROOF_SYSTEM.md`, `docs/CLAIMS-REGISTER.md` |
| The claims register discipline | v1 | Every claim carries a basis or it does not ship |
| Multi-speed motion verification | Experience v1 | 12 / 60 / 180 / 420 px, tested while moving |
| "One picture of the world, never two and never none" | Experience v1 | Testable invariant |
| Real founder portrait, real Arizona material | v2 | Real beats generated, every time |
| Naming canon, exactly | `docs/DE-NAMING-CANON.md` | Cloud Edge / SASE · Managed Physical Site Network · Hybrid / Multi-Site · Co-Managed Network · Threadline (Migration, Inbox, Continuity, Recovery) · Switchboard |
| Transformation over replacement | Experience v1 rule | One environment that evolves, not a new illustration per section |

---

## 4. What V4 intentionally rejects

| Rejected | Because |
|---|---|
| **20 sections, 23.5 viewports** | V4 is **10 chapters** and must come in materially shorter. Length is a failure mode, not a feature. |
| **279 links; 19 in the hero** | The hero carries **one** primary action. Whole-page link budget is a gate, not a preference. |
| **Uniform section heights** | One chapter is the peak and is visibly the largest. Adjacent chapters differ in weight. |
| Dashboard-looking UI, fake SOC screens, counters, telemetry | Tier 0 truth. Also the specific thing Joe named in the rejection. |
| Purple/magenta doing the design's work | Magenta is **held to almost nothing** — see §6. |
| A new unrelated illustration per section | Transformation over replacement. |
| Generated photoreal imagery on the flagship | `design/IMAGERY.md`; code-built only. People as presence, never faces. |
| Scroll-jacking, full-page snapping, dead scroll, blank pinned ranges | Native scroll is the baseline. |
| WebGL because it exists | Lightest technology that delivers it. DOM/SVG/CSS/Canvas first; WebGL only if it materially improves the result **and** passes the performance gate. |
| A second token scheme, nested re-declaration, `!important` patches | The DE Desk failure. Structurally forbidden. |
| Assembling old homepage components | Read them for business truth; redesign the presentation from scratch. |

---

## 5. V4 section / story map

Ten chapters. Chapter 03 is the peak and gets the most scroll room and the asset budget.

| # | Chapter | Job | Notes |
|---|---|---|---|
| 01 | **Hero** | "You lead the business. We lead the technology." Who DE serves; cybersecurity-first managed technology; the customer stays in command. | **One** primary CTA: *Understand Your Environment*. A secondary exploration path only if it earns itself. |
| 02 | **Disconnected environment** | People, identity, endpoints, email, cloud, network, applications, data and vendors exist — but are not operating as one system. | Establishes the environment that every later chapter transforms. |
| 03 | **Alignment / Why DE** — ★ **the peak** | "We do not promise outcomes before we understand the environment." Environment moves from slightly wrong to aligned. | The signature transformation. 348° → 360° **if it survives visual review**. Largest scroll span by a visible margin; the chapter before it is quieter. |
| 04 | **Assess first → three doors** | Assessment sits **above** the pathways, never as a fourth peer product. | Three pathways: **Handle Our IT** (ProActive, Co-Managed) · **Solve a Business Need** (Standalone) · **Client Marketplace** (existing-client expansion). |
| 05 | **DE security foundation** | The current eight-block architecture. | Identity & Access · Endpoint · Email & Collaboration · Browser & Web · Network · Detection & Response · Human Risk · **Risk & Exposure**. Risk & Exposure is the continuous intelligence layer beneath and across the other seven — **not another identical card**. |
| 06 | **Business operating system** | Security becomes the foundation for the broader managed technology environment. | Workplace, communications, network, cloud/data, business systems, automation, support, governance, continuity. Vendor-neutral unless disclosure is explicitly appropriate. |
| 07 | **Outcomes** | What the customer can accomplish: protect · work better · communicate · automate · comply · recover · grow. | Outcomes and capabilities. **Not vendor lists.** |
| 08 | **Proof + responsibility** | The strongest proof/trust/company material merged into **one** chapter. | Real DE product/interface captures where appropriate · Client Bill of Rights · Guarantee · Trust Center · real methodology · real founder/company presence · real reviews and case studies **only where they actually exist**. DE's published boundaries and refusals appear here as evidence of responsibility. |
| 09 | **Fit + operating models** | Who DE is for, and how the relationship scales. | Enough ProActive/package information to orient. **Not** the pricing page dumped onto the homepage. |
| 10 | **Final frame** | Return to the opening environment, now aligned. "You lead the business. We lead the technology." | Primary CTA: *Understand Your Environment*. The close resolves and holds — it does not fade into a footer. |

---

## 6. V4 visual system

One coherent system. The homepage must feel like **one product made by one company.**

**Layers** (per `scrollcraft/builds/directions-v1/BRIEF.md`, merged in PR #230):

- **Visual base — Calm Engineered Confidence.** The default register.
- **Product / information layer — Precision Product Company.** The three doors, the
  eight blocks, the operating system, the models.
- **Motion layer — Bright Cinematic Story.** A layer *over* the two above. Never its
  own dark immersive universe.

**Ground and colour**

- Graphite / deep near-black foundation.
- Warm paper (`#F7F5F2`) where deliberate contrast is wanted — as a chapter treatment,
  used for emphasis, not decoration.
- **DE magenta `#D3126A`, held to almost nothing.** *Decided by Joe, 2026-09-27.* Pine
  was rejected: `brand/README.md` states the gold belongs to the logo only and "does
  not replace brand magenta `#D3126A` anywhere in the interface," so pine would have
  been introducing a new accent rather than swapping one. Magenta marks **state and
  the primary action** — never a section's personality.

**Brand assets — non-negotiable, from `brand/README.md`**

> Don't — recolour the mark; put gold on a light ground; set the wordmark in a live
> font; stretch, rotate, add effects, or box the primary lockup; separate the mark from
> the wordmark.

`brand/digerati-logo.svg` **is** the light-ground lockup (gold mark, graphite
wordmark). Its gold was corrected `#F5E48A → #E3B23C` precisely because the old value
failed contrast on warm paper. This was gotten wrong once already; it is recorded here
so it is not gotten wrong again.

**Typography.** Strong, technically precise, generous whitespace, clear hierarchy.
Type carries structure so that containers do not have to. As a standalone preview
build, V4 is not bound to the `client/` production stack lock (Space Grotesk / Inter /
Oxanium) — and the merged directions brief explicitly moves direction 01 off it. The
chosen stack is recorded in the build's own brief and reviewed before any promotion
to `/`.

**Structural rules**

- **One token system only.** No second naming scheme; no nested re-declaration; no
  `!important` patch layer. Enforced by test — see §12.
- No random gradients or a different card style per section.
- Hairlines and space before containers. Not everything is a card.
- Code-built imagery only. No generated photoreal plates on the flagship.
  People as presence, never faces.

---

## 7. Motion rules

- **Native scroll is the baseline.** No full-page snapping. No scroll-jacking. The
  visitor never fights the page.
- **Transformation over replacement.** One environment that evolves through the story.
  Not a new unrelated illustration per chapter.
- Pinned or scroll-driven sequences **only** where the transformation genuinely
  benefits. Everywhere else, the page simply scrolls.
- **No dead scroll. No blank pinned ranges. No section that requires a particular
  scroll speed to read correctly.**
- **Never rotate the document.** The 348° → 360° instrument acts on the environment
  inside its own frame, never on the page, and never produces horizontal overflow.
- One engineered peak (chapter 03). The chapter before it is quieter than it is.
- `prefers-reduced-motion: reduce` collapses every transition to zero and leaves a
  complete, readable document — not a degraded one.
- **Lightest technology that delivers it.** DOM / SVG / CSS / Canvas preferred. WebGL
  only where it materially improves the result and passes the performance gate.

**Motion must be tested while it is happening, not only after it settles**, at four
real speeds: **crawl ≈12px · reading ≈60px · brisk ≈180px · fling ≈420px.** This is
Joe's standing rule from 2026-09-06: *"you must always scroll at different speeds and
test if it has any type of thing that looks off."*

---

## 8. Responsive / mobile rules

- Verified at **390 / 768 / 1440**. Mobile is a first-class target, authored — not a
  pass at the end.
- **Zero horizontal overflow at every width.** Measured, not assumed. (The 109px
  overflow at 390 in an earlier build came from an unscoped rule making inner text a
  flex container; flex children default to `min-width: auto`.)
- The environment appears on phones. Mobile gets a *different* telling, never a
  *lesser* one, and never a blank space where the story was.
- No content hidden beneath fixed chrome at any width, including with the cookie
  banner present.
- Tap targets sized for touch; no hover-only affordance carries meaning.

---

## 9. Accessibility rules

- Semantic heading order, one `<h1>`, no skipped levels.
- Full keyboard navigation; visible, readable focus states on every interactive element.
- Contrast measured on the **composited** page at the brightest frame under each line —
  not assumed from token values.
- `prefers-reduced-motion` honoured throughout (§7).
- Motion never the sole carrier of meaning; anything animation says, text also says.
- Real landmarks; decorative graphics hidden from assistive technology.

---

## 10. Factual / truth requirements

**The rule:** any statement that reads like a metric, customer result, availability
state, integration state, certification, staffing claim or operational signal needs a
real source. **Unknown → say unknown. Unavailable → say unavailable. Illustrative →
label it illustrative.**

Explicitly forbidden on V4:

- Invented testimonials · fake counters · fake client logos · fake SOC screens ·
  fake telemetry · invented certifications · invented staffing or response claims.
- Anything that implies a live operational state the site cannot actually observe.

Required:

- Industry statistics are **context, never DE performance**, each with a named source
  and year (`client/src/data/cyberAwarenessFacts.ts`).
- Service-level claims only where a published DE document states them
  (`client/src/pages/legal/SLA.tsx`, Terms of Use).
- Every new claim on V4 gets a row in `docs/CLAIMS-REGISTER.md` with its basis and
  status before the page is proposed for `/`.
- DE's published boundaries and refusals are shown as evidence of responsibility
  (chapter 08).

> Do not make V4 prettier by making DE less truthful.

---

## 11. Conversion architecture

- **One primary action, repeated, never competing: *Understand Your Environment*.**
  It opens the hero (01) and closes the page (10).
- **Assessment sits above the three doors** (04). It is the way in, not a fourth
  product beside them.
- **Link budget is a gate.** The production page carries 279 links and 19 in the hero;
  V4's hero carries one primary action, and the whole-page total is measured and
  reported in the completion report. A rise back toward the old number is a defect.
- Each chapter has **one** job and at most one forward action. A chapter that offers
  three equal choices has not decided what it is for.
- The close resolves and holds. It does not trail into a footer.
- Every CTA routes correctly and is verified (§12).

---

## 12. Acceptance tests

V4 is not proposable for `/` until all of these pass and the evidence is attached.

**Structure and honesty**

1. Ten chapters, in the order of §5. Chapter 03 has the largest scroll span by a
   visible margin.
2. Total page length materially below the production baseline of 23.5 viewports;
   the measured figure is reported.
3. Whole-page link count and hero link count measured and reported; hero carries one
   primary action.
4. No claim on the page lacks a row in `docs/CLAIMS-REGISTER.md`.
5. No fake operational state anywhere: no counters, telemetry, SOC screens, client
   logos or testimonials without a real source.
6. Naming canon exact (§3). Eight blocks with Risk & Exposure continuous, not a ninth
   identical card.

**Motion**

7. Scroll at **12 / 60 / 180 / 420 px**, at 390 and 1440, sampled *during* motion:
   no BLANK, no FROZEN, no STALE, no FLASH, no collision.
8. "One picture of the world, never two and never none" holds at every sampled
   position and every width.
9. No dead scroll; no blank pinned range; nothing requires a particular scroll speed.
10. `prefers-reduced-motion` yields a complete, readable document with zero transitions.

**Responsive and accessibility**

11. **Zero horizontal overflow at 390 / 768 / 1440**, measured.
12. No content beneath fixed chrome at any width, cookie banner present and absent.
13. Keyboard path through the whole page; focus visible and readable at every stop.
14. Contrast measured on the composited page under every line of text; nothing below
    4.5:1 for body text.
15. Semantic heading order verified; one `<h1>`.

**Engineering**

16. One token system: no second naming scheme, no nested token re-declaration, no
    `!important` patch layer. **Guarded by a test**, not by inspection — the DE Desk
    failure (§2) is how this goes wrong silently.
17. `tsc --noEmit` clean; full `vitest` suite green; production build clean.
18. Acceptable first-load weight, reported. No layout shift.
19. All CTAs route correctly, verified by navigation, not by reading `href`s.
20. `/version-4` is `noindex`, absent from normal navigation, and production `/` is
    byte-for-byte untouched by the diff.

---

## 13. Build and review loop

1. Claude builds a stage and summarises exactly what changed.
2. ChatGPT reviews the actual source or PR **against this document**.
3. Contradictions are fixed before the next stage starts.
4. Visual QA re-runs.

A draft PR opens once the first complete, coherent V4 exists — not before, and not a
stack of half-chapters. `MERGED` and `LIVE` remain separate states. Joe approves
replacing production `/`; nothing else does.
