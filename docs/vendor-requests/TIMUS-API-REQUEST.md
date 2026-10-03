# Timus API request (VPN Access page)

Status: **not sent** (prepared 2026-10-03). Owner: Joe. Decision: VPN Access = Timus
(`VENDOR_SETUP_STATUS.md`, "Portal tools waiting on vendors").

Why: the client portal's VPN Access page (`/portal/vpn`) should show each client company
its own Timus devices and their connection state. Everything is built except the Timus
call, because Timus publishes no API reference we can build from. Timus Manager's
**API Access** screen issues a Client ID + Client Secret (documented for the Active
Directory Directory Connector only). Research and links: `server/integrations/vpn/README.md`, section "timus".

## Message to send (Timus partner team / partner success manager)

> We are a Timus MSP partner and want to show each of our customers their own Timus
> devices in our client portal (read-only, server-side). Please send:
>
> 1. **API documentation**: the URL of the API reference (OpenAPI / Swagger file or
>    Postman collection if you have one) and the API base URL.
> 2. **Authentication**: how calls are authorized. Are the Client ID / Client Secret from
>    Timus Manager > Settings > Configurations > API Access usable for this? Which
>    "Application Type" to choose, the token URL and grant type, token lifetime, and
>    whether credentials expire.
> 3. **Partner vs per-tenant credentials**: can one partner-level credential (Partner
>    Portal) read all our customers, or do we need a credential per customer tenant?
>    Can it be limited to read-only?
> 4. **Customer identification**: how a customer is identified in the API (tenant id,
>    company id, organization id, site id), and where we find that id for each customer.
> 5. **Endpoints** (read-only), filtered to one customer, with an example response for each:
>    - devices: id, name, OS, assigned user, device posture / compliance if available
>    - users: id, email, name, team
>    - connection status: connected now or not, and last connected time per device or user
>    - connector / gateway / site status (online, last heartbeat)
> 6. **Paging and rate limits**: page size, pagination method, requests per minute, and
>    the response when exceeded.
> 7. **Sandbox**: a test tenant (or a partner sandbox) we can call before production.
> 8. **Data a customer may see**: any field you advise us not to show end customers
>    (for example internal ids, IP addresses, location).
> 9. **Roadmap**: if devices or connection status are not in the API yet, the expected
>    date; and whether webhooks, SCIM or log export (syslog / SIEM) are planned.

## What DE sets once Timus answers

Nothing changes in production until these are set and the adapter is built
(`server/integrations/vpn/timus.ts`, the only file that changes; it does not read these yet).

```
PORTAL_VPN_PROVIDER=timus
PORTAL_VPN_TIMUS_API_KEY=<credential from Timus; may become CLIENT_ID + CLIENT_SECRET per their auth>
PORTAL_VPN_TIMUS_BASE_URL=<API base URL from Timus>
PORTAL_VPN_CLIENT_MAP='{"<portal clientId>":"<Timus tenant / customer id>","<portal clientId 2>":"<Timus tenant id 2>"}'
```

- `PORTAL_VPN_CLIENT_MAP` keys are portal company ids (DE admin > Data sources lists them);
  values are the Timus customer id from answer 4. A company with no entry sees
  "isn't linked yet", never another company's devices.
- Values go in the host environment only (never in git). Until then, leave
  `PORTAL_VPN_PROVIDER` unset (sample page) or use `manual` and enter or import devices by hand
  (VPN Access page, as a DE admin viewing the company: Add device or Import CSV, for example
  from a Timus Manager export).

## Checklist when the answer arrives

- [ ] Docs URL recorded in `server/integrations/vpn/README.md` and above each call in `timus.ts`.
- [ ] Fixture copied from the docs' example response (URL cited in the fixture).
- [ ] Tests: mapped tenant only, unmapped -> notMapped, vendor failure -> generic 502.
- [ ] Sandbox call verified; then production env set; page checked as two companies.
