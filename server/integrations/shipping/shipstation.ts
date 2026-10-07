import { basicAuth, isRecord, vendorGetJson } from "./http";
import {
  countShipments,
  newestFirst,
  str,
  ShippingConfigError,
  ShippingVendorError,
  type Env,
  type NormalizedShipment,
  type ShippingData,
} from "./types";

/**
 * ShipStation API V1 (PORTAL_SHIPPING_PROVIDER=shipstation).
 *
 * Auth, host and limits: https://www.shipstation.com/docs/api/requirements/
 *   Basic HTTP auth, API Key as username and API Secret as password;
 *   host https://ssapi.shipstation.com/; 40 requests per minute per key pair.
 * Endpoint: https://www.shipstation.com/docs/api/shipments/list/
 *   (mirror: https://docs.shipstation.com/apis/shipstation-v1/docs/shipments/list)
 *
 * Per-company scope: a ShipStation store id. List Shipments takes a storeId
 * query parameter, so ShipStation itself filters to one store; DE gives each
 * client its own store (a manual store per client in ShipStation). Tags were
 * considered but List Shipments cannot filter by tag. As a second check, any
 * returned shipment whose advancedOptions.storeId names another store fails
 * the whole request (fail closed) instead of being shown.
 *
 * Gap: V1 shipments are labels. They carry no carrier tracking status and no
 * tracking URL, so every non-voided shipment is "label_created" and the page
 * says delivery progress is not reported (reportsDeliveryStatus false).
 */

export const SHIPSTATION_BASE_URL = "https://ssapi.shipstation.com";
export const SHIPSTATION_KEY_ENV = "PORTAL_SHIPPING_SHIPSTATION_API_KEY";
export const SHIPSTATION_SECRET_ENV = "PORTAL_SHIPPING_SHIPSTATION_API_SECRET";
export const SHIPSTATION_PAGE_SIZE = 100;

export function shipstationCredentials(env: Env): { key: string; secret: string } {
  const key = (env[SHIPSTATION_KEY_ENV] || "").trim();
  const secret = (env[SHIPSTATION_SECRET_ENV] || "").trim();
  if (!key || !secret) throw new ShippingConfigError(`${SHIPSTATION_KEY_ENV} and ${SHIPSTATION_SECRET_ENV} must be set`);
  return { key, secret };
}

export function parseShipStationStoreId(scope: string): string {
  const id = scope.trim();
  if (!/^\d{1,18}$/.test(id)) throw new ShippingConfigError("ShipStation scope must be a numeric store id");
  return id;
}

/** Maps one List Shipments row. */
export function mapShipStationShipment(row: Record<string, unknown>): NormalizedShipment | null {
  const id = str(row.shipmentId);
  if (!id) return null;
  const items = Array.isArray(row.shipmentItems)
    ? row.shipmentItems.reduce<number>((sum, it) => sum + (isRecord(it) && typeof it.quantity === "number" ? it.quantity : 0), 0)
    : null;
  return {
    id,
    reference: str(row.orderNumber),
    carrier: str(row.carrierCode),
    trackingNumber: str(row.trackingNumber),
    trackingUrl: null,
    status: row.voided === true ? "cancelled" : "label_created",
    shippedAt: str(row.shipDate) ?? str(row.createDate),
    deliveredAt: null,
    items: items === null || items === 0 ? null : items,
    notes: null,
  };
}

/** Maps a List Shipments response for one store; throws if any row names another store. */
export function mapShipStationResponse(body: unknown, storeId: string): ShippingData {
  if (!isRecord(body) || !Array.isArray(body.shipments)) {
    throw new ShippingVendorError("ShipStation answered an unexpected shape");
  }
  const shipments: NormalizedShipment[] = [];
  for (const row of body.shipments) {
    if (!isRecord(row)) continue;
    const adv = isRecord(row.advancedOptions) ? row.advancedOptions : null;
    const rowStore = adv ? str(adv.storeId) : null;
    if (rowStore && rowStore !== storeId) {
      throw new ShippingVendorError("ShipStation returned a shipment from another store; refusing to show any");
    }
    const mapped = mapShipStationShipment(row);
    if (mapped) shipments.push(mapped);
  }
  shipments.sort(newestFirst);
  const total = typeof body.total === "number" ? body.total : shipments.length;
  return {
    provider: "shipstation",
    shipments,
    counts: countShipments(shipments, { reportsDeliveryStatus: false, total }),
    windowDays: null,
    truncated: total > shipments.length,
    reportsDeliveryStatus: false,
  };
}

export async function loadShipStation(scope: string, env: Env, fetchImpl?: typeof fetch): Promise<ShippingData> {
  const storeId = parseShipStationStoreId(scope);
  const { key, secret } = shipstationCredentials(env);
  const qs = new URLSearchParams({
    storeId,
    includeShipmentItems: "true",
    sortBy: "ShipDate",
    sortDir: "DESC",
    page: "1",
    pageSize: String(SHIPSTATION_PAGE_SIZE),
  });
  // https://www.shipstation.com/docs/api/shipments/list/
  const body = await vendorGetJson(
    "ShipStation",
    `${SHIPSTATION_BASE_URL}/shipments?${qs.toString()}`,
    { Authorization: basicAuth(key, secret) },
    fetchImpl,
  );
  return mapShipStationResponse(body, storeId);
}
