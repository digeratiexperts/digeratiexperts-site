# Portal grey ladder: three concepts

**Mode:** Exploration (Joe, 2026-10-04, pointing at the kie.ai billing screen: "see how even kie.ai is using the shades of grey in the order they are with the blue — this is proper, you can do that"; 2026-10-06: "do all these", after choosing the Client Portal dashboard as the first surface). Tier 0 and Tier 1 of `design/DESIGN-AUTHORITY.md` hold in full. Tier 2 surface values are challenged on purpose; nothing here changes `client/`.

**Surface:** the Client Portal dashboard (`/portal/dashboard`), shell plus dashboard, with the real section names from `client/src/pages/portal/PortalDashboard.tsx` and the real nav groups from `client/src/components/portal/shell/portalNav.ts`. Every name, number and ticket is **EXAMPLE** data (`design/VISUAL_EVIDENCE.md`). Fonts fall back to system faces in the sandbox.

## The principle being tested

On the kie.ai screen, each layer is one even step of grey, and colour is spent once:

1. **Page** is the darkest field.
2. **Rail** (sidebar) is one step lighter.
3. **Cards** are one step lighter again.
4. **Fields and action wells** step back *down* inside a card (inset), so inputs read as "type here" without borders shouting.
5. **The selected nav item** is the only near-white shape on the screen.
6. **One accent** (their blue, our magenta) marks the single primary action and the one count that needs you. Status colours stay for truth (open / in progress / resolved), never decoration.

Today's portal (`client/src/styles/portal.css`) already layers graphite: page `#050312`, rail `#0a0a0f`, card `#151217`. The steps are uneven (page to rail is small, rail to card is large), fields use their own `--input` grey rather than stepping back down from the card, and there is no single near-white selected shape. The concepts test the ladder strictly.

## The three concepts

| | Page | Rail | Card | Inset (fields, wells) | Selected nav | Accent |
|---|---|---|---|---|---|---|
| **A. Neutral steps** | `#0c0c0e` | `#111114` | `#18181c` | `#0e0e11` | near-white pill | magenta `#D3126A` |
| **B. Graphite steps** | `#050312` | `#0b0915` | `#14111c` | `#09070f` | near-white pill | magenta `#D3126A` |
| **C. Light steps** | `#ecebef` | `#16141a` (graphite) | `#ffffff` | `#f3f2f5` | white pill on dark rail | magenta ink `#A30E52` |

- **A. Neutral steps** (`a-neutral-steps/`): the kie.ai ladder one-to-one in true neutral greys. Calmest and most "tool-like". **Challenges Tier 2:** drops DE's violet tint in the portal, so the portal no longer shares the site's graphite. Tier 1 still holds (precise, premium, not cyberpunk).
- **B. Graphite steps** (`b-graphite-steps/`): keeps DE's violet-tinted graphite `#050312` so the portal still matches the website, but re-spaces the layers evenly, adds inset fields and the white selected pill. **Smallest change** from what ships; mostly token values plus the nav-active style.
- **C. Light steps** (`c-light-steps/`): the same ladder for the light (Ambient) theme Joe picked on 2026-10-03: graphite rail kept, white cards, slightly grey fields. **Challenges a Joe decision:** it swaps today's orchid page `#f8f1f9` (and its magenta/violet glows) for a neutral grey `#ecebef` so the steps read as greys; Joe decides whether the orchid stays. Shows the ladder works in both themes.

Each folder has `index.html` (open it in a browser) and full-page screenshots at `390.png`, `768.png`, `1440.png`. No horizontal overflow at any width. `_shared/generate.py` rebuilds all three from one template, so a token change is one edit.

## Recommendation (provisional until Joe picks)

**B for the dark theme and C for the light theme.** B gets the kie.ai discipline (even steps, inset fields, one white pill, magenta spent once) without breaking the shared graphite identity between the website and the portal, which is a Tier 1/Tier 2 continuity Joe has protected. A is the purest version of the reference and the right pick only if Joe wants the portal to feel deliberately separate from the marketing site.

## What shipping would touch (not done here)

- `client/src/styles/portal.css`: the dark and light HSL tokens for background / sidebar / card / muted, plus one new inset token.
- The sidebar active style in `PortalLayout.tsx` / shadcn sidebar classes (white pill instead of the magenta bar).
- Inputs and the dashboard's "Do something" links move to the inset token.
- Magenta removed from secondary links and non-urgent counts.

Rendered QA at 390 / 768 / 1440 on the real portal, the axe smoke (portal entry pages) and a before/after set under `artifacts/visual-qa/` would gate that PR.
