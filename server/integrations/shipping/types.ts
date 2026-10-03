/**
 * Normalized Ship Center data, shared by every shipping adapter
 * (shipstation, easypost, shippo, manual) and GET /api/portal/shipping.
 * The client page mirrors these types in PortalShipCenter.tsx.
 */

export type ShippingProviderId = "shipstation" | "easypost" | "shippo" | "manual";

/**
 * One status vocabulary across vendors.
 *   processing     not yet handed to a carrier (no label yet, or label purchase queued)
 *   label_created  a label exists; the carrier has not reported a scan (or the
 *                  provider does not report carrier progress at all)
 *   in_transit     moving, out for delivery, or waiting at a pickup point
 *   delivered      delivered
 *   exception      failure, error or return to sender
 *   cancelled      label voided or refunded
 *   unknown        the carrier has reported nothing usable
 */
export const SHIPMENT_STATUSES = [
  "processing",
  "label_created",
  "in_transit",
  "delivered",
  "exception",
  "cancelled",
  "unknown",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export function isShipmentStatus(v: unknown): v is ShipmentStatus {
  return typeof v === "string" && (SHIPMENT_STATUSES as readonly string[]).includes(v);
}

/** Statuses counted on the "Active shipments" tile. */
export const ACTIVE_STATUSES: readonly ShipmentStatus[] = ["processing", "label_created", "in_transit", "exception"];

export type NormalizedShipment = {
  /** Provider object id (manual: the record id). */
  id: string;
  /** Order number / reference / metadata label, when the provider has one. */
  reference: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  /** Only a URL the provider (or DE staff) supplied, http(s) only. */
  trackingUrl: string | null;
  status: ShipmentStatus;
  /** ISO date or datetime the shipment shipped / the label was created. */
  shippedAt: string | null;
  deliveredAt: string | null;
  /** Total item quantity, when the provider reports it. */
  items: number | null;
  notes: string | null;
  /**
   * manual provider only: what the carrier's own tracking API last said
   * (carriers/, see README.md "Carrier tracking"). null when the row was not
   * looked up (carrier not configured, kill switch, over the per-page cap,
   * lookup failed); absent on vendor providers. When present, `status` above
   * already reflects the carrier's answer (see carriers/index.ts mergeStatus).
   */
  carrierStatus?: CarrierStatus | null;
};

/** Carriers whose tracking APIs the manual provider can ask. */
export type CarrierId = "ups" | "fedex" | "usps";

export type CarrierStatus = {
  source: CarrierId;
  /** ISO datetime (UTC) this server asked the carrier. */
  checkedAt: string;
  /** The carrier's latest scan / event description, as the carrier wrote it. */
  latestEvent: string | null;
  /**
   * ISO 8601 date-time of that event. With an offset when the carrier gives
   * one (UPS, FedEx); USPS gives the scan's local wall-clock time, which is
   * returned without an offset (see README.md).
   */
  latestEventAt: string | null;
  /** "City, ST" of that event (city / state only, no street or ZIP). */
  latestLocation: string | null;
};

export type ShippingData = {
  provider: ShippingProviderId;
  /** Newest first. */
  shipments: NormalizedShipment[];
  counts: {
    /** null when the provider does not report delivery progress (see reportsDeliveryStatus). */
    active: number | null;
    total: number;
  };
  /** How far back the list and total reach in days; null = everything the provider returned. */
  windowDays: number | null;
  /** true when the provider holds more shipments than are listed. */
  truncated: boolean;
  /** false when the provider cannot tell in transit from delivered (ShipStation v1 shipments). */
  reportsDeliveryStatus: boolean;
};

export type ShippingLoadResult = { notMapped: true } | { data: ShippingData };

export type Env = Record<string, string | undefined>;

export const VENDOR_TIMEOUT_MS = 10_000;

/** Missing or malformed configuration. Logged server-side; the browser gets a generic 502. */
export class ShippingConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShippingConfigError";
  }
}

/** The vendor failed, timed out or answered an unexpected shape. Never carries vendor body text. */
export class ShippingVendorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShippingVendorError";
  }
}

/** Builds the counts for a list of normalized shipments. */
export function countShipments(
  shipments: NormalizedShipment[],
  opts: { reportsDeliveryStatus: boolean; total?: number },
): ShippingData["counts"] {
  return {
    active: opts.reportsDeliveryStatus ? shipments.filter((s) => ACTIVE_STATUSES.includes(s.status)).length : null,
    total: typeof opts.total === "number" && Number.isFinite(opts.total) ? opts.total : shipments.length,
  };
}

/** Keeps only absolute http(s) URLs; anything else becomes null. */
export function safeHttpUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function str(v: unknown): string | null {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Newest first by shippedAt; undated last. */
export function newestFirst(a: NormalizedShipment, b: NormalizedShipment): number {
  const ta = a.shippedAt ? Date.parse(a.shippedAt) : NaN;
  const tb = b.shippedAt ? Date.parse(b.shippedAt) : NaN;
  if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
  if (Number.isNaN(ta)) return 1;
  if (Number.isNaN(tb)) return -1;
  return tb - ta;
}
