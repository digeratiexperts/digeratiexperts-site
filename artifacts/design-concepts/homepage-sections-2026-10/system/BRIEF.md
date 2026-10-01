# Homepage section mockups — design brief (2026-10-01)

**Ask (Joe, 2026-10-01):** "mock up every section on the live digeratiexperts.com homepage and make it look how it should look. just give images of your version for each section in order."

**Mode:** Exploration Mode, scoped to static mockups. Deliverable = one 1440px PNG per live section, in live order. Nothing here touches `client/`; production `/` is untouched. Joe picks; integration is a separate PR under the Product Preservation Law.

**Tier 0 holds (never relax):** real copy only; no invented clients, quotes, metrics, response times, partners, telemetry or faces; every number must already exist in the repo (the content inventory cites the file); classify sample artifacts `ILLUSTRATIVE` / `EXAMPLE FORMAT`; WCAG AA contrast; body copy ≥ 15px; targets ≥ 44px; no horizontal overflow at 390; no hover-only content; "Digerati Experts" / "DE", never "Digerati" alone; no vendor names in the hero.

**Tier 1 holds:** premium, cybersecurity-first, precise, trustworthy, principal-led, Arizona-accountable. Never cyberpunk, neon, hacker, generic SaaS, stock-photo driven, visually noisy.

**Tier 2 (the current system) is the base.** These mockups are "the current system executed properly", not a new system. Tokens, type stack, field ladder, accent doctrine and archetypes come from `system/tokens.css` (values from `client/src/index.css`) and `design/UI-STYLE-RULES.md`. What the mockups change from the live page is listed per section below and must be visible in the result.

## What is wrong with the live page (the diagnosis these mockups answer)

Live crops: `live/NN-*.webp` (1440px). Full-size originals were captured 2026-10-01 from production.

1. **Containers fight each other.** Rounded paper islands float in black, raised boxes sit inside wells, white cards sit inside islands, cards inside cards. The page reads as a stack of giant rounded cards instead of chapters.
2. **Heads are inconsistent.** Some left, some centered; eyebrows are plain caps here, a pill with a dot there, a chip with an icon elsewhere; the gradient accent lands on headings Joe did not list.
3. **Decoration without meaning.** Magenta dots on stat cards, arrows in every problem cell, glow rings, hover tabs that show one item at a time.
4. **Imagery that reads as stock.** Industries use five generic photos; "Why Arizona businesses work with us" and "Detection & response" use generated desk/office photos (laptop and office clichés, `design/IMAGERY.md`). The only real photograph is the founder's.
5. **Duplicated asks.** Two proof blocks in a row, two newsletter forms, three forms asking for the assessment, "Schedule Consultation" and "Call" twice within one chapter.
6. **Craft defects.** Feed card dates truncate; the ProActive Ecosystem preview is a leftover tab widget; the Greater Phoenix cities are six empty boxes; too much vertical padding everywhere; the Ask DE nudge sits on content.

## The system, applied (rules every section follows)

