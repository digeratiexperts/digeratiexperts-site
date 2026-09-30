# Store (Door 2) grammar

The public Store is the V4 homepage's sibling: the same hairline-and-space
vocabulary, the same six-size type scale and step-label form, one accent
channel (electric) instead of magenta, and catalog density instead of
marketing space. This note is the short version of
`docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md` §8–§12 for anyone touching
`client/src/pages/solutions/*`, `client/src/pages/store/*` or
`client/src/components/store/door2/*`. Evidence lives in
`artifacts/visual-qa/store-experience/` (`baseline/` is what was rejected,
`redesign/` is what was approved).

## Three shapes and one action

| Shape | Primitive | Rule |
|---|---|---|
| Chapter | `StoreChapter`, `StepLabel` | A top rule, a step label (`02 ── Pain or need` with the sr-only `Step 2 · Pain or need`), one h2, space. Never a rounded island. |
| Cell | `GridCell`, `HairGrid` | A top rule, a mono label, a title that is the cell's only link, one detail line, actions on one row. `--added` and `--current` turn the rule electric. |
| Tile | `ChoiceTiles` | A native radio inside a label. Hairline at rest, electric border and ink when checked, pink focus ring, the jelly settle on change only. Every exclusive choice in the Store is one of these. |
| Sheet | `PackageSheet`, `SheetRows` | Hairline rows, label left, Oxanium quantity right. Basis phrase in italics until the profile sizes it; then the numbers settle once. |
| Action | `StoreAction` | `primary` is magenta and appears once per screen. `secondary` is electric outline. `quiet` is underlined text. A disabled primary always names its reason. |

Raised surfaces (`--de-raised`) are spent on exactly two things: the sticky
`SolutionRail` and the `SolutionBar` sheet. Paper (`--de-paper`) appears where
the buyer signs (the contact card) and where the buyer holds the record (the
confirmation summary and print). Graphite is where the buyer builds.

## Colour

- Electric (`--de-accent-rgb 29 111 242`, ink `111 179 255`) is wayfinding and
  state: step numbers, the journey rail's fill, checked tiles, "Added ✓",
  quantities, links, "You are here", suggestion chips, touched coverage cells,
  the confirmation's hairline draw. Never a wash, never a filled panel.
- Magenta (`#D3126A`) is the one forward action per screen: Review Your
  Solution · Add & review package · Continue to contact details · Submit
  Solution · the locked assessment CTA when an assessment is required.
- Gold is the wordmark only. Violet, indigo and the thirteen per-family icon
  hues are gone: one electric `IconWell`.
- Focus ring: pink, 2px, offset 2, everywhere.

## Motion

Motion communicates state, hierarchy, continuity and feedback, never
decoration. The settle keys on a transient `data-de-just-selected`, so nothing
animates on first paint. The one loud moment is the electric hairline drawing
under the confirmation's h1. `prefers-reduced-motion: reduce` collapses every
transition and animation in `store-builder.css` to nothing in one media query.

## Copy

- "Digerati Experts" or "DE". The door is "Store" in nav, "Solve a business
  need" on the page. The object is "Your Solution". The action is "Submit
  Solution".
- Pricing is `Standard price`, `Preferred pricing` or `DE confirms`. Never a
  number, a percentage or "discount".
- Standalone: "DE builds it. You, or your IT provider, run it." Never "DE
  managed", "DE manages", "DE operates".
- Delivery & Setup is listed and defaulted in DE order: Remote DE setup →
  shipped or guided self-setup → On-site technician (Truck-Roll, Trip Charge
  and Tech Labor). Never a ship date or an ETA.
- Persistence: "Saved on this device" / "Saved to DE" (only when the server
  said `durable: true`) / "DE's save service is unavailable right now".
- After submit: "Recorded with DE. Keep this reference." The reference is the
  record; no email is promised.

## Rejected (Baseline A, `artifacts/visual-qa/store-experience/baseline/`)

| Pattern | Why it was rejected | Where it was |
|---|---|---|
| Rainbow family icons (13 hues) | Reads as a generic catalog; violet and indigo are barred from accents | `01-index-*.png` |
| Boxed rounded cards for every section | Islands, not a page; the V4 sibling uses rules and space | `04-workspace-*.png` |
| Relationship asked on the family page and again on the workspace | Two owners of one fact; the buyer answered twice | `03-family-*.png`, `04-workspace-*.png` |
| Empty family page until a commercial choice | Nothing to compare before deciding | `03-family-*.png` |
| Floating "Your Solution" chip overlapping the dock at 390 | Two fixed elements sharing pixels | `01-index-390.png` |
| Toasts on add | Noise; the object itself should react | walk notes |
| Raw enums (`remote_assist`, `co_managed`) in the summary | Not the buyer's words | `05-request-*.png` |
| UUID as the confirmation's reference | Nothing a person can quote on the phone | `06-confirmation-*.png` |
| Landing mid-page after navigation | Scroll position kept across pushes | walk notes |

## Approved (`artifacts/visual-qa/store-experience/redesign/`)

| Pattern | File |
|---|---|
| Header band, the pathway line, the collapsed profile row, scenario starters with the incident phone line, goal groups of cells with a true Add need toggle | `01-index-*`, `02-index-scenario-*`, `05-index-profile-collapsed-*` |
| Both relationships side by side on shared rules, sized, no control | `08-family-*` |
| One relationship control, package sheets in three modes, coverage as structure, hints with reasons, Delivery & Setup in DE order with per-package resolution | `09-workspace-unchosen-*`, `10-workspace-help-me-choose-*`, `11-workspace-onsite-*`, `12-workspace-saved-*` |
| The paper card with four fields, per-field validation, the offline panel | `13-contact-*`, `14-contact-invalid-*`, `15-contact-503-*` |
| The held record: reference, status, next steps, the summary on paper | `17-submitted-*`, `19-submitted-no-archive-*` |
| The Your Solution sheet with the dock hidden beneath it | `06-index-sheet-390.png` |
