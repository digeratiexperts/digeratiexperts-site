import { VENDOR_TIMEOUT_MS, VpnConfigError, VpnVendorError, type Env } from "./errors";
import type { VpnData, VpnDevice, VpnDeviceStatus } from "./types";

/**
 * Tailscale (PORTAL_VPN_PROVIDER=tailscale).
 *
 * Docs (Tailscale's own API reference; tailscale.com/api is the current home,
 * the same text is published in the tailscale/tailscale repo):
 *   https://tailscale.com/api
 *   https://github.com/tailscale/tailscale/blob/v1.72.0/publicapi/readme.md   (base URL, auth)
 *   https://github.com/tailscale/tailscale/blob/v1.72.0/publicapi/tailnet.md  (list tailnet devices)
 *   https://github.com/tailscale/tailscale/blob/v1.72.0/publicapi/device.md   (device attributes)
 *   https://github.com/tailscale/tailscale-client-go-v2/blob/main/devices.go  (official client:
 *     response is { "devices": [...] }, `connectedToControl`, `lastSeen` empty while connected)
 *   https://github.com/tailscale/tailscale-client-go-v2/blob/main/oauth.go    (OAuth token URL)
 *
 * Scope: one DE tailnet; each client company's devices carry a company tag
 * (e.g. "tag:acme"). Tags are the tailnet's own identity for devices ("Once a
 * device is tagged, the tag is the owner of that device", device.md), so the
 * map value is that tag and only devices carrying it are returned. External
 * (shared-in) devices have no tags and never match.
 *
 * Env:
 *   PORTAL_VPN_TAILSCALE_API_KEY             tskey-api-... access token, or instead
 *   PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_ID     an OAuth client (does not expire) with
 *   PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_SECRET   read access to devices
 *   PORTAL_VPN_TAILSCALE_TAILNET             optional; "-" (the token's default tailnet) when unset
 */

export const TAILSCALE_BASE_URL = "https://api.tailscale.com";
const TAG_PATTERN = /^tag:[A-Za-z0-9][A-Za-z0-9_-]{0,62}$/;

/** The subset of the documented device attributes this adapter reads. */
export type TailscaleDevice = {
  id?: string;
  nodeId?: string;
  name?: string;
  hostname?: string;
  os?: string;
  user?: string;
  tags?: string[] | null;
  lastSeen?: string | null;
  authorized?: boolean;
  isExternal?: boolean;
  connectedToControl?: boolean;
};

export function isTailscaleTag(scope: string): boolean {
  return TAG_PATTERN.test(scope);
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const t = Date.parse(v);
  // Go's zero time ("0001-01-01T00:00:00Z") means "not set".
  if (!Number.isFinite(t) || new Date(t).getUTCFullYear() < 2000) return null;
  return new Date(t).toISOString();
}

function statusOf(d: TailscaleDevice): VpnDeviceStatus {
  if (d.authorized === false) return "pending";
  if (d.connectedToControl === true) return "online";
  if (d.connectedToControl === false) return "offline";
  return "unknown";
}

/** Keeps only devices carrying `tag` (exact match) and maps them. */
export function mapTailscaleDevices(devices: TailscaleDevice[], tag: string): VpnDevice[] {
  return devices
    .filter((d) => d && d.isExternal !== true && Array.isArray(d.tags) && d.tags.includes(tag))
    .map((d) => ({
      id: String(d.nodeId || d.id || ""),
      name: d.hostname || (d.name ? d.name.split(".")[0] : "") || "Unnamed device",
      os: d.os || null,
      status: statusOf(d),
      lastSeen: isoOrNull(d.lastSeen),
      user: d.user || null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------- auth ----------

let oauthCache: { key: string; token: string; expiresAt: number } | null = null;

/** Test seam. */
export function _resetTailscaleTokenCache() {
  oauthCache = null;
}

async function bearerToken(env: Env, fetchImpl: typeof fetch): Promise<string> {
  const apiKey = (env.PORTAL_VPN_TAILSCALE_API_KEY || "").trim();
  if (apiKey) return apiKey;
  const clientId = (env.PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (env.PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    throw new VpnConfigError(
      "set PORTAL_VPN_TAILSCALE_API_KEY, or PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_ID and PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_SECRET",
    );
  }
  const cacheKey = `${clientId}:${clientSecret.length}`;
  if (oauthCache && oauthCache.key === cacheKey && oauthCache.expiresAt > Date.now()) return oauthCache.token;

  // OAuth 2.0 client-credentials grant; token URL from the official client:
  // https://github.com/tailscale/tailscale-client-go-v2/blob/main/oauth.go (TokenURL: baseURL + "/api/v2/oauth/token")
  // Background: https://github.com/tailscale/tailscale/blob/v1.72.0/publicapi/readme.md#authentication
  let res: Response;
  try {
    res = await fetchImpl(`${TAILSCALE_BASE_URL}/api/v2/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }).toString(),
      signal: AbortSignal.timeout(VENDOR_TIMEOUT_MS),
    });
  } catch (err) {
    throw new VpnVendorError(`tailscale oauth token request failed (${err instanceof Error ? err.name : "error"})`);
  }
  if (!res.ok) throw new VpnVendorError(`tailscale oauth token HTTP ${res.status}`);
  const body = (await res.json().catch(() => null)) as { access_token?: unknown; expires_in?: unknown } | null;
  const token = typeof body?.access_token === "string" ? body.access_token : "";
  if (!token) throw new VpnVendorError("tailscale oauth token response had no access_token");
  const ttl = typeof body?.expires_in === "number" && body.expires_in > 120 ? body.expires_in : 300;
  oauthCache = { key: cacheKey, token, expiresAt: Date.now() + (ttl - 60) * 1000 };
  return token;
}

// ---------- load ----------

export async function loadTailscaleVpnData(opts: { tag: string; env: Env; fetchImpl?: typeof fetch }): Promise<VpnData> {
  if (!isTailscaleTag(opts.tag)) {
    throw new VpnConfigError('client map value for tailscale must be a device tag such as "tag:acme"');
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const token = await bearerToken(opts.env, fetchImpl);
  const tailnet = (opts.env.PORTAL_VPN_TAILSCALE_TAILNET || "").trim() || "-";

  // List tailnet devices: GET /api/v2/tailnet/{tailnet}/devices (default field set)
  // https://github.com/tailscale/tailscale/blob/v1.72.0/publicapi/tailnet.md#list-tailnet-devices
  // Auth: "Authorization: Bearer <token>"
  // https://github.com/tailscale/tailscale/blob/v1.72.0/publicapi/readme.md#authentication
  let res: Response;
  try {
    res = await fetchImpl(`${TAILSCALE_BASE_URL}/api/v2/tailnet/${encodeURIComponent(tailnet)}/devices`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(VENDOR_TIMEOUT_MS),
    });
  } catch (err) {
    throw new VpnVendorError(`tailscale devices request failed (${err instanceof Error ? err.name : "error"})`);
  }
  if (!res.ok) throw new VpnVendorError(`tailscale devices HTTP ${res.status}`);
  const body = (await res.json().catch(() => null)) as { devices?: unknown } | null;
  if (!body || !Array.isArray(body.devices)) throw new VpnVendorError("tailscale devices response had no devices array");

  return {
    provider: "tailscale",
    providerName: "Tailscale",
    service: { status: "reachable", checkedAt: new Date().toISOString() },
    reportsLiveStatus: true,
    devices: mapTailscaleDevices(body.devices as TailscaleDevice[], opts.tag),
  };
}
