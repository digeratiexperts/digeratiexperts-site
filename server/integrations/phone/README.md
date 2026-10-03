# Portal phone page data (`PORTAL_PHONE_PROVIDER`)

Backs `client/src/pages/portal/PortalCytracom.tsx` through `GET /api/portal/phone`
(`routes.ts`). The switch lives in `server/portalIntegrations.ts`.

| `PORTAL_PHONE_PROVIDER` | Page shows |
|---|---|
| unset / unknown / `sample` | Today's sample page and its "Sample data" notice. Production default. |
| `hidden` (`off`, `none`) | "Cytracom Phone isn't available on your account" notice; page leaves the nav. |
| `cytracom` | Live data from the Cytracom Public API (below). |

Softphone downloads and the support callout stay on the page in every mode.

## Endpoint contract

Always `{ success, status }`. In live mode also one of:

- `{ needsCompany: true }`: DE admin in admin view (no company in view).
- `{ notMapped: true }`: the company has no entry in `PORTAL_PHONE_CLIENT_MAP`. The vendor is not called.
- `{ data }`: `PhoneData` from `types.ts`.
- HTTP 502 `{ success: false, error: "Phone data isn't available right now." }`: vendor failure,
  missing token, or malformed map. The reason goes to the server log as
  `[portal-phone] cytracom failed for client <id>: ...`; tokens and vendor error bodies never
  reach the browser or the log.

## `cytracom` provider: BUILT (extensions only)

Cytracom's business phone (UCaaS) has an official public API. ControlOne is Cytracom's
separate network-security product and is not involved.

Official docs (Cytracom Help Center, section "Cytracom's Public API"):

- Section: https://help.cytracom.com/hc/en-us/sections/360003366471-Cytracom-s-Public-API
- Introduction (base URL, auth): https://help.cytracom.com/hc/en-us/articles/360021690072-API-Introduction
- Token management: https://help.cytracom.com/hc/en-us/articles/360022561751-API-Token-Management
- Data Services (`/data/users`, `/data/resources`): https://help.cytracom.com/hc/en-us/articles/360021912211-API-Data-Services
- Insights (call detail records): https://help.cytracom.com/hc/en-us/articles/360022377692-API-Insights
- Events: https://help.cytracom.com/hc/en-us/articles/360021998772-API-Events
- Call control: https://help.cytracom.com/hc/en-us/articles/360022188091-API-Call-Control-Actions
- Developer landing page: https://www.cytracom.com/resources/developers

What the docs say and the adapter uses (`cytracom.ts`):

- Base URL `https://api.cytracom.net/v1.0`. Every request carries a token, sent as in the
  documented `curl --user token:<<YOUR-TOKEN>>`, i.e. HTTP Basic, user `token`, password = token.
- A token is created by an admin **of one customer account** (Users > Tokens > +New) and reads
  that account only. The docs describe no partner-wide token and no tenant filter.
- `GET /data/users` lists extensions with their users: `name`, `extension_number`, `email`
  (`null` when no user is assigned). `limit` defaults to 100, max 1000; the adapter asks for 1000.

The page shows, for the company in view: the signed-in user's extension (matched
case-insensitively on their portal sign-in email against the extension's Cytracom user email),
the number of extensions, and the company extension list (name, extension, user assigned or not).
Emails are used server-side for the match and are not sent to the browser.

### Per-company scope

Because a Cytracom token is the account boundary, the client map holds a **token key** per
company, and each company's token sits in its own variable:

```
PORTAL_PHONE_PROVIDER=cytracom
PORTAL_PHONE_CLIENT_MAP={"<portal clientId>":"ACME","<other clientId>":"GLOBEX"}
PORTAL_PHONE_CYTRACOM_TOKEN_ACME=<token created by ACME's Cytracom admin>
PORTAL_PHONE_CYTRACOM_TOKEN_GLOBEX=<token created by GLOBEX's Cytracom admin>
```

