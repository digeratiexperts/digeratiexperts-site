# Store page redesign: three directions (2026-10-03)

**Joe's ask:** "the layers don't work … we need to design something good. Think of Shopify theme style or Amazon or any big SaaS company."

**Mode:** Exploration Mode, static mockups only (`frontend-design` + `web-design-rules`). Nothing in `client/` changes. Concept work, never merged as-is; the pick ships as its own PR.

**The diagnosis:** today the Store stacks dark cards straight on a dark page (L2 on L0) with no panel between them and almost no tonal step, so nothing separates. Every direction below fixes the elevation ladder; they differ in how.

| Concept | Reference | Elevation | What it changes |
|---|---|---|---|
| `1-storefront.html` | Shopify themes, Stripe | Dark nav + hero band → warm light page (`#f4f2ee`) → white cards → floating white Your Solution | The build area goes light. A checkout-style step bar sits on the seam between hero and page. Families become a product grid with an icon "media" strip, one outcome with a check, View package / Add need. A 14th tile, "Not sure which one?", calls DE. |
| `2-marketplace.html` | Amazon | Dark header with a big search and a Your Solution "cart" button → goal sub-nav → hero banner with the profile as the "deliver to" box → white boxes that overlap the banner → cool grey page | Search-first. The three situation groups become Amazon-homepage boxes with compact rows. Families become a filterable list (goal checkboxes, relationship radios) with large Add to solution buttons. |
| `3-graphite.html` | Linear, Vercel | L0 page `#07060b` → L1 panel `#0f0e15` → L2 card `#18171f` → L3 floating `#22212c`, each with its own edge and a top highlight | Keeps the dark brand, but every chapter is a panel and every card sits inside one. |

All three use option E's grouping of the situations (Joe, 2026-10-03) and its three proposed headings.

**Tier 2 challenged:** `design/STORE_DOOR2_GRAMMAR.md` (no rounded islands, raised surfaces only for the rail and sheet, paper only where the buyer signs) in all three; the light build field in 1 and 2; a search-first header in 2. Fonts stay Space Grotesk / Inter / Oxanium (the local files; the mockups load no remote fonts). Joe-decided items: none challenged (Store electric stays the Store accent; magenta stays the one forward action).

**Tier 0:** copy, family descriptions, outcomes, goals and situations are transcribed from `client/src/data/curatedSolutions.ts`, `solutionScenarios.ts` and `client/src/lib/businessNeeds.ts` (`data.js`); icons are the live Lucide set; no prices, ratings, reviews, logos or counts that the Store doesn't have. "Standalone or co-managed" in 2 is true of every family (each has both offers). AA contrast, ≥44px primary targets, visible focus, reduced motion. Rendered at 1440 / 768 / 390 with 0px horizontal overflow (`render.mjs`, serve the repo root on :3000 first).

## Concept 4 · Flagship (apple.com/iphone grammar) — 2026-10-04

**Joe:** "I want an Apple level graphical masterpiece like this page. https://www.apple.com/iphone/" (after picking concept 2 as the baseline; concept 2's layout work is kept as `marketplace-wip.patch`, a not-yet-verified integration of concept 2 into `client/`, for reuse).

`4-apple.html`, rendered section by section by `render4.mjs` (`renders/4-apple-<width>-<n>-<section>.png`).

| Section | Apple pattern | DE content |
|---|---|---|
| Global bar + frosted local nav | iPhone local nav with Buy pill | "Store" · Situations · Size it · Families · Why DE · magenta Your Solution pill with count |
| Hero (black) | one sculptural object, giant type | the 13 family glyphs as an isometric, lit field (electric / graphite / paper finishes, one magenta), real headline and lede |
| Start from a situation (mist) | "Get to know iPhone" gallery: tall 28px cards, round + button, paddles, bleeds off the right edge | the ten situations, grouped by tabs; each card shows the three families it adds as glyph objects; incident cards carry the phone |
| Size it once (white) | configurator | four large Oxanium dials with − / + steppers, two facts as segmented choices, live "Sized for…" line |
| Explore the families (mist) | "Explore the lineup" with segmented tabs | thirteen family cards, glyph as the product shot, outcome with a check, Add need / Learn more ›, a "Not sure which one?" call card |
| Why DE (black) | "Why Apple is the best place to buy" carousel | DE's protected differentiators only (no payment here; Your Technology. Your Data. Your Keys.; standalone or co-managed; profile-led sizing; documented environments; a person on the phone) |
| Close + floating bar | bag / sticky buy bar | "Not sure where to start?"; a frosted Your Solution pill rises after the first add |

**Verified:** 0px horizontal overflow at 1440 / 768 / 390; axe-core (WCAG 2.2 AA + best practice) 0 violations at 1440 and 390 (`axe-audit.mjs`); Lighthouse performance 99, accessibility 100, best practices 96, LCP 2.0s, CLS 0, TBT 0ms; motion is transform/opacity only and stops under reduced motion.

**Imagery:** none generated. Apple's page is carried by product photography; DE's "product" is rendered here as glyph objects in CSS. Real photography (team, office) or generated stills (kie.ai, costs credits) are Joe's call.
