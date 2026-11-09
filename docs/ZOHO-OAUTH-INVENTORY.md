# Zoho OAuth inventory and reconnect runbook (website)

**Status:** live in production since 2026-10-10 (PR #562); Zoho Connect enabled and approved the same day.
**Standard:** Intelligence Hub `docs/ZOHO-OAUTH-STANDARD.md`. That repo's `lib/zoho-oauth` is the reference implementation, ported here. This page covers what the website does and where it differs from the Hub.

Env vars are listed **by name only**. Values live in `/home/digeratiexperts.com/shared/.env` on the VPS, never in this repository.

## Rules for every agent and person (read before touching Zoho)

**Production state, 2026-10-10:** Zoho Connect is **on**. One Zoho API Console **Server-based Application** (`ZOHO_CONNECT_CLIENT_ID`) holds one grant that serves the website's CRM, Billing, Desk, Books and Payments. Joe approved it once at `/api/zoho/connect`.

**Connect only, 2026-11-06 (issue #974):** the Connect grant is now the **only** credential. The code no longer reads the legacy Self Client refresh tokens or their per-product clients, so there is no fallback and no kill switch back to them. See "Retired: Self Client tokens" below for the env vars Joe can delete once this is LIVE.

Two Zoho limits drive these rules:
- Each client holds at most **20 refresh tokens per user**. The 21st silently revokes the oldest, which may be another product's live token.
- Each refresh token allows **10 access-token requests per 10 minutes**. Going over looks like a dead token, but it is throttling.

Before 2026-10-10, ignoring them took the Desk down again and again (issue #418).

1. **Never generate a grant code on the Connect client.** Don't use the Connect client from the Intelligence Hub, scripts, MCP servers or any other repo. It belongs to the website alone. Another system needs its own client.
2. **Never generate grant codes on the retired Self Clients** (the ones that issued the old refresh tokens listed under "Retired: Self Client tokens"). The website no longer uses them; a new code on one only spends a slot and is never read.
3. **Website code never calls `/oauth/v2/token` itself.** Every Zoho call goes through `server/zoho/oauth`: `createZohoProductAuth` → `getAccess()` / `fetchWithAuth()`, and `check()` / `status()` for health. No hand-rolled refresh, no per-request token, and no env refresh-token fallback of any kind. `server/zoho/oauth/token-endpoint.ts` is the only file that names the token path; the portal sign-in's code exchange goes through its `callZohoTokenEndpoint` too. `server/zoho/oauth/noDirectTokenCalls.test.ts` fails the build if the token path or a retired Self Client setting appears anywhere else.
4. **Health checks and status pages never request a token.** They read `status()`, or `check()`, which makes at most one cheap probe every 10 minutes. Never poll Zoho in a loop.
5. **Never hardcode a Zoho host** (`accounts.zoho.com`, `www.zohoapis.com`, `desk.zoho.com`, `payments.zoho.com`). Take it from `server/zoho/oauth/dc.ts` or the access's `dc`.
6. **Read the state before acting:**
   - `degraded`: Zoho is throttling or down. **Do nothing.** It retries with a backoff. Never rotate a token, generate a code or restart to "fix" it.
   - `needs_reconnect`: tell Joe to sign in as `admin@digeratiexperts.com` and open `https://digeratiexperts.com/api/zoho/connect`: one click, and the old grant is revoked automatically. Agents never ask for grant codes, refresh tokens or client secrets, and never paste them anywhere.
   - `not_configured`: a setting is missing. Name the env var. Never invent a value.
7. **Secrets:**
   - Env var **names** only, in code, commits, PRs, issues and chat.
   - `.env` lives in `/home/digeratiexperts.com/shared/`, owned by `diger7051:diger7051`, mode `600`. Restore both after editing it.
   - Tokens in the database are encrypted (`zoho_oauth_tokens`). Never print or log a token.
8. **A new Zoho product or scope:**
   - Add its scopes to `server/zoho/oauth/scopes.ts` and a `createZohoProductAuth` for it.
   - Tell Joe that **one reconnect** at `/api/zoho/connect` is needed after deploy, so the grant covers the new scopes.
   - Don't create a new Self Client for it.
9. **No kill switch to Self Client tokens any more.** `ZOHO_CONNECT_ENABLED=false` now turns every Zoho product **off** (`not_configured`): the CRM, Desk, Books and Payments calls stop. Never set it to "fix" a `degraded` or `needs_reconnect` state; the fix for `needs_reconnect` is the reconnect click.
10. **The Intelligence Hub has its own Zoho Connect client and grant** (Hub `docs/ZOHO-OAUTH-STANDARD.md`). Never share a client between the Hub and the website.

## Why

Before this change the website had four separate Zoho token paths, each with its own refresh code and the US hosts hardcoded. A Zoho throttle (`Access Denied`, "too many requests") or a 5xx was reported as `auth_failed` (issue #418). Each fix also meant pasting a new Self Client grant code, and every paste spends one of Zoho's 20 refresh-token slots per client and user. When the 21st token is issued, Zoho silently revokes the oldest one, which may belong to another product.

## The four token paths

### 1. CRM and Desk: `server/zoho/zohoClient.ts`

Uses the token manager: products `crm` and `desk`, wiring in `server/zoho/zohoAuth.ts`.

**Credential, CRM and Desk:** the Zoho Connect grant only, while `ZOHO_CONNECT_ENABLED` is on and the grant's scopes cover the product, refreshed with `ZOHO_CONNECT_CLIENT_ID` / `_SECRET`. The retired `ZOHO_REFRESH_TOKEN`, `ZOHO_DESK_REFRESH_TOKEN`, `ZOHO_FORM_OAUTH` and the Desk's own client (`ZOHO_DESK_CLIENT_ID` / `_SECRET`) are not read. Without a covering grant the product is `not_configured` and the reason says what to do.

**Scopes** (`server/zoho/oauth/scopes.ts`):
- CRM: `ZohoCRM.modules.READ`, `ZohoCRM.modules.CREATE`, `ZohoCRM.modules.UPDATE`, `ZohoCRM.users.READ`.
- Billing rides the CRM token and is requested in the same consent: `ZohoSubscriptions.{subscriptions,invoices,customers,plans,settings}.READ`.
- Desk: `Desk.tickets.READ`, `Desk.tickets.CREATE`, `Desk.tickets.UPDATE`, `Desk.contacts.READ`, `Desk.contacts.WRITE`, `Desk.settings.READ`, `Desk.basic.READ`.

**Hosts:**
- CRM uses the token response's `api_domain`, otherwise `www.zohoapis.<dc>`.
- Desk uses `desk.zoho.<dc>/api/v1`.

**Call sites, CRM:**
- `server/zoho/zohoCRM.ts` and `server/zoho/zohoBilling.ts` (through `getClient()`).
- `server/quoteLeadCrm.ts`, `server/storeQuoteCrm.ts`, `server/publicSolutionRequestCrm.ts`.
- `server/routes.ts`: the `/api/zoho/crm/*` and `/api/zoho/billing/*` routes, and `GET /api/zoho/status`.

**Call sites, Desk:**
- `server/zoho/zohoDesk.ts` (through `getDeskClient()` / `getDeskUploadClient()`).
- `server/widgetTicketRoute.ts` (`POST /api/portal/zoho/ticket`, `GET /api/zoho/desk/status`).
- `server/deskTicketReplayWorker.ts` and `server/services/orderFulfillment.ts`.
- `server/routes.ts`: `/api/zoho/desk/*`.
- `server/index.ts`: `/api/health` (`zohoDesk`, `zoho.desk`).

### 2. Portal sign-in: `server/portalZohoAuth.ts`

**Not** part of the token manager. It is an OIDC sign-in for people, and it stores no long-lived token.

- **Env:** `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` (falling back to `ZOHO_CLIENT_ID_API` / `_SECRET_API`), `ZOHO_PORTAL_OIDC_REDIRECT_URI` or `ZOHO_OAUTH_PORTAL_REDIRECT_URI`, `ZOHO_OAUTH_STATE_SECRET`, `ZOHO_OIDC_ISSUER`, `PORTAL_OAUTH_EMAIL_ALLOWLIST`. These are a sign-in client, not an API credential: no refresh token is kept.
- **Code exchange:** `exchangeZohoAuthCode` sends its `authorization_code` request through `callZohoTokenEndpoint` (`server/zoho/oauth/token-endpoint.ts`), so it never builds the token URL itself (since #974). The guard test names this file as the one exception allowed to build a grant body outside `server/zoho/oauth`.
- **Scopes:** `openid email profile`.
- **Host:** `ZOHO_OIDC_ISSUER` when set (still honoured). Otherwise the accounts host of `ZOHO_ACCOUNTS_SERVER`, which defaults to `https://accounts.zoho.com`.
- **Call sites:** `server/routes.ts`: `/api/portal/auth/zoho/{status,start,callback}` and the legacy alias `/api/zoho/oauth/callback`. The owner check for Zoho Connect reuses its `isMasterPortalEmail`.

### 3. Payments: `server/zohoPayments.ts`

Uses the token manager: product `payments`.

- **Credential:** the Connect grant only. `ZOHO_PAYMENTS_REFRESH_TOKEN` and `ZOHO_PAYMENTS_CLIENT_ID` / `_SECRET` are retired and not read.
- **Always required:** `ZOHO_PAYMENTS_ACCOUNT_ID` and `ZOHO_PAYMENTS_SIGNING_KEY`. The signing key and webhook verification are unchanged.
- **Scopes:** `ZohoPay.payments.CREATE`, `ZohoPay.payments.READ`. Check them against the Zoho Payments API console before the first Connect.
- **Hosts:** `payments.zoho.<dc>/api/v1` and `payments.zoho.<dc>/hostedcheckout`.
- **Call sites:**
  - `server/secureStoreCheckout.ts`.
  - `server/routes.ts`: portal invoice pay and `/api/store/payment-status`.
  - `server/index.ts`: the webhook, `/api/health`, `/api/payments/availability`.
  - `server/paymentReadiness.ts` (the readiness probe). The probe now accepts a cached access token instead of forcing a refresh on every probe.

### 4. Books: `server/services/zohoBooksTax.ts`

Uses the token manager: product `books`. The public signatures are unchanged; thread T7 builds on them.

- **Credential:** the Connect grant only. `ZOHO_BOOKS_REFRESH_TOKEN` and `ZOHO_BOOKS_CLIENT_ID` / `_SECRET` are retired and not read. Without a grant that covers Books, the Warehouse Books card lists "Zoho Connect grant with the Books scopes (/api/zoho/connect)" as the missing setting.
- **Also required:** `ZOHO_BOOKS_ORGANIZATION_ID`, `ZOHO_BOOKS_TAX_CONTACT_ID`, `ZOHO_BOOKS_SERVICE_ITEM_ID`. Optional: `ZOHO_BOOKS_TAX_ITEMS`, `ZOHO_BOOKS_RECORD_PAID_ORDERS`.
- **Scopes:** `ZohoBooks.estimates.CREATE`, `ZohoBooks.estimates.DELETE`, `ZohoBooks.settings.READ`, `ZohoBooks.contacts.READ`, `ZohoBooks.contacts.CREATE`, `ZohoBooks.invoices.CREATE`, `ZohoBooks.invoices.READ`, `ZohoBooks.customerpayments.CREATE`.
- **Host:** `api_domain`, otherwise `www.zohoapis.<dc>/books/v3`.
- **Call sites:**
  - `server/services/salesTax.ts`.
  - `server/services/salesTaxReadiness.ts`, which serves `server/warehouseRoutes.ts` and the Warehouse Books card.
  - `server/services/zohoBooksInvoice.ts` (paid-order invoices), `server/secureStoreCheckout.ts`, `server/services/orderFulfillment.ts`.

Not a Zoho API token: the CSP in `server/middleware/security.ts` lists `payments.zoho.com` and `*.zoho.com` for the browser-side hosted checkout and widgets. It is left as is.

## What the token manager does

Rules R1–R7 of the standard, in `server/zoho/oauth/manager.ts`:

- **Access tokens are a cache.**
  - A token is reused until 5 minutes before it expires.
  - It is persisted encrypted in `zoho_oauth_tokens` (migration `0017`), so a restart or deploy does not mint a new one.
  - Products that share a refresh token share its access token.
- **Single flight.** Concurrent callers share one in-flight refresh.
- **Budget.** At most 5 token requests per refresh token per 10 minutes, half of Zoho's limit of 10.
- **Classified errors** (`token-endpoint.ts`):

  | Zoho answer | Kind | Backoff | Health |
  |---|---|---|---|
  | `invalid_code`, `invalid_grant`, `invalid_token` | revoked | re-check every 6 h | `needs_reconnect` |
  | `invalid_client`, `unauthorized_client`, redirect mismatch | client | re-check hourly | `needs_reconnect` |
  | `Access Denied`, "too many requests", HTTP 429 | rate_limited | 10 min | `degraded` |
  | network error, timeout, 5xx, a non-JSON body or a body without a token, an unknown code | transient | 30 s, doubling up to 15 min | `degraded` |

- **401 from a product API.** The token is dropped and the request is retried once with a new one. If the rejected token is less than 2 minutes old, the manager does not refresh again, because that is a missing-scope problem.
- **Client pinning.**
  - A Connect grant always refreshes with the client id stored with it, and only when that id is `ZOHO_CONNECT_CLIENT_ID`. Any other client (a retired Self Client, the sign-in client) is refused: Zoho is not called, and the product reads `needs_reconnect`.
- **Data centers.** Every host comes from `server/zoho/oauth/dc.ts`. Codes and tokens go only to a recognised `https://accounts.zoho.<dc>`; an unknown value falls back to the US DC.
- **Secrets.**
  - The refresh and access tokens are stored encrypted with AES-256-GCM (`enc:v1`), using `ZOHO_TOKEN_ENCRYPTION_KEY`, or `MFA_ENCRYPTION_KEY` when that is unset.
  - Logs carry the error kind and Zoho's error code, never a token, a secret or Zoho's own text.
- **No database.** Without a database or the table, tokens are cached in memory only, as before.

## Health: four states

Every product reports one of these:

| State | Meaning | Fix action? |
|---|---|---|
| `connected` | A token works | no |
| `degraded` | Throttled, 5xx or unreachable; retrying on its own | **no**: never generate a new token for this |
| `needs_reconnect` | Zoho refused the token or client, or a fresh token lacks scopes | yes: the runbook below |
| `not_configured` | No credential | yes |

There is also `unknown`: credentials are present but not used since boot. Only `/api/health` and `/api/zoho/connection` show it.

Where the states show:
- **`GET /api/health`** (public). `services.zoho` maps `crm`, `desk`, `books` and `payments` to states only, from stored state and with no Zoho call; it is `null` when that read failed or did not answer within 5 s (a database stall, #657), so readers must allow null. `services.zohoDesk` keeps its old values for existing monitors, plus `degraded`.
- **`GET /api/zoho/desk/status`** (public). The new `state` field. `connected` and `reason` are unchanged, so `reason: auth_failed` now only means `needs_reconnect`. `.github/workflows/production-health.yml` puts `state` in the issue it opens and says not to rotate a token when the state is `degraded`.
- **`GET /api/zoho/status`** (public, CRM). The new `state` field. It makes at most one cheap CRM read every 10 minutes; before, it minted a token on every request. The message is our own wording.
- **`GET /api/zoho/connection`** (admin). The Connect grant summary, each product's health with reasons, the redirect URI, and `canManage`.
- **Warehouse Books card** (`salesTaxReadiness.ts`, unchanged). A throttle now reads `UNKNOWN` instead of `AUTH_REQUIRED`, because `booksCall` only reports `auth` when Zoho refused the credential.

## Zoho Connect (one consent, every product)

`server/zoho/oauth/connect.ts`, `server/zohoConnectRoutes.ts`, wired in `server/routes.ts`.

- **Feature flag.** `ZOHO_CONNECT_ENABLED=true` turns it on. While it is off:
  - The connect, callback and disconnect routes answer 404.
  - Products ignore any stored grant and read `not_configured` (there is no other credential since #974).
- **Who can use it.** Only the owner: a live admin signed in as `admin@digeratiexperts.com` or `admin@digerati-experts.com`, and not impersonating a company. Any other admin can read `/api/zoho/connection` but cannot connect or disconnect.
- **Client.** A dedicated Zoho API Console **Server-based Application**, set as `ZOHO_CONNECT_CLIENT_ID` / `ZOHO_CONNECT_CLIENT_SECRET`. It is never the portal sign-in client.
- **The flow:**
  1. `GET /api/zoho/connect` sets an httpOnly, SameSite=Lax state cookie bound to the owner's user id, valid for 10 minutes.
  2. It redirects to `accounts.zoho.<dc>/oauth/v2/auth` with `access_type=offline` and `prompt=consent`, asking for every product's scopes.
  3. `GET /api/zoho/connect/callback` checks the state and the user, then exchanges the code at the `accounts-server` Zoho returned. That server must be a recognised Zoho host.
  4. The callback stores the grant encrypted, finds the Desk org, and **revokes the grant it replaces**.
  5. It redirects back to `returnTo` (default `/portal/admin`) with `zoho_connect=ok` or `zoho_connect=error`.
- **Disconnect.** `POST /api/zoho/disconnect` revokes and removes the grant. Every product then reads `not_configured` until Joe connects again.

### Callback URL DE must register

Register this on the Server-based client, under **Authorized Redirect URIs**:

```
https://digeratiexperts.com/api/zoho/connect/callback
```

Set `ZOHO_CONNECT_REDIRECT_URI` only if a different URI is registered. The code never registers anything in Zoho.

## Reconnect runbook (one click)

Use this when a product reads `needs_reconnect` or `not_configured` because no grant is stored.

**First time only:**
1. In the Zoho API Console (api-console.zoho.com), signed in as the Zoho account that owns CRM, Desk, Books and Payments, click **Add Client → Server-based Applications**.
   - Homepage: `https://digeratiexperts.com`.
   - Redirect URI: the one above.
2. On the VPS, add `ZOHO_CONNECT_CLIENT_ID`, `ZOHO_CONNECT_CLIENT_SECRET` and `ZOHO_CONNECT_ENABLED=true` to `/home/digeratiexperts.com/shared/.env`.
3. Confirm `npm run db:migrate` has applied `0017_zoho_oauth_tokens.sql`. `deploy.sh` runs it on every release.
4. Run `sudo systemctl restart digeratiexperts-site`.

**Every reconnect:**
1. Sign in to the portal as `admin@digeratiexperts.com`.
2. Open `https://digeratiexperts.com/api/zoho/connect`, approve the Zoho consent screen, and wait to land back on the portal with `zoho_connect=ok`.
3. Check:
   - `GET /api/zoho/connection` shows `unified.connected: true` and each product `connected`.
   - `GET /api/zoho/desk/status` reads `"state":"connected"`.
   - `/api/health` → `services.zoho` reads `connected` for each product once it has been used.

The old grant is revoked automatically, so slots never pile up. No env token needs changing and no restart is needed.

**If it fails:** the error comes back in `zoho_error` on the return page.
- `invalid_client` or redirect mismatch: check the client id and secret, and the registered URI.
- Expired code: click again.

**If a product reads `degraded`:** do nothing. Zoho is throttling or down, and the server retries with a backoff. Generating a new token in this state spends a slot and changes nothing.

**Rollback:** there is no credential to roll back to since #974. If the grant is broken, reconnect. To roll back the code change itself, revert the PR for #974 and redeploy; the retired env vars only help that revert if they are still in `.env`, so delete them only after the check in "Retired: Self Client tokens".

## Retired: Self Client tokens (2026-11-06, issue #974)

The website no longer reads these. They were per-product Self Client refresh tokens and clients, kept as fallbacks until the Connect grant had served every product since 2026-10-10:

- `ZOHO_REFRESH_TOKEN` (CRM; also the Desk's last fallback)
- `ZOHO_FORM_OAUTH` (Desk fallback)
- `ZOHO_DESK_REFRESH_TOKEN`, `ZOHO_DESK_CLIENT_ID`, `ZOHO_DESK_CLIENT_SECRET`
- `ZOHO_PAYMENTS_REFRESH_TOKEN`, `ZOHO_PAYMENTS_CLIENT_ID`, `ZOHO_PAYMENTS_CLIENT_SECRET`
- `ZOHO_BOOKS_REFRESH_TOKEN`, `ZOHO_BOOKS_CLIENT_ID`, `ZOHO_BOOKS_CLIENT_SECRET`

`ZOHO_CLIENT_ID_API` / `ZOHO_CLIENT_SECRET_API` stay: the portal sign-in falls back to them when `ZOHO_CLIENT_ID` / `_SECRET` are unset.

**Before merging the #974 PR:** Joe signs in as `admin@digeratiexperts.com` and opens `GET /api/zoho/connection`. Every product (`crm`, `desk`, `books`, `payments`) must read `connected` with source `unified`. A product on source `env` is still on a Self Client token and would go `not_configured` after the deploy; reconnect at `/api/zoho/connect` first (Payments in particular: its scopes were never confirmed against the Zoho Payments console).

**After it is LIVE** and `/api/health` → `services.zoho` reads `connected` for each product that has been used:
1. Delete the env vars above from `/home/digeratiexperts.com/shared/.env`, then restore `diger7051:diger7051` and mode `600`, and restart.
2. Optional: in the Zoho API Console, revoke the old Self Client tokens (or delete the Self Clients) so they hold no live slots. Never generate a new code on them.

`deploy/vps/env.production.example` and `docs/SECRETS-REQUIRED.md` still list the retired names; they are owned by open PRs #955 / #968 / #969 and are cleaned in a follow-up once those land.

## Local deviations from the Hub port

- **Products.** `crm`, `desk`, `books` and `payments`. Billing scopes ride with CRM, and `Service.fullaccess.all` counts as covering that service.
- **Credentials.** The Hub has per-product DB rows; the website has only the Connect grant (since #974). The store's fingerprint-keyed state rows (`readState` / `writeState`) are no longer written by the manager; old rows are harmless.
- **Connect client.** Only `ZOHO_CONNECT_CLIENT_ID` / `_SECRET`: no fallback to the sign-in client.
- **Feature flag.** It gates both the routes and products' use of the grant; off means every product is `not_configured`.
- **`notConfigured(message, problem)`.** It receives the problem kind, so the CRM and Desk callers keep `ZohoOAuthError`, and `not_configured` stays separate from `needs_reconnect`.
- **Logs.** Failure logs carry the error code only, never Zoho's text.
- **Blank tokens.** A blank `access_token` counts as no token.
- **Desk org.** The Desk org id is not required for a source: `server/zoho/zohoDesk.ts` still discovers it.
