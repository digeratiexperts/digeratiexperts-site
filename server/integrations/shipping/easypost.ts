import { basicAuth, isRecord, isSafeScopePrefix, vendorGetJson } from "./http";
import {
  countShipments,
  newestFirst,
  safeHttpUrl,
  str,
  ShippingConfigError,
  ShippingVendorError,
  type Env,
  type NormalizedShipment,
  type ShipmentStatus,
  type ShippingData,
} from "./types";

/**
 * EasyPost API v2 (PORTAL_SHIPPING_PROVIDER=easypost).
 *
 * Docs (docs.easypost.com was not reachable from the build machine; the
 * field names below come from EasyPost's official Node SDK, @easypost/api
 * 8.9.0, whose types cite these pages, plus the pages' search excerpts):
 *   Auth:      https://docs.easypost.com/docs/authentication
 *              HTTP Basic, the API key as username, no password.
 *   Shipments: https://docs.easypost.com/docs/shipments#retrieve-all-shipments
 *              GET https://api.easypost.com/v2/shipments, page_size (max 100),
 *              before_id, start_datetime, end_datetime (default: the last
 *              month), purchased, include_children; answers { shipments, has_more }.
 *   Trackers:  https://docs.easypost.com/docs/trackers#tracker-object
 *              status, public_url, carrier, tracking_details[].{status,datetime}
 *   API keys:  https://docs.easypost.com/docs/api-keys#retrieve-an-api-key
 *              GET /v2/api_keys answers the user's keys and a `children`
 *              array of Child Users (id, keys, children).
 *   Child users: https://docs.easypost.com/docs/users/child-users
 *
 * Per-company scope (PORTAL_SHIPPING_CLIENT_MAP value), one of:
 *   "user_..."           an EasyPost Child User per client (recommended).
 *                        Shipments are read with that child's own production
 *                        key, which EasyPost restricts to the child's own
 *                        shipments. The key is looked up with the parent key
 *                        via /v2/api_keys, so only the parent key lives in env.
 *   "reference:ACME-"    one shared account; DE starts every shipment's
 *                        `reference` with the client's prefix. The list
 *                        endpoint cannot filter by reference, so this server
 *                        pages through the parent's own shipments (never
 *                        include_children) and keeps exact prefix matches only.
 *                        Prefix must end in - : _ / # (see isSafeScopePrefix).
 */

export const EASYPOST_BASE_URL = "https://api.easypost.com/v2";
export const EASYPOST_KEY_ENV = "PORTAL_SHIPPING_EASYPOST_API_KEY";
export const EASYPOST_WINDOW_DAYS = 90;
export const EASYPOST_PAGE_SIZE = 100;
/** Pages scanned for a reference-prefix scope (5 x 100 shipments). */
export const EASYPOST_REFERENCE_MAX_PAGES = 5;
const CHILD_KEY_TTL_MS = 5 * 60 * 1000;

export type EasyPostScope = { kind: "child"; userId: string } | { kind: "reference"; prefix: string };

export function parseEasyPostScope(scope: string): EasyPostScope {
  const s = scope.trim();
  if (/^user_[A-Za-z0-9]{1,64}$/.test(s)) return { kind: "child", userId: s };
  if (s.startsWith("reference:")) {
    const prefix = s.slice("reference:".length);
    if (!isSafeScopePrefix(prefix)) {
      throw new ShippingConfigError("EasyPost reference prefix must be 3-64 chars and end with - : _ / or #");
    }
    return { kind: "reference", prefix };
  }
  throw new ShippingConfigError('EasyPost scope must be a child user id ("user_...") or "reference:<prefix>"');
}

export function easypostApiKey(env: Env): string {
  const key = (env[EASYPOST_KEY_ENV] || "").trim();
  if (!key) throw new ShippingConfigError(`${EASYPOST_KEY_ENV} is not set`);
  return key;
}

// Tracker status values: https://docs.easypost.com/docs/trackers#tracker-object
const TRACKER_STATUS: Record<string, ShipmentStatus> = {
  unknown: "unknown",
  pre_transit: "label_created",
  in_transit: "in_transit",
  out_for_delivery: "in_transit",
  available_for_pickup: "in_transit",
  delivered: "delivered",
  return_to_sender: "exception",
  failure: "exception",
  error: "exception",
  cancelled: "cancelled",
};

export function mapEasyPostShipment(row: Record<string, unknown>): NormalizedShipment | null {
  const id = str(row.id);
  if (!id) return null;
  const tracker = isRecord(row.tracker) ? row.tracker : null;
  const rate = isRecord(row.selected_rate) ? row.selected_rate : null;
  const rawStatus = str(tracker?.status) ?? str(row.status) ?? "unknown";
  let status: ShipmentStatus = TRACKER_STATUS[rawStatus] ?? "unknown";
  // A refunded or refund-pending label will not ship.
  if (row.refund_status === "submitted" || row.refund_status === "refunded") status = "cancelled";
  let deliveredAt: string | null = null;
  if (status === "delivered" && tracker && Array.isArray(tracker.tracking_details)) {
    const hit = [...tracker.tracking_details].reverse().find((d) => isRecord(d) && d.status === "delivered");
    deliveredAt = hit && isRecord(hit) ? str(hit.datetime) : null;
  }
  return {
    id,
    reference: str(row.reference),
    carrier: str(tracker?.carrier) ?? str(rate?.carrier),
    trackingNumber: str(row.tracking_code) ?? str(tracker?.tracking_code),
    trackingUrl: safeHttpUrl(tracker?.public_url),
    status,
    shippedAt: str(row.created_at),
    deliveredAt,
    items: null,
    notes: null,
  };
}

