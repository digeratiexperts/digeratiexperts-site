# Secrets and environment variables

Every environment variable and secret this repository reads, by **name only**. No values belong in this file, in commits, PR text or chat.

- Production values live in `/home/digeratiexperts.com/shared/.env` on the VPS (loaded by the systemd unit and by `deploy/vps/deploy.sh` before the build). The template is `deploy/vps/env.production.example`.
- GitHub Actions secrets are listed separately at the end; they are set under Settings → Secrets and variables → Actions.
- **Secret** means the value grants access or signs something: store it only in the env file or a secret store. **Config** is not sensitive but still lives in the env file.
- "Where used" names up to two files; search the name for the rest.

Generated 2026-10-10 from `process.env.*`, `import.meta.env.*`, `env.*` and named-lookup reads in `server/`, `shared/`, `client/src/`, `scripts/`, `vite.config.ts` and `drizzle.config.ts`, then checked by hand. Re-run the search when adding a variable and add it here in the same PR.

## Required in production

`server/production.config.ts` refuses to start without these (`enforceProductionConfig`).

| Name | Kind | Where used | Notes |
|---|---|---|---|
| `DATABASE_URL` | secret | `server/production.config.ts`, `server/index.ts` | Postgres connection string. Only CI's smoke run may omit it, with `DE_SMOKE_ALLOW_MEMORY_ONLY=1`. |
| `JWT_SECRET` | secret | `server/production.config.ts`, `server/index.ts` | Signs portal session tokens. Placeholder values are rejected. |
| `MFA_ENCRYPTION_KEY` | secret | `server/production.config.ts`, `server/portalAuthStore.ts` | Encrypts stored portal TOTP secrets. |

## Recommended

Startup logs a warning without these; the named feature degrades.

| Name | Kind | Where used | Notes |
|---|---|---|---|
| `SESSION_SECRET` | secret | `server/production.config.ts`, `server/portalZohoAuth.ts` | OAuth state-signing fallback. |
| `TURNSTILE_SECRET_KEY` | secret | `server/production.config.ts`, `server/middleware/security.ts` | Server-side Turnstile verification; fails open without it. Pair with `VITE_TURNSTILE_SITE_KEY` at build time. |
| `ZOHO_PAYMENTS_ACCOUNT_ID` | config | `server/production.config.ts`, `server/index.ts` | Online card checkout. Without it and the signing key, checkout and webhook verification are off. |
| `ZOHO_PAYMENTS_SIGNING_KEY` | secret | `server/production.config.ts`, `server/index.ts` | Zoho Payments webhook signature. |

## Zoho (CRM, Desk, OAuth, Payments, Books)

Optional per feature. Thread T1 is refactoring the Zoho token code; check `server/zoho/*` on main before relying on the fallbacks noted here.

