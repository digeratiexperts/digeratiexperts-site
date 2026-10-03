import { isRecord, isSafeScopePrefix, vendorGetJson } from "./http";
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
 * Shippo API (PORTAL_SHIPPING_PROVIDER=shippo).
 *
 * Docs (docs.goshippo.com was not reachable from the build machine; the
 * field names come from Shippo's official SDK, shippo 2.18.0 on npm, which is
 * generated from Shippo's OpenAPI spec, plus the pages' search excerpts):
 *   Transactions: https://docs.goshippo.com/api-reference/transactions/list-all-shipping-labels
 *     GET https://api.goshippo.com/transactions, query page, results (max 100),
 *     object_status, tracking_status, rate; answers { next, previous, results[] }.
 *     Transaction: object_id, object_created, status (WAITING | QUEUED |
 *     SUCCESS | ERROR | REFUNDED | REFUNDPENDING | REFUNDREJECTED),
 *     tracking_number, tracking_status (UNKNOWN | PRE_TRANSIT | TRANSIT |
 *     DELIVERED | RETURNED | FAILURE), tracking_url_provider, eta, rate,
 *     metadata (free text, up to 100 characters).
 *   Auth: header "Authorization: ShippoToken <token>" (SDK hook
 *     PrefixApiKeyBeforeRequestHook; https://docs.goshippo.com/docs/Guides_general/authentication).
 *   Managed accounts: https://docs.goshippo.com/docs/platformaccounts/platform_using_accounts
 *     "add their Shippo Account ID to the header of the call with the key
 *     value pair SHIPPO-ACCOUNT-ID: <ShippoAccountID>".
 *
 * Per-company scope (PORTAL_SHIPPING_CLIENT_MAP value), one of:
 *   "account:<ShippoAccountID>"  a Shippo Platform managed account per client
 *                                (recommended). Shippo scopes the call to that
 *                                account through the SHIPPO-ACCOUNT-ID header.
 *   "metadata:ACME-"             one shared account; DE starts each label's
 *                                `metadata` with the client's prefix. The list
 *                                endpoint cannot filter by metadata, so this
 *                                server pages through and keeps exact prefix
 *                                matches only. Prefix must end in - : _ / #.
 *
 * Gaps: a transaction has no delivered date (only eta), and `rate` is often a
 * bare rate id, so carrier is shown only when the rate object is embedded.
 */

export const SHIPPO_BASE_URL = "https://api.goshippo.com";
export const SHIPPO_TOKEN_ENV = "PORTAL_SHIPPING_SHIPPO_API_TOKEN";
export const SHIPPO_PAGE_SIZE = 100;
export const SHIPPO_METADATA_MAX_PAGES = 5;

export type ShippoScope = { kind: "account"; accountId: string } | { kind: "metadata"; prefix: string };

export function parseShippoScope(scope: string): ShippoScope {
  const s = scope.trim();
  if (s.startsWith("account:")) {
    const accountId = s.slice("account:".length).trim();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(accountId)) throw new ShippingConfigError("Shippo account id is malformed");
    return { kind: "account", accountId };
  }
  if (s.startsWith("metadata:")) {
    const prefix = s.slice("metadata:".length);
    if (!isSafeScopePrefix(prefix)) {
      throw new ShippingConfigError("Shippo metadata prefix must be 3-64 chars and end with - : _ / or #");
    }
    return { kind: "metadata", prefix };
  }
  throw new ShippingConfigError('Shippo scope must be "account:<ShippoAccountID>" or "metadata:<prefix>"');
}

export function shippoToken(env: Env): string {
  const token = (env[SHIPPO_TOKEN_ENV] || "").trim();
  if (!token) throw new ShippingConfigError(`${SHIPPO_TOKEN_ENV} is not set`);
  return token;
}

const TRACKING_STATUS: Record<string, ShipmentStatus> = {
  UNKNOWN: "unknown",
  PRE_TRANSIT: "label_created",
  TRANSIT: "in_transit",
  DELIVERED: "delivered",
  RETURNED: "exception",
  FAILURE: "exception",
};

