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

## Carrier tracking (manual provider only)

When `PORTAL_SHIPPING_PROVIDER=manual` and staff entered a carrier and tracking number, the
server can ask UPS, FedEx or USPS for the current status (`carriers/`). Only carriers whose
keys are set are ever called. With no carrier keys the page behaves exactly as before
(staff-entered status, `carrierStatus: null` on every row). Vendor providers
(shipstation / easypost / shippo) are untouched.

| Env var | Meaning |
|---|---|
| `PORTAL_CARRIER_UPS_CLIENT_ID`, `PORTAL_CARRIER_UPS_CLIENT_SECRET` | UPS app Client ID / Client Secret (developer.ups.com app with the Tracking API product) |
| `PORTAL_CARRIER_FEDEX_CLIENT_ID`, `PORTAL_CARRIER_FEDEX_CLIENT_SECRET` | FedEx project API Key / Secret Key (developer.fedex.com project with Track API) |
| `PORTAL_CARRIER_USPS_CLIENT_ID`, `PORTAL_CARRIER_USPS_CLIENT_SECRET` | USPS app Consumer Key / Consumer Secret (developers.usps.com app with Tracking) |
| `PORTAL_CARRIER_UPS_ENV`, `PORTAL_CARRIER_FEDEX_ENV`, `PORTAL_CARRIER_USPS_ENV` | `sandbox` uses the carrier's documented test host; anything else (default) is production |
| `PORTAL_CARRIER_TRACKING` | `off` (or `false` / `0` / `no` / `disabled`) stops every carrier lookup |

A carrier counts as configured only when both its id and secret are set.
`carrierTrackingConfig(env)` (exported from `index.ts`) answers
`{ ups: { configured }, fedex: { configured }, usps: { configured } }`, booleans only.

How a page load works (`carriers/index.ts`):

- Carrier name: the staff-entered `carrier` is matched case-insensitively. UPS: `UPS`,
  `UPS Ground`, `United Parcel Service`... FedEx: `FedEx`, `Fed Ex`, `FedEx Ground`,
  `Federal Express`... USPS: `USPS`, `U.S.P.S.`, `USPS Priority Mail`, `U.S. Postal Service`,
  `United States Postal Service`. Anything else is not looked up.
- Tracking number: spaces are removed. UPS numbers must be 7-34 characters (the length the
  UPS Tracking spec states for `inquiryNumber`). FedEx and USPS publish no format in the docs
  that could be read, so only a letters-and-digits check applies (it keeps the number safe
  in a URL path).
- The newest 25 eligible rows are looked up, 4 at a time; older rows keep the staff status.
  The page waits at most 8 s; slower lookups finish in the background and fill the cache.
- Each answer, and each failure, is cached for 15 minutes per carrier + tracking number.
  OAuth tokens are cached until 60 s before the carrier's `expires_in`; a 401 on a tracking
  call refreshes the token once.
- Status: the carrier's status replaces the staff status, except that a carrier code we
  cannot map leaves the staff status, and a staff `delivered` / `cancelled` changes only
  when the carrier says delivered. When the carrier says delivered and staff left
  `deliveredAt` empty, it is set from the latest event's date.
- Any carrier failure (timeout, HTTP error, not found, bad JSON) keeps the staff status for
  that row, sets `carrierStatus: null`, and logs `[portal shipping] carrier lookup failed for
  shipment <id> (<carrier>): CarrierError: <carrier> <step> answered HTTP <n>`. Never a body,
  token or secret, and never a 502 for the page.

Each looked-up row gets:

```ts
carrierStatus: {
  source: "ups" | "fedex" | "usps";
  checkedAt: string;            // ISO UTC, when this server asked
  latestEvent: string | null;   // carrier's latest event text
  latestEventAt: string | null; // ISO 8601; UPS / FedEx with offset, USPS local wall time without offset
  latestLocation: string | null;// "City, ST" only
} | null
```

### UPS (built)

- Source: UPS's official OpenAPI specs at https://github.com/UPS-API/api-documentation
  (`Tracking.yaml`, `OAuthClientCredentials.yaml`, `UPSTrackAlert.yaml`), the files
  developer.ups.com renders. developer.ups.com itself was blocked by the egress proxy.
- Token: `POST {host}/security/v1/oauth/token`, HTTP Basic (client id : secret), form
  `grant_type=client_credentials`; `expires_in` is a string of seconds.
  https://developer.ups.com/api/reference/oauth/client-credentials
- Track: `GET {host}/api/track/v1/details/{inquiryNumber}?locale=en_US`, bearer token, required
  headers `transId` (unique per request; a 32-hex random id) and `transactionSrc`
  (`digerati-portal`). https://developer.ups.com/api/reference/tracking
- Hosts: production `https://onlinetools.ups.com`, sandbox `https://wwwcie.ups.com` (CIE).
- Status: `package[0].currentStatus.type`. `Tracking.yaml` gives only the example `X`; the value
  list is in `UPSTrackAlert.yaml` (`activityStatus.type`): `D` Delivery, `I` On the Way,
  `M` Manifest, `MV` Manifest Void, `U` Updated Delivery Date or Time, `X` Package Exception.
  Mapped: `D` = delivered only with a `deliveryDate`/`deliveryTime` of type `DEL`, otherwise
  in transit; `I`, `U` = in transit; `M` = label created; `MV` = cancelled; `X` = exception.
