# Door 2 — Solve a Business Need

> **Superseded.** The public builder now lives at `/store` and is specified by
> `docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md` (design) and
> `docs/PUBLIC-SOLUTION-BUILDER.md` (rules). The `/solutions/business-needs`
> paths below 301 to their `/store` equivalents. This note is kept as the
> Phase 1 record only.

**Phase 1 implementation.** Draft only. Do not merge or deploy from this note.

## #101 dependency

PR #101 (`feature/curated-de-solution-families`) was **still open** when this work started. This branch **extends #101** so there is still one package module: `client/src/data/curatedSolutions.ts`. That file was not copied or forked.

## Routes

| Path | Audience |
| --- | --- |
| `/solutions/business-needs` | Public Door 2 index |
| `/solutions/business-needs/:family` | Public family page |
| `/solutions/request` | Public Solution Request |
| `/store` | Unchanged warehouse-to-be |
| `/portal/marketplace` | Door 3 later |
| `/internal/warehouse` | Door 4 later |

## Not in this phase

Door 1 rebuild, Door 3, warehouse relocate, `/store` 301, catalog deletes, ManagedStore claim edits, staff identity.
