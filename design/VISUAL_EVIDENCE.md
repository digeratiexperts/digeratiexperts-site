# Visual evidence

Layer 4 of Visual System v2. Parent: `VISUAL_SYSTEM_V2.md`. Foundation: `BRAND.md`, `DESIGN_SYSTEM.md`.

Purpose: make technical proof visible without pretending simulated UI is a real customer environment, live SOC, or measured DE performance.

**DE needs more technical precision, visual evidence, and interactivity — but not more visual noise.**

---

## Classification (required)

Every operational visual, report crop, assessment frame, incident flow, telemetry strip, or “dashboard” treatment must be classified as one of:

Code union on `EvidenceFrame` (`EvidenceClassification`): `LIVE` | `SANITIZED_REAL` | `EXAMPLE` | `ILLUSTRATIVE`. Prose may say **SANITIZED REAL**.

| Class | Code token | Meaning | When to use | Label in UI |
|-------|------------|---------|-------------|-------------|
| **LIVE** | `LIVE` | Data is actually live (or as-live as the product is), from a real DE system, at the time shown | Public threat feed cards from `docs/THREAT-INTEL-FEED.md`; Google/Yelp reviews from the live reviews API when configured | Visible. Include timestamp / source. |
| **SANITIZED REAL** | `SANITIZED_REAL` | Derived from a real DE artifact, engagement, or system, with secrets and client identifiers removed | Real assessment excerpts, real (redacted) roadmap pages, real portal chrome with dummy org names | Visible. Source note: what was redacted. Badge copy: `Real, details removed` (plain language, per the 2026-09-02 review: disclosure stays visible, the internal code moves to `data-classification`). |
| **EXAMPLE** | `EXAMPLE` | Plausible DE workflow or interface, **not** a specific customer, **not** measured performance | IncidentFlow module; sample assessment scores; “how a coverage map behaves” | Visible. Never omit. |
| **ILLUSTRATIVE** | `ILLUSTRATIVE` | Atmospheric or explanatory; not a claim about DE operations | Environment plates, diagram metaphors, editorial stages | Visible when a viewer could mistake it for operations. |

If you cannot classify it, do not ship it as evidence.

### Forbidden indistinguishability

Never make simulated UI indistinguishable from:

- actual customer data
- live telemetry
- measured DE performance
- a real incident

**Do not** show “M365 Phishing Vector Neutralized in 8m” as real DE performance. That is an **EXAMPLE** incident flow, labeled as such.

A future Arizona threat radar **cannot** imply live Arizona telemetry unless it actually uses live data.

Do not back-date, “recent”-wash, or invent freshness (`.cursorrules` §34).

---

## Evidence hierarchy

Before designing a large visual, ask what the visitor must understand or believe, then pick the strongest form:

1. **Real artifact** — document, report page, signed-off assessment excerpt
2. **Real data** — live feed, real review, real catalog count, real pricing from canonical sources
3. **Real person** — principal, team, named reviewer (with permission)
4. **Explanatory diagram** — coverage, ecosystem, identity flow
5. **Sanitized interface** — portal / assessment UI with classification
6. **Illustrative scenario** — labeled EXAMPLE / ILLUSTRATIVE
7. **Editorial photography** — `PHOTOGRAPHY.md`
8. **Atmospheric environment** — Layer 1 plates
9. **Icon** — `IconWell` on small functional cards

Decorative HUD comes after all of these, and only if `HUD_CHROME.md` allows it.

---

## EvidenceFrame

Path: `client/src/components/evidence/EvidenceFrame.tsx` (landed on `main` in `87e2858`, ahead of this governance PR). VIS-001 does not restyle it. Bake classification into the component so authors cannot “forget” the label on operational visuals.

The landed API **requires** `classification` and `title` (stricter than the original optional-slot sketch). Keep it required.

Tests: `client/src/components/evidence/evidencePrimitives.test.ts` (source-string guards). Visual QA at 390 / 768 / 1440 is still pending — do not mark LIVE.

### Variants

| Variant | Field | Use |
|---------|-------|-----|
| `dark` | `--de-bg` / `--de-raised` + hairline | Marketing dark chapters, coverage, telemetry |
| `paper` | `--de-paper` + paper hairline | Reports, roadmaps, assessment printables on light |
| `interactive` | dark or paper with Layer 5 controls | Switchers, timelines, comparison — still classified |

### Optional slots (all optional except that operational content should expose classification)

| Slot | Type | Rules |
|------|------|-------|
| `classification` | `LIVE` \| `SANITIZED REAL` \| `EXAMPLE` \| `ILLUSTRATIVE` | Required whenever the content could be read as operations or performance |
| `timestamp` | string / ISO | Honest. `LAST VERIFIED` in Oxanium when live or sanitized-real |
| `title` | string | Space Grotesk. No invented outcome titles |
| `status` | StatusToken | See `HUD_CHROME.md`. Emerald only when genuinely healthy/live |
| `sourceNote` | string | Source, sanitization note, or “Example — not a customer incident” |
| `technicalId` | string | Optional Oxanium ID (`EVD-04`). Not decoration |

### Chrome

EvidenceFrame **may** use HUDFrame (thin hairline, two corner marks, optional ID). It is not a generic `Card` with extra glow.

Do not:

- fill the frame with violet
- add giant bloom
- put `+` in every corner
- nest three grids

### Consumers (later)

- Assessment EvidenceFrame (VIS-007)
- Roadmap EvidenceFrame (Sprint 2)
- IncidentFlow (VIS-008) — EXAMPLE by default
- Protection Coverage (VIS-005)
- Protection Command Deck (VIS-009)
- Store technical product media when showing “what the control looks like” (VIS-011)

---

## Do

- Prefer a redacted real assessment page over a pretty fake dashboard
- Label EXAMPLE incident flows in the frame, not only in alt text
- Keep timestamps, sources, and severity honest on LIVE threat cards
- Use canonical pricing / package data; never duplicate invented numbers
- Pair large evidence with a short Inter explanation — the frame is not a puzzle

## Do not

- Invent clients, scores, MTTC, “8 minute” response, uptime, headcount, or certifications
- Ship a `SimulatedIncidentResponseCard` that looks live
- Use LIVE on copy written by an agent
- Mix LIVE threat-feed items with ILLUSTRATIVE SOC art in a way that implies the art is the feed
- Restyle Blog/Journal or Store palettes to make evidence “pop”

## Tokens

Dark frames: `--de-bg`, `--de-raised`, `--de-hairline`, white type, magenta only for action / classification emphasis when needed.

Paper frames: `--de-paper`, `--de-paper-raised`, `--de-paper-hairline`, magenta paper-ink for actions.

Labels: Oxanium. Titles: Space Grotesk. Body: Inter.

---

## Related

- Proof chips and human proof: `PROOF_SYSTEM.md` (do not fabricate)
- Diagrams: `DIAGRAM_SYSTEM.md`
- HUD: `HUD_CHROME.md`
- Threat feed (actual LIVE source): `docs/THREAT-INTEL-FEED.md`
- Reviews (actual LIVE / catalog): `docs/GOOGLE-REVIEWS.md`