| Name | Kind | Where used | Notes |
|---|---|---|---|
| `ZOHO_CLIENT_ID` | config | `server/production.config.ts`, `server/zohoPayments.ts` | Zoho OAuth client (portal sign-in with Zoho, legacy shared client). |
| `ZOHO_CLIENT_SECRET` | secret | `server/production.config.ts`, `server/zohoPayments.ts` | Secret for the above. |
| `ZOHO_CLIENT_ID_API` | config | `server/services/zohoBooksTax.ts`, `server/zohoPayments.ts` | Zoho API client used for CRM, and for the Desk when no dedicated Desk client is set. |
| `ZOHO_CLIENT_SECRET_API` | secret | `server/services/zohoBooksTax.ts`, `server/zohoPayments.ts` | Secret for the above. |
| `ZOHO_REFRESH_TOKEN` | secret | `server/integrations/zohoAgentsReadiness.ts`, `server/zoho/zohoClient.ts` | CRM refresh token. |
| `ZOHO_DESK_REFRESH_TOKEN` | secret | `server/deskTicketFallback.ts`, `server/zoho/zohoClient.ts` | Desk refresh token. Without a working one, Get Support tickets go to the failover spool. With a dedicated Desk client it must come from that client. |
| `ZOHO_DESK_CLIENT_ID` | config | `server/zoho/zohoClient.ts` | Optional dedicated Desk OAuth client. When this or the secret is set, all three Desk values are required and nothing is borrowed from CRM (`resolveDeskOAuthConfig`). |
| `ZOHO_DESK_CLIENT_SECRET` | secret | `server/zoho/zohoClient.ts` | Secret for the above. |
| `ZOHO_DESK_SOURCE_FIELD` | config | `server/zoho/zohoDesk.ts`, `shared/deskTicketSource.ts` | Optional Desk custom-field name for the ticket source. |
| `ZOHO_FORM_OAUTH` | secret | `server/zoho/zohoClient.ts` | Fallback Desk refresh token when `ZOHO_DESK_REFRESH_TOKEN` is unset and no dedicated Desk client is set (`server/zoho/zohoClient.ts`). |
| `ZOHO_OAUTH_STATE_SECRET` | secret | `server/portalZohoAuth.ts` | Signs the portal Zoho OAuth state; falls back to `SESSION_SECRET`. |
| `ZOHO_OAUTH_PORTAL_REDIRECT_URI` | config | `server/portalZohoAuth.ts` | Override for the portal OAuth callback URL. |
| `ZOHO_PORTAL_OIDC_REDIRECT_URI` | config | `server/routes.ts`, `server/portalZohoAuth.ts` | Override for the portal OIDC callback URL. |
| `ZOHO_OIDC_ISSUER` | config | `server/portalZohoAuth.ts` | Override for the Zoho OIDC issuer. |
| `PORTAL_OAUTH_EMAIL_ALLOWLIST` | config | `server/portalZohoAuth.ts` | Restricts which emails may sign in to the portal with Zoho. |
| `ZOHO_CRM_WEB_BASE` | config | `server/quoteLeadCrm.ts` | CRM web base URL for record links. |
| `ZOHO_LEAD_ASSIGNMENT_RULE_ID` | config | `server/quoteLeadCrm.ts`, `server/routes.ts` | CRM lead assignment rule for website leads. |
| `ZOHO_CHECKOUT_KEY` | secret | `server/zohoService.ts` | Legacy Zoho checkout (`server/zohoService.ts`). |
| `ZOHO_VERIFICATION_KEY` | secret | `server/zohoService.ts` | Legacy Zoho checkout verification (`server/zohoService.ts`). |
| `ZOHO_PAYMENTS_CLIENT_ID` | config | `server/zohoPayments.ts` | Zoho Payments OAuth client. |
| `ZOHO_PAYMENTS_CLIENT_SECRET` | secret | `server/zohoPayments.ts` | Secret for the above. |
| `ZOHO_PAYMENTS_REFRESH_TOKEN` | secret | `server/zohoPayments.ts` | Zoho Payments refresh token. |
| `ZOHO_BOOKS_CLIENT_ID` | config | `server/services/zohoBooksTax.ts` | Zoho Books OAuth client (falls back to the API client). |
| `ZOHO_BOOKS_CLIENT_SECRET` | secret | `server/services/zohoBooksTax.ts` | Secret for the above. |
| `ZOHO_BOOKS_REFRESH_TOKEN` | secret | `server/services/zohoBooksTax.ts`, `server/services/salesTaxReadiness.ts` | Books refresh token (sales tax, invoices). |
| `ZOHO_BOOKS_ORGANIZATION_ID` | config | `server/services/zohoBooksTax.ts` | Books organization. |
| `ZOHO_BOOKS_TAX_CONTACT_ID` | config | `server/services/zohoBooksTax.ts`, `server/services/salesTaxReadiness.ts` | Contact used for tax estimates. |
| `ZOHO_BOOKS_SERVICE_ITEM_ID` | config | `server/services/zohoBooksTax.ts`, `server/services/salesTaxReadiness.ts` | Item used for tax estimates. |
| `ZOHO_BOOKS_TAX_ITEMS` | config | `server/services/zohoBooksTax.ts`, `shared/storeTaxCodes.ts` | JSON map of tax-code items. |
| `ZOHO_BOOKS_RECORD_PAID_ORDERS` | config | `server/services/zohoBooksInvoice.ts` | Flag: record paid Store orders in Books. |
| `ZOHO_BOOKS_DEPOSIT_ACCOUNT_ID` | config | `server/services/zohoBooksInvoice.ts` | Deposit account for recorded payments. |
| `ZOHO_HUB_WEBHOOK_SECRET` | secret | `server/integrations/zohoAgentsReadiness.ts` | Read through `secretEnv` for Zoho agent readiness. |

## Intelligence Hub / TechSales sync

