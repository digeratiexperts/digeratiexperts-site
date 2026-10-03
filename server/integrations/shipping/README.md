# Ship Center data sources (`PORTAL_SHIPPING_PROVIDER`)

`GET /api/portal/shipping` (routes.ts) backs `client/src/pages/portal/PortalShipCenter.tsx`.
Nothing changes in production until `PORTAL_SHIPPING_PROVIDER` is set.

| Value | Page shows |
|---|---|
| unset / unknown (`sample`) | today's sample page and its "Sample data" notice |
| `hidden` (`off`, `none`) | "Ship Center isn't available on your account" |
| `shipstation` / `easypost` / `shippo` | the company's shipments from that vendor |
| `manual` | tracking numbers DE staff enter per company |

Live answers: `{ needsCompany }` (DE admin in admin view), `{ notMapped }` (company has no
client-map entry: the page says "not linked yet", no figures), `{ data }` (`ShippingData`,
types.ts) or HTTP 502 with a generic message. Vendor and configuration faults are logged
server-side (`[portal shipping] ...`, HTTP status only, never vendor body text or credentials).

"Create new shipment" and "Contact Support" open `/portal/tickets/create` in live mode: no
documented shipment-creation flow is wired in, so the page does not pretend to book one.

## Per-company scope: `PORTAL_SHIPPING_CLIENT_MAP`

Vendor accounts are DE-wide. Each vendor adapter needs a JSON object of portal client id to
scope string. A company with no entry gets `{ notMapped: true }` and the vendor is never called.
Invalid JSON or a malformed scope is a configuration fault (502), never "show everything".

```
PORTAL_SHIPPING_CLIENT_MAP='{"<portal clientId>":"<scope>", ...}'
```

| Provider | Scope string | Who filters |
|---|---|---|
| shipstation | `"<storeId>"` (numeric) | ShipStation (`storeId` query parameter) |
| easypost | `"user_<id>"` (Child User, recommended) | EasyPost (the child's own key only sees the child's shipments) |
| easypost | `"reference:ACME-"` | this server (prefix match on `reference`) |
| shippo | `"account:<ShippoAccountID>"` (managed account, recommended) | Shippo (`SHIPPO-ACCOUNT-ID` header) |
| shippo | `"metadata:ACME-"` | this server (prefix match on `metadata`) |

Prefix scopes must be 3-64 characters and end with `-`, `:`, `_`, `/` or `#`, so `ACME-`
can never match `ACMECORP-1`. Staff must start every label's reference / metadata with the
company's prefix; a label without it is shown to nobody.

## shipstation (ShipStation API V1)

- Env: `PORTAL_SHIPPING_SHIPSTATION_API_KEY`, `PORTAL_SHIPPING_SHIPSTATION_API_SECRET`
  (ShipStation: Account Settings > API Settings).
- Auth / host / limit: https://www.shipstation.com/docs/api/requirements/ (Basic auth, key as
  username and secret as password; `https://ssapi.shipstation.com/`; 40 requests per minute
  per key pair). Each page view is one request.
