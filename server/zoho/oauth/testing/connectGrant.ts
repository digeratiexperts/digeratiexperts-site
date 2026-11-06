/**
 * Test fixture: seed the Zoho Connect grant in the shared token store, the
 * way /api/zoho/connect would, so product modules (CRM, Desk, Books,
 * Payments) find their only credential. Imported by tests only.
 *
 * The values are fixtures, never real credentials. They are generated per
 * test run rather than written as string literals, so no constant credential
 * exists in non-test source (CodeQL js/hardcoded-credentials).
 */
import { randomBytes } from "node:crypto";
import {
  invalidateZohoSources,
  refreshZohoConnectSnapshot,
  resetAllZohoProductCaches,
  UNIFIED_PROVIDER,
  ZOHO_PRODUCT_SCOPES,
  ZOHO_TOKEN_PATH,
  zohoDefaultDc,
  zohoTokenStore,
  type ZohoProduct,
} from "../index";

const fixture = (label: string) => `${label}-${randomBytes(6).toString("hex")}`;

export const TEST_CONNECT_CLIENT = { id: fixture("connect-client"), secret: fixture("connect-secret") } as const;
export const TEST_CONNECT_REFRESH = fixture("test-connect-refresh");

const ALL_PRODUCTS: ZohoProduct[] = ["crm", "desk", "books", "payments"];

/** The env settings Zoho Connect needs (flag + client), as fixtures. */
export const ZOHO_CONNECT_TEST_ENV = {
  ZOHO_CONNECT_ENABLED: "true",
  ZOHO_CONNECT_CLIENT_ID: TEST_CONNECT_CLIENT.id,
  ZOHO_CONNECT_CLIENT_SECRET: TEST_CONNECT_CLIENT.secret,
} as const;

/** The token URL of a data center's accounts server (US unless ZOHO_ACCOUNTS_SERVER says otherwise). */
export function zohoTokenUrl(accounts: string = zohoDefaultDc().accounts): string {
  return `${accounts.replace(/\/$/, "")}${ZOHO_TOKEN_PATH}`;
}

export interface SeedZohoConnectGrantOptions {
  /** Products whose scopes the grant carries (default: all four). */
  products?: ZohoProduct[];
  /** Exact scope string instead of `products` (null = unknown, covers everything). */
  scope?: string | null;
  refreshToken?: string;
  accountsServer?: string;
  apiDomain?: string | null;
  orgId?: string | null;
  /** A cached access token, as if one was minted already. */
  accessToken?: string;
  accessExpiresAt?: Date;
}

/**
 * Turn Zoho Connect on with the fixture client and store a grant. Without
 * `accessToken` the grant reads as never used (state "unknown"), like a
 * credential the server has not tried since boot.
 */
export async function seedZohoConnectGrant(opts: SeedZohoConnectGrantOptions = {}): Promise<void> {
  Object.assign(process.env, ZOHO_CONNECT_TEST_ENV);
  const refreshToken = opts.refreshToken ?? TEST_CONNECT_REFRESH;
  const scope =
    opts.scope !== undefined
      ? opts.scope
      : (opts.products ?? ALL_PRODUCTS).flatMap((p) => ZOHO_PRODUCT_SCOPES[p]).join(" ");
  const store = zohoTokenStore();
  await store.saveGrant({
    provider: UNIFIED_PROVIDER,
    refreshToken,
    clientId: TEST_CONNECT_CLIENT.id,
    scope,
    accountsServer: opts.accountsServer ?? zohoDefaultDc().accounts,
    apiDomain: opts.apiDomain ?? null,
    orgId: opts.orgId ?? null,
    accessToken: opts.accessToken ?? null,
    accessExpiresAt: opts.accessExpiresAt ?? null,
  });
  if (!opts.accessToken) {
    await store.patch(UNIFIED_PROVIDER, refreshToken, { authStatus: null, lastSuccessAt: null });
  }
  invalidateZohoSources();
  resetAllZohoProductCaches();
  await refreshZohoConnectSnapshot();
}

/** Remove the Connect env settings set by seedZohoConnectGrant. */
export function clearZohoConnectTestEnv(): void {
  for (const k of Object.keys(ZOHO_CONNECT_TEST_ENV)) delete process.env[k];
}