- Key must match `[A-Z0-9_]{1,64}` (case-insensitive) and is always read under the
  `PORTAL_PHONE_CYTRACOM_TOKEN_` prefix, so a map entry cannot reach another variable.
- Unmapped company: `{ notMapped: true }`, no vendor call.
- Mapped but token variable missing, or map not valid JSON: 502 and a log line (fails closed).
- A company is only ever served with the token its own map entry names (route tests cover this).

### Gaps (what the live page does not show, and why)

| Sample page item | Live status | Reason |
|---|---|---|
| Phone status (Online) | Not shown | Not in the public API: no endpoint for device registration or presence. |
| Voicemails count | Not shown | Not in the public API: no voicemail message endpoint. |
| Today's calls / Recent calls | Not built | Insights is documented, but its list response could not be read first-hand; see "Call history (Insights)" below. |
| Phone settings form, quick actions | Sample mode only | They never saved anything; the docs offer no settings-write endpoint. |

The live page says plainly that phone status, call history and voicemail counts are not connected
yet and points people to the Cytracom app.

### Call history (Insights): NOT BUILT, gap recorded

Planned behind a second switch, `PORTAL_PHONE_CALL_HISTORY=on` (default off), because the docs
do not say whether every token may read Insights. Nothing reads that variable yet, so Insights is
never called and setting it has no effect today.

Doc: https://help.cytracom.com/hc/en-us/articles/360022377692-API-Insights

What search-engine extracts of that page show (the page itself is blocked by this session's egress
proxy, and Cytracom publishes no SDK or OpenAPI file on GitHub or npm):

- `POST /insights/search` lists call detail records (CDRs); `POST /insights/scroll` continues a
  search with the `scroll_id` returned by each response; `GET /insights/{linked_id}` returns one.
- Only calls from the previous 6 months; a `date_range` must not exceed 90 days.
- Request body, from the documented curl example:
  `{"query":{"date_range":{"start":"2018-07-27T00:00:00.000-0600","end":"2018-09-25T23:59:59.000-0600"},"general_search":"Cytracom"},"options":{"size":4,"scroll":"true"}}`.
  `start`/`end` take ISO 8601 or epoch milliseconds; `options.size` max 100. A second form uses
  `{"query":{"since_linked_id":"..."}}`.
- Record attributes named: `linked_id`, `uuid`, `started_on`, `started_on_ts`, `direction`
  ("inbound is coming from external; outbound is going to external; internal is within the
  system"), `answered`, `dialed_number`, `original_caller_id`, `toll_free`, and `legs[]` (with
  `duration` in seconds, `source`, `destination`). The single-record answer is wrapped as
  `{"data":{"call_detail":{...}},"code":200}`.

Why nothing was built: the extracts never show the **`/insights/search` response envelope** (where
the record list sits next to `scroll_id`), whether `duration` and `answered` sit on the record or
only on its legs, which field carries the extension, or a documented criterion that filters by
extension. Parsing a guessed envelope would break the "documented fields only" rule, and the test
fixtures must be copied from the doc's examples, which could not be read verbatim.

To build it (one slice once the doc text is in hand): open the Insights page in a browser and
paste the full `/insights/search` example response and the criteria and attribute tables into
this README. Planned shape: last N days (N <= 90) via `date_range`, `options.size` 100; counts
total / inbound / outbound / missed (missed = inbound and not `answered`, only if `answered` is a
record attribute); a recent list (time, direction, extension, duration); caller numbers masked to
the last 4 digits on the server; read only with the company's own token.

### Voicemail and devices

The Data Services doc lists `GET /data/resources` (call routing resources: `id`, `name`,
`number`, `type`; filters `type` and `number`; types include `phone` and `mailbox`). That gives
names and numbers only, with no registration state and no message counts, so it adds nothing a
client can act on beyond the extension list already shown; not built. **Device registration
status and voicemail message counts are not in the public API.**

