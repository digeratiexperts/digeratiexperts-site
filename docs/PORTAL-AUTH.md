# Client Portal authentication

> Updated: 2026-08-23
> Product: Client Portal on portal.digeratiexperts.com (same Node app as the public website).

## Intended model

Clients authenticate with Digerati Experts-native credentials **and** optional Zoho Public Platform SSO:

| Mechanism | Status |
|-----------|--------|
| Email + password | Canonical |
| Host-only HttpOnly `portalAuth` + `portalSession` cookies | Canonical |
| MFA (TOTP + email challenge / backup codes) | Supported |
| Password reset + email verification | Supported |
| Zoho Public Platform SSO (`/api/portal/auth/zoho/*`) | Supported when `ZOHO_CLIENT_ID` + `ZOHO_CLIENT_SECRET` are set |

Zoho CRM / Desk / Billing / Payments remain backend integrations. Portal SSO uses the shared website Zoho Public Platform OAuth client (same `shared/.env` on the VPS).

TechSales (`techsales.digerati-experts.com`) keeps its own Hub SSO (`/api/login?provider=zoho` → `/api/callback`). Do **not** merge portal and Hub auth paths.

Canonical portal login URL: `https://portal.digeratiexperts.com/portal/login` — never invent `//login`.

Portal JWTs are never returned in JSON, URLs, or browser storage, and portal APIs do not accept
Bearer tokens. Every protected request requires both cookies, a matching portal-only JWT
audience/type/session claim, and a live revocable server-side session record. Workspace JWTs use a
separate audience/type and are accepted only as Bearer tokens by the workspace API.

Authenticated unsafe requests must be same-origin and JSON. The server rejects missing, foreign,
or sibling `Origin`/`Referer` values and form content types. Cookies are host-only so a sibling
subdomain cannot receive them.

## MFA secret storage

TOTP seeds are encrypted at rest with user-bound AES-256-GCM envelopes. Recovery codes are shown
once, stored only as keyed hashes, and removed atomically when used. Production requires a dedicated
`PORTAL_MFA_ENCRYPTION_KEY` containing an unpadded base64url-encoded 32-byte key.

During key rotation, the new primary belongs in `PORTAL_MFA_ENCRYPTION_KEY`; prior keys remain in
comma-separated `PORTAL_MFA_PREVIOUS_ENCRYPTION_KEYS` until all affected TOTP records and recovery
codes have been rotated. The first encrypted-storage release must be coordinated across every
application instance sharing the database because older releases cannot read converted MFA records.
See `deploy/vps/README.md` for the cutover and recovery boundary.

## Zoho SSO routes

| Route | Purpose |
|-------|---------|
| `GET /api/portal/auth/zoho/status` | `{ configured: boolean }` for login UI |
| `GET /api/portal/auth/zoho/start` | Begin OIDC authorize redirect |
| `GET /api/portal/auth/zoho/callback` | Canonical callback |
| `GET /api/zoho/oauth/callback` | Alias matching `ZOHO_PORTAL_OIDC_REDIRECT_URI` on VPS |

Env (VPS `shared/.env`, never commit secrets):

- `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` (aliases of `*_API` OK)
- `ZOHO_PORTAL_OIDC_REDIRECT_URI` or `ZOHO_OAUTH_PORTAL_REDIRECT_URI`
- `ZOHO_OAUTH_STATE_SECRET` (optional; falls back to JWT/SESSION secret)
- `PORTAL_OAUTH_EMAIL_ALLOWLIST` (exact emails and/or `@domain` entries)
- `ZOHO_OIDC_ISSUER` (optional; default `https://accounts.zoho.com`)

Master emails (always admin on SSO): `admin@digeratiexperts.com`, `admin@digerati-experts.com`.

## Roles

| Layer | Values |
|-------|--------|
| Portal role | admin / user / viewer |
| Store role | public / prospect / managed / comanaged / admin |

Checkout requires comanaged or admin. Admin APIs use requireAdmin.

## Verification checklist

- [ ] Password login (POST `/api/portal/login` + Turnstile)
- [ ] Zoho button visible on `/portal/login` when status.configured
- [ ] Zoho start → Zoho accounts → callback → portal dashboard
- [ ] MFA enrollment / challenge / recovery
- [ ] Password reset flow
- [ ] Session / JWT expiration (24h, 4h while impersonating)
- [ ] Logout revokes the server session and clears both HttpOnly cookies
- [ ] No portal JWT in JSON, URLs, localStorage, or Authorization headers
- [ ] Portal and workspace JWT audiences reject each other
- [ ] Missing, foreign, and sibling origins receive 403 on unsafe authenticated requests
- [ ] Tenant/clientId association is resolved against the live portal user
- [ ] Role enforcement on admin routes
- [ ] Deep-link return after login
- [ ] Client isolation (ticket/invoice/order scoped to clientId / email)
