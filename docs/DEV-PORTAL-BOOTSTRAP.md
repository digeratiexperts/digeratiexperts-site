# Dev portal bootstrap (local QA only)

Canonical website baseline: `8a3196b5` (`cursor/review/website-integration-candidate-20260913`).

Production never seeds fixed admin credentials. Local demo-client login is **opt-in** and gated by two environment variables plus a non-production `NODE_ENV`.

## Variables

| Variable | Required for bootstrap | Effect |
|---|---|---|
| `NODE_ENV` | Must **not** be `production` | Production refuses bootstrap even if the other vars are set. |
| `ENABLE_DEV_PORTAL_BOOTSTRAP` | Must equal exactly `true` | Master switch. Absent or any other value → no-op. |
| `DEV_PORTAL_ADMIN_PASSWORD_HASH` | Non-empty hash (≥ 20 chars) | Runtime hash only. Never commit plaintext passwords or a fixed hash in source. |

Implementation: `server/portalAuthStore.ts` (`seedDevPortalBootstrapIfEnabled`, `isDevPortalBootstrapAllowed`, `resolveDevPortalAdminPasswordHash`). Tests: `server/portalAuthStore.bootstrap.test.ts`, `server/storage.credential-hygiene.test.ts`.

## Behavior matrix (local QA)

| `NODE_ENV` | Flag | Hash | Result |
|---|---|---|---|
| `production` | any | any | No bootstrap admins; production stays fail-closed. |
| `development` / `test` | unset / false | any | No bootstrap admins; MemStorage admin password empty; DatabaseStorage does not seed login-capable demo users. |
| `development` / `test` | `true` | unset / short | No-op (hash required). |
| `development` / `test` | `true` | valid hash | Indexes bootstrap admin(s) and may seed shared demo portal users with that same hash for client QA. |

## Local setup (example)

1. Generate a hash locally (do not paste production hashes into git or chat logs).
2. In your **local-only** `.env` (never commit):

```bash
NODE_ENV=development
ENABLE_DEV_PORTAL_BOOTSTRAP=true
DEV_PORTAL_ADMIN_PASSWORD_HASH="<your-local-hash>"
```

3. Restart the API/server process so `initPortalAuthStore` re-runs.
4. Sign in with the bootstrap admin email defined in `portalAuthStore` and the password that matches your hash.

## What this is not

- Not a production feature. Do not set the flag on VPS shared `.env`.
- Not a substitute for Zoho SSO portal login where identity is already configured.
- Not permission to reintroduce fixed plaintext passwords or fixed hashes into `server/storage.ts` / `portalAuthStore.ts`.