**Verification note.** `help.cytracom.com` and `cytracom.com` were blocked by this session's
network egress proxy, so the pages could not be opened directly. Everything above was read from
search-engine extracts of those official pages (the `/data/users` example in
`cytracom.fixtures.ts` is the documented example). Before switching production to `cytracom`,
open the Data Services and Introduction pages and confirm the auth form, the `limit` parameter
and the `data.users` envelope; then make one call with a real token.

### Getting a token for a client account

Per https://help.cytracom.com/hc/en-us/articles/360022561751-API-Token-Management, only the
customer account's administrator can create or delete a token, and a token reads only that
customer account.

1. Sign in to the client's Cytracom web portal as that account's administrator (the client's
   admin, or DE if DE holds the admin role on that account).
2. Open **Users**, then the **Tokens** tab.
3. Click **+New**, enter a name that says what it is for (for example `Digerati portal`), and
   click **Save**. The token is generated.
4. Click **Copy** to put the token on the clipboard. Do not paste it into email, chat or a ticket.
5. Add it to the production environment file on the server as
   `PORTAL_PHONE_CYTRACOM_TOKEN_<KEY>` (below), add the company to `PORTAL_PHONE_CLIENT_MAP`,
   and restart the app.
6. To revoke: same Tokens tab, click delete twice. Then remove the variable.

### Environment variables DE sets

| Variable | Value | Notes |
|---|---|---|
| `PORTAL_PHONE_PROVIDER` | `cytracom` | Unset = sample page (production default); `hidden` removes the page. |
| `PORTAL_PHONE_CLIENT_MAP` | JSON object, portal clientId -> token key, e.g. `{"<clientId>":"ACME"}` | Key: letters, digits, `_`, up to 64; upper-cased. Invalid JSON makes the page answer 502. |
| `PORTAL_PHONE_CYTRACOM_TOKEN_<KEY>` | The token from the steps above | One per mapped company. Secret: never in the repo, never in logs. |
| `PORTAL_PHONE_CALL_HISTORY` | `on` | Reserved for call history. Not read by any code yet (see the Insights gap). |

The admin setup page can show each company's state with
`phoneSetupStatus(env, clientIds)` from `index.ts`: per clientId
`{ mapped, tokenSet, tokenEnvName }` (booleans and the variable name, never the token). It throws
`PhoneConfigError` when `PORTAL_PHONE_CLIENT_MAP` is not a JSON object.

### Rate limits

None are documented. The page caches the answer for 60 s in the browser (react-query
`staleTime`); the server does not cache.

## What Joe needs to supply

1. For each client company on Cytracom: an API token created by that company's Cytracom account
   admin (or by DE if DE holds the admin role on that account), stored as
   `PORTAL_PHONE_CYTRACOM_TOKEN_<KEY>`.
2. `PORTAL_PHONE_CLIENT_MAP` mapping each portal clientId to its `<KEY>`.
3. Ask Cytracom (partner support) whether a **partner-level token** across customer accounts
   exists; if so the map could hold a customer code instead of one token per company.
4. To fill the call history: open the Insights doc in a browser (or ask Cytracom) and paste the
   full `/insights/search` example response and its criteria/attribute tables here; ask whether
   records can be filtered by extension and whether every token may read Insights.
5. For phone status and voicemail counts: ask Cytracom whether any API exposes device
   registration state or mailbox message counts; the public docs show none.

Until then `PORTAL_PHONE_PROVIDER=hidden` removes the page, or leave it unset to keep the sample.

## Tests

- `cytracom.test.ts`: mapping of the documented `/data/users` example, request URL and Basic
  auth, email kept server-side, vendor-failure error without vendor text, client-map parsing,
  token-key restriction, and `phoneSetupStatus` (names and booleans only, never a token value).
- `routes.test.ts`: over HTTP: sample, hidden, needsCompany, notMapped (no vendor call), live
  data, per-company token isolation (including a DE admin viewing as a company), vendor 401 -> 502
  with a generic message and a log line without the token, missing token -> 502, malformed map -> 502.
