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

## Strings left out of the mocks (no source)

| Live string | Where | Why |
|---|---|---|
| "Results in 24-48 hours" | Lead form footer | No source in `docs/CLAIMS-REGISTER.md` |
| "Microsoft Partner", "Apple Consultants" | Newsletter chips | No source in `docs/CLAIMS-REGISTER.md` |
| "24/7 Security Operations Center Always Active" | Contact | Replaced by the SLA wording "24/7/365 emergency incident response" |
| "Arizona SOC Operations" badge, "Always-On Telemetry" caption | Detection & response image panel | No source; Tier 0 bars invented telemetry |

If Joe picks this direction, the integration PR records these in `docs/CLAIMS-REGISTER.md`.

## Joe's decisions, 2026-10-01

- **Decision 1, duplicate asks: agreed.** One assessment form on the page (13, lead form). The next-step band (15) keeps its copy and becomes one button (`openBooking("homepage-cta")`, which is what its email field really did). One newsletter form: the footer's; the FAQ chapter's "Stay Updated" card is removed and the service area becomes a full-width row.
- **Decision 2, pronunciation row: agreed.** Kept as one row in the hero.
- **Industries photo cards: keep.** "i also dont want to lose UI design like the industries with the hover color picture. a lot of subtle work can be lost so be careful." Section 10 restores the five photographs with the live treatment (grayscale at rest, colour on hover and keyboard focus, magenta border, arrow nudge, phone snap rail with scroll buttons). This overrides the earlier "no photographs" direction for this section; the claims-register note that calls them stock photographs is recorded, and Joe's decision stands. `renders/10-industries-1440-hover.png` shows the hover state.
- **Bottom bar: upgrade with autohide that is not annoying.** `bar/` holds the prototype, the behaviour checks (15/15 pass) and the integration spec.
- **Subtle work:** `INTERACTION-INVENTORY.md` lists every hover, focus, transition, reveal and image treatment on the live page, so integration keeps them.
