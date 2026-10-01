# Store Stations: visual QA (2026-10-01)

Joe, 2026-09-30: the Store is "too matched … hard to see whats what and move forward in steps"; "make these lines thicker and more fun". Two concepts were rendered over the real workspace (A "Track", B "Stations"); Joe, 2026-10-01: "go with B, build it".

Captured by Playwright against the dev server with consent pre-seeded, animations frozen for the still.

| File | What it shows |
|---|---|
| `after-workspace-progress-{390,768,1440}.png` | `/store/solution` with the profile and needs done: the rail's ✓ ✓ 03 stations, ready chapters with ✓ stations, Relationship lit as the current card with "You are here" |
| `after-workspace-empty-{390,768,1440}.png` | `/store/solution` with nothing done: Profile is the current card |
| `after-index-{390,768,1440}.png` | `/store`: neutral stations 01 and 02 joined by the line at 1440 |
| `after-family-{390,768,1440}.png` | `/store/solutions/identity-access`: neutral stations |
| `after-contact-{390,768,1440}.png` | `/solutions/request`: station 06 on paper, electric, with "You are here" |
| `before-workspace-progress-*.png`, `before-contact-*.png` | The same states on `main` (8fc55249) before this change |
| `compare-workspace-1440.png`, `compare-workspace-390.png`, `compare-contact-1440.png` | Before and after side by side |

Checks on every after view (5 states × 3 widths): axe (WCAG 2 A/AA, serious and critical) 0 violations, no horizontal overflow, no runtime errors. Rail and chapter states agree (`complete,complete,current,pending,complete,pending` with `relationship:current`). Under `prefers-reduced-motion: reduce` the current station's halo runs once instantly (`d2-beacon x1`) instead of breathing.
