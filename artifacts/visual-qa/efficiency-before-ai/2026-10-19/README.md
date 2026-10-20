# /solutions/efficiency-before-ai — visual QA (2026-10-19)

Brief (Joe): "Serious from an IT and business perspective but fun and functional and eye candy from a design perspective."

Mode: **Maintenance** (a production page inside the current system). Tier 2 tokens, type and chapter primitives are kept; the new pieces are page-scoped interactives in `client/src/pages/solutions/efficiency/` with their own lazily loaded stylesheet. Every visual is drawn in code: no kie.ai or Recraft spend, no generated imagery.

## What is on the page

| Section | Piece | What it does |
| --- | --- | --- |
| Hero | Stack tower | Foundation bricks → operations → data and access → a shiny AI slab. "Pull a foundation brick" knocks the backup brick out and the stack tips. |
| The pitch | Hype bento | Lead pitch in the big card; each pitch is struck through as it scrolls into view, with the reality beneath. The lead card's noise bars settle. |
| The foundation | Self-check | Six gaps as checkboxes; each tick cracks a brick and tips the AI slab; verdict + CTA to `/book`. Labelled "Illustrative self-check, not an assessment." |
| The budget | Budget balancer | Move a basic into the AI pilot: its share of the bar slides across, the card is stamped "Cut to fund AI" and shows where the risk moves. Labelled "Illustrative: equal shares, no dollar figures." |

## Files

- `page-{390,768,1440}.png`: full page, initial state.
- `page-interacted-{390,1440}.png`: tower pulled, three gaps ticked, two lines cut.
- `widget-*-{390,1440}.png`: each piece before (`widget-x`) and after (`widget-x-on`) interaction.
- `megamenu-solutions-1440.png`, `mobile-menu-390.png`, `solutions-index-link-*.png`: the navigation entry points.

## Checks

- Horizontal overflow: 0px at 390, 768 and 1440, before and after interaction.
- axe (WCAG 2.0/2.1/2.2 A + AA): 0 violations at 390, 768 and 1440, before and after interaction.
- Keyboard: the tower toggle (Space, `aria-pressed`) and the checkboxes work without a pointer; result regions are `aria-live="polite"`.
- Reduced motion: every transition and the sheen are off; states still change, and the strike-through and settled bars show at once.
- Console: no page errors.
- Bundle: page stylesheet 13.3 kB (3.3 kB gzip) in its own chunk; entry stylesheet 298.8 kB of the 315 kB budget.

## Scorecard (premium-web-design rule 10)

| # | Category | Score | Note |
| --- | --- | --- | --- |
| 1 | Hierarchy and ensemble | 4 | Poster-style lead card leaves deliberate empty space at 1440; reads intentional, could carry more. |
| 2 | Theme discipline | 4 | Tier 2 tokens only; magenta for actions and foundation edges, violet only as light on the AI slab. Production chapter rhythm keeps more than one dark band (Maintenance). |
| 3 | Object / artifact consistency | 4 | Code-drawn objects in the hero, the wall and the bar; cards use IconWell. No generated objects (no spend approved). |
| 4 | Motion discipline | 5 | 150 / 320 / 900 ms, one easing, motion only on state change or first view. |
| 5 | Contrast and a11y | 5 | axe 0 at three widths, both states; keyboard verified. |
| 6 | Responsive operability | 5 | 0px overflow at three widths; tower shown on phones. |
| 7 | Content preservation | 5 | All earlier copy kept; the hero facts' order lives in the tower labels and the step rail. |
| 8 | Truth rules | 5 | No figures; both interactives labelled illustrative (`docs/CLAIMS-REGISTER.md`). |
| 9 | Performance | 5 | Lazy page chunk; entry CSS untouched by the widgets. |
| 10 | Code discipline | 5 | Pure model with tests (`efficiencyModel.test.ts`); page-scoped `.eba-*` CSS. |
| | **Total** | **47 / 50** | Target ≥ 45 met. |