function readShipmentsPage(body: unknown): { rows: Record<string, unknown>[]; hasMore: boolean } {
  if (!isRecord(body) || !Array.isArray(body.shipments)) {
    throw new ShippingVendorError("EasyPost answered an unexpected shape");
  }
  return { rows: body.shipments.filter(isRecord), hasMore: body.has_more === true };
}

export function buildEasyPostData(shipments: NormalizedShipment[], truncated: boolean): ShippingData {
  shipments.sort(newestFirst);
  return {
    provider: "easypost",
    shipments,
    counts: countShipments(shipments, { reportsDeliveryStatus: true }),
    windowDays: EASYPOST_WINDOW_DAYS,
    truncated,
    reportsDeliveryStatus: true,
  };
}

/** Maps a reference-scoped scan: keeps only rows whose reference starts with the prefix. */
export function filterByReference(rows: Record<string, unknown>[], prefix: string): NormalizedShipment[] {
  const out: NormalizedShipment[] = [];
  for (const row of rows) {
    const ref = typeof row.reference === "string" ? row.reference : "";
    if (!ref.startsWith(prefix)) continue;
    const mapped = mapEasyPostShipment(row);
    if (mapped) out.push(mapped);
  }
  return out;
}

/** Finds a child user's active production key in a /v2/api_keys answer (children may nest). */
export function findChildProductionKey(body: unknown, userId: string): string | null {
  if (!isRecord(body)) return null;
  const queue: unknown[] = Array.isArray(body.children) ? [...body.children] : [];
  while (queue.length) {
    const node = queue.shift();
    if (!isRecord(node)) continue;
    if (node.id === userId) {
      const keys = Array.isArray(node.keys) ? node.keys : [];
      const prod = keys.find((k) => isRecord(k) && k.mode === "production" && k.active !== false && typeof k.key === "string");
      return prod && isRecord(prod) ? (prod.key as string) : null;
    }
    if (Array.isArray(node.children)) queue.push(...node.children);
  }
  return null;
}

const childKeyCache = new Map<string, { key: string; expires: number }>();

/** Test seam. */
export function _resetEasyPostKeyCache() {
  childKeyCache.clear();
}

async function childKeyFor(userId: string, parentKey: string, fetchImpl?: typeof fetch): Promise<string> {
  const cached = childKeyCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.key;
  // https://docs.easypost.com/docs/api-keys#retrieve-an-api-key
  const body = await vendorGetJson("EasyPost", `${EASYPOST_BASE_URL}/api_keys`, { Authorization: basicAuth(parentKey, "") }, fetchImpl);
  const key = findChildProductionKey(body, userId);
  if (!key) throw new ShippingConfigError("mapped EasyPost child user has no active production key under this account");
  childKeyCache.set(userId, { key, expires: Date.now() + CHILD_KEY_TTL_MS });
  return key;
}

function listUrl(now: Date, beforeId?: string): string {
  const start = new Date(now.getTime() - EASYPOST_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const qs = new URLSearchParams({
    page_size: String(EASYPOST_PAGE_SIZE),
    purchased: "true",
    start_datetime: start.toISOString(),
    end_datetime: now.toISOString(),
  });
  if (beforeId) qs.set("before_id", beforeId);
  return `${EASYPOST_BASE_URL}/shipments?${qs.toString()}`;
}

export async function loadEasyPost(
  scope: string,
  env: Env,
  fetchImpl?: typeof fetch,
  now: Date = new Date(),
): Promise<ShippingData> {
  const parsed = parseEasyPostScope(scope);
  const parentKey = easypostApiKey(env);

  if (parsed.kind === "child") {
    const childKey = await childKeyFor(parsed.userId, parentKey, fetchImpl);
    // https://docs.easypost.com/docs/shipments#retrieve-all-shipments (child's own key: child's shipments only)
    const page = readShipmentsPage(
      await vendorGetJson("EasyPost", listUrl(now), { Authorization: basicAuth(childKey, "") }, fetchImpl),
    );
    const shipments = page.rows.map(mapEasyPostShipment).filter((s): s is NormalizedShipment => !!s);
    return buildEasyPostData(shipments, page.hasMore);
  }

  const kept: NormalizedShipment[] = [];
  let beforeId: string | undefined;
  let hasMore = false;
  for (let i = 0; i < EASYPOST_REFERENCE_MAX_PAGES; i++) {
    // https://docs.easypost.com/docs/shipments#retrieve-all-shipments (parent's own shipments; include_children left false)
    const page = readShipmentsPage(
      await vendorGetJson("EasyPost", listUrl(now, beforeId), { Authorization: basicAuth(parentKey, "") }, fetchImpl),
    );
    kept.push(...filterByReference(page.rows, parsed.prefix));
    hasMore = page.hasMore;
    const last = page.rows[page.rows.length - 1];
    beforeId = last ? str(last.id) ?? undefined : undefined;
    if (!hasMore || !beforeId) break;
  }
  return buildEasyPostData(kept, hasMore);
}
