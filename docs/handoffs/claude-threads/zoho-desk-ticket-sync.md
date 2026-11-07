# Website tickets not reaching Zoho Desk

- **Status:** Verify, then close or reopen
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

## Source
- Original chat (only Joe can open it): https://claude.ai/chat/eeb8045a-540d-4b8b-83f3-7778735a240d