- Latest event: `activity[0]` (the spec says most recent first): `status.description`,
  `date` + `time` + `gmtOffset`, `location.address.city` / `stateProvince`.
- Limits: UPS keeps tracking data for 120 days (spec note), so older numbers fail and keep the
  staff status. No rate limit is stated in the spec.

### FedEx (built, confirm before switching on)

- Source: developer.fedex.com was blocked by the egress proxy, and FedEx publishes no
  official SDK or OpenAPI file on GitHub or npm. Everything below comes from search-engine
  excerpts of the official pages:
  https://developer.fedex.com/api/en-us/catalog/authorization/docs.html and
  https://developer.fedex.com/api/en-us/catalog/track/docs.html
- Token: `POST {host}/oauth/token`, `application/x-www-form-urlencoded`,
  `grant_type=client_credentials`, `client_id` (API Key), `client_secret` (Secret Key);
  `expires_in` seconds (standard one hour). FedEx's best-practice page says to cache the token
  until a 401, which the adapter does.
- Track: `POST {host}/track/v1/trackingnumbers`, bearer token, body
  `{ includeDetailedScans: true, trackingInfo: [{ trackingNumberInfo: { trackingNumber } }] }`.
- Hosts: production `https://apis.fedex.com`, sandbox `https://apis-sandbox.fedex.com`.
- Status: `output.completeTrackResults[0].trackResults[0].latestStatusDetail.code` (then
  `derivedCode`): `DL` delivered; `OD`, `IT`, `PU` in transit; `OC` label created; `SE`
  exception; `CA` cancelled; any other code keeps the staff status. **Gap:** this code list
  was not read on the FedEx page itself (it is the list quoted in excerpts and in FedEx
  sandbox mocks). Check it against the Track API docs' status code table before setting the
  FedEx keys, and replace `carriers/fixtures/fedex-track-trackingnumbers.json` with the docs'
  example response.
- Latest event: the newest `scanEvents[]` entry by `date` (`eventDescription`,
  `scanLocation.city` / `stateOrProvinceCode`), else `latestStatusDetail`.

### USPS (built)

- The legacy USPS Web Tools XML APIs were retired on January 25, 2026
  (https://www.usps.com/business/web-tools-apis/); this uses the current USPS APIs
  (`apis.usps.com`, OAuth 2.0).
- Source: USPS's official examples repository https://github.com/USPS/api-examples
  (README "OAuth Token" and "Tracking", Postman collection), which mirrors
  developers.usps.com. developers.usps.com and apis.usps.com were blocked by the egress proxy.
- Token: `POST {host}/oauth2/v3/token`, JSON `{ client_id, client_secret, grant_type:
  "client_credentials" }`; `expires_in` is a string. The README says a valid customer
  registration ID (CRID) and mailer ID (MID) are needed to get a token: DE's USPS business
  account must have them.
- Track: `GET {host}/tracking/v3/tracking/{trackingNumber}?expand=DETAIL`, bearer token.
  (Tracking 3.2, `/tracking/v3r2/tracking`, also exists; its README example shows a GET with
  a JSON array body, which is ambiguous, so 3.0 is used.)
- Hosts: production `https://apis.usps.com`, sandbox `https://apis-tem.usps.com`.
- Status: `statusCategory`. Only values shown in reachable official docs are mapped:
  `Accepted` (README example) and `In Transit` = in transit, `Delivered` = delivered (USPS
  Track & Confirm guide). **Gap:** the full category list is on developers.usps.com; other
  values (for example alerts) keep the staff status until mapped.
- Latest event: the newest `trackingEvents[]` entry (`eventType`, `eventTimestamp`,
  `eventCity` / `eventState`). USPS's example pairs `eventTimestamp`
  `"2023-08-02T07:31:00Z"` with "7:31 am ... in RICHMOND, VA", so the trailing `Z` is local
  time, not UTC: it is dropped and the time is passed on as local wall time.

### What Joe must obtain for carrier tracking

- UPS: a developer.ups.com app with the Tracking API product; its Client ID and Client Secret.
- FedEx: a developer.fedex.com project with the Track API; its API Key and Secret Key.
  Confirm the status code table (above) first.
- USPS: a developers.usps.com app with the Tracking API; Consumer Key and Secret, on a USPS
  business account with a CRID and MID.
- Optional: test each with `PORTAL_CARRIER_<X>_ENV=sandbox` first (test-host keys can differ
  from production keys).

The old root `SHIPPING_SETUP.md` was removed on 2026-10-10 (issue 395): it described Web
Tools keys, an admin carrier form and `/api/portal/shipping/rates`, `/label`, `/track` and
`/admin/shipping/carriers` endpoints that never existed in this codebase. This README is the
only shipping setup guide.

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
- `carriers/carriers.test.ts`: carrier mapping from `carriers/fixtures/*.json` (UPS: the spec's
  field examples; USPS: a byte copy of the README example; FedEx: documented field names, our
  values), carrier-name matching, request shapes and hosts, token caching and 401 refresh,
  15-minute result cache, per-page cap and concurrency, page budget, failure keeps the staff
  status, unconfigured carriers never called, kill switch.
- `routes.test.ts`: over HTTP, sample / hidden / needsCompany / notMapped / live / vendor
  failure / config failure / manual (with a failing carrier: still HTTP 200, staff status),
  and that each company only receives its own scope.
