# VPN Access data sources (`PORTAL_VPN_PROVIDER`)

The portal's VPN Access page (`client/src/pages/portal/PortalVPN.tsx`) reads
`GET /api/portal/vpn` (`routes.ts`). The provider is chosen by one variable:

| `PORTAL_VPN_PROVIDER` | Page shows |
|---|---|
| unset / unknown / `sample` | today's sample page and its "Sample data" notice (default; production unchanged) |
| `hidden` | removed from the nav; route shows "isn't available on your account" |
| `tailscale` | the company's Tailscale devices (built) |
| `twingate` | devices of the company's Twingate group users (built; verify with a live key first, see gaps) |
| `perimeter81` | **not built**: always HTTP 502 "not available" plus a server log line |
| `manual` | WireGuard / OpenVPN devices DE staff enter in the portal (built) |

Endpoint contract (live mode): `{ success, status }` plus one of
`{ needsCompany: true }` (DE admin with no company in view), `{ notMapped: true }`,
`{ data: VpnData }` (`types.ts`), or HTTP 502 `{ success: false, error }` with the
reason in the server log only (`[portal-vpn] <provider> failed for client <id>: ...`).
`manual` also answers `{ manage: { clientId } }` to a DE admin viewing as a company.

## Per-company scope: `PORTAL_VPN_CLIENT_MAP`

DE's vendor account is shared by every client, so each portal company maps to
its own slice of it. JSON object, portal `clientId` -> scope string:

```
PORTAL_VPN_CLIENT_MAP='{"<acme clientId>":"tag:acme","<globex clientId>":"tag:globex"}'   # tailscale
PORTAL_VPN_CLIENT_MAP='{"<acme clientId>":"R3JvdXA6MTIz"}'                                 # twingate (group id)
```

- A company with no entry gets `{ notMapped: true }` and no vendor call. It never
  sees another company's devices or the unfiltered list.
- Malformed JSON, a value of the wrong shape (a Tailscale value without `tag:`),
  or a Twingate group that does not exist is a configuration fault: 502, logged.
- Filtering is server-side; the browser only ever receives the mapped company's devices.
- `manual` needs no map: records are stored per portal company already.
- Vendor answers are cached per provider + scope for 60 seconds.

## tailscale

- **Scope: a device tag per company** (e.g. `tag:acme`). One DE tailnet; Tailscale
  tags are the tailnet's identity for devices ("Once a device is tagged, the tag is
  the owner of that device"), and ACLs grant access by tag, so DE tags each client
  device anyway. A tailnet per company would also work but needs a separate token
  per tailnet; not built. External (shared-in) devices have no tags and never match.
- **Env:** `PORTAL_VPN_TAILSCALE_API_KEY` (`tskey-api-...`, expires in 1 to 90 days),
  or, preferred for production, an OAuth client that does not expire:
  `PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_ID` + `PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_SECRET`
  (give it device read access). Optional `PORTAL_VPN_TAILSCALE_TAILNET` (default `-`,
  the token's own tailnet).
- **Calls:** `GET https://api.tailscale.com/api/v2/tailnet/{tailnet}/devices`
  (Bearer token; default field set). OAuth: client-credentials grant at
  `POST https://api.tailscale.com/api/v2/oauth/token`.
- **Mapping:** `connectedToControl` -> online / offline; `authorized: false` -> awaiting
  approval; `lastSeen` (empty while connected); `os`; `user`; `hostname`.
- **Docs:** https://tailscale.com/api (current home; blocked from the build sandbox),
  same reference as published by Tailscale in their repo:
  https://github.com/tailscale/tailscale/blob/v1.72.0/publicapi/readme.md ,
  https://github.com/tailscale/tailscale/blob/v1.72.0/publicapi/tailnet.md#list-tailnet-devices ,
  https://github.com/tailscale/tailscale/blob/v1.72.0/publicapi/device.md ;
  official client for the `{ devices: [...] }` envelope, `connectedToControl` and the
  OAuth token URL: https://github.com/tailscale/tailscale-client-go-v2 (`devices.go`, `oauth.go`).
- **Limits / gaps:** no pagination ("All results are returned at once"). The repo copy
  of the docs predates `connectedToControl`; it is taken from Tailscale's official Go
  client. If a device lacks it the page shows "Unknown", not a guess.
- **Client downloads:** https://tailscale.com/download/windows , /download/mac , /download .

## twingate

- **Scope: a Twingate Group per company** (map value = group id). Groups are how
  Twingate authorizes users to Resources, so DE already keeps one per client. The page
  shows the devices of that group's users. Do not map a company to the built-in
  "Everyone" group. Archived devices are left out.
- **Env:** `PORTAL_VPN_TWINGATE_NETWORK` (the subdomain of `<network>.twingate.com`),
  `PORTAL_VPN_TWINGATE_API_KEY` (Admin Console: Settings > API > Generate Token).
- **Call:** `POST https://<network>.twingate.com/api/graphql/`, header `X-API-KEY`,
  query `group(id) { users(after) { pageInfo, edges { node { email, firstName, lastName,
  devices { edges { node { id name osName deviceType activeState lastSuccessfulLoginAt }}}}}}}`.
  Up to 10 pages of group users per load.
- **Mapping:** `activeState` ACTIVE -> "Active", BLOCKED -> "Blocked", ARCHIVED -> hidden;
  last column is `lastSuccessfulLoginAt` ("Last sign-in").
- **Docs:** https://www.twingate.com/docs/api-overview (endpoint, `X-API-KEY`,
  60 reads / 20 writes per minute, 429 when exceeded),
  https://www.twingate.com/docs/api (schema: `Group.users`, `User.devices`,
  `DeviceActiveState`, `Device.lastConnectedAt` deprecated and empty),
  https://www.twingate.com/docs/introduction-to-the-python-cli (Twingate's CLI; its
  published queries use the same device fields:
  https://github.com/Twingate-Labs/Twingate-CLI/blob/main/src/tgcli/queries/devices.py),
  https://github.com/Twingate/terraform-provider-twingate (`group(id) { users(after, first) }`, `pageInfo`).