Optional; DE Sync is off without them.

| Name | Kind | Where used | Notes |
|---|---|---|---|
| `TECHSALES_HUB_URL` | config | `server/integrations/deSyncRoutes.ts`, `server/integrations/techSalesClient.ts` | Hub base URL. |
| `TECHSALES_BASE_URL` | config | `server/integrations/techSalesClient.ts` | Legacy alias of the Hub URL. |
| `TECHSALES_SYNC_URL` | config | `server/routes.ts`, `server/integrations/deSyncRoutes.ts` | Hub sync endpoint. |
| `TECHSALES_SYNC_TOKEN` | secret | `server/integrations/deSyncAuth.ts` | Bearer token for the sync. |
| `WEBSITE_LEAD_WEBHOOK_SECRET` | secret | `server/integrations/deSyncAuth.ts` | Signs website lead webhooks to the Hub. |
| `WEBSITE_TO_HUB_SECRET` | secret | `server/integrations/deSyncAuth.ts` | Website → Hub signing secret. |
| `PORTAL_TO_HUB_SECRET` | secret | `server/serviceRequestHubSync.ts`, `server/integrations/deSyncAuth.ts` | Portal → Hub signing secret. |
| `HUB_TO_WEBSITE_SECRET` | secret | `server/integrations/deSyncAuth.ts` | Verifies Hub → website calls. |
| `HUB_TO_PORTAL_SECRET` | secret | `server/integrations/deSyncAuth.ts` | Verifies Hub → portal calls. |
| `DE_SYNC_REQUIRE_SIGNED` | config | `server/integrations/deSyncAuth.ts`, `server/integrations/techSalesClient.ts` | Flag: reject unsigned inbound sync. |

## Portal integrations

Optional; each portal page shows "not connected" without its provider.