/** Maps one transaction. A failed label purchase (status ERROR) is not a shipment: null. */
export function mapShippoTransaction(row: Record<string, unknown>): NormalizedShipment | null {
  const id = str(row.object_id);
  if (!id) return null;
  const txStatus = str(row.status) ?? "";
  if (txStatus === "ERROR") return null;
  let status: ShipmentStatus;
  if (txStatus === "WAITING" || txStatus === "QUEUED") status = "processing";
  else if (txStatus === "REFUNDED" || txStatus === "REFUNDPENDING") status = "cancelled";
  else status = TRACKING_STATUS[str(row.tracking_status) ?? "UNKNOWN"] ?? "unknown";
  const rate = isRecord(row.rate) ? row.rate : null;
  return {
    id,
    reference: str(row.metadata),
    carrier: str(rate?.provider),
    trackingNumber: str(row.tracking_number),
    trackingUrl: safeHttpUrl(row.tracking_url_provider),
    status,
    shippedAt: str(row.object_created),
    deliveredAt: null,
    items: null,
    notes: null,
  };
}

function readPage(body: unknown): { rows: Record<string, unknown>[]; hasNext: boolean } {
  if (!isRecord(body) || !Array.isArray(body.results)) {
    throw new ShippingVendorError("Shippo answered an unexpected shape");
  }
  return { rows: body.results.filter(isRecord), hasNext: typeof body.next === "string" && body.next.length > 0 };
}

export function filterByMetadata(rows: Record<string, unknown>[], prefix: string): NormalizedShipment[] {
  const out: NormalizedShipment[] = [];
  for (const row of rows) {
    const meta = typeof row.metadata === "string" ? row.metadata : "";
    if (!meta.startsWith(prefix)) continue;
    const mapped = mapShippoTransaction(row);
    if (mapped) out.push(mapped);
  }
  return out;
}

export function buildShippoData(shipments: NormalizedShipment[], truncated: boolean): ShippingData {
  shipments.sort(newestFirst);
  return {
    provider: "shippo",
    shipments,
    counts: countShipments(shipments, { reportsDeliveryStatus: true }),
    windowDays: null,
    truncated,
    reportsDeliveryStatus: true,
  };
}

function listUrl(page: number): string {
  const qs = new URLSearchParams({ page: String(page), results: String(SHIPPO_PAGE_SIZE) });
  return `${SHIPPO_BASE_URL}/transactions?${qs.toString()}`;
}

export async function loadShippo(scope: string, env: Env, fetchImpl?: typeof fetch): Promise<ShippingData> {
  const parsed = parseShippoScope(scope);
  const auth = { Authorization: `ShippoToken ${shippoToken(env)}` };

  if (parsed.kind === "account") {
    // https://docs.goshippo.com/api-reference/transactions/list-all-shipping-labels
    // https://docs.goshippo.com/docs/platformaccounts/platform_using_accounts (SHIPPO-ACCOUNT-ID)
    const page = readPage(
      await vendorGetJson("Shippo", listUrl(1), { ...auth, "SHIPPO-ACCOUNT-ID": parsed.accountId }, fetchImpl),
    );
    const shipments = page.rows.map(mapShippoTransaction).filter((s): s is NormalizedShipment => !!s);
    return buildShippoData(shipments, page.hasNext);
  }

  const kept: NormalizedShipment[] = [];
  let hasNext = false;
  for (let p = 1; p <= SHIPPO_METADATA_MAX_PAGES; p++) {
    // https://docs.goshippo.com/api-reference/transactions/list-all-shipping-labels
    const page = readPage(await vendorGetJson("Shippo", listUrl(p), auth, fetchImpl));
    kept.push(...filterByMetadata(page.rows, parsed.prefix));
    hasNext = page.hasNext;
    if (!hasNext) break;
  }
  return buildShippoData(kept, hasNext);
}
