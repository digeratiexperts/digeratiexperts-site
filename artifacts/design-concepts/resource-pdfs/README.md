# DE document system — resource PDF concepts (VIS-015)

**Mode:** Exploration (Joe's brief, 2026-10-03). **Claim:** issue #366. **Status: CONCEPT-READY** — not PR-ready for integration, not merged, not live. Nothing under `client/public/` has changed.

This folder holds phase 1: the audit of the 13 public resource PDFs and three rendered concepts of the same datasheet (ProActive IT), built from one shared content file so the comparison is fair. Joe picks a direction; only then is the system extended to one checklist and one report, and then to all 13.

| | |
|---|---|
| `content/proactive-it.json` | The one content source all three concepts render. Every claim carries a source. |
| `concepts/a-editorial.mjs`, `b-technical.mjs`, `c-executive.mjs` | The three art directions (HTML + CSS templates). |
| `lib/base.mjs` | Shared shell: fonts, logo from `brand/`, escaping, page frame. |
| `lib/finalize.py` | Writes metadata Chromium leaves out (author, subject, keywords, `/Lang`, DisplayDocTitle). |
| `lib/verify.py` | Technical gate: tagging, structure, fonts (embedded, no Type 3, ToUnicode), links, title, language, text. |
| `build.mjs` | `node artifacts/design-concepts/resource-pdfs/build.mjs [a b c]` → `out/*.pdf` |
| `out/` | Rendered concept PDFs (the deliverable to open). |
| `evidence/` | Before/after boards in colour and grayscale, 150 dpi zoom crops. |
| `fonts/` | Static TTF instances + OFL licences (see `fonts/README.md`). |
| `CONTENT-CHANGES.md` | Content-change register for Joe (claims corrected, added, removed). |

---

## 1. Audit of the current 13 PDFs

Every page of all 13 was rendered and read, and the text was extracted (`pdftotext -layout`). Contact sheet of all 26 pages: `evidence/board-color.png` (top-left shows one current datasheet; the full sheet was reviewed in session).

**Source / generator.** All 13 were made by ReportLab on 12–13 May 2026 (`Producer: ReportLab PDF Library`). **No generator or source exists in the repository**, so they cannot be reproduced or corrected except by hand. The registry marks every one `"status": "ready-draft"`.

**Two unrelated templates.** Five files (both checklists, the Cyber Risk Assessment sample, Managed Workplace, Ecosystem Overview) use a "Digerati Experts · Cybersecurity-first IT" template with a footer reading *"Prepared as sample/educational resource content. Customize before client-specific use."* The other eight use a "DIGERATI EXPERTS" template whose footer reads *"Draft resource content for site publication"*. Neither shows the logo.

| Area | Finding | Severity |
|---|---|---|
| Truth | ProActive IT and Office datasheets contradict the canonical tier inclusions in `client/src/data/pricing.ts` (e.g. Office says 24/7 SOC and security awareness are add-ons; `pricing.ts` includes both). Detail in `CONTENT-CHANGES.md` §A. | **High** (Tier 0 business correctness) |
| Truth | Monthly minimums ($1,600 / $2,400 / $5,400 / $9,000) are absent; only IT and Office show a rate. The rate is printed without its minimum. | High |
| Truth | Office: "Support is designed around 8x5 operations" — not found in `pricing.ts`, the SLA page or the claims register. | Review |
| Truth | Security Readiness Checklist contains a "Fast Scoring Guide" (0–2 / 3–5 / 6+ answers). It is existing content, not invented, but it is an unvalidated scoring method. | Review (Joe) |
| Public wording | 8 files say "Draft resource content" and 5 say "Customize before client-specific use" in every footer, on the public website. | High |
| Accessibility | Untagged; no document title (`(anonymous)`); no `/Lang`; fonts not embedded (Helvetica Type 1, no ToUnicode). | High |
| Accessibility | Table header rows render as solid dark bars: the header text is present in the file but drawn dark-on-dark, so it is invisible (`evidence/before-checklist-table-1.png`). | High |
| Navigation | No live links anywhere: every CTA ("Schedule a Cyber Risk Assessment") is plain text with no URL, phone or email. No bookmarks. | High |
| Layout | Orphaned headings: "Recommended Next Step" (both checklists), "Best Fit" (Managed Workplace) and "Common Add-On Areas" (Overview) end page 1 with their body on page 2. Five files carry a second page holding 1–3 lines. | Medium |
| Checklists | No checkboxes: the status column prints "Yes / No / Unknown" as text; no notes space. | Medium |
| Brand | Label cells use a saturated blue `#0056F5`, close to the Joe-decided Store-only electric blue; "DIGERATI EXPERTS" set in Helvetica instead of the logo; table cells use a cyan `#27CAF2` rule from no current token. | Medium |
| Hierarchy | One body size (≈8.5–9 pt) for everything below the title; long bullet lists with identical weight; no visual for the tier ladder that every datasheet describes in prose. | Medium |
| Page count / size | 2 pages each; 4.5–5.3 KB each. Small because nothing is embedded. | Info |
| Naming | Company named correctly ("Digerati Experts") throughout. No customer names, logos, testimonials or metrics. Sample reports labelled "sample" in the title but not prominently EXAMPLE on each finding. | OK / Low |

## 2. The three concepts

All three keep the Tier 1 identity (premium, cybersecurity-first, precise, trustworthy; never cyberpunk, hacker or generic SaaS) and the Tier 0 rules. All three use the logo from `brand/` unchanged; gold appears only in the mark. Same content, same claims, same CTA, same two Letter pages.

### A — Editorial clarity (`out/concept-a-proactive-it-datasheet.pdf`)
- **Hypothesis.** A buyer trusts a document that reads like a considered publication. Restraint signals confidence.
- **Keeps.** Warm paper `#F7F5F2` as the page, graphite ink `#050312`, magenta as a hairline and folio accent only, Inter for text.
- **Changes.** Adds a serif display face (Newsreader) for headings and a standfirst; replaces Space Grotesk/Oxanium in documents. Numbered list rows replace bullets. The ladder is set as type, not drawn.
- **Strengths.** The most premium and calm; excellent reading rhythm.
- **Weaknesses.** Least scannable; status of "included / not included" relies on section headings, not a matrix. Full-bleed paper prints as a light tint on office printers.

### B — Technical precision (`out/concept-b-proactive-it-datasheet.pdf`)
- **Hypothesis.** A cybersecurity buyer trusts precision they can audit: numbered sections, a document ID and revision, a scope matrix that says what is included, what is not and where it begins, and an annotated diagram.
- **Keeps.** Graphite + white, Space Grotesk headings, Inter text, magenta only for section numbers and one CTA rule.
- **Changes.** Adds IBM Plex Mono for labels, IDs and diagram annotations in place of Oxanium (Plex Mono reads as engineering documentation, not as a HUD). Introduces the spec header (TYPE · DOC · REV · PAGE), the status glyph set (filled / half / open circle, always with words), and a drawn ladder diagram with real vector text.
- **Strengths.** Most scannable and most honest about scope; the patterns carry directly to checklists (numbered checks, status column, notes) and reports (findings tables, evidence, limitations, contents).
- **Weaknesses.** Densest of the three; mono labels need discipline to stay on the right side of "technical", not "terminal".

### C — Executive briefing (`out/concept-c-proactive-it-datasheet.pdf`)
- **Hypothesis.** The reader is an owner deciding, not studying. Lead with the decision, three takeaways and a fit check; compare all four levels in one table; close on a written recommendation.
- **Keeps.** Graphite, white, paper for the recommendation panel, Space Grotesk + Inter, magenta for takeaway numerals and the recommendation rule.
- **Changes.** A graphite masthead band with the reverse logo; "Bottom line / Three things to know / Fit check / Recommendation" structure.
- **Strengths.** Fastest to a decision; the four-level comparison table is the clearest pricing view of the three.
- **Weaknesses.** The three takeaways and the fit-check column are editorial synthesis of existing facts (recorded in the register); the heavy band costs toner and does not suit a checklist. Strongest for reports' executive summaries, weakest as a whole-family system.

### Joe-decided items
No concept challenges a Joe-decided item. Gold stays the mark only. The current PDFs' saturated blue and cyan are **removed**; the blue sat close to the Store-only electric blue that Joe locked to the Store. The type changes (Newsreader in A, Plex Mono in B) are Tier 2 changes, not Joe-decided ones; they are flagged here because they extend the type stack for documents.

## 3. Recommendation

**B, Technical precision, as the system**, borrowing one pattern from C: its "Bottom line + three things to know" block becomes the executive-summary component in reports.

Why: the brief asks for precision, evidence, readable tables and sharp diagrams, and asks checklists and reports to work as tools. B is the only direction whose primitives (spec header, numbered sections, status matrix, annotated diagram, evidence tables) serve all three families without inventing structure, and it states scope boundaries most honestly, which is DE's own "every claim pairs with a boundary" voice. A is the more beautiful page, and its typography could be a fallback if Joe prefers warmth over density.

## 4. Verification of the concepts

`python3 artifacts/design-concepts/resource-pdfs/lib/verify.py artifacts/design-concepts/resource-pdfs/out/*.pdf`

| | Current | A | B | C |
|---|---|---|---|---|
| Tagged, structure tree | no | yes (H1, H2, L/LI, Table, Link) | yes (+ Figure with alt text) | yes |
| Title / `/Lang` / DisplayDocTitle | none | yes | yes | yes |
| Fonts | Helvetica, not embedded | CID TrueType, embedded subsets, ToUnicode | same | same |
| Live links | 0 | 3 (booking URL, tel, mailto) | 3 | 3 |
| Size | 5 KB | 74 KB | 104 KB | 95 KB |
| Grayscale legible | yes | yes | yes | yes |

Contrast of every text colour pair, computed (WCAG): lowest is 5.88:1 (magenta text on tint). Brand magenta `#D3126A` (5.17:1 on white) is used only for non-text rules; text uses the darker `#B80F5C`.

Viewport simulations (`evidence/viewport/`): page 1 of each concept rendered fit-to-width at 390 and 768 (2× density) and 1440 (1×). At 390 fit-width, 9 pt body text is about 6 CSS px, so phone readers pinch-zoom, as with any fixed Letter page. The text is vector, so it stays sharp at every zoom level (`evidence/zoom-*.png`, 150 dpi). These are simulations, not real viewer captures.

Not yet done (phase 3, after the pick): a PDF/UA checker run (veraPDF is not installed here, so **no PDF/UA claim is made**), reading the PDFs in real phone/tablet viewers through the site at 390 / 768 / 1440, and print tests.

A finding fixed during the build: Chromium embeds **variable** fonts as Type 3, which prints poorly and fails checkers. The system uses static instances (`fonts/README.md`); `verify.py` fails any Type 3 font.

## 5. Site-wide capability (Joe, 2026-10-03)

Joe asked for the document system to be usable site-wide. Proposal for phase 2:

- One shared document system (tokens, the three family layouts, header/footer/table/callout/diagram primitives, the renderer and `verify.py`) lives in one place in the repo, not under `artifacts/`.
- The 13 resource PDFs are its first consumers, generated offline into `client/public/assets/resources/` (same URLs).
- Server-generated documents (Store quotes/orders/receipts, solution packets) could adopt the same tokens later. **That overlaps open PR #339** (`server/pdf/dePdfBrand.ts`, "one branded document family for quotes, orders and receipts") and #308; adoption needs coordination with that work and is not part of this brief until Joe says so.

## 6. Questions for Joe

1. **Direction:** A, B (recommended) or C — or B with A's serif headings?
2. **Site-wide scope:** should the system's location and tokens be designed now so Store PDFs (#339) can adopt them later, or should it also *replace* the Store document styling in this task?
3. **Content register items** in `CONTENT-CHANGES.md` marked "Joe".