| Name | Kind | Where used | Notes |
|---|---|---|---|
| `JUMPCLOUD_API_KEY` | secret | `server/lifecycleOrchestrator.ts`, `server/integrations/jumpcloud.ts` | Identity lifecycle (`/portal/admin/lifecycle`). |
| `JUMPCLOUD_ORG_ID` | config | `server/integrations/jumpcloud.ts`, `client/src/pages/portal/AdminLifecycle.tsx` | JumpCloud organization. |
| `JUMPCLOUD_API_BASE` | config | `server/integrations/jumpcloud.ts` | API base override. |
| `BLACKPOINT_API_KEY` | secret | `server/lifecycleOrchestrator.ts`, `server/integrations/blackpoint.ts` | Blackpoint (also accepts `BLACKPOINT_API_TOKEN`). |
| `BLACKPOINT_API_TOKEN` | secret | `server/integrations/blackpoint.ts`, `client/src/pages/portal/AdminLifecycle.tsx` | Alias of the above. |
| `BLACKPOINT_API_BASE` | config | `server/integrations/blackpoint.ts` | API base override. |
| `BLACKPOINT_BASE_URL` | config | `server/integrations/blackpoint.ts` | Alias of the above. |
| `BLACKPOINT_INSTALLER_URL` | config | `server/integrations/blackpoint.ts`, `client/src/pages/portal/AdminLifecycle.tsx` | Agent installer link shown to admins. |
| `PORTAL_VPN_PROVIDER` | config | `server/portalDataSources.ts`, `server/integrations/vpn/index.ts` | `tailscale`, `twingate` or `timus`. |
| `PORTAL_VPN_CLIENT_MAP` | config | `server/portalDataSources.ts`, `server/integrations/vpn/index.ts` | JSON map of portal clients to VPN tenants. |
| `PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_ID` | config | `server/portalDataSources.ts`, `server/integrations/vpn/tailscale.ts` | Tailscale OAuth client. |
| `PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_SECRET` | secret | `server/portalDataSources.ts`, `server/integrations/vpn/tailscale.ts` | Secret for the above. |
| `PORTAL_VPN_TAILSCALE_API_KEY` | secret | `server/portalDataSources.ts`, `server/integrations/vpn/tailscale.ts` | Tailscale API key (alternative to OAuth). |
| `PORTAL_VPN_TAILSCALE_TAILNET` | config | `server/portalDataSources.ts`, `server/integrations/vpn/tailscale.ts` | Tailnet name. |
| `PORTAL_VPN_TWINGATE_NETWORK` | config | `server/portalDataSources.ts`, `server/integrations/vpn/twingate.ts` | Twingate network. |
| `PORTAL_VPN_TWINGATE_API_KEY` | secret | `server/portalDataSources.ts`, `server/integrations/vpn/twingate.ts` | Twingate admin API token. |
| `PORTAL_VPN_TIMUS_API_KEY` | secret | `server/portalDataSources.ts`, `server/integrations/vpn/timus.ts` | Timus credential (waiting on Timus API docs). |
| `PORTAL_VPN_TIMUS_BASE_URL` | config | `server/portalDataSources.ts`, `server/integrations/vpn/timus.ts` | Timus API base. |
| `PORTAL_PHONE_PROVIDER` | config | `server/portalDataSources.ts`, `server/integrations/phone/index.ts` | Phone provider (Cytracom). |
| `PORTAL_PHONE_CLIENT_MAP` | config | `server/integrations/phone/index.ts`, `server/integrations/phone/routes.ts` | JSON map of portal clients to phone tenants. |
| `PORTAL_PHONE_CYTRACOM_TOKEN_<CLIENT>` | secret | — | One Cytracom token per client; the suffix is the client key from the map (`server/integrations/phone/index.ts`). |
| `PORTAL_SHIPPING_PROVIDER` | config | `server/portalDataSources.ts`, `server/integrations/shipping/carriers/index.ts` | `shipstation`, `easypost` or `shippo`. |
| `PORTAL_SHIPPING_CLIENT_MAP` | config | `server/integrations/shipping/index.ts`, `server/integrations/shipping/easypost.ts` | JSON map of portal clients to shipping accounts. |
| `PORTAL_SHIPPING_SHIPSTATION_API_KEY` | secret | `server/portalDataSources.ts`, `server/integrations/shipping/shipstation.ts` | ShipStation key. |
| `PORTAL_SHIPPING_SHIPSTATION_API_SECRET` | secret | `server/portalDataSources.ts`, `server/integrations/shipping/shipstation.ts` | ShipStation secret. |
| `PORTAL_SHIPPING_EASYPOST_API_KEY` | secret | `server/portalDataSources.ts`, `server/integrations/shipping/easypost.ts` | EasyPost key. |
| `PORTAL_SHIPPING_SHIPPO_API_TOKEN` | secret | `server/portalDataSources.ts`, `server/integrations/shipping/shippo.ts` | Shippo token. |
| `PORTAL_CARRIER_TRACKING` | config | `server/portalDataSources.ts`, `server/integrations/shipping/carriers/index.ts` | Flag: direct carrier tracking. |
| `PORTAL_CARRIER_UPS_CLIENT_ID` | config | `server/portalDataSources.ts`, `server/integrations/shipping/carriers/ups.ts` | UPS OAuth client. |
| `PORTAL_CARRIER_UPS_CLIENT_SECRET` | secret | `server/portalDataSources.ts`, `server/integrations/shipping/carriers/ups.ts` | Secret for the above. |
| `PORTAL_CARRIER_UPS_ENV` | config | `server/integrations/shipping/carriers/ups.ts` | UPS sandbox/production. |
| `PORTAL_CARRIER_FEDEX_CLIENT_ID` | config | `server/portalDataSources.ts`, `server/integrations/shipping/carriers/fedex.ts` | FedEx OAuth client. |
| `PORTAL_CARRIER_FEDEX_CLIENT_SECRET` | secret | `server/portalDataSources.ts`, `server/integrations/shipping/carriers/fedex.ts` | Secret for the above. |
| `PORTAL_CARRIER_FEDEX_ENV` | config | `server/integrations/shipping/carriers/fedex.ts` | FedEx sandbox/production. |
| `PORTAL_CARRIER_USPS_CLIENT_ID` | config | `server/portalDataSources.ts`, `server/integrations/shipping/carriers/usps.ts` | USPS OAuth client. |
| `PORTAL_CARRIER_USPS_CLIENT_SECRET` | secret | `server/portalDataSources.ts`, `server/integrations/shipping/carriers/usps.ts` | Secret for the above. |
| `PORTAL_CARRIER_USPS_ENV` | config | `server/integrations/shipping/carriers/usps.ts` | USPS sandbox/production. |
| `VAULT_ENCRYPTION_KEY` | secret | `server/portalClientVault.ts`, `client/src/pages/portal/AdminClientWorkspace.tsx` | Client file vault encryption (32+ characters). Vault stores nothing without it. |
| `VAULT_STORAGE_DIR` | config | `server/portalClientVault.ts` | Vault storage path. |
| `PORTAL_DESK_TICKET_SYNC_MS` | config | `server/routes.ts` | Desk ticket sync interval. |

