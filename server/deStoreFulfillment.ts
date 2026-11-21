/**
 * Records fulfillment events emitted by the Hub. The site never invents
 * shipped, delayed, cancelled, or refunded statuses on its own.
 */
export type StoreFulfillmentEventType =
  | "fulfillment.order_confirmation"
  | "fulfillment.delay_notice_sent"
  | "fulfillment.buyer_delay_consent"
  | "fulfillment.buyer_cancel"
  | "fulfillment.shipped"
  | "fulfillment.refunded"
  | "order.created"
  | "agreement.created"
  | "signature.requested"
  | "device.deployment";

export interface StoredFulfillmentEvent {
  eventId: string;
  eventType: StoreFulfillmentEventType;
  occurredAt: string;
  hubOrderId?: string;
  siteOrderId: string;
  payload: Record<string, unknown>;
}

export interface StoreFulfillmentRecord {
  siteOrderId: string;
  hubOrderId?: string;
  status?: string;
  promisedShipByDate?: string;
  events: StoredFulfillmentEvent[];
}

const records = new Map<string, StoreFulfillmentRecord>();

function keyOf(event: Pick<StoredFulfillmentEvent, "siteOrderId" | "hubOrderId">): string {
  return event.hubOrderId || event.siteOrderId;
}

export function resetStoreFulfillmentRecords(): void {
  records.clear();
}

export function recordHubFulfillmentEvent(event: StoredFulfillmentEvent): StoreFulfillmentRecord {
  const existing =
    (event.hubOrderId ? records.get(event.hubOrderId) : undefined) ||
    records.get(event.siteOrderId) ||
    { siteOrderId: event.siteOrderId, hubOrderId: event.hubOrderId, events: [] };

  if (event.hubOrderId) existing.hubOrderId = event.hubOrderId;
  existing.siteOrderId = event.siteOrderId || existing.siteOrderId;

  const payload = event.payload;
  if (typeof payload.status === "string") existing.status = payload.status;
  if (typeof payload.promisedShipByDate === "string") existing.promisedShipByDate = payload.promisedShipByDate;
  if (event.eventType === "fulfillment.shipped") existing.status = "shipped";
  if (event.eventType === "fulfillment.refunded") existing.status = "refunded";
  if (event.eventType === "fulfillment.buyer_cancel") existing.status = "cancelled";
  if (event.eventType === "fulfillment.delay_notice_sent") existing.status = "awaiting_buyer_delay_decision";

  if (!existing.events.some((item) => item.eventId === event.eventId)) {
    existing.events = [...existing.events, event];
  }

  records.set(event.siteOrderId, existing);
  if (existing.hubOrderId) records.set(existing.hubOrderId, existing);
  return existing;
}

export function getStoreFulfillmentRecord(id: string): StoreFulfillmentRecord | undefined {
  return records.get(id);
}
