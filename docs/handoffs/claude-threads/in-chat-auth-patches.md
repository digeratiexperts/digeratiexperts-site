# In-chat auth patches (passkey/OAuth/email code)

- **Status:** Closed: superseded (checked 2026-11-09)
- **Repo:** digeratiexperts-site
- **Relay issue:** none yet — create one from this file before you start (see the README)
- **Written:** 2026-11-07 from Claude chats; anything not marked "checked" may be stale

## Goal
Decide whether the Aug 31 auth patches are still needed.

## Where it stands
- Patches built with `store.js` and `mailer.js` left as stubs. Portal auth has moved on since (see `docs/PORTAL-AUTH.md`).

## Next step (exact)
Compare the patches with `docs/PORTAL-AUTH.md`. If superseded, mark this closed.

## Done when
Marked superseded, or a relay issue for the missing piece.

## Files likely touched
`docs/PORTAL-AUTH.md`

## Needs Joe (stop gates)
None.

## Checked 2026-11-09 (superseded)
- The stubs named here (`store.js`, `mailer.js`) do not exist in the repo.
- Every capability the patches aimed at is on main: passkeys (`server/portalPasskeys.ts`, `server/portalPasskeyLoginRoutes.ts`), Zoho SSO (`/api/portal/auth/zoho/*`), and email verification / MFA email challenge (`server/services/notificationService.ts`, `server/routes.ts`), as `docs/PORTAL-AUTH.md` describes.
- Decision: superseded. Nothing to port. No relay issue needed.

## Source
- Original chat (only Joe can open it): https://claude.ai/chat/165d716e-b2cb-466b-a9a0-a5dc74b9df01
