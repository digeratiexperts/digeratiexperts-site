import { listManualRecords } from "../../portalManualRecords";
import { loadEasyPost } from "./easypost";
import { buildManualData } from "./manual";
import { loadShipStation } from "./shipstation";
import { loadShippo } from "./shippo";
import { ShippingConfigError, type Env, type ShippingLoadResult } from "./types";

/**
 * Shipping adapters behind GET /api/portal/shipping (see README.md).
 *
 * Vendor accounts are DE-wide, so every vendor adapter needs the company's
 * scope from PORTAL_SHIPPING_CLIENT_MAP (JSON: portal clientId -> scope):
 *   shipstation  "<storeId>"
 *   easypost     "user_<childUserId>" | "reference:<PREFIX->"
 *   shippo       "account:<ShippoAccountID>" | "metadata:<PREFIX->"
 * A company with no entry gets { notMapped: true }. "manual" needs no map:
 * its records are already stored per company.
 */

export const SHIPPING_CLIENT_MAP_ENV = "PORTAL_SHIPPING_CLIENT_MAP";

/** Parses the client map. Invalid JSON is a config fault (502), not "unmapped". */
export function readShippingClientMap(env: Env): Record<string, string> {
  const raw = (env[SHIPPING_CLIENT_MAP_ENV] || "").trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ShippingConfigError(`${SHIPPING_CLIENT_MAP_ENV} is not valid JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ShippingConfigError(`${SHIPPING_CLIENT_MAP_ENV} must be a JSON object of clientId -> scope`);
  }
  const out: Record<string, string> = {};
  for (const [clientId, scope] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof scope === "string" && scope.trim()) out[clientId] = scope.trim();
    else if (typeof scope === "number" && Number.isFinite(scope)) out[clientId] = String(scope);
  }
  return out;
}

export function shippingScopeFor(clientId: string, env: Env): string | null {
  const map = readShippingClientMap(env);
  return Object.prototype.hasOwnProperty.call(map, clientId) ? map[clientId] : null;
}

export async function loadShippingData(opts: {
  provider: string;
  clientId: string;
  env: Env;
  fetchImpl?: typeof fetch;
}): Promise<ShippingLoadResult> {
  const { provider, clientId, env, fetchImpl } = opts;
  if (provider === "manual") {
    return { data: buildManualData(await listManualRecords(clientId, "shipment")) };
  }
  const scope = shippingScopeFor(clientId, env);
  if (!scope) return { notMapped: true };
  switch (provider) {
    case "shipstation":
      return { data: await loadShipStation(scope, env, fetchImpl) };
    case "easypost":
      return { data: await loadEasyPost(scope, env, fetchImpl) };
    case "shippo":
      return { data: await loadShippo(scope, env, fetchImpl) };
    default:
      throw new ShippingConfigError(`unknown shipping provider "${provider}"`);
  }
}
