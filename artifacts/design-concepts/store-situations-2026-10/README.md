# Store step 02 situation cards: six options (2026-10-03)

**Joe's ask:** the dark situation cards on the dark page don't separate. Either the background goes light, the boxes go light, or the boxes go away and section panels hold them. "Why not design them all as samples and I choose."

**Mode:** Exploration Mode, static mockups only. Nothing in `client/` changes. The pick then ships as its own PR against `client/src/styles/store-builder.css` (`.d2-grid--cards`) and, for the grouped options, `client/src/pages/solutions/BusinessNeedsIndex.tsx` and `client/src/pages/store/PublicStoreCheckout.tsx`.

| Option | What changes | Render |
|---|---|---|
| A · Today | Live: dark gradient cards on the dark page | `renders/A-1440.png` |
| B · Paper chapter | The whole step on warm paper (`--de-paper`), white cards with an electric top rule | `renders/B-1440.png` |
| C · Paper cards | Dark page stays; each card is warm paper | `renders/C-1440.png` |
| D · Grouped panels, dark | No card per situation; three tinted panels group them, hairlines inside | `renders/D-1440.png` |
| E · Grouped panels, paper | Three warm-paper panels on the dark page, hairlines inside | `renders/E-1440.png` |
| F · No boxes | Group headings and hairlines only | `renders/F-1440.png` |

Each option also has a `-390.png` phone render. `render.mjs` rebuilds them (`node artifacts/design-concepts/store-situations-2026-10/render.mjs`); no horizontal overflow at 1440 or 390.

**Tier 2 challenged:** `design/STORE_DOOR2_GRAMMAR.md` keeps paper for where the buyer signs and holds the record; B, C and E put paper where the buyer builds. F labels the urgent group in a pink ink, a second accent the grammar doesn't have today.

**New copy (D, E, F only):** three group headings and lines, for Joe to approve or rewrite: "Something just happened" (phishing, IT person left, ransomware: the three that already carry the phone line), "We're growing or changing" (second office, new hires, remote/BYOD, phone contract), "We have to prove it or keep up" (insurance, auditor, stretched IT team). Grouping changes the live order of the ten situations.

**Tier 0:** situation copy, family labels, phone number and button labels are transcribed from `client/src/data/solutionScenarios.ts` and `BusinessNeedsIndex.tsx`; dark-on-paper and electric-on-paper inks clear AA; 44px targets.
