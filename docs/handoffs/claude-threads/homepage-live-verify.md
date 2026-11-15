# Homepage refinement: confirm it's live

- **Status:** Open, needs Joe: MERGED yes, LIVE not evidenced (checked 2026-11-09)
- **Repo:** digeratiexperts-site
- **Relay issue:** none yet — create one from this file before you start (see the README)
- **Written:** 2026-11-07 from Claude chats; anything not marked "checked" may be stale

## Goal
Confirm the refined homepage (Lane H) is what visitors see.

## Where it stands
- PR #698 merged (checked 2026-11-07). MERGED is not LIVE.

## Next step (exact)
Read the latest production deploy run's verify step for a SHA that includes #698. Don't browse production without Joe's OK.

## Done when
Deploy evidence shows a SHA that includes #698.

## Files likely touched
none

## Needs Joe (stop gates)
None.

## Checked 2026-11-09
- PR #698 merged 2026-10-24 as `6bf3208`, and it is an ancestor of `origin/main`. MERGED.
- LIVE is not shown: the newest "Production health" runs (2026-11-09) report commits `2bd96373b` / `855098371`, which contain #698. But that run logs status, database and Desk only, with no release SHA.
- The `Verify production current release` workflow's last success is 2026-08-26, before #698 merged. Its file is not in this repo.
- The deployed commit appears only in the signed-in staff `/api/health` map (`server/publicHealth.ts`), so an anonymous read cannot confirm it.
- **Needs Joe:** sign in and read the deployed commit in `/api/health`, or say whether this slice needs a deploy-evidence fix.

## Source
- Original chat (only Joe can open it): https://claude.ai/chat/e5d3f20c-0e24-4c0d-8073-4d3021b6528e
