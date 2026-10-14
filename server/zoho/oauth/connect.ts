/**
 * Zoho Connect — server-based OAuth (authorization-code) flow that produces
 * ONE refresh token covering every Zoho product the website uses (CRM, Desk,
 * Books, Payments).
 *
 * Ported from Intelligence Hub lib/zoho-oauth/connect.ts. Local deviations:
 * the website's callback path, only the dedicated ZOHO_CONNECT_CLIENT_ID /
 * _SECRET client (never the portal sign-in client), and the default DC from
 * ZOHO_ACCOUNTS_SERVER (dc.ts zohoDefaultDc).
 *
 * Why not Self Client: Self Client grant codes must be generated and pasted by
 * hand, one per product, and every paste spends one of Zoho's 20 refresh-token
 * slots for that client+user (the 21st silently revokes the oldest). Connect
 * is one click → Zoho consent → callback → stored. Reconnecting replaces and
 * revokes the previous token, so the slot count never grows.
 *
 * Per Zoho's multi-DC rules the callback carries `accounts-server`; the code
 * is exchanged there and every later refresh goes to the same DC.
 */
import { randomBytes } from "node:crypto";
import { isZohoAccountsServer, zohoDcFromUrl, zohoDefaultDc } from "./dc";
import {
  connectClient,
  invalidateZohoSources,
  primeZohoAccessToken,
  UNIFIED_PROVIDER,
} from "./manager";
import { productsCoveredBy, scopesForProducts, type ZohoProduct } from "./scopes";
import type { ZohoTokenStore } from "./store";
import {
  callZohoTokenEndpoint,
  revokeZohoRefreshToken,
  ZohoTokenError,
  type FetchLike,
} from "./token-endpoint";

/** The redirect URI path DE registers on the Zoho server-based client. */
export const ZOHO_CONNECT_CALLBACK_PATH = "/api/zoho/connect/callback";

/** Redirect URI registered on the Zoho server-based client. */
export function zohoConnectRedirectUri(origin: string): string {
  const explicit = (process.env.ZOHO_CONNECT_REDIRECT_URI || "").trim();
  if (explicit) return explicit;
  return `${origin.replace(/\/+$/, "")}${ZOHO_CONNECT_CALLBACK_PATH}`;
}

export function isZohoConnectAvailable(): boolean {
  return connectClient() !== null;
}

export interface ZohoConnectStart {
  url: string;
  state: string;
}

