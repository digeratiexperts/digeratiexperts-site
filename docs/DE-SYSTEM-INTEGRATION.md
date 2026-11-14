# DE system integration

**Systems:** `digeratiexperts-site` (website + Client Portal, `:3300`) and Intelligence-Hub / TechSales (`techsales.digerati-experts.com`, `:3100`).
**Not used:** legacy `digeratiexperts/TechSales`.  
**Do not rotate** live `TECHSALES_SYNC_TOKEN` / `WEBSITE_LEAD_WEBHOOK_SECRET` in this change.

## Ownership

| System | Owns |
|--------|------|
| TechSales (Hub) | Canonical account, deals, catalog, pricing, quotes, agreements, signatures, handoff, entitlements, commercial onboarding |
| Client Portal | Users, roles, departments, approvals, support interactions, pending commands, UI/session |
| Website | Anonymous session, attribution, public forms, pre-client cart |

Once an object is an account, deal, quote, agreement, client, or managed order, **canonical ID = Hub `accounts.id`**.

## Integration matrix (as of this document)

| Direction | Object | Endpoint | Auth | SoR | Status | Retry | Dedupe | Identity |
|-----------|--------|----------|------|-----|--------|-------|--------|----------|
| Website → TechSales | Leads / contact / newsletter / assessment / quote wizard | `POST TECHSALES_SYNC_URL` (`/api/webhooks/website-lead`) and `POST /api/integrations/v1/website/*` | Legacy Bearer + `x-de-sync-token`; HMAC when scoped secrets set | Hub SDR + account | LIVE (legacy) / PARTIAL (durable outbox) | Outbox exponential | Email + `eventId` | email, then `canonicalAccountId` |
| Portal → TechSales | Documents / orders (read) | `GET /api/webhooks/portal/company-documents` `company-orders` | Same legacy secret; `PORTAL_TO_HUB_SECRET` preferred | Hub | READ ONLY / LIVE | none on pull | n/a | `accountId` if mapped, else one-time `companyName` |
| Portal → TechSales | Commands (profile, quote response, approvals, onboarding) | `POST /api/integrations/v1/portal/commands` | HMAC + scoped secret | Hub applies | PARTIAL | Outbox | `eventId` | `canonicalAccountId` |
| TechSales → Portal/Website | Commercial events | `POST {WEBSITE_BASE_URL}/api/integrations/v1/hub/events` | HMAC `HUB_TO_WEBSITE_SECRET` / `HUB_TO_PORTAL_SECRET` | Hub | PARTIAL | Outbox | inbox `eventId` UNIQUE | `canonicalAccountId` |
| TechSales → Website | Public catalog snapshot | `GET /api/integrations/v1/public-catalog` | HMAC or legacy | Hub catalog | PARTIAL | last-known-good cache | snapshot version | n/a |
| Website ↔ Portal | Auth, cart, entitlements | Same Express app | Portal JWT | Portal users / website session | LIVE | n/a | portal user id | `portalClients.id` + `hubAccountId` |
| Zoho → TechSales | Deal stage | `POST /api/webhooks/zoho/deal-stage` | `ZOHO_HUB_WEBHOOK_SECRET` | Hub (conflicts recorded) | LIVE | Hub Zoho rules | `deals.zoho_id` | Zoho deal/account ids |
| TechSales → Zoho | Deal push | none | — | Hub | MISSING / LEGACY outbound | — | — | — |

Status key: **LIVE** working in production · **PARTIAL** new durable path alongside live · **READ ONLY** pull · **MISSING** not built · **LEGACY** keep until fallback removed.

## Identity

```
portal_client_id  ↔  canonicalAccountId (Hub accounts.id)  ↔  zoho_account_id
```

Company name is display/search only after the first successful match is persisted (`portal_clients.hub_account_id` + Hub `sync_identities`).

## Secrets (migration)

```
WEBSITE_TO_HUB_SECRET  → else TECHSALES_SYNC_TOKEN / WEBSITE_LEAD_WEBHOOK_SECRET
PORTAL_TO_HUB_SECRET   → else same legacy
HUB_TO_WEBSITE_SECRET  / HUB_TO_PORTAL_SECRET  (new; required for push)
```

Log `legacy integration credential used`. Never log secret values. Do not remove legacy until a later cleanup PR.

## Reliability

Transactional outbox → worker claim → signed POST → inbox unique `eventId` → 2xx delivered / retry / DLQ. Loop guard: `source` + `originEventId`; Hub events update projections only.

## Deploy sequence

1. Hub accepts legacy + new auth  
2. Website/Portal accepts legacy + new auth  
3. Deploy Hub  
4. Deploy Website/Portal  
5. Add new production secrets  
6. Verify both directions  
7. Switch clients to scoped secrets  
8. Leave legacy fallback  
9. Remove fallback later  

Never rotate the current production token first.
