# Homepage section mockups — 2026-10-01

**Joe's ask:** "can you mock up every section on the live Digeratiexperts.com homepage and make it look how it should look. just give images of your version for each section in order."

**Mode:** Exploration Mode (Joe's words: "how it should look"), scoped to static mockups. Deliverable: `renders/NN-*-1440.png`, one image per live section in live order. Nothing in `client/` changes; production `/` is untouched; this is a concept for Joe to pick from, never merged as-is.

**Hypothesis:** the live homepage already has the right system (graphite wells, warm paper, magenta punctuation, violet as light, Space Grotesk / Inter / Oxanium) but executes it inconsistently: nested containers, mixed head styles, decoration without meaning, stock-looking imagery, duplicated asks. "How it should look" is that system applied with one rhythm, one head recipe, one card, real artifacts only, and less air. The diagnosis and the per-section direction are in `system/BRIEF.md`.

**Tier 2 kept:** every token value, the type stack, the field ladder, the accent doctrine (gradient on the Joe-listed headings only), every archetype, every piece of copy and every CTA destination, the eight-block model with Risk & exposure continuous (Joe-decided), the site chrome in the hero.

**Tier 2 changed (and why):** paper chapters become full-bleed bands instead of rounded islands (chapters, not cards); exactly two raised boxes (Stats, Pricing); one left-aligned head recipe; decorative dots/arrows/glows removed; industry photographs and the generated desk/office stills replaced by IconWell cells, an EXAMPLE FORMAT report outline and an ILLUSTRATIVE diagram; the ProActive stack preview and the proof tab switcher become always-visible rails; the pronunciation card becomes one row; three unsourced strings omitted (see the brief's truth notes).

**Joe-decided items challenged:** none. (The pronunciation card is not in the Joe-decided table; its reduction is a proposal.)

**Tier 0:** real copy only (`CONTENT-INVENTORY.md`, transcribed from source); no invented clients, quotes, numbers, partners or faces; sample artifacts tagged ILLUSTRATIVE / EXAMPLE FORMAT; the threat rail is the live feed captured 2026-10-01 (`data/`); AA contrast; ≥15px body; ≥44px targets; every mock renders without horizontal overflow at 390.

## Layout of this folder

| Path | What |
|---|---|
| `system/BRIEF.md` | Diagnosis, rules, per-section direction, truth notes |
| `system/tokens.css` | The shared system for the mocks (values from `client/src/index.css`) |
| `system/render.mjs` | Serves the repo root, screenshots each section at 1440 (and 390), reports overflow/errors/fonts |
| `system/icon.mjs` | Prints a Lucide icon from the project's `lucide-react` as inline SVG |
| `CONTENT-INVENTORY.md` | Every string, link, image and data source on the live page, transcribed |
| `live/` | The live sections as captured 2026-10-01 at 1440 (webp) |
| `data/` | Live API captures used by the mocks |
| `sections/` | One standalone HTML mock per section |
| `renders/` | The deliverable PNGs |

## Render

```bash
cd artifacts/design-concepts/homepage-sections-2026-10
node system/render.mjs --all --widths 1440,390
```