- **Canvas:** `.de-canvas` (max 1400px, 24px gutters). Section padding `.de-section` (64px). Heads are **left-aligned** on the canvas; the only centered composition is the final Next-step band and the lead form head.
- **One head recipe:** `.de-eyebrow` (tracked caps, magenta ink; no pill, no dot, no icon) → `.de-h2` → `.de-lede` (≤ 640px). A section's secondary link sits in the head row on the right (`display:flex; justify-content:space-between; align-items:end`), never orphaned below the grid.
- **Gradient accent (`.de-accent`) on exactly one word/phrase, only in:** hero H1 line 3, Stats, Services, Team ("Experts"), Proof. Nowhere else. Paper headings use the magenta colon (`.de-colon`) or nothing.
- **Field rhythm (the ladder), top to bottom:** hero well → trust strip (paper, attached) → Why we exist (paper band) → Stats (raised box) → Problems (paper band) → Services (surface) → Protection (paper band with one dark evidence panel) + How protection works (surface) → Proof (well) → Why Arizona (paper band) → Team (well) → Industries (surface) → Pricing (raised box) → Insights (well) → Lead form (paper band) → FAQ (paper band, hairline seam) → Compliance/newsletter/service area (surface) → Next step (paper band) → Contact (well) → Footer (chrome black). **Paper chapters are full-bleed bands (`.f-paper` section), not rounded islands.** Exactly two raised style boxes on the page (Stats, Pricing). Adjacent dark sections share a field and are separated by a hairline.
- **Cards:** one radius (16px), one hairline border, 24px padding; `.de-card` on dark, `.de-card--paper` on paper; hairline cell grids (`.de-cells`) for lists that are not cards. No glow, no scale on hover, no decorative dots or arrows. `IconWell` (`.de-iconwell`) for glyphs: Lucide only, 1.8 stroke; `node system/icon.mjs <name>` prints the SVG.
- **Actions:** per section at most one filled button (`.de-btn--primary`, magenta; hero primary is the violet gradient) plus one outline or text link. Keep every live CTA label and `href` (the inventory lists them); when the live section has three buttons, demote one to a text link, never delete the destination.
- **Numbers:** Oxanium (`.de-stat`, `.de-num`, `.de-seq`, `.de-meta`) for stats, sequence IDs, metadata. Never for paragraphs.
- **Evidence:** sample artifacts (assessment preview, document outline, diagram) carry a `.de-tag` with ILLUSTRATIVE or EXAMPLE FORMAT. HUD chrome (ticks, corner marks, Oxanium metadata) only on evidence modules and diagrams, never on FAQ, prose, forms or proof.
- **Photography:** the founder photo (`/client/public/images/founder/joe-petro-studio-blazer-white.webp`) and the hero city plate (`/attached_assets/de-hero-arizona-dusk-1600.webp`, faint, masked) are the only photographs. No stock, no generated desks/offices/dogs/scales.
- **Motion:** none in mockups.
- **Chrome:** the hero mock includes the approved site chrome (utility strip, black nav, spy row) so the image reads like the real fold; no promo strip, no cookie banner, no dock. Every other section is the section alone.
- **Width:** design for 1440. The CSS must also hold at 390 (grids collapse; no overflow); the render script fails on overflow. 390 is verification, 1440 is the deliverable.

## Section list and direction (live order)

Builders: read the matching block in `CONTENT-INVENTORY.md` for the real copy, then the live crop, then build. "Keep" = same copy and destinations. "Change" = what the mockup must do differently.

### 01 · Hero (`sections/01-hero.html`) — live `live/01-hero.webp`
Keep: chrome; eyebrow; the three-line H1 with the gradient on "Your Business"; sentence; primary (violet gradient) + "See Plans & Pricing" outline; the three check items + phone; positioning line; the assessment preview; the attached paper trust strip with its four cells. Change: the pronunciation card shrinks to one quiet row (wordmark-style "DIG·ER·AH·TEE", phonetic, a 40px "Hear it" chip) under the positioning line, so the fold is headline → action, not a dictionary entry. The assessment preview becomes a disciplined artifact: a dark window titled "Cyber Risk Assessment · overview", the four review areas as a 2×2 list, the posture bars (same sample values as `DashboardMockup.tsx`, tagged ILLUSTRATIVE PREVIEW), the three outcomes. City plate faint on the right under a mask, grid lines at ≤ 0.3 opacity, one violet radial. Nothing in the hero may be covered: leave the right-bottom 180×90px clear (where the Ask DE launcher lives).

### 02 · Why we exist (`02-why-we-exist.html`) — `live/01-hero.webp` bottom half
Keep: eyebrow, H2, lede, the three claims with their links, the "Ready to Secure Your Business?" line and both actions. Change: paper band, two columns: statement left; the three claims as one white hairline list right (title + body + magenta dash). The closing ask is one row under the statement: primary "Schedule Consultation" + "Call …" as outline-paper. Target height ≈ 520px at 1440.

### 03 · The threats are real (`03-threats-are-real.html`) — `live/02-stats.webp`
Keep everything (four sourced facts, link). Change: raised box; head row with "Full sourced facts" link on the right; cards equal height with IconWell, Oxanium number, statement, source line on a hairline; remove the magenta dots; faint violet echo in the box corner (≤ 0.12).

### 04 · What we tackle (`04-what-we-tackle.html`) — `live/03-challenges.webp`
Keep: head, "Full threat context" link, the six numbered problems, closing sentence + "Discuss Your Security Needs". Change: full-bleed paper band; 2×3 numbered list with hairline seams (`.de-seq` numbers), no arrows; closing row inside the band with the sentence left and the one button right.

