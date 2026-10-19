# /concepts/home-chapters — premium pass + object integration (2026-10-19)

Mode: Exploration Mode (Joe directive: "modernize … premium, simple, monday.com/Apple/x.ai style"). Concept route only — live `/` untouched.

## What this pass contains
- 22 monochrome 3D card objects (kie.ai gpt-image-2, job `card-objects-2026-10-19`, ~$0.66) placed one per card across hero claims, problems, services, protect steps, client-proof cells, trust pillars, pricing cards. In the section flow (`CardObjects.tsx`), decorative (`aria-hidden`, empty alt), faces/text-free, ILLUSTRATIVE per `design/IMAGERY.md`.
- Alpha-cut to transparent WebP (640px, quality 84) in `client/public/concepts/objects/` (~757 KB total).
- Bento grids (problems first card 2×2; services featured 2-of-4; stats 4-up; pricing 4-up with outlined flagship; trust pillars 4-up).
- Movie-poster hero: charcoal `#121212` field over `#fafafa` base, founder photo indexed `Joseph Petro`, crossing the seam; the live hero's copy block yields, the assessment-window product shot stays.
- Charcoal `#121212` replaces pure-black; white cards on `#fafafa`; one glass surface (chapter nav) only; three motion speeds (150ms controls / 320ms panels / 900ms imagery); reduced-motion respected.
- Fixed the silently-failing `#protection.v8` scope (section had no `.v8` class): dark-stage card/text rules now actually apply to the Protect stage; fixed white-on-pale `.proof-foot__phone`; magenta heading underlines suppressed in light sections.

## Verification (capture set `v8-*`, pre-fix set `v7-*`)
- Horizontal overflow: 0px at 390 / 768 / 1440; no page errors.
- axe-core: **0 violations** at 390 and 1440 (`axe-concepts.mjs`), previously 1 color-contrast serious (9 nodes).
- Full `tsc` clean; full `npm test` failures limited to 7 pre-existing local-env tests (fail identically with changes stashed: Windows CRLF deploy-script content check, portal-console theme marker, desk auth env).

## QC gate scorecard (10 categories, /50)
1. Hierarchy & ensemble (poster hero, sized-by-importance bento): 5/5
2. Light-first theme discipline (charcoal #121212, white cards, one glass nav): 5/5
3. Objects-in-cards consistency (22/22 assets, one style, right object matched to each card): 5/5
4. Motion discipline (3 speeds, reduced-motion): 4/5 (parallax subtle; objects animate only on hover)
5. Contrast & a11y (axe 0 @390/1440, focus-visible rails/dots): 5/5
6. Responsive operability (0px overflow @390/768/1440): 5/5
7. Content preservation (all 14 V8 sections + every form/feed/link reused unchanged): 5/5
8. Truth rules (IA/Illustrative labels kept; no invented metrics/clients): 5/5
9. Performance (objects lazy + async; plates single-file; no new JS deps): 4/5
10. Code discipline (concepts-only files, live sections untouched, tsc clean): 5/5
**48/50 — target ≥45 met.**

## Known nits (next pass candidates)
- Insight feed on dev shows fewer cards (no threat-feed API locally); production fetches live feed.
- Objects could carry a second "quiet" density for dense list sections (backlog).

## Budget
kie.ai 2026-10: ~$3.85 of month soft $25 (job card-objects-2026-10-19 ≈ $0.66; plates earlier). Within Joe's USD 20 approval.

## Approval
Joe (2026-10-19, chat): "do it all babyyyy" (approve the object set, base fix, photo hero, objects in every card) and "im going to bed so continue on your own, all approved". Concept stays at `/concepts/home-chapters`; `/` unchanged until Joe explicitly promotes.
