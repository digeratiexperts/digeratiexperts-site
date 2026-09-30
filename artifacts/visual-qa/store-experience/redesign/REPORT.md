# Store redesign — visual QA evidence

Captured 2026-09-28 on the dev server (memory mode), Chrome 1194, consent pre-seeded, plus one pass with the cookie banner present. Re-captured the same day after the round-2 review fixes (electric washes removed, error inks from `--destructive`, rail header wrap, bottom-sheet rise, need rows still at mount): every gate below unchanged within rounding; only the screenshots whose pixels moved are refreshed. Script: the evidence walk in the session scratchpad (`walk-redesign.mjs`), the same gates as `docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md` §14. Raw numbers in `report.json`. Baseline A for comparison: `../baseline/`. Re-captured 2026-09-29 after the approved round and its review: the Door 2 accent now computes electric (a `:root`-scoped variable had rendered every accent magenta since the rebuild), the announcement strip is off Door 2 and `/book`, the footer is the store variant, and the confirmation's booking action is live; every capture in this folder is from that state.

## Gates

| Gate (§14) | 390 | 768 | 1440 |
|---|---|---|---|
| Horizontal overflow, five routes (14) | 0 | 0 | 0 |
| Scroll at top after each navigation (15) | yes | yes | yes |
| Polite live regions per page (25) | 1 | 1 | 1 |
| axe serious/critical, five routes (25) | 0 | 0 | 0 |
| Ask DE / tel inside `<main>` (16): index | 0 / 3 (incident lines) | 0 / 3 | 0 / 3 |
| family · workspace · contact · confirmation | 1 / 1 each | 1 / 1 each | 1 / 1 each |
| `data-accent` (16) | electric | electric | electric |
| Fixed chrome without banner (13), px | 151–153 (≤ 180) | 151–153 | 188–242 |
| Fixed chrome with banner (13), share of viewport | 301 px = 36% (≤ 40%) | 301 px = 29% | 239 px = 27% |
| Overlapping fixed chrome (13) | none | none | none |
| `/store` length, empty draft (14; gate ≤ 7 at 390, target 4 at 1440) | 6.34 | 5.79 | 5.33 (target not met) |
| `/store/solution` length, one need (smoke) | 7.0 | 4.7 | 5.2 |
| `/store/solution` length, four needs (walk) | 10.2 | 6.5 | 7.2 |
| Controls in `<main>` (17): index / family / workspace / contact / confirmation | 51 / 8 / 41† / 9 / 6 | 51 / 8 / 41† / 9 / 6 | 53 / 13 / 44† / 9 / 6 |
| Sheet hides the dock while open (5.6) | yes | yes | n/a (rail) |
| Contact: four invalid fields marked, first focused (25) | yes | yes | yes |
| Confirmation: h1 focused in `role="status"`, draft emptied, profile kept, archive written (24) | yes | yes | yes |
| Refresh re-renders from archive + status; no-archive device shows the honest line; unknown reference → 404 (24) | yes | yes | yes |

† measured with four needs in the draft (budget is 40 with three).

**Not met, reported:** `/store` at 1440 is 5.33 viewports against the target of 4 (the footer is 0.7 of it; the ten scenarios and thirteen family rows are decided content). `/store/solution` at 390 clears 6 viewports only without the shared footer, which is 1.9 viewports there; the footer `store` variant is PR 3.

## States captured (file prefix)

01 index empty · 02 scenario tapped (undo + reasons) · 03 profile partial (gap line) · 04 profile complete (sized line + suggestion) · 05 after completion (strip stays open under focus) · 06 the sheet at 390 · 07 search with no result · 08 family (sized, suggestion chip) · 09 workspace unchosen (preview sheets, disabled continue) · 10 help me choose (compare sheets) · 11 on-site chosen (fallback lines, hint) · 12 saved (memory: "Couldn't save to DE just now") · 13 contact · 14 four invalid fields · 15 the 503 panel · 16 the 429 panel · 17 the confirmation (a fresh submit) · 18 the confirmation of a replayed submit (the banner "We already have this request as DE-…"; captured before the attempt-id key, when every walk run replayed the first) · 19 the confirmation on a device without the archive · 20 index with the cookie banner.

Each at 390, 768 and 1440; `-fold-` files are the first viewport only. Refreshed after the round-2 fixes: the index at 1440 (rail header on one line), the sheet at 390 and 768 (radius), the workspace states 10–12 (checked tiles without the electric wash), the invalid contact fields (error inks) and the confirmation (a fresh submit); the other captures are unchanged and kept from the first pass.
