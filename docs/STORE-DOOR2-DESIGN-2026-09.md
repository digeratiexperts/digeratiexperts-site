# Store (Door 2) redesign — "One Solution, assembling"

**Status:** design of record for the public Store rebuild, 2026-09-28. Written against Baseline A
(`artifacts/visual-qa/store-experience/baseline/`, commit 9c161401) and the seven-reader map
(`store-map.json`: `constraint_set` is law, `defects_ranked` must become impossible).
**Lens:** conversion and trust without lies. **Owner direction (Joe, 2026-09-27):** a fun, modern
store that engages, automates, leads and is feature-rich around real use cases. **Fulfillment rule
(Joe, 2026-09-27, binding):** remote support and shipping come before Truck-Roll, Trip Charge and
Tech Labor, everywhere, by default.

Locks honoured without exception: electric accent (`data-accent="electric"`), magenta `#D3126A`
primary CTA only, gold logo-only, foundation tokens and type; no payment, no cart vocabulary, no
vendor catalog, no fabricated proof, no universal assessment, four contact fields, profile once,
Client Marketplace `returnTo`, "Digerati Experts" / "DE"; routes, `de-solution-draft-v2` and
`/api/public/solutions/request` kept and extended, never replaced.

---

## 1. Thesis

The Store is one object — **Your Solution** — that the buyer watches assemble while they answer.
Every screen is a view of the same draft; no question is asked twice; the persistent Solution Rail
is the store. Delight comes from the object reacting truthfully: quantities size themselves the
moment the profile is complete, the relationship is suggested from the profile with its reason,
Delivery & Setup defaults itself to the earliest remote-first option each package supports, the
eight-block security map fills in as structure, and the rail turns from "assembling" to "ready"
before the buyer's eyes. The funnel leaks today because the same question (relationship) is asked
twice with different semantics, the family page hides all value behind that question, "Help me
choose" is a dead end, and the flow ends in a UUID under someone else's heading. The redesign makes
each of those states impossible: one relationship owner, value before choice, "Help me choose" as
a submittable state, and a confirmation that is a real page which does work.

## 2. Decisions taken (each closes an `open_questions_for_owner` item)

