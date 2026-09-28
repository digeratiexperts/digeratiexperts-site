# Store approved round — visual QA evidence

Captured 2026-09-28 on the dev server (memory mode), Chrome 1194, consent pre-seeded, after Joe approved every decision in `docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md` §16. Raw numbers in `report.json`. The walk builds a real solution from the "Cyber-insurance renewal sent a questionnaire we can't answer" situation (Compliance & Risk requires an assessment), submits it, and follows the confirmation's action to `/book`.

## What each capture shows

| File | Shows |
|---|---|
| `01-store-fold-*` | `/store` with no assessment strip over the task (§16.2) |
| `02-contact-page-fold-*` | `/contact`, a non-Store page, keeps the sitewide strip and the assessment footer: the change is scoped to Door 2 |
| `03-workspace-footer-*` | The Store footer: "Back to Your Solution" in place of the magenta assessment CTA |
| `04-submitted-band-*` | The confirmation's assessment band with its one magenta action, now live (`BOOK_ALIGNED = true`) |
| `05-book-ref-*` | `/book?ref=DE-…`: the reference line above the widget, the aligned copy (conversation first, the formal assessment at $2,500 when scoped, nothing billed until yes) |

## Gates

| Gate | 390 | 768 | 1440 |
|---|---|---|---|
| Assessment strip on Door 2 (index, workspace, contact step, confirmation) | 0 | 0 | 0 |
| Store footer "Back to Your Solution" / assessment CTA on Door 2 | 1 / 0 | 1 / 0 | 1 / 0 |
| Strip and assessment footer still on `/contact` and `/book` (not Door 2) | yes | yes | yes |
| Confirmation band renders for an assessment solution; action links to `/book?ref=` | yes | yes | yes |
| `/book?ref=` shows the reference; a malformed `ref` shows nothing | yes / yes | yes / yes | yes / yes |
| `/book` page copy says "free" / carries the canonical price | no / yes | no / yes | no / yes |
| axe serious/critical: `/store`, confirmation, `/book?ref=` | 0 | 0 | 0 |
| Horizontal overflow on every page walked | 0 | 0 | 0 |
| `/store` length, empty draft (viewports) | 6.34 | 5.79 | 5.34 |

The production smoke (`scripts/door2-browser-smoke.mjs` against the built server) now also fails on any assessment strip, any assessment footer CTA, or a missing "Back to Your Solution" on the five Door 2 routes; it passed. The staff preview cookie is covered by `server/warehouseRoutes.test.ts` (a browser walk would need a staff session).

**Observation for Joe, not changed:** the sitewide strip still reads "Get Your Free Cybersecurity Assessment" on `/book` itself, above copy that now says the first conversation costs nothing and the formal assessment is $2,500 when scoped. Both are true of the conversation, but the word "Assessment" in the strip is the looser of the two. The strip is shared marketing chrome outside the Store and was not in the approved scope.