## Other services

Optional per feature.

| Name | Kind | Where used | Notes |
|---|---|---|---|
| `OPENAI_API_KEY` | secret | `server/production.config.ts`, `server/index.ts` | DE Desk chat, MSP advisor, TTS. Also read as `OPENAI_API`. |
| `OPENAI_API` | secret | `server/index.ts`, `server/publicSupportChat.ts` | Legacy alias of the above. |
| `OPENAI_BASE_URL` | config | `server/production.config.ts` | API base override. |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | secret | `server/production.config.ts`, `server/index.ts` | Replit-era alias; takes precedence when set. |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | config | `server/production.config.ts`, `server/index.ts` | Replit-era alias. |
| `ENABLE_OPENAI` | config | `server/production.config.ts` | Kill switch (`false` turns it off). |
| `ENABLE_OPENAI_INTEGRATION` | config | `server/services/openai-config.ts`, `server/routes.ts` | OpenAI integration on/off for the admin toggle (`server/services/openai-config.ts`). |
| `MSP_ADVISOR_MODEL` | config | `server/services/msp-advisor/advisor.ts`, `server/services/msp-advisor/portal-assist.ts` | Model id for the MSP advisor. |
| `STRIPE_SECRET_KEY` | secret | `server/production.config.ts` | Stripe (legacy; Zoho Payments is current). |
| `STRIPE_LIVE_API_KEY` | secret | `server/production.config.ts` | Alias of the above. |
| `STRIPE_WEBHOOK_SECRET` | secret | `server/production.config.ts` | Stripe webhook signature. |
| `ENABLE_STRIPE` | config | `server/production.config.ts` | Kill switch. |
| `ENABLE_ZOHO` | config | `server/production.config.ts` | Kill switch. |
| `ZEPTOMAIL_API_TOKEN` | secret | `server/services/notificationService.ts`, `server/routes.ts` | Transactional email. Without it notifications only log. |
| `ADMIN_EMAIL` | config | `server/deskTicketFallback.ts`, `server/services/notificationService.ts` | Recipient of admin notifications. |
| `SALES_LEAD_EMAIL` | config | `server/services/notificationService.ts` | Recipient of lead notifications. |
| `DESK_FALLBACK_EMAIL` | config | `server/deskTicketFallback.ts` | Where failover Desk tickets are emailed. |
| `GOOGLE_PLACES_API_KEY` | secret | `server/googleReviews.ts` | Google reviews. Aliases: `GOOGLE_MAPS_API_KEY`, `GBP_API_KEY`, `PLACES_API_KEY`. |
| `GOOGLE_MAPS_API_KEY` | secret | `server/googleReviews.ts` | Alias. |
| `GBP_API_KEY` | secret | `server/googleReviews.ts` | Alias. |
| `PLACES_API_KEY` | secret | `server/googleReviews.ts` | Alias. |
| `GOOGLE_PLACE_ID` | config | `server/googleReviews.ts`, `client/src/data/reviewsCatalog.ts` | Place for reviews. Aliases: `GBP_PLACE_ID`, `PLACES_PLACE_ID`. |
| `GBP_PLACE_ID` | config | `server/googleReviews.ts` | Alias. |
| `PLACES_PLACE_ID` | config | `server/googleReviews.ts` | Alias. |
| `GOOGLE_MAPS_CID` | config | `server/googleReviews.ts` | Maps listing id for review links. |
| `YELP_API_KEY` | secret | `server/yelpReviews.ts` | Yelp reviews (also `YELP_FUSION_API_KEY`). |
| `YELP_FUSION_API_KEY` | secret | `server/yelpReviews.ts` | Alias. |
| `YELP_BUSINESS_ID` | config | `server/yelpReviews.ts` | Yelp listing. |
| `NVD_API_KEY` | secret | `server/services/threat-intel/sources.ts` | Higher NVD rate limit for the threat feed. |
| `AZ_TPT_RATE_TABLE_JSON` | config | `server/services/salesTax.ts` | Arizona TPT rate table override. |
| `MESHY_API_KEY` | secret | `client/src/data/productImages.ts`, `scripts/generate-meshy-store-icons.mjs` | Store icon generation script only. |
| `PRIVATE_OBJECT_DIR` | config | `server/replit_integrations/object_storage/objectStorage.ts`, `server/portalClientVault.ts` | Object storage (Replit-era) private dir. |
| `PUBLIC_OBJECT_SEARCH_PATHS` | config | `server/replit_integrations/object_storage/objectStorage.ts` | Object storage public paths. |

