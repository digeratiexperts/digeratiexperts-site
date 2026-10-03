import { VpnConfigError, type Env } from "./errors";
import { loadManualVpnData } from "./manual";
import { loadPerimeter81VpnData } from "./perimeter81";
import { loadTailscaleVpnData } from "./tailscale";
import { loadTimusVpnData } from "./timus";
import { loadTwingateVpnData } from "./twingate";
import type { VpnData, VpnLoadResult } from "./types";

/**
 * VPN adapters behind GET /api/portal/vpn (PORTAL_VPN_PROVIDER). See README.md.
 *
 * Vendor accounts are DE-wide, so each portal company maps to its own scope in
 * that account:
 *
 *   PORTAL_VPN_CLIENT_MAP='{"<portal clientId>":"<scope>"}'
 *     tailscale  a device tag, e.g. "tag:acme"
 *     twingate   a Twingate group id
 *
 * A company with no entry gets { notMapped: true }: never another company's
 * devices and never the unfiltered list. "manual" reads the company's own
 * staff-entered records and needs no map. "perimeter81" and "timus" have no
 * documented devices API and always answer "not available" (no map read, no
 * vendor call). Timus gets the map lookup as a callback, so building its
 * adapter later changes timus.ts only.
 */

export const VPN_CLIENT_MAP_ENV = "PORTAL_VPN_CLIENT_MAP";
const CACHE_TTL_MS = 60_000;

/** Parses PORTAL_VPN_CLIENT_MAP. Invalid JSON is a config fault (502), not "unmapped". */
export function readVpnClientMap(env: Env): Record<string, string> {
  const raw = (env[VPN_CLIENT_MAP_ENV] || "").trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new VpnConfigError(`${VPN_CLIENT_MAP_ENV} is not valid JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new VpnConfigError(`${VPN_CLIENT_MAP_ENV} must be a JSON object of clientId -> scope`);
  }
  const out: Record<string, string> = {};
  for (const [clientId, scope] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof scope === "string" && scope.trim()) out[clientId] = scope.trim();
  }
  return out;
}

/** The company's mapped scope, or null when the company is not mapped. */
export function vpnScopeFor(clientId: string, env: Env): string | null {
  const map = readVpnClientMap(env);
  return Object.prototype.hasOwnProperty.call(map, clientId) ? map[clientId] : null;
}

// Short cache per provider + scope: Twingate allows 60 reads a minute for the
// whole DE network, and the page refetches on focus.
const cache = new Map<string, { at: number; data: VpnData }>();

/** Test seam. */
export function _resetVpnCache() {
  cache.clear();
}

async function cached(key: string, load: () => Promise<VpnData>): Promise<VpnData> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  const data = await load();
  cache.set(key, { at: Date.now(), data });
  return data;
}

export async function loadVpnData(opts: {
  provider: string;
  clientId: string;
  env: Env;
  fetchImpl?: typeof fetch;
}): Promise<VpnLoadResult> {
  const { provider, clientId, env, fetchImpl } = opts;
  if (provider === "manual") return { data: await loadManualVpnData(clientId) };
  if (provider === "perimeter81") return loadPerimeter81VpnData();
  if (provider === "timus") {
    return loadTimusVpnData({ clientId, env, fetchImpl, scope: () => vpnScopeFor(clientId, env) });
  }

  const scope = vpnScopeFor(clientId, env);
  if (!scope) return { notMapped: true };
  if (provider === "tailscale") {
    return { data: await cached(`tailscale:${scope}`, () => loadTailscaleVpnData({ tag: scope, env, fetchImpl })) };
  }
  if (provider === "twingate") {
    return { data: await cached(`twingate:${scope}`, () => loadTwingateVpnData({ groupId: scope, env, fetchImpl })) };
  }
  throw new VpnConfigError(`no vpn adapter for provider "${provider}"`);
}