### 05 · Cybersecurity-first managed IT (`05-services.html`) — `live/04-services.webp`
Keep: head (gradient on "Managed IT"), the three path cards with their links, the FULL OPERATIONS tag on ProActive Ecosystem, "Need one specific service? View Standalone Services", the ProActive Ecosystem stack items and "How the ProActive Ecosystem works". Change: surface field; the stack preview becomes a **stack rail**: every component visible at once as hairline cells (name + one-line role + "details" link from the inventory), no tabs, no "See full Protect process" orphan link. One head, one rail, one link.

### 06 · Eight blocks (`06-eight-blocks.html`) — `live/05-protection.webp`
Keep: head, the eight blocks and their copy (Risk & exposure continuous, never a ninth peer — Joe-decided), the selected block's purpose, the three assessment questions, boundary, scope/signals/outputs, the source footnote, and the four "How protection works" steps with "Full methodology". Change: paper band; the model becomes **one** dark evidence panel: left rail = seven blocks as a vertical list (Identity & Access selected), with Risk & exposure as a dashed continuous rail spanning the panel's bottom; right = reading pane for the selected block. Tag ILLUSTRATIVE · INTERACTIVE MODEL once. Then the four steps as a numbered hairline row on surface (`.de-seq` 01–04, IconWell, title, body).

### 07 · Client proof (`07-client-proof.html`) — `live/06-testimonials.webp`
Keep: head (gradient on "Outcomes"), the honesty copy, "Read us on Google", the three "What clients hire us to improve" items, case studies row with both buttons, the four verification surfaces (Client reviews, Client Bill of Rights, Trust Center, Case studies) with their copy and links, the serving line and phone. Change: well; one chapter instead of two: (1) three outcomes as hairline cells, (2) the honest reviews panel compact (`.de-card--inset`) beside the case-studies panel, (3) "Built for accountability you can verify:" as a four-cell rail where all four surfaces show at once (no tab switcher), (4) one quiet serving line. Demote the second "Get My Cyber Risk Assessment" to a text link; keep the primary once.

