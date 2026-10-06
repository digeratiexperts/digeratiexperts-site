# Portal grey ladder: before / after (real portal)

**What changed:** concepts B (dark) and C (light) from `artifacts/design-concepts/portal-grey-ladder/`, approved by Joe on 2026-10-06 ("all approved here"), applied to `client/src/styles/portal.css`. The change touches tokens and the active nav style only. No component or layout changes.

| Layer | Dark before | Dark after | Light before | Light after |
|---|---|---|---|---|
| Page | `#050312` | `#050312` (kept) | orchid `#f8f1f9` + magenta/violet glows | grey `#ecebef`, no glows |
| Rail | `#0a0a0f` | `#0b0915` | graphite | graphite `#0b0915` |
| Card | `#151217` | `#14111c` | white | white |
| Muted / accent | uneven | `#1d1927` | orchid tints | `#f3f2f5` / `#e7e6eb` |
| Selected nav | magenta-tinted bar | near-white pill, graphite ink, weight 600 | magenta-tinted bar | near-white pill |

Rail label colour moved from 78% to 82% lightness so the 60% group labels ("SUPPORT", "ACCOUNT") hold 4.94:1 on the new rail.

**Light theme reverses a Joe decision:** on 2026-10-03 Joe picked the orchid "Ambient" field. C swaps it for neutral grey steps. Joe confirms these screenshots before merge.

## Files

`{before,after}-{dark,light}-{dashboard,tickets}-{390,768,1440}.png`: full-page captures, 24 in total.
- **before:** `origin/main` at 8cbffda.
- **after:** this branch.
- Both runs used the dev server with the local dev admin, captured 2026-10-06. The ticket rows are the dev seed's EXAMPLE data.

## Checks (after, all 12 views)

- **axe-core** (WCAG 2.0/2.1/2.2 A + AA, reduced motion): 0 violations of any impact.
- **Horizontal overflow:** none at 390 / 768 / 1440.
- **Computed field colour:** dark `rgb(5, 3, 17)`, light `rgb(236, 235, 239)`. Every capture asserted host `127.0.0.1` and the expected path before the shot.
- **Unit test:** `client/src/styles/portalLightTheme.test.ts` locks the light values and the 4.5:1 text contrast.
