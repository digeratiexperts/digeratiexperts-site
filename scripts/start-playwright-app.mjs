import { randomBytes } from "node:crypto";

import bcrypt from "bcrypt";

import { RELEASE_SMOKE_ACCOUNT } from "../e2e/support/demoAccount.ts";

const port = process.env.PLAYWRIGHT_PORT?.trim() || "4173";
if (!/^\d{2,5}$/.test(port)) {
  throw new Error("PLAYWRIGHT_PORT must be a valid local TCP port");
}

// Never let an inherited shell value or a developer .env file connect this
// smoke server to production systems. Empty values are intentional: dotenv
// will not replace an already-defined environment variable by default.
const isolatedIntegrationVariables = [
  "ADMIN_EMAIL",
  "AI_INTEGRATIONS_OPENAI_API_KEY",
  "AI_INTEGRATIONS_OPENAI_BASE_URL",
  "BLACKPOINT_API_BASE",
  "BLACKPOINT_API_KEY",
  "BLACKPOINT_API_TOKEN",
  "BLACKPOINT_BASE_URL",
  "BLACKPOINT_INSTALLER_URL",
  "DATABASE_URL",
  "ENABLE_OPENAI_INTEGRATION",
  "GBP_API_KEY",
  "GBP_MAPS_CID",
  "GBP_PLACE_ID",
  "GOOGLE_MAPS_API_KEY",
  "GOOGLE_MAPS_CID",
  "GOOGLE_PLACE_ID",
  "GOOGLE_PLACES_API_KEY",
  "HUB_TO_PORTAL_SECRET",
  "HUB_TO_WEBSITE_SECRET",
  "JUMPCLOUD_API_BASE",
  "JUMPCLOUD_API_KEY",
  "JUMPCLOUD_ORG_ID",
  "NVD_API_KEY",
  "OPENAI_API",
  "OPENAI_API_KEY",
  "PLACES_API_KEY",
  "PLACES_PLACE_ID",
  "PORTAL_BASE_URL",
  "PORTAL_DOMAIN",
  "PORTAL_MFA_PREVIOUS_ENCRYPTION_KEYS",
  "PORTAL_OAUTH_EMAIL_ALLOWLIST",
  "PORTAL_OAUTH_STATE_SECRET",
  "PORTAL_ORIGIN",
  "PORTAL_TO_HUB_SECRET",
  "PRIVATE_OBJECT_DIR",
  "PUBLIC_OBJECT_SEARCH_PATHS",
  "REPL_OWNER",
  "REPL_SLUG",
  "TECHSALES_BASE_URL",
  "TECHSALES_HUB_URL",
  "TECHSALES_SYNC_TOKEN",
  "TECHSALES_SYNC_URL",
  "TURNSTILE_SECRET_KEY",
  "VITE_BING_SITE_VERIFICATION",
  "VITE_BING_UET_TAG_ID",
  "VITE_CLARITY_ID",
  "VITE_GOOGLE_SITE_VERIFICATION",
  "VITE_LINKEDIN_PARTNER_ID",
  "VITE_META_PIXEL_ID",
  "VITE_TURNSTILE_SITE_KEY",
  "WEBSITE_LEAD_WEBHOOK_SECRET",
  "WEBSITE_TO_HUB_SECRET",
  "YELP_API_KEY",
  "YELP_BUSINESS_ID",
  "YELP_FUSION_API_KEY",
  "ZEPTOMAIL_API_TOKEN",
  "ZOHO_CHECKOUT_KEY",
  "ZOHO_CLIENT_ID",
  "ZOHO_CLIENT_ID_API",
  "ZOHO_CLIENT_SECRET",
  "ZOHO_CLIENT_SECRET_API",
  "ZOHO_DESK_REFRESH_TOKEN",
  "ZOHO_FORM_OAUTH",
  "ZOHO_OAUTH_PORTAL_REDIRECT_URI",
  "ZOHO_OIDC_ISSUER",
  "ZOHO_PAYMENTS_ACCOUNT_ID",
  "ZOHO_PAYMENTS_CLIENT_ID",
  "ZOHO_PAYMENTS_CLIENT_SECRET",
  "ZOHO_PAYMENTS_REFRESH_TOKEN",
  "ZOHO_PAYMENTS_SIGNING_KEY",
  "ZOHO_PORTAL_OIDC_REDIRECT_URI",
  "ZOHO_REFRESH_TOKEN",
  "ZOHO_VERIFICATION_KEY",
];

for (const variable of isolatedIntegrationVariables) {
  process.env[variable] = "";
}

Object.assign(process.env, {
  NODE_ENV: "development",
  PORT: port,
  APP_URL: `http://127.0.0.1:${port}`,
  ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
  JWT_SECRET: randomBytes(32).toString("base64url"),
  SESSION_SECRET: randomBytes(48).toString("base64url"),
  PORTAL_MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64url"),
  PORTAL_AUTH_USE_MEMORY: "true",
  PORTAL_ENABLE_DEMO_DATA: "true",
  PORTAL_INVOICE_PAYMENTS_ENABLED: "false",
  LEGACY_OBJECT_STORAGE_ENABLED: "false",
  // Keep network-backed background collectors dormant during the short smoke.
  THREAT_FEED_STARTUP_DELAY_MS: "2147483647",
});

process.env.PORTAL_DEMO_PASSWORD_HASH = await bcrypt.hash(
  RELEASE_SMOKE_ACCOUNT.password,
  4,
);

await import("../server/index.ts");
