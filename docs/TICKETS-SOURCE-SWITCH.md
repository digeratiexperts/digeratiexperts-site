# Tickets: switching the portal and widget from Desk to the Hub

Cross-repo review step 3, "Tickets" (Intelligence-Hub `docs/architecture/2026-11-04-cross-repo-review.md`).

Joe, 2026-11-05: **"Hub first then sync with desk but if desk is first then sync with hub."** The Hub ticket engine (Hub ADR 0020) is the master for tickets the website creates. Zoho Desk receives them through the Hub's two-way sync, so Desk agents keep working in Desk.

## The switch

`TICKETS_SOURCE` in the website's environment (`/etc/digeratiexperts/*.env` on the VPS):

| Value | What the Client Portal and the "Get Support" widget do |
|---|---|
| `desk` (default; also unset or anything other than `hub`) | Create, list and comment straight in Zoho Desk, as before this change. The Hub is never called. |
| `hub` | Create, list and comment through the Hub ticket API (`de.hub.portal-tickets/v1`). Desk gets each ticket from the Hub sync. |

Merging the code changes nothing. Behaviour changes only when someone sets `TICKETS_SOURCE=hub` and restarts the site.

**Needs:** `TECHSALES_HUB_URL` and the scoped `PORTAL_TO_HUB_SECRET`. These routes refuse the legacy shared secret, so there is no fallback to it. A portal company also needs a Hub account link (`portal_clients.hub_account_id`), and that Hub account must have **exactly one** Hub client. Optional: `HUB_TICKETS_TIMEOUT_MS` (default 8000).

## What `hub` does, path by path

| Path | With `hub` | When the Hub can't take it |
|---|---|---|
| Portal: new ticket (`POST /api/portal/tickets`) | The portal row is kept as before. The Hub creates the ticket and the row records `hub:<id>`. | The existing Desk path runs (Desk API, then the email/spool failover), and a **reconciliation note** is written. |
| Widget: Get Support (`POST /api/portal/zoho/ticket`) | The Hub creates it, the visitor sees the Hub number (DE-1xxx), and a portal user's copy is mirrored as `hub:<id>`. | The existing Desk path runs unchanged, and a reconciliation note is written. |
| Portal: ticket list | The portal's own rows are merged with the account's Hub tickets. A portal row linked by `hub:<id>`, or by its old Desk id once the Hub sync links that Desk ticket, appears once with the Hub's live status. Every other Hub ticket shows as `hub-<id>`. | The Desk list is used, as today. Nothing needs reconciling, because nothing was written. |
| Portal: ticket detail for `hub-<id>` | Ticket and conversation come from the Hub (public replies plus the client's own portal replies). | 503 "unavailable right now". |
| Portal: reply on `hub-<id>` | Sent to the Hub. | If the Hub has already linked a Desk copy, the reply goes to Desk as a public comment and a note is written. Otherwise the client sees "couldn't send, try again" and keeps their text. |
| Portal: reply on a portal row with `hub:<id>` | Stored in the portal (as today), then sent to the Hub. | The portal keeps the reply and a note is written (`handedTo: portal_only`). |

**Reconciliation notes** are JSON files in `<site>/shared/spool/ticket-reconciliation/` (override with `TICKET_RECONCILIATION_SPOOL_DIR`). Each note records the kind (create/reply), the channel, why the Hub missed it (`not_configured`, `unreachable`, `refused` with status and code, `invalid`, `no_account`), where the ticket went instead, and the portal reference and Desk id when known. Each is also logged as `[TICKETS-SOURCE] Ticket missed the Hub` with identifiers only. Every ticket in a note still reached Desk, or the portal and the Desk failover. A note means "check this one is in the Hub". It does not mean the ticket was lost.

Known gaps (follow-ups, not blockers for the week of watching):

- File attachments on a Hub ticket still need the Desk ticket id, so they answer "email support" until the Hub accepts attachments from the portal.
- A client's reply is stored in the Hub as an internal note headed with who wrote it. The Hub has no "message from the client" entry kind yet, and a public reply would be e-mailed back to the client by Desk.
- The detail page of a portal row linked to `hub:<id>` shows the portal's own comments, the same as Desk-linked rows do today. Only `hub-<id>` pages show the Hub conversation.

## Switch-on order (Joe)

Do these in order. Don't skip ahead. Each step needs the one before it.

1. **Hub ticket sync on: OPEN-ITEMS C10.** Do all eight C10 steps in the Hub's `docs/OPEN-ITEMS-FOR-DE.md`: the Desk field `cf_hub_sync_stamp`, the integration agent, the Deluge workflow, the department maps (with a second owner admin), Desk SLA off, a dry-run backfill, shadow, then live (`TICKET_SYNC_ENABLED=1`). Until C10 is live, a ticket created in the Hub does **not** reach Desk, so do not set `TICKETS_SOURCE=hub` before it.
2. **Merge and deploy the Hub endpoint** (Intelligence-Hub PR "signed portal → Hub ticket API") and this website PR. Both are inert on their own.
3. **Check the links.** Every portal company that should use the Hub needs `hub_account_id`, and its Hub account needs exactly one Hub client. Companies without one keep working on the Desk path, with a `no_account` or `client_mapping_required` note per ticket. Those notes tell you which companies still need linking.
4. **Set `TICKETS_SOURCE=hub`** in the website environment and restart the site. Then make one portal ticket and one widget ticket. Confirm each appears in the Hub and, through the sync, in Desk with the same subject. Reply once from the portal and once from Desk.
5. **Watch for a week.** Each day:
   - look at the reconciliation notes (`ls <site>/shared/spool/ticket-reconciliation/`);
   - look at the Hub's Data Manager, then *Ticket sync* (lag, failed work, needs-review items);
   - check that each note's ticket is in Desk.

   Anything that keeps repeating is a fix before step 6. To go back at any point, set `TICKETS_SOURCE=desk` and restart. Tickets already in the Hub stay there and keep syncing.
6. **Retire the direct Desk paths** once a clean week has passed:
   - website: remove the Desk create, list and comment code behind `TICKETS_SOURCE=desk` (the Desk failover email/spool stays as the last resort);
   - shieldkit: retire its direct Desk tickets. Security events already reach the Hub (Hub #838, `POST /integrations/v1/shieldkit/events`), and the Hub opens the ticket. Turn off shieldkit's own Desk ticket creation in the shieldkit repo.

   Each retirement is its own PR with Joe's approval.

## Where the code is

- Switch, ids, reconciliation, list merge: `server/ticketsSource.ts` (tests `server/ticketsSource.test.ts`).
- Hub client (signed, scoped secret only, never throws): `server/integrations/hubTicketClient.ts`. Contract: `server/integrations/hubTicketsContract.ts`.
- Contract fixture: `server/integrations/deSyncContract.fixture.json` → `reads.portalTickets`. It is byte-identical to the Hub's `artifacts/api-server/src/lib/de-sync-contract.fixture.json`, and both sides have parity tests.
- Widget: `server/widgetTicketRoute.ts` (tests `server/widgetTicketRoute.hub.test.ts`). Portal routes: `server/routes.ts` (`/api/portal/tickets*`).
- Hub side: Intelligence-Hub `artifacts/api-server/src/routes/portal-tickets.ts`, ADR 0020 "Portal bridge".