/** Build the Zoho consent URL. Caller stores `state` in an httpOnly cookie. */
export function buildZohoConnectUrl(input: {
  products: readonly ZohoProduct[];
  redirectUri: string;
}): ZohoConnectStart {
  const client = connectClient();
  if (!client) {
    throw new Error(
      "Zoho Connect is not configured: set ZOHO_CONNECT_CLIENT_ID / ZOHO_CONNECT_CLIENT_SECRET (a Zoho API Console “Server-based Application”).",
    );
  }
  const state = randomBytes(24).toString("base64url");
  const accounts = zohoDefaultDc().accounts;
  const url = new URL(`${accounts}/oauth/v2/auth`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", client.id);
  url.searchParams.set("scope", scopesForProducts(input.products).join(","));
  url.searchParams.set("redirect_uri", input.redirectUri);
  // offline → a refresh token; consent → Zoho always returns one, even when
  // the user approved this client before.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return { url: url.toString(), state };
}

export interface ZohoConnectResult {
  products: ZohoProduct[];
  dc: string;
  deskOrgId: string | null;
  warnings: string[];
}

async function discoverDeskOrgId(
  deskHost: string,
  accessToken: string,
  fetchImpl: FetchLike,
): Promise<string | null> {
  try {
    const resp = await fetchImpl(`${deskHost}/api/v1/organizations`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    const json = (await resp.json().catch(() => ({}))) as { data?: unknown };
    const orgs = Array.isArray(json.data) ? (json.data as Array<Record<string, unknown>>) : [];
    const pick = orgs.find((o) => o.isDefault === true) ?? orgs[0];
    const id = pick?.id;
    return typeof id === "string" || typeof id === "number" ? String(id) : null;
  } catch {
    return null;
  }
}

/**
 * Exchange the callback code, store the consolidated grant, revoke the grant
 * it replaces. Throws an Error with a user-facing message on failure.
 */
export async function completeZohoConnect(input: {
  code: string;
  accountsServer?: string | null;
  redirectUri: string;
  requestedProducts: readonly ZohoProduct[];
  store: ZohoTokenStore;
  fetchImpl?: FetchLike;
}): Promise<ZohoConnectResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const client = connectClient();
  if (!client) throw new Error("Zoho Connect client is not configured on the server.");

  const fromCallback = (input.accountsServer || "").trim();
  if (fromCallback && !isZohoAccountsServer(fromCallback)) {
    throw new Error("Zoho returned an unrecognised accounts server; refusing to send the code there.");
  }
  const accounts = fromCallback || zohoDefaultDc().accounts;

  let got;
  try {
    got = await callZohoTokenEndpoint(
      accounts,
      {
        grant_type: "authorization_code",
        client_id: client.id,
        client_secret: client.secret,
        redirect_uri: input.redirectUri,
        code: input.code,
      },
      fetchImpl,
    );
  } catch (err) {
    if (err instanceof ZohoTokenError && err.kind === "revoked") {
      throw new Error("Zoho rejected the authorization code (expired or already used). Click Connect Zoho again.");
    }
    if (err instanceof ZohoTokenError && err.kind === "client") {
      throw new Error(
        `Zoho rejected the Connect client (${err.code}). Check the client id/secret and that the redirect URI ${input.redirectUri} is registered on the Zoho API Console client.`,
      );
    }
    throw err;
  }
  if (!got.refreshToken) {
    throw new Error("Zoho did not return a refresh token. Click Connect Zoho again (consent must be granted).");
  }

  const scope = got.scope?.trim() || scopesForProducts(input.requestedProducts).join(" ");
  const dc = zohoDcFromUrl(accounts, got.apiDomain);
  const covered = productsCoveredBy(scope).filter((p) => input.requestedProducts.includes(p));
  const warnings: string[] = [];

  let deskOrgId: string | null = null;
  if (covered.includes("desk")) {
    deskOrgId = await discoverDeskOrgId(dc.desk, got.accessToken, fetchImpl);
    if (!deskOrgId) {
      warnings.push("Connected, but no Zoho Desk organization was found for this account. Check the Desk status after reconnecting.");
    }
  }

  const previous = await input.store.read(UNIFIED_PROVIDER).catch(() => null);
  await input.store.saveGrant({
    provider: UNIFIED_PROVIDER,
    refreshToken: got.refreshToken,
    clientId: client.id,
    orgId: deskOrgId,
    apiDomain: got.apiDomain ?? dc.api,
    accountsServer: dc.accounts,
    scope,
    accessToken: got.accessToken,
    accessExpiresAt: new Date(Date.now() + got.expiresInSec * 1000),
  });
  primeZohoAccessToken(got.refreshToken, got.accessToken, got.expiresInSec);
  invalidateZohoSources();

  // Free the replaced grant's refresh-token slot (Zoho keeps 20 per client+user).
  if (previous && previous.refreshToken !== got.refreshToken) {
    await revokeZohoRefreshToken(
      zohoDcFromUrl(previous.accountsServer, previous.apiDomain).accounts,
      previous.refreshToken,
      fetchImpl,
    );
  }
  return { products: covered, dc: dc.dc, deskOrgId, warnings };
}

/** Revoke + delete the consolidated grant. Products fall back to legacy grants. */
export async function disconnectZoho(
  store: ZohoTokenStore,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  const row = await store.read(UNIFIED_PROVIDER);
  if (!row) return false;
  await revokeZohoRefreshToken(
    zohoDcFromUrl(row.accountsServer, row.apiDomain).accounts,
    row.refreshToken,
    fetchImpl,
  );
  await store.remove(UNIFIED_PROVIDER);
  invalidateZohoSources();
  return true;
}

/** Non-secret summary of the consolidated grant. */
export async function getZohoConnectSummary(store: ZohoTokenStore): Promise<{
  connected: boolean;
  products: ZohoProduct[];
  dc?: string;
  deskOrgId?: string | null;
  status?: string | null;
  lastError?: string | null;
  lastSuccessAt?: string | null;
}> {
  const row = await store.read(UNIFIED_PROVIDER).catch(() => null);
  if (!row) return { connected: false, products: [] };
  return {
    connected: row.authStatus !== "revoked" && row.authStatus !== "client_error",
    products: productsCoveredBy(row.scope),
    dc: zohoDcFromUrl(row.accountsServer, row.apiDomain).dc,
    deskOrgId: row.orgId,
    status: row.authStatus,
    lastError: row.lastError,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
  };
}
