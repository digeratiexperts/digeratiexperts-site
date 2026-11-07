# Blog "Listen" button: static MP3 narration

- **Status:** Waits on Joe first
- **Repo:** digeratiexperts-site
- **Relay issue:** none yet — create one from this file before you start (see the README)
- **Written:** 2026-11-07 from Claude chats; anything not marked "checked" may be stale

## Goal
The Listen button plays pre-rendered MP3s instead of live OpenAI calls.

## Where it stands
- Branch `fix/blog-narration-static` exists (checked 2026-11-07); no PR. Render script is dry-run by default; a full render costs about $1.11.

## Next step (exact)
Open a draft PR from the branch after merging current `main` into it. Do not run the paid render.

## Done when
Draft PR open, CI green, render approved and run, Listen works on a live post.

## Files likely touched
branch `fix/blog-narration-static`

## Needs Joe (stop gates)
Restore OpenAI billing and approve the ~$1.11 render (paid API).

## Source
- Original chat (only Joe can open it): https://claude.ai/chat/0e937893-ecdf-4d2f-83ea-a2063ee2cf50