- **Limits / gaps:**
  - The twingate.com docs pages were blocked from the build sandbox; the schema facts
    above come from the docs' indexed text and Twingate's own published code. Before
    enabling, run the query once in the Admin API explorer with DE's key.
  - The Admin API reports no live "connected now" state (`lastConnectedAt` is deprecated
    and returns empty), so the page shows "Active" and the last sign-in, not online/offline.
  - A user's nested device list is read as one page; if Twingate reports more, the
    server logs that the list was cut short.
  - 60 reads per minute for the whole DE network: the 60-second cache keeps one company's
    page views to about one read a minute.
- **Client downloads:** https://www.twingate.com/download (one page for every platform).

## perimeter81 (Check Point Harmony SASE) — not built

- Harmony SASE's public API (gateway `https://api.perimeter81.com/api/rest`, reference
  https://support.perimeter81.com/apidocs) documents Users (members), Groups, Addons
  and Networks. Its getting-started page lists **Devices** (with Applications, Logs and
  Settings) as path classes that "will be released soon":
  https://support.perimeter81.com/docs/api-getting-started ,
  https://support.perimeter81.com/v1/docs/api-getting-started .
- The page needs each company's devices and their connection state; no documented
  endpoint returns them, so the adapter makes no vendor call. It throws
  `VpnProviderUnavailableError`, the route logs
  `[portal-vpn] perimeter81 failed for client <id>: ... no devices endpoint ...`
  and answers 502 with the generic message. The perimeter81.com docs were also blocked
  from the build sandbox; recheck the reference before building, and only from a
  documented devices endpoint.

## manual

- **Records:** `kind: "vpn_device"` via the DE-admin API `/api/portal/admin/manual-records`
  (`server/portalManualRecords.ts`). A DE admin viewing as a company gets add / edit /
  remove controls on the page.
- **Fields (`data`):** `name` (required), `os`, `protocol` (`wireguard` | `openvpn`),
  `status` (`active` | `blocked`), `lastSeen` (date), `user`, `notes`. Anything else is
  dropped when read. Never store private keys or config files; config download is out of scope.
- **Client downloads:** https://www.wireguard.com/install/ , https://openvpn.net/client/ .
- No live state: the page shows "Managed by DE" and the staff-entered status.

## What Joe must supply before switching a provider on

- tailscale: an OAuth client (or API key) for DE's tailnet with device read access;
  a `tag:<company>` on every client device (declared in the tailnet policy `tagOwners`);
  the client map.
- twingate: the network subdomain, an Admin API token, a group per client company,
  the client map (group ids come from the Admin API, e.g. a `groups` query).
- manual: nothing; enter devices as a DE admin viewing as the company.

## Tests

`adapters.test.ts` (fixtures in `fixtures/`, each citing its source) and `routes.test.ts`
(sample, hidden, needsCompany, notMapped, live per provider, vendor failure, bad map,
cross-company isolation).
