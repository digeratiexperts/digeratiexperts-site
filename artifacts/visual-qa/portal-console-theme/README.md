# Portal "Admin console" theme (real portal)

**Ask:** Joe, 2026-10-14: "a dark theme that is like Entra and IT dashboards ... build it then for the Client portal".

**What it is:** a third, opt-in theme in the portal user menu (Appearance → **Admin console**). Graphite dark stays the default, Light and "Match device" are unchanged, and "Match device" never picks the console theme. The change is portal-scoped CSS tokens plus one menu option. No layout, route, API or data change.

| Layer | Graphite dark (default, unchanged) | Admin console |
|---|---|---|
| Page | `#050312` | `#1f1f1f` neutral |
| Rail | `#0b0915` | `#141414`, one step below the page |
| Card | `#14111c` | `#292929`, one step above |
| Well / hover | `#1d1927` | `#333333` / `#363636` |
| Accent | magenta `#D3126A` | blue `#0f6cbd` fill, `#479ef5` focus ring, `#75b8f7` links |
| Selected nav | near-white pill | `#2e2e2e` row with a 3px blue left bar |
| Corners | 12px / 8px | 6px / 4px |
| Type | Space Grotesk headings, Inter | Segoe UI (system UI face) for all text |

Category colours on card tops stay as they are. Inside the console theme the brand magenta tokens (`--de-magenta*`) map to the blue, so the "New ticket" button and the Administer toggle follow.

## Files

`{console,dark}-{dashboard,tickets}-{390,768,1440}.png`: full-page captures (12). `console-menu-1440.png`: the Appearance menu with the option. Captured 2026-10-14 by `capture.mjs` on the dev server with the local dev admin; the ticket rows are the dev seed's EXAMPLE data.

## Checks

- **axe-core** (WCAG 2.0/2.1/2.2 A + AA, reduced motion), all 12 views: 0 violations.
- **Horizontal overflow:** none at 390 / 768 / 1440.
- **Computed field colour:** console `rgb(31, 31, 31)`, dark `rgb(5, 3, 17)` (unchanged).
- **Unit test:** `client/src/styles/portalConsoleTheme.test.ts` checks text, state inks (on 7–12% tints), button fills, focus ring and field edges for contrast.

Already like this before the change, not touched here: at 390px the admin-only "Administer a client…" picker is cut off at the right edge in every theme.

Joe confirms these screenshots before merge.
