# Website tickets not reaching Zoho Desk

- **Status:** Open, needs Joe: code and live state look healthy; an end-to-end Desk ticket is still unproven (checked 2026-11-09)
- **Repo:** digeratiexperts-site
- **Relay issue:** none yet — create one from this file before you start (see the README)
- **Written:** 2026-11-07 from Claude chats; anything not marked "checked" may be stale

## Goal
Widget tickets reach Zoho Desk again.

## Where it stands
- Broke after Oct 3 while still showing success. Tracked as item S4 in OPEN-ITEMS-FOR-DE.md (site issue #418). The Hub ticketing PRs may have changed this.

## Next step (exact)
Submit a test ticket on staging (not production) and confirm it lands in Desk, or read S4 for the current state.

## Done when
A test ticket appears in Desk with its Portal Ticket ID.

## Files likely touched
`server/zoho/`

## Needs Joe (stop gates)
The Zoho reconnect click, if `needs_reconnect`.

## Checked 2026-11-09
- Live `GET /api/zoho/desk/status`: `configured: true, connected: true`, state `connected` (read only, no token request). The Desk health probe in the production-health run also reads `desk=true`.
- `server/zoho` and the widget-ticket tests on current `origin/main`: 13 files, 150 tests, all pass.
- Issue #418 (the S4 history) is closed as of 2026-10-10.
- **Not proven:** the done-test needs a real ticket in Desk. Staging disables the Zoho credentials by design (`deploy/vps/staging-review-safety.md`), so a staging ticket cannot prove this. A production test would create a real Desk ticket and email the inbox, so it waits for Joe.
- **Design question for Joe:** the widget returns `success: true` with a ticket number whenever the fallback spool or Desk-inbox email accepts the ticket, even if the Desk API call failed (`server/widgetTicketRoute.ts`). That explains the old "still showing success" symptom. Joe decides whether that stays.

## Source
- Original chat (only Joe can open it): https://claude.ai/chat/eeb8045a-540d-4b8b-83f3-7778735a240d