## Runtime settings (not secrets)

Safe defaults; set only to override.

| Name | Kind | Where used | Notes |
|---|---|---|---|
| `NODE_ENV` | config | `server/publicSolutionSpool.ts`, `server/warehouseRoutes.ts` | `production` turns on the startup gate. |
| `PORT` | config | `server/production.config.ts`, `server/index.ts` | Default 3300. |
| `MAIN_DOMAIN` | config | `server/production.config.ts` | Default `digeratiexperts.com`. |
| `PORTAL_DOMAIN` | config | `server/production.config.ts` | Default `portal.digeratiexperts.com`. |
| `APP_URL` | config | `server/services/notificationService.ts`, `server/portalUserInvite.ts` | Public base URL for links in email. |
| `ALLOWED_ORIGINS` | config | `server/production.config.ts` | Extra CORS origins, comma-separated. |
| `WEBAUTHN_RP_ID` | config | `server/portalPasskeys.ts` | Passkey relying-party id; defaults to the registrable domain. |
| `JWT_EXPIRY` | config | `server/production.config.ts` | Default `24h`. |
| `BCRYPT_ROUNDS` | config | `server/production.config.ts` | Default 12. |
| `RATE_LIMIT_WINDOW` | config | `server/production.config.ts` | Default 15 minutes. |
| `RATE_LIMIT_MAX` | config | `server/production.config.ts` | Default 100. |
| `DB_MAX_CONNECTIONS` | config | `server/production.config.ts` | Default 10. |
| `DB_IDLE_TIMEOUT` | config | `server/production.config.ts` | Default 30000 ms. |
| `DB_CONNECTION_TIMEOUT` | config | `server/production.config.ts` | Default 5000 ms. |
| `DE_PRODUCTION_DB_MARKERS` | config | `server/index.ts` | Hostnames that mark a production database. |
| `DE_STAGING_REVIEW` | config | `server/stagingReviewGuard.ts` | Staging review mode: locks outbound mutations. |
| `TURNSTILE_ENFORCE` | config | `server/middleware/security.ts` | `1` makes Turnstile fail closed when `TURNSTILE_SECRET_KEY` is missing. |
| `PDF_CHROMIUM_PATH` | config | `server/pdf/renderHtmlToPdf.ts` | Chromium for PDF rendering. |
| `PDF_MAX_CONCURRENT_RENDERS` | config | `server/pdf/renderHtmlToPdf.ts` | PDF render concurrency. |
| `PYTHON` | config | `server/pdf/renderHtmlToPdf.ts` | Python for the PDF pipeline (also `PYTHON_BIN`). |
| `PYTHON_BIN` | config | `server/pdf/renderHtmlToPdf.ts` | Alias. |
| `SOLUTION_SPOOL_DIR` | config | `server/publicSolutionSpool.ts` | Solution-request spool. |
| `QUOTE_SPOOL_DIR` | config | `server/publicSolutionSpool.ts` | Quote spool. |
| `DESK_TICKET_SPOOL_DIR` | config | `server/publicSolutionSpool.ts` | Desk ticket failover spool. |
| `THREAT_FEED_PATH` | config | `server/services/threat-intel/ingest.ts` | Threat feed file. |
| `THREAT_FEED_STARTUP_DELAY_MS` | config | `server/services/threat-intel/ingest.ts` | Delay before the first feed refresh. |
| `ENABLE_DEV_PORTAL_BOOTSTRAP` | config | `server/portalAuthStore.ts` | Development only: seed a portal admin. Never set in production. |
| `DEV_PORTAL_ADMIN_PASSWORD_HASH` | secret | `server/portalAuthStore.ts` | Development only: the seeded admin's hash. |
| `DE_SMOKE_ALLOW_MEMORY_ONLY` | config | `server/healthProbe.ts`, `server/production.config.ts` | CI smoke only: allow no `DATABASE_URL`. |
| `REPLIT_SERVER_PORT` | config | `server/index.ts` | Replit-era; unused on the VPS. |
| `REPL_ID` | config | `vite.config.ts` | Replit-era; unused on the VPS. |
| `REPL_OWNER` | config | `server/index.ts`, `server/vite.ts` | Replit-era; unused on the VPS. |
| `REPL_SLUG` | config | `server/index.ts`, `server/vite.ts` | Replit-era; unused on the VPS. |