| # | Decision | Reason |
|---|---|---|
| D1 | **Relationship is one choice per solution.** Owner = `draft.deliveryPreference`. `needs[].delivery` is no longer a display source (kept in the type for parsing old drafts; on read, if every need carries the same value and the global is empty, the value is lifted to the global; otherwise ignored). | map:contradictions #1 and map:defects_ranked #1. A co-managed relationship is with the company, not per family (docs/STORE-SOLUTION-ENGINE.md one-owner table). |
| D2 | **"Help me choose" is submittable** as `intent: "consultation"`, `deliveryPreference: "unsure"`. The button says *Submit & have DE recommend*. Before that, "Help me choose" does real work: it derives a suggestion from `internalIt` (no internal IT → Standalone, because Co-Managed's prerequisite is a named internal IT owner; yes → Co-Managed; not sure → leave it with DE) and shows the reason. | map:defects_ranked #2; docs/PUBLIC-SOLUTION-BUILDER.md "ask DE to recommend". |
| D3 | **The whole flow lives under `/store`.** Canonical contact route `/store/solution/contact`; `/solutions/request` stays as an alias (existing links, `requestPath()`, tests). Confirmation is its own route `/store/solution/submitted`. Both added to `storeLegacyRedirects.ts` public set and `spaKnownPaths.ts`. | map:defects_ranked #16 — the last step visibly left the Store (magenta, no atmosphere, dark cookie bar). Colour lock names `/store/*`, so moving the route needs no lock change. |
| D4 | **One step sequence, six steps, numbered once:** 01 Profile · 02 Needs · 03 Relationship · 04 Package · 05 Delivery & Setup · 06 Contact. One exported `STORE_STEPS` constant drives every eyebrow and the rail; docs and `door2Leakage.test.ts` locks are renumbered in the same PR. | map:defects_ranked #29. |
| D5 | **Three names, three jobs:** the nav item and page is **Store**; the V4 pathway is **Solve a Business Need**; the object is **Your Solution**. "Business Solution Builder", "IT Solutions Store" and "Open the Solution Builder" are retired from copy and titles. Staff `ShoppingCart` title is renamed "Warehouse Cart" so "Your Solution" is Door 2 only. | map:defects_ranked #12, map:ux_gaps #12. |
| D6 | **Delivery & Setup is per package, remote-first, defaulted.** Each package card carries its own Delivery row; the default is the earliest option that package supports in the order remote setup → shipped + self-install → on-site. Remote-support preference stays one question per solution, defaulting to "as needed". | Joe's fulfillment rule; map:defects_ranked #4 (union gating, stale selections) becomes impossible because there is no cross-package set. |
| D7 | **One help affordance on every Door 2 screen:** the Solution Rail footer carries *Ask DE* (seeded with the solution) and *Call 325-480-9870* from `PRIMARY_PHONE`. `SiteBottomBar` is hidden on all Door 2 routes (today it shows on `/store` only, which is the inconsistency). The dock is kept sitewide (Joe, 2026-08-27); this only extends the existing `hideDoor2HelpDock` rule to the index. | map:defects_ranked #35; STORE-ARCHITECTURE-DESIGN "exactly one help option". |
| D8 | **Marketing chrome yields to task chrome:** announcement strip suppressed on `isDoor2Path`; footer keeps its columns but its CTA block becomes *Back to your solution* on Door 2. | UI-STYLE-RULES §6 catalog/utility; map:defects_ranked #61. |
| D9 | **Persistent object is a rail, not a chip.** Desktop: sticky right column on all four screens. Phone/tablet: a full-width bottom bar (`de-fixed-in-canvas`) publishing `--de-store-cart-h`, opening a bottom sheet with an internal scroll region and pinned footer. The corner chip is REPLACED (reason: it overlapped the profile pill and shared the Desk corner at 390, and it vanished on the workspace and contact screens). | map:defects_ranked #9, #10; map:ux_gaps #4, #5. |
| D10 | **Confirmation survives refresh and does work.** On success the draft is archived to `de-solution-submitted-v1` (profile kept in the live draft, needs cleared), the page navigates to `/store/solution/submitted?ref=DE-XXXXXX`, and a status-only endpoint answers "we already have this" on replay without returning PII. | map:defects_ranked #18, #19, #22. |
| D11 | **Icon tints consolidate to electric.** The 13-hue `FAMILY_ACCENTS` map is REPLACED by one `IconWell` treatment (reason: unguarded rainbow incl. violet/indigo that `index.css` bars from accents; CRITIQUE "three card dialects and a rainbow"). | map:contradictions "Colour lock scope". |
| D12 | **Honest persistence copy.** "Saved to DE in this browser" until the server reports `durable: true`; a resume link is offered only then, with the plain warning "Anyone with this link can open your draft". | map:defects_ranked #8, #20. |

## 3. The flow (six steps, four screens plus confirmation)

| Step | Route | Job | The buyer sees | The buyer does | State carried | Exits |
|---|---|---|---|---|---|---|
| Arrive & start | `/store` | Recognise the pressure, start a solution in one tap | Short hero (one line, one accent word), six **scenario starters** built from the 13 families, the compact **Size to your business** profile bar, the catalog grouped by the five goals as hairline rows, the Solution Rail (empty state: "Nothing here yet — pick a starter or a need") | Taps a starter (adds its families, proposes a relationship) or adds a need from a row; fills the profile bar when prompted (quantities animate in across the page) | `needs[]`, `environment` | Family row → `/store/solutions/:family`; rail → `/store/solution`; header line → Handle Our IT, Client Marketplace |
| Understand one need | `/store/solutions/:family` | See the value before any commercial choice; compare the two ways to work with DE | Outcomes and description first; **side-by-side comparison** Standalone vs Co-Managed (who does what, pricing position, sized package lines, prerequisites, boundaries); segmented control Standalone / Co-Managed / Help me choose with the profile-derived suggestion and its reason; Delivery & Setup preview already defaulted remote-first; security blocks this family covers | Picks a relationship (applies to the whole solution; the rail says so) or leaves it with DE; *Add to Your Solution* (or *Included — keep browsing* if already added) | `needs[]` (+ `installation` default), `deliveryPreference` | Back to Store; rail → workspace; "Need DE to run IT instead?" → `/solutions/proactive-ecosystem` |
| Review the whole | `/store/solution` (+ `/store/checkout` alias) | Confirm the composed solution is right, adjust, save | Numbered chapters separated by hairlines (not islands): 01 Profile (compact, editable inline), 02 Needs (rows with *Change* → family page, *Remove* with Undo), 03 Relationship (one segmented control; if "unsure", the "DE will recommend" badge), 04 Packages (one raised card per need: sized lines, assessment policy, security blocks), 05 Delivery & Setup (inside each package card, remote-first order, default preselected; one remote-support question), **Security coverage** (eight blocks as structure), Save / Print row | Edits anything; *Print or save summary*; *Save to DE* (debounced auto-PUT after first need + profile); *Continue to contact details* | Whole draft; server `request.id` + `reference` in draft meta | Contact; back to any family; Ask DE seeded with the summary |
| Tell DE who | `/store/solution/contact` (`/solutions/request` alias) | Hand over with confidence | Paper chapter (the page's one relief/loud moment): left, a read-only *What you're sending* summary in public labels (never enums); right, a white card with exactly Company name / Name / Email / Phone, per-field validation, the sanctioned line "No payment is taken here. DE confirms package fit, scope, fulfillment, and pricing before commitment.", and *What happens next* (three honest steps) | Fills four fields; *Submit Solution* (or *Submit & have DE recommend* when unsure) | POST body incl. `selectedNeeds[].installation`, `reference` returned | Back to Your Solution; phone; Ask DE |
| Done | `/store/solution/submitted?ref=` | Prove it landed and lead the next step | H1 "Your solution is with DE", reference `DE-XXXXXX`, the submitted summary, contact echo, *What DE does next*, honest durability line if pending, actions ordered by policy | *Print or save summary*; *Book the required assessment* (only when policy = required) → `/book?ref=`; *Ask DE about this solution*; *Start another solution*; call | Archive only; live draft keeps profile | Store, `/book`, Ask DE |

## 4. Screens

### 4.1 `/store` — Store index
**1440:** nav (no announcement strip) → hero band on `--de-bg` with the electric atmosphere at low intensity: eyebrow `STORE`, H1 "Tell us what hurts. Watch the solution build." (one electric word), one-sentence subcopy "Pick a business need. DE sizes the package from your profile, suggests how to work together and shows delivery before you ever share an email.", quiet line "Other ways to work with DE: Handle Our IT · Client Marketplace". Below the hairline: two columns, 1fr + 21rem sticky rail. Left: **Scenario starters** (2×3 grid of choice tiles, `data-de-jelly-choice`): "A phishing email almost worked" → Cybersecurity Operations + Security Awareness + Email & Collaboration; "Cyber-insurance renewal asks questions we can't answer" → Identity & Access + Backup & Continuity + Compliance & Risk; "We're opening another location" → Network & Connectivity + Business Communications + Hardware & Lifecycle; "New hires need laptops fast" → Hardware & Lifecycle + Endpoint & Device Management; "Our one IT person is drowning" → IT Operations & Support + Endpoint & Device Management (suggests Co-Managed); "An auditor wants evidence" → Compliance & Risk + Documentation & Standards. Each tile names the families it adds; tapping adds them (Undo in the rail) and scrolls to the profile bar if the profile is empty. Then **Size to your business** — one row: four numeric inputs (Users, Computers, Mobile devices, Sites) + two segmented controls (Ownership, Internal IT); status text "Add your counts and every package sizes itself" → "Sized for 25 users · 30 computers · 15 mobile · 1 site". Then the catalog: five goal groups, each an H2 with a hairline and its families as rows (IconWell, label, one-line description, one outcome, *Add* / *Included* toggle, chevron to the family page). Search filters rows with a polite live count.
**390:** hero (2 lines), starters as a 2-column grid of compact tiles, profile bar stacks to 2×2 + two segmented rows, goal groups as plain lists. Bottom bar "Your Solution · 0" pinned above the cookie banner. Above the fold: H1, subcopy, first two starters. Target height ≤ 5 viewports (from 11.4).
**Primitives:** `StoreHero`, `ScenarioStarterTile` (new), `ProfileBar` (upgraded `SolutionProfileForm`, compact variant), `GoalGroup` + `FamilyRow` (new, replaces card grid), `SolutionRail` (new), `IconWell`, `Button`.
**States:** empty rail; profile partial ("2 of 6 set — sites and internal IT still needed", per-field hints incl. which counts may be 0); search no-results (Clear search + Clear goal); need added (row → *Included*, rail count pulses once); starter added (rail lists families with "from: A phishing email almost worked"); reduced motion: all instant.
**Copy:** "Standalone means you or your IT provider run it day to day." · "Co-Managed means your IT team and DE share the work." · "No payment here. DE confirms fit, scope, delivery and pricing before anything is committed."

### 4.2 `/store/solutions/:family`
**1440:** back link → header: eyebrow `02 · NEEDS`, H1 family label, description, three outcomes as a hairline list. Then **"Two ways to work with DE on this"**: a segmented control (native radios styled as tiles, arrow-key navigable) Standalone · Co-Managed · Help me choose, under it the suggestion line "Suggested from your profile: Standalone — you told us there's no internal IT team to share the work with. You can change this any time." Below, two equal columns (raised cards, the only cards on the page): offer name (public view), "Who does what" (relationship summary), pricing position label, sized package lines (from the profile; "Per covered user" when unsized), prerequisites, boundaries; the selected column gains the electric active border; unselected stays readable (never hidden). Delivery & Setup preview: one row "Delivery & Setup for this package: Remote setup by DE (default) · Shipped equipment with self-install · On-site technician — last resort, Truck-Roll, Trip Charge and Tech Labor apply", showing only modes the policy supports, in that order. Security blocks: "This need covers: Identity & Access" as chips (structure only). Primary: *Add to Your Solution* (magenta) — or *Included · Keep browsing* + *Review Your Solution* when already included. Secondary text link "Need DE to run all of IT instead? See Handle Our IT."
**390:** header, segmented control (3 stacked tiles), the two columns become a swipe-free vertical stack with the selected offer first and the other collapsed to a summary with *Compare*; primary button in the bottom bar's expanded state.
**Primitives:** `RelationshipChooser` (new single-select primitive, reused on workspace), `OfferCompareCard`, `DeliveryPreviewRow`, `CoverageChips`, `SolutionRail`.
**States:** unsized profile (lines read "Per covered user"; a one-line prompt "Add your counts to size this" links to the rail's profile editor); suggestion available / no suggestion (internal IT not sure → "Not sure? Leave it with DE and we'll recommend"); included; unknown family → generic 404.

### 4.3 `/store/solution` — Your Solution
**1440:** eyebrow `YOUR SOLUTION`, H1 "Your solution, assembled", subcopy "Profile → needs → relationship → package → delivery & setup → contact. One draft, every step." Chapters separated by hairlines with Oxanium step numbers; only package cards are raised containers. 01 Profile: compact summary with inline edit (ProfileBar). 02 Needs: rows with *Change* and *Remove* (Undo snackbar). 03 Relationship: `RelationshipChooser` + suggestion line; if unsure, badge "DE will recommend after you submit". 04/05 Packages: one raised card per need — header (offer name, relationship, pricing position, assessment policy label), lines with quantities, then **Delivery & Setup** inside the card: install options in the locked order with the default preselected and the sentence "Default: the earliest remote-first option this package supports", shipment copy, technician copy naming Truck-Roll, Trip Charge and Tech Labor as last resort. Below all cards, one question "Remote support after setup" (As needed · Ongoing · None). **Security coverage** chapter: the eight blocks as a 4×2 grid of hairline cells; each cell lists the selected families that cover it or "Not in this solution — add Identity & Access"; Browser & Web reads "Not a standalone family — part of DE's managed protection" (honest exit to Door 1). Save row: "Saved to DE in this browser · 2:14 PM" / "Saved to DE — Copy resume link" when durable; *Print or save summary*. Sticky rail: six rows with state, the one primary *Continue to contact details* (magenta only when ready, otherwise a described disabled state naming the missing item), Ask DE, phone.
**390:** chapters stack; the rail becomes the bottom bar; *Continue* lives in the bar so it is never below four sections.
**States:** empty (no needs → "Your solution is empty" + starters shortcut); partial (rail names the exact missing item); ready; saving (button spinner, live region "Saving…"); save error ("Couldn't reach DE — your draft is still saved in this browser. Retry"); success (timestamp); unsure relationship (packages show the comparison summary, delivery still selectable because policy is per family).

### 4.4 `/store/solution/contact`
**1440:** paper chapter on `--de-paper`. Left column: *What you're sending* — profile, relationship in public words ("Co-Managed · preferred pricing where it applies" or "Left with DE to recommend"), one line per package with its delivery choice in public labels, remote support label. Right: white card, H1 "Who should DE follow up with?", eyebrow `06 · CONTACT`, four fields with labels, `aria-invalid` + described-by messages, focus to first invalid; the sanctioned no-payment line; *What happens next*: "1. DE reviews fit, scope, delivery and pricing. 2. DE contacts you at the email and phone you give here. 3. Nothing is committed until you approve." Primary *Submit Solution* (magenta). Secondary: "Prefer to talk? Call 325-480-9870". 
**390:** summary collapses to an accordion "What you're sending (2 packages)"; the card and submit are the fold.
**States:** invalid field; server 400 (message from server); 503 durable-required ("DE couldn't save this right now. Your draft is safe in this browser — try again or call 325-480-9870"); submitting; success → navigate.

### 4.5 `/store/solution/submitted`
**1440/390:** `role="status"` region receives focus. H1 "Your solution is with DE". Reference `DE-XXXXXX` (Oxanium) with "Quote this if you call". Submitted summary (read from the archive; never refetched with PII). Contact echo. *What DE does next* (same three honest lines; if the server reported `durable: "pending"`: "Your request is recorded and queued; if you don't hear from DE, call and quote the reference"). Actions in policy order: *Book the required assessment* (only when any package is `required`; → `/book?ref=`), *Print or save summary*, *Ask DE about this solution* (seed includes the reference and family names), *Start another solution* (keeps profile), phone. Replay: banner "We already have this request as DE-XXXXXX". Direct visit without archive: "No submitted solution on this device" + link to Store.

## 5. Automate · Lead · Feature-rich (what the data lets us do truthfully)

- **Size** every package line from the profile via explicit per-line bases (replacing the keyword regex), pluralised, "Per covered user / Per approved device / Per site / Included once" when unsized.
- **Suggest** the relationship from `internalIt` with the reason shown; never silently applied.
- **Compose** solutions from six scenario starters that map onto existing families only.
- **Default** Delivery & Setup to the earliest remote-first supported mode per package; on-site is a last resort named for its cost.
- **Route** the intent from policy on both client and server (`assessment` if any package requires it, `consultation` if the relationship is unsure, else `quote`); the URL `?intent=` is at most a label hint.
- **Save** locally always; PUT to DE debounced once profile + one need exist; resume link only when durable.
- **Lead**: rail always names the single next thing; the confirmation orders actions by policy; CRM description carries the sized package, delivery choices and assessment policy so DE can act.
- **Coverage**: eight blocks as structure, never a score.
- **Print/save summary** (print stylesheet, no pricing), **Ask DE** seeded with the solution, **phone** everywhere.

## 6. Visual system

One theme, the electric channel. Field steps: hero on `--de-bg` with the existing `StorePageAtmosphere` at ≤ 0.6 of today's intensity; catalog and workspace on `--de-surface` with `--de-hairline` seams; raised `--de-raised` only for package cards, offer comparison cards and the rail; the contact step on `--de-paper` with a white card — the page's single relief/loud moment, and the only magenta fill is the submit / continue button. Electric is wayfinding: eyebrows, active borders, step numbers, links, IconWell glyphs — never a wash. Type: Space Grotesk headings, Inter body, Oxanium only for step numbers and the reference. Card discipline: rows and hairlines by default; a container only where the buyer holds something (a package, the rail). Motion communicates state: choice tiles press/settle (`data-de-jelly-choice`), quantities tween in once when the profile completes, rail rows tick, the count badge pulses once on add, Undo snackbar slides from the bottom bar; no mount animations on already-selected controls (transient `data-de-just-selected` instead of steady `aria-checked`). `prefers-reduced-motion` collapses everything to instant. No HUD, counters, fake availability or telemetry anywhere.

## 7. Truth rules

1. Never show a price, ETA, ship date, response time, SLA, availability or "replies in minutes".
2. Standalone copy never says DE manages, operates or runs anything; Co-Managed never promises a discount, only "preferred pricing where it applies".
3. "Help me choose" never becomes a relationship on its own; a suggestion is labelled "Suggested from your profile" with its reason.
4. Assessment appears only where package policy says `required`/`recommended`; the strip and footer never sell it on Door 2.
5. Security coverage is structure ("covered by / not in this solution"), never a score or percentage; `8 BLOCKS` wording only where genuinely covered.
6. Persistence copy matches the server's `durable` flag; the resume link carries its access warning.
7. Confirmation states what DE does next in plain steps, without time promises; pending durability is said out loud.
8. Raw enum values never reach the buyer; every enum has one label map next to the policy layer.
9. Company is "Digerati Experts" or "DE"; phone only from `PRIMARY_PHONE`.
10. On-site work is always the last option, named "On-site technician — Truck-Roll, Trip Charge and Tech Labor apply", scope-dependent.

## 8. Data and server changes

Client policy (`client/src/lib/solutionPackage.ts`):
- `INSTALL_MODE_ORDER = ["remote_assist", "self_install", "onsite"] as const`; `installModes` in every `FAMILY_PACKAGE_POLICY` entry is normalised through it; export `defaultInstallMode(policy)` = first supported; export `INSTALL_MODE_LABELS` (remote_assist "Remote setup by DE", self_install "Shipped to you · self-install with remote guidance", onsite "On-site technician · Truck-Roll, Trip Charge and Tech Labor apply") and `SUPPORT_LABELS`, `RELATIONSHIP_LABELS`.
- `technicianCopy`: not_needed → "Not offered for this package — everything is done remotely."; available → "Available as a last resort when remote setup and shipped equipment cannot do the job. Truck-Roll, Trip Charge and Tech Labor apply."; scope_dependent → "Only when the approved design needs hands-on installation. Truck-Roll, Trip Charge and Tech Labor apply."
- New `ADVISORY` policy (installModes `["remote_assist"]`, shipment none, technician not_needed) for compliance_risk, documentation_standards, technology_strategy.
- `remoteSupportAvailable` becomes a policy field.
- Line sizing: `includes` gain an explicit basis (`{label, basis: "user"|"device"|"site"|"once"}` in `curatedSolutions.ts`, copy-only change to labels where the naming canon requires: "Managed Physical Site Network", "Co-Managed Network"); golden test over all 26 offers.
- `coverageBlocksForFamily(familyId)` map (proposed: identity_access→Identity & Access; endpoint_devices→Endpoint; email_collaboration→Email & Collaboration; network_connectivity→Network; cybersecurity_operations→Detection & Response; security_awareness→Human Risk; compliance_risk→Risk & Exposure) — **Joe approves the mapping before it ships**.
- `suggestRelationship(environment)` → `{ value, reason } | null`.

Draft (`client/src/lib/solutionDraft.ts`, key `de-solution-draft-v2` kept):
- `needs[].installation?: InstallMode` (per package), `needs[].source?: string` (starter id); `needs[].delivery` parsed but not displayed; lift-to-global on read.
- `meta: { requestId?, reference?, savedAt?, durable? }`.
- `recommendedIntent`: `assessment` > `consultation` (any unresolved relationship) > `quote`.
- `archiveSubmittedDraft()` writes `de-solution-submitted-v1` and resets needs (profile kept); `clearSolutionDraft` gets its consumer.
- `FAMILY_IDS` derived from `curatedSolutionFamilies`.

Routes: add `/store/solution/contact` and `/store/solution/submitted` to `App.tsx`, `server/storeLegacyRedirects.ts` (public set), `server/spaKnownPaths.ts`; `/solutions/request` stays as alias rendering the same component; server 301s for `/solutions/business-needs[/:family]` → `/store[...]`. `isDoor2Path` covers the new routes; `hideDoor2HelpDock` covers `/store`.

Server (`server/publicSolutionRoutes.ts`, store, persistence, crm):
- PUT strips contact and notes (contract says so); rate-limit `apiGeneralRateLimiter` on all three, `formSubmissionRateLimiter` + honeypot on POST; `Cache-Control: no-store` on GET; cookie `secure` in production.
- POST: validate needs before persisting contact; require profile complete; recompute `intent` from `selectedNeeds × FAMILY_PACKAGE_POLICY`; accept `selectedNeeds[].installation`; reject/fork when the base record is already `submitted`; drop the unconditional re-mark to `pending`.
- Response adds `reference` (`DE-` + 6 unambiguous chars derived from the correlationId, stored on the record), `durable: true | "pending"` (bubbled from `persistPublicSolutionRequest`), `nextStep: "assessment" | "quote" | "consultation"`.
- New `GET /api/public/solutions/request/status?ref=` → `{ status, reference, submittedAt }` only (no PII).
- `LEAD_CREATED` emits the `WebsiteLeadLike` shape (name, email, company, phone, message = description) so the admin email and Hub outbox are not blank; CRM description appends per-package lines, quantities, delivery choice and assessment policy.
- `chrome`: `MegaMenu` skips the announcement strip on `isDoor2Path`; footer takes `variant="store"` swapping its CTA block; `.de-site-canvas` padding-bottom includes `--de-store-cart-h`; `STORE_ADVISOR_SEED` rewritten in Solution terms and scoped to `isDoor2Path` vs `isWarehousePath`.
- Docs in the same PR: PUBLIC-SOLUTION-BUILDER.md step renumbering and persistence description; STORE-SOLUTION-ENGINE.md durable-with-fallback; STORE-DOOR-2.md superseded banner; `design/STORE_DOOR2_GRAMMAR.md` (family row, offer compare card, package card, rail, confirmation) with approved/rejected screenshots.

## 9. Acceptance tests

1. `INSTALL_MODE_ORDER` equals `["remote_assist","self_install","onsite"]`; every `FAMILY_PACKAGE_POLICY[*].installModes` is in that order; `defaultInstallMode` never returns `onsite` when another mode is supported; rendered Delivery & Setup radios appear in that DOM order on family, workspace and contact summary; onsite label contains "Truck-Roll, Trip Charge and Tech Labor".
2. Golden table: `buildSolutionPackage` over all 26 offers with a fixed profile yields the expected quantity strings (no "1 computers", no "Included" where a basis exists).
3. Draft with `deliveryPreference: "unsure"` reaches `/store/solution/contact`, submit is enabled with label "Submit & have DE recommend", POST body has `intent: "consultation"`; server recomputes intent and ignores `?intent=quote` for a required-assessment package.
4. Relationship is asked in exactly one control per screen; changing it on the family page changes the rail on `/store/solution`; no need row shows a relationship different from the rail.
5. Family page renders both offers' package lines before any selection; `Add to Your Solution` is enabled once a relationship (incl. unsure) is chosen; already-included state renders "Included".
6. `suggestRelationship` returns Standalone for `internalIt: "no"`, Co-Managed for `"yes"`, null for `"unsure"`/empty, and the UI never writes the suggestion without a click.
7. After a successful POST: `de-solution-submitted-v1` exists, `de-solution-draft-v2.needs` is empty and `environment` unchanged, URL is `/store/solution/submitted?ref=DE-…`, `role="status"` heading has focus, reference is 9 chars; refresh keeps the page; a replayed POST renders the "already have this" banner.
8. Every Door 2 route renders under `data-accent="electric"`, with the white cookie surface, no announcement strip, no `SiteBottomBar`, exactly one Ask DE control and one `tel:` link from `PRIMARY_PHONE`.
9. Playwright at 390/768/1440: zero horizontal overflow on all five screens; no two fixed elements' rects intersect (bottom bar × cookie × toast × Desk launcher); index height at 390 ≤ 5 viewports; `--de-store-cart-h` is published and included in `.de-site-canvas` padding.
10. Axe: no violations; single-select controls are radios with arrow-key navigation; `aria-invalid` + described-by on invalid contact fields; search results announced; all decorative icons `aria-hidden`; text contrast ≥ 4.5:1 (no `text-white/40`).
11. `door2Leakage.test.ts` passes with the renumbered locks, new files added to its list, and still bans cart/vendor vocabulary; server tests: PUT ignores contact, POST 400 before persisting contact when needs are empty, 503 `DURABLE_DATABASE_REQUIRED`/`durable:"pending"` behaviour, status endpoint returns no contact fields, `LEAD_CREATED` payload carries name/email/company/phone.
12. Reduced motion: with `prefers-reduced-motion: reduce`, no element has a running animation or transition > 0ms after add / profile complete / route change.
13. Copy grep: no "Digerati " alone, no "Business Solution Builder", no raw enum strings (`co_managed`, `remote_assist`, `as_needed`) in rendered HTML; no price/ETA/SLA strings on any Door 2 route.
14. Bundle budget green; all new Store CSS ships in the Store chunk.

## 10. Mobile (390 / 768)
Bottom bar replaces the rail: one line "Your Solution · 2 needs · sized" + *Review* (index/family) or *Continue* (workspace) — the primary action is always in the bar. Its sheet has an internal scroll region and pinned footer with Ask DE + call. Everything positions via `--de-chrome-inset`, `--de-cookie-h`, `--de-unified-bar-h` (0 on Door 2) and publishes `--de-store-cart-h`; the Undo snackbar and toast viewport stack above it. No horizontal rails, so the gesture lock is gated on `.de-store-h-rail` presence (swipe-back returns). 768 keeps the bottom bar; the rail appears at ≥ 1024.

## 11. Risks
- Coverage-block mapping and scenario starters are new public claims: Joe approves both lists before launch.
- Moving the contact route under `/store` touches `storeLegacyRedirects.ts`, `spaKnownPaths.ts` and the sitemap; a miss yields a generic 404 in production.
- `door2Leakage.test.ts` string locks must be rewritten in the same PR or CI fails.
- The `claude-completion-program-lane` claim and PR #196 touch the same files; reconcile against `origin/main` first, never edit `server/storeQuoteCrm.ts`.
- CSS headroom is 4.87 kB in the entry sheet: every new style must load through the Store chunk.
- Hiding `SiteBottomBar` on `/store` extends an existing rule but Joe asked to keep the dock; if he prefers it on the index, the bottom bar already clears `--de-unified-bar-h`.
- Durable persistence may be memory-only in some environments; the honest `durable:"pending"` path must be rendered, not just returned.

**Effort:** XL (four screens rebuilt on shared primitives, a new rail/bottom bar, policy and draft extensions, two routes, server contract extensions, doc and test re-locks, and a full 390/768/1440 visual QA pass).
