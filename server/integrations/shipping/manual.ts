import type { ManualRecord } from "../../portalManualRecords";
import { countShipments, isShipmentStatus, newestFirst, safeHttpUrl, str, type NormalizedShipment, type ShippingData } from "./types";

/**
 * PORTAL_SHIPPING_PROVIDER=manual: tracking numbers DE staff enter per company
 * (server/portalManualRecords.ts, kind "shipment"). The record's `data`:
 *
 *   reference, carrier, trackingNumber, trackingUrl (http/https, optional),
 *   status (one of SHIPMENT_STATUSES), shippedAt, deliveredAt (YYYY-MM-DD),
 *   items (number), notes
 *
 * No carrier "Track" link is built from the tracking number: no carrier
 * publishes a deep-link pattern we could cite (see README.md), so a link
 * appears only when staff paste the carrier's tracking URL.
 */

export const MANUAL_SHIPMENT_FIELDS = [
  "reference",
  "carrier",
  "trackingNumber",
  "trackingUrl",
  "status",
  "shippedAt",
  "deliveredAt",
  "items",
  "notes",
] as const;

export function mapManualShipment(rec: ManualRecord): NormalizedShipment {
  const d = rec.data || {};
  const items = typeof d.items === "number" ? d.items : typeof d.items === "string" && d.items.trim() ? Number(d.items) : NaN;
  return {
    id: rec.id,
    reference: str(d.reference),
    carrier: str(d.carrier),
    trackingNumber: str(d.trackingNumber),
    trackingUrl: safeHttpUrl(d.trackingUrl),
    status: isShipmentStatus(d.status) ? d.status : "unknown",
    shippedAt: str(d.shippedAt),
    deliveredAt: str(d.deliveredAt),
    items: Number.isFinite(items) && items >= 0 ? Math.floor(items) : null,
    notes: str(d.notes),
  };
}

export function buildManualData(records: ManualRecord[]): ShippingData {
  const shipments = records.map(mapManualShipment).sort(newestFirst);
  return {
    provider: "manual",
    shipments,
    counts: countShipments(shipments, { reportsDeliveryStatus: true }),
    windowDays: null,
    truncated: false,
    reportsDeliveryStatus: true,
  };
}