## Build time (baked into the public bundle)

`VITE_*` values ship to every browser. Never put a secret in one; `deploy.sh` refuses a bundle containing the Turnstile secret.

| Name | Kind | Where used | Notes |
|---|---|---|---|
| `VITE_TURNSTILE_SITE_KEY` | config | `client/src/components/TurnstileWidget.tsx` | Turnstile widget site key (public by design). |
| `VITE_CLARITY_ID` | config | `client/src/lib/analytics.ts` | Microsoft Clarity. |
| `VITE_META_PIXEL_ID` | config | `client/src/lib/analytics.ts` | Meta pixel. |
| `VITE_BING_UET_TAG_ID` | config | `client/src/lib/analytics.ts` | Bing UET. |
| `VITE_LINKEDIN_PARTNER_ID` | config | `client/src/lib/analytics.ts` | LinkedIn Insight. |
| `VITE_GOOGLE_SITE_VERIFICATION` | config | `client/src/lib/analytics.ts` | Search Console verification. |
| `VITE_BING_SITE_VERIFICATION` | config | `client/src/lib/analytics.ts` | Bing verification. |
| `VITE_DE_STAGING_REVIEW` | config | `client/src/components/StagingReviewBadge.tsx` | Staging banner. |
| `VITE_DE_REVIEW_LABEL` | config | `client/src/components/StagingReviewBadge.tsx` | Staging banner label. |
| `VITE_DE_REVIEW_SHA` | config | `client/src/components/StagingReviewBadge.tsx` | Staging banner commit. |
| `VITE_CACHE_DIR` | config | `vite.config.ts` | Vite cache location. |

## GitHub Actions secrets

| Name | Where used | Required? |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | `ci.yml` → Purge Cloudflare cache | Optional. Zone → Cache Purge → Purge, digeratiexperts.com only. Without it the purge warns and skips. |
| `CLOUDFLARE_ZONE_ID` | `ci.yml` → Purge Cloudflare cache | Optional, with the token. |
| `PORTAL_QA_EMAIL` | `portal-prod-check.yml` | Optional. Test client login; without it (and without the token) the check skips green. |
| `PORTAL_QA_PASSWORD` | `portal-prod-check.yml` | Optional, with the email. |
| `PORTAL_QA_TOKEN` | `portal-prod-check.yml` | Optional fallback: a `portalAuth` cookie value when Turnstile blocks the automated login. |

No workflow needs any other secret. `GITHUB_TOKEN` is provided by Actions.

## Local tooling and test scripts only

Read by QA, smoke and capture scripts or the test runner, never by the production server: `A11Y_BASE`, `A11Y_FAIL_ON`, `A11Y_OUT`, `AXE_PATH`, `BASE_URL`, `CHROME`, `CHROME_PATH`, `DE_CHROME_PATH`, `DE_FFMPEG_PATH`, `DE_CLAIM_CHECK_VERBOSE`, `DESK_BASE`, `DESK_OUT`, `DOOR2_BASE`, `DOOR2_OUT`, `DOOR2_SUBMIT`, `PLAYWRIGHT_CHROMIUM`, `PLAYWRIGHT_CHROMIUM_PATH`, `PORTAL_QA_BASE`, `QUIZ_BASE`, `PROD`, `VITEST`. `PORTAL_QA_EMAIL`, `PORTAL_QA_PASSWORD` and `PORTAL_QA_TOKEN` are also read by `scripts/qa/portal-prod-check.mjs` when run by hand.

## Listed in the env template but not read by any code

`CORO_CLIENT_ID`, `CORO_CLIENT_SECRET`, `WEBSITE_BASE_URL` and `PORTAL_BASE_URL` appear in `deploy/vps/env.production.example` but nothing in the repository reads them. They are harmless; DE can keep them for a planned integration or drop them from the template.
