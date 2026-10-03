# Portal light theme "Ambient": visual QA (2026-10-03)

Joe, 2026-10-03: portal light mode is liked, but "the light grey I would replace with an ambent color". Three options were rendered over the real portal (A warm amber, B Ambient, C keep grey); Joe picked B: "B, cards but show me first". This build is held for Joe's approval before merge.

What changes, light theme only: the content field and the wells move from warm grey (`36 24% 96%`) to a soft orchid (`290 42% 96%`, #f8f1f9), and a magenta glow (top right) and a violet glow (top left) light the top of the content area. Cards stay white, the rail stays graphite, dark mode is untouched.

Captured by Playwright against the local dev server, signed in as the dev QA admin with `de-portal-theme=light`.

| File | What it shows |
|---|---|
| `after-{dashboard,tickets,create}-{390,768,1440}.png` | `/portal/dashboard`, `/portal/tickets`, `/portal/tickets/new` in Ambient |
| `before-{dashboard,tickets,create}-{390,768,1440}.png` | The same pages on `main` (warm grey) |
| `compare-dashboard-1440.png`, `compare-tickets-1440.png`, `compare-dashboard-390.png` | Before and after side by side |

Checks on every after view (3 pages × 3 widths): axe (WCAG 2 A/AA, serious and critical) 0 violations, no horizontal overflow, no runtime errors; the content field computes `rgb(248, 241, 249)`.
