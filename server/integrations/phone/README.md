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
| Phone status (Online) | Not shown | The docs list no endpoint for device registration or presence. |
| Voicemails count | Not shown | The docs list no voicemail endpoint. |
| Today's calls / Recent calls | Not shown yet | Insights (`POST /insights/search`, `GET /insights/{linked_id}`) is documented, max 90-day range, calls from the last 6 months. The single-record example is clear, but the list endpoint's response envelope could not be confirmed (see the note below), so it is not wired. |
| Phone settings form, quick actions | Sample mode only | They never saved anything; the docs offer no settings-write endpoint. |

The live page says plainly that phone status, call history and voicemail counts are not connected
yet and points people to the Cytracom app.

**Verification note.** `help.cytracom.com` and `cytracom.com` were blocked by this session's
network egress proxy, so the pages could not be opened directly. Everything above was read from
search-engine extracts of those official pages (the `/data/users` example in
`cytracom.fixtures.ts` is the documented example). Before switching production to `cytracom`,
open the Data Services and Introduction pages and confirm the auth form, the `limit` parameter
and the `data.users` envelope; then make one call with a real token.

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
4. To fill the call history: ask Cytracom for (or open in a browser) the full `/insights/search`
   response example, and whether call records can be filtered by extension.
5. For phone status and voicemail counts: ask Cytracom whether any API exposes device
   registration state or mailbox message counts; the public docs show none.

Until then `PORTAL_PHONE_PROVIDER=hidden` removes the page, or leave it unset to keep the sample.

## Tests

- `cytracom.test.ts`: mapping of the documented `/data/users` example, request URL and Basic
  auth, email kept server-side, vendor-failure error without vendor text, client-map parsing and
  token-key restriction.
- `routes.test.ts`: over HTTP: sample, hidden, needsCompany, notMapped (no vendor call), live
  data, per-company token isolation (including a DE admin viewing as a company), vendor 401 -> 502
  with a generic message and a log line without the token, missing token -> 502, malformed map -> 502.
