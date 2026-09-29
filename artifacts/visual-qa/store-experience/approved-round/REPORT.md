# Store approved round — visual QA evidence

Captured on the dev server (memory mode), Chrome 1194, consent pre-seeded, after Joe approved every decision in `docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md` §16; re-captured after the approved-round review (`85842b76`): the Door 2 accent now computes electric (it had resolved to magenta since the rebuild), the strip is off `/book`, the confirmation carries the bridge line and its footer reads "Back to the Store". Raw numbers in `report.json`. The walk builds a real solution from the "Cyber-insurance renewal sent a questionnaire we can't answer" situation (Compliance & Risk requires an assessment), submits it, and follows the confirmation's action to `/book`.

## What each capture shows

| File | Shows |
|---|---|
| `01-store-fold-*` | `/store` with no assessment strip over the task (§16.2) |
| `02-contact-page-fold-*` | `/contact`, a non-Store page, keeps the sitewide strip and the assessment footer: the change is scoped to Door 2 |
| `03-workspace-footer-*` | The Store footer: "Back to Your Solution" in place of the magenta assessment CTA (the confirmation's reads "Back to the Store") |
| `04-submitted-band-*` | The confirmation's assessment band: the bridge line, then its one magenta action, now live (`BOOK_ALIGNED = true`); electric reference and step numbers |
| `05-book-ref-*` | `/book?ref=DE-…`: no announcement strip, the reference line above the widget, the aligned copy (conversation first, the formal assessment at $2,500 when scoped, nothing billed until yes) |

## Gates

| Gate | 390 | 768 | 1440 |
|---|---|---|---|
| Assessment strip on Door 2 (index, workspace, contact step, confirmation) | 0 | 0 | 0 |
| Store footer "Back to Your Solution" / assessment CTA on Door 2 | 1 / 0 | 1 / 0 | 1 / 0 |
| Strip and assessment footer still on `/contact` (not Door 2) | yes | yes | yes |
| Strip on `/book`, the page it sells | 0 | 0 | 0 |
| Confirmation band renders for an assessment solution; action links to `/book?ref=` | yes | yes | yes |
| `/book?ref=` shows the reference; a malformed `ref` shows nothing | yes / yes | yes / yes | yes / yes |
| `/book` says "free" anywhere in `<main>` / carries the canonical price | no / yes | no / yes | no / yes |
| axe serious/critical: `/store`, confirmation, `/book?ref=` | 0 | 0 | 0 |
| Horizontal overflow on every page walked | 0 | 0 | 0 |
| `/store` length, empty draft (viewports) | 6.34 | 5.79 | 5.34 |

The production smoke (`scripts/door2-browser-smoke.mjs` against the built server) now also fails on any assessment strip, any assessment footer CTA, or a missing "Back to Your Solution" on the five Door 2 routes; it passed. The staff preview cookie is covered by `server/warehouseRoutes.test.ts` (a browser walk would need a staff session).

**Resolved in the review follow-up:** the sitewide strip used to read "Get Your Free Cybersecurity Assessment" on `/book` itself, above copy that prices the formal assessment at $2,500 when scoped. It is now off `/book` (the page it sells), and the production smoke checks the whole `/book?ref=` document for "free" near "assessment".
