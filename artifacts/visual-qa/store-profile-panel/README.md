# Store profile panel: visual QA (2026-09-30)

Joe's direction: the expanded "Size it to your business" form "needs to have a light grey background to separate it from the black background of the whole page".

Captured by Playwright against the dev server, consent pre-seeded, with a partial profile (Users 25, Sites 0 to show the error, "The company" checked, focus on Mobile devices) so the strip stays expanded.

| File | What it shows |
|---|---|
| `before-{index,family,workspace}-{390,768,1440}.png` | Current `main` (74535d76): the form sits straight on graphite |
| `after-{index,family,workspace}-{390,768,1440}.png` | This change: the light grey `.d2-profile-panel` |
| `after-suggest-{390,1440}.png` | Complete profile with the "Done" control and the SuggestionLine on the panel |
| `compare-workspace-1440.png`, `compare-index-390.png` | Before and after side by side |

Surfaces: `index` = `/store`, `family` = `/store/solutions/identity-access`, `workspace` = `/store/solution`.

Checks on every after view: axe (WCAG 2 A/AA, serious and critical) 0 violations, no horizontal overflow, no runtime errors. The panel computes to `color(srgb 0.8927 0.8849 0.8787)` (about `#e4e2e0`).