### 08 · Why Arizona businesses work with us (`08-why-arizona.html`) — `live/07-trust.webp`
Keep: eyebrow, H2 (no gradient — not on Joe's list; use plain ink), lede, the three points, the CTA. Change: paper band; right column replaces the generated laptop photo with a real-format artifact: an **assessment report outline**, EXAMPLE FORMAT, as a white document panel (title block "Cyber Risk Assessment — findings", section rows "Prioritized findings / Business-impact context / Right-sized recommendations", placeholder bars, no numbers, no client).

### 09 · Team (`09-team.html`) — `live/08-team.webp`
Keep: eyebrow, H2 (gradient on "your technology"), lede + "Meet the team", the founder photo, name, role, "Chandler, Arizona HQ", "Principal-Led Managed Security Operations" + paragraph, the three operations items, "Talk to an Expert". Change: well; photo as a 4:5 portrait card ≈ 400px wide with name/role in a caption bar; right: heading, paragraph, the three operations as a numbered hairline list (not three cards); one button.

### 10 · Industries (`10-industries.html`) — `live/09-industries.webp`
Keep: H2, subline, the five industries with their one-liners and "View …" links, "Get Industry-Specific Protection". Change: surface field; head left with the button in the head row; five equal hairline cells (IconWell light-on-dark, name, line, link); **no photos**.

### 11 · Pricing (`11-pricing.html`) — `live/10-pricing.webp`
Keep: all four models with prices, minimums, descriptions, bullets, links; FLAGSHIP CYBER on Business only; the fit paragraph; "Not just IT support — one operating model" copy; "Compare Everything" + "Pricing tools". Change: raised box; tighter cards (equal, `.de-seq` 01–04, Oxanium prices); the closing two-column row inside the box: copy left, two actions right; the estimate disclaimer as `.de-small`.

### 12 · Recent threats & insights (`12-threats-insights.html`) — `live/11-insights.webp`
Keep: H2 with colon, lede with the "Security Updates" link, four feed cards (use the inventory's real sample items or the honest loading/empty shell — never invent CVEs), the sources sentence, "View All Security Updates" + "Read the Digerati Journal"; the "Monitoring that ends with a person who owns the outcome" block with its four checks, two cards and CTA. Change: well; head left; feed cards white on dark with the full date visible (never truncated), tag + date on one row; the second block replaces the generated office photo with a three-step **diagram** (signal → human triage → named owner) on a dark inset, tagged ILLUSTRATIVE, drawn with hairlines and Oxanium labels only.

### 13 · Lead form (`13-lead-form.html`) — `live/12b-leadform.webp`
Keep: eyebrow, H2, lede, the three reassurance items, four fields, button, the three footers (complimentary / 24–48 hours / no obligation), "Prefer to call?". Change: paper band; two columns: statement + reassurances left, the white form card right; labels above fields, 48px inputs, one magenta button full width of the card.

### 14 · FAQ, compliance, newsletter, service area (`14-faq.html`) — `live/12-faq.webp`
Keep: all four questions and their answers; "Security & Compliance Support" line, note and chips; "Stay Updated" copy, field, button, topic chips, privacy line; the six Greater Phoenix cities. Change: paper band for the FAQ with the first answer open (real answer text), accordions as hairline rows (no pink border-left, no shadows); then one surface band in three parts: compliance chips row; newsletter card (left) and service area (right) as two equal dark cards, cities as a simple inline chip list.

### 15 · Next step (`15-next-step.html`) — `live/13-cta.webp`
Keep: eyebrow, H2, lede, the assessment-led line, the serving line, the four bullets, email field + button, "Or send a message below", "Prefer to call?". Change: paper band, centered, max 760px: the four bullets as one hairline row; field + button on one line; the two footers as one small row. Target height ≈ 560px.

### 16 · Contact and footer (`16-contact-footer.html`) — `live/14-contact.webp`
Keep: everything (details, hours, SOC line, social, the form with its fields, footer columns and links, newsletter, legal line). Change: well for contact (left details as a hairline list, right white form card, "Send Message" as the dark button); footer on chrome black with a hairline top: logo reverse, four link columns, newsletter + social under the logo, legal line; 40% less vertical air than live; page ends quiet.

## Build procedure (every builder)

1. Read your section's inventory block, the live crop (Read the webp), `system/tokens.css`, this brief.
2. Write `sections/NN-id.html`: `<link rel="stylesheet" href="../system/tokens.css">`, a `<style>` block for section-only rules, semantic HTML (`section`, `h2`, `ul`, `a`, `button`, `label`+`input`).
3. Render: `node system/render.mjs sections/NN-id.html --widths 1440,390`. Read `renders/NN-id-1440.png`. Critique it against this brief (hierarchy, spacing, alignment, decoration, truth). Fix. Re-render. At least two rounds; stop when the render is clean and the JSON line says `ok: true` for both widths.
4. Return the file path and a short list of what changed from live and why.

## Truth notes from the content inventory (binding)

- **Reviews are an honest empty state on the live page** (`/api/public/reviews` returns nothing; see inventory §7 and Appendix B). The proof mock shows the empty-state copy verbatim with "Read us on Google". No quotes, no stars, no counts.
- **Threat feed:** `data/threats-2026-10-01.json` is the live `/api/public/threats?scope=homepage` response captured 2026-10-01 (four CISA KEV items). Use those four items exactly (title, excerpt, kicker, sourceName, publishedAt formatted as "September 9, 2026", cve). Tag the rail `LIVE FEED · CAPTURED 2026-10-01`. Never invent a CVE.
- **Strings to leave out of the mocks because `docs/CLAIMS-REGISTER.md` records no source for them:** "Results in 24-48 hours" (lead form footer); the "Microsoft Partner" and "Apple Consultants" chips (newsletter block). Keep the other items in those rows. The contact section's "24/7 Security Operations Center Always Active" becomes the SLA-backed wording "24/7/365 emergency incident response" (`client/src/pages/legal/SLA.tsx`).
- **Images:** the five industry photographs and the "assessment desk" / "office evening" stills are not used (register row "Removed on purpose"; `design/IMAGERY.md`). The founder photo (`/client/public/images/founder/joe-petro-studio-blazer-white.webp`) and the hero city plate are used.
- **The hero assessment preview** keeps the `DashboardMockup.tsx` sample posture values (Identity 68, Endpoints 77, Email 61, Backups 84, Controls 56, Overall 69) only because they are the live illustrative sample; tag them ILLUSTRATIVE PREVIEW.
- **Pronunciation row** copy comes from inventory §1 (PronunciationCard); the audio is synthesized, so label the control "Hear it", nothing more.