- Call: `GET /shipments?storeId=&includeShipmentItems=true&sortBy=ShipDate&sortDir=DESC&page=1&pageSize=100`,
  https://www.shipstation.com/docs/api/shipments/list/
  (mirror https://docs.shipstation.com/apis/shipstation-v1/docs/shipments/list).
- Scope: a store id. DE needs one ShipStation store per client (e.g. a manual store each).
  List Shipments cannot filter by tag, so tags were not used. If any returned row's
  `advancedOptions.storeId` names another store, the whole answer is refused.
- Gaps: V1 shipments are labels: no carrier tracking status, no tracking URL, no delivered
  date. Rows show "Label created" (or "Cancelled" when voided), the "Active shipments" tile
  shows "—" and says ShipStation doesn't report delivery progress. Per the docs, orders
  marked shipped without a ShipStation label are not returned. `total` is ShipStation's
  count for the store (voided labels included); the newest 100 are listed.
- Not used: ShipStation API V2 (`api.shipstation.com`, `API-Key` header) has tracking
  status, but the brief and Joe's likely account use V1 key + secret.

## easypost (EasyPost API v2)

- Env: `PORTAL_SHIPPING_EASYPOST_API_KEY` (the parent account's key).
- Auth: https://docs.easypost.com/docs/authentication (Basic, API key as username, no password).
- Calls:
  - Child scope: `GET https://api.easypost.com/v2/api_keys` with the parent key
    (https://docs.easypost.com/docs/api-keys#retrieve-an-api-key: returns `children[]` with
    `id`, `keys`, `children`), take that child's active production key (cached 5 minutes in
    memory), then `GET /v2/shipments` with the child's key.
  - Reference scope: `GET /v2/shipments` with the parent key (no `include_children`), up to
    5 pages of 100 via `before_id`, keeping prefix matches.
  - Shipments: https://docs.easypost.com/docs/shipments#retrieve-all-shipments
    (`page_size` max 100, `purchased=true`, `start_datetime`/`end_datetime` set to the last
    90 days; EasyPost defaults to one month otherwise).
  - Tracker fields (`status`, `public_url`, `tracking_details`): https://docs.easypost.com/docs/trackers#tracker-object
  - Child users: https://docs.easypost.com/docs/users/child-users
- Status: tracker status `pre_transit` = Label created; `in_transit` / `out_for_delivery` /
  `available_for_pickup` = In transit; `delivered`; `return_to_sender` / `failure` / `error` =
  Exception; `cancelled` or a submitted / refunded refund = Cancelled. "Track" opens the
  tracker's `public_url`.
- Gaps: no item counts on EasyPost shipments; the list covers the last 90 days.

## shippo (Shippo API)

- Env: `PORTAL_SHIPPING_SHIPPO_API_TOKEN` (live token, `shippo_live_...`).
- Auth: `Authorization: ShippoToken <token>`, https://docs.goshippo.com/docs/Guides_general/authentication
- Call: `GET https://api.goshippo.com/transactions?page=&results=100`,
  https://docs.goshippo.com/api-reference/transactions/list-all-shipping-labels
  (answers `{ next, previous, results[] }`; filters exist for rate, object_status and
  tracking_status only, not metadata).
- Managed accounts: https://docs.goshippo.com/docs/platformaccounts/platform_using_accounts
  ("SHIPPO-ACCOUNT-ID: <ShippoAccountID>" header). Needs a Shippo Platform account.
- Status: transaction `WAITING` / `QUEUED` = Processing; `REFUNDED` / `REFUNDPENDING` =
  Cancelled; `ERROR` (failed label purchase) is not shown; otherwise tracking_status
  `PRE_TRANSIT` = Label created, `TRANSIT` = In transit, `DELIVERED`, `RETURNED` / `FAILURE` =
  Exception, `UNKNOWN`. "Track" opens `tracking_url_provider`.
- Gaps: no delivered date (only `eta`, not shown) and no item count. `rate` is usually a bare
  rate id in list answers, so the carrier column is blank unless the rate object is embedded
  (no extra per-row rate lookups are made).

## manual

- No env beyond `PORTAL_SHIPPING_PROVIDER=manual`; no client map (records are stored per company).
- Records: `server/portalManualRecords.ts`, kind `shipment`, `data` fields `reference`,
  `carrier`, `trackingNumber`, `trackingUrl`, `status` (one of the normalized statuses),
  `shippedAt`, `deliveredAt` (YYYY-MM-DD), `items`, `notes`.
- A DE admin viewing as a company gets add / edit / delete on the page (the route adds
  `manage: { clientId }`), calling `/api/portal/admin/manual-records`.
- Track links: no carrier deep-link is generated from a tracking number. UPS documents
  tracking links only as a licensed HTML form post (https://www.ups.com/gec/techdocs/pdf/trackhtml_v3.pdf);
  no FedEx or USPS page publishing a deep-link pattern was found. Staff may paste the carrier's
  tracking URL (http/https only) and the page shows "Track" for it.

## Doc access and fixtures

The build machine's egress proxy blocked `shipstation.com`, `docs.shipstation.com`,
`docs.easypost.com` and `docs.goshippo.com`. Endpoints, auth and fields were confirmed from
the official docs pages through search excerpts, and for EasyPost and Shippo from the vendors'
official SDKs on npm (`@easypost/api` 8.9.0, `shippo` 2.18.0, generated from Shippo's OpenAPI
spec). The fixtures in `fixtures/` cite their doc URL and use the documented field names, but
their values are not byte copies of the docs' example responses. Before switching a provider
on, run one real request against a test store / child / managed account to confirm.

## What Joe must supply per provider

- shipstation: API key + secret; one store per client; the store id for each client.
- easypost: parent production API key; one Child User per client (or a reference prefix
  convention); the child user id for each client.
- shippo: live API token; a Platform account with one managed account per client (or a
  metadata prefix convention); the account id for each client.
- manual: nothing; DE staff enter tracking from the page while viewing as the company.

## Tests

- `adapters.test.ts`: mapping from `fixtures/*.json`, scope parsing, auth headers, prefix
  safety, vendor errors without body text.
- `routes.test.ts`: over HTTP, sample / hidden / needsCompany / notMapped / live / vendor
  failure / config failure / manual, and that each company only receives its own scope.
