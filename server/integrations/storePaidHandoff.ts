import { eq } from "drizzle-orm";
import { isDeepStrictEqual } from "node:util";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import type { ZohoPaymentWebhookEvent } from "../zohoPayments";
import { evaluatePaymentSucceeded, unpaidOrderCondition } from "../zohoPaymentWebhook";
import { enqueueOutbox } from "./deSyncStore";
import { buildStoreOrderCreatedPayload } from "./enqueueStoreOrder";
import { blocksOriginalStorePurchase } from "../storeOrderControls";
import type { DeSyncEnvelope } from "./deSyncContract";
import { PAID_OR_LATER_STATUSES } from "../zohoPaymentWebhook";

export type StoreHandoffDatabase = NodePgDatabase<typeof schema>;
type Payment = Pick<ZohoPaymentWebhookEvent, "amount" | "currency" | "paymentId">;

function paidOrderSnapshot(order: Pick<schema.StoreOrder, "subtotal" | "tax" | "total">) {
  return { subtotal: order.subtotal, tax: order.tax, total: order.total };
}

/** A verified payment and its existing de-sync command commit or roll back together. */
export async function recordPaidStoreHandoff(database: StoreHandoffDatabase, orderId: string, event: Payment) {
  return database.transaction(async transaction => {
    // Re-read under the row lock: earlier webhook reads can be stale after a
    // cancellation, amount edit, or concurrent delivery. The second delivery
    // observes the committed paid state and cannot create another handoff.
    const [order] = await transaction.select().from(schema.storeOrders).where(eq(schema.storeOrders.id, orderId)).limit(1).for("update");
    if (!order) return { action: "missing" as const };
    const decision = evaluatePaymentSucceeded(order, event);
    if (decision.action === "reject") return { ...decision, order };
    if (decision.action === "already_paid") {
      if (!order.zohoPaymentId && event.paymentId) {
        const [updated] = await transaction.update(schema.storeOrders).set({
          zohoPaymentId: event.paymentId, paidAt: order.paidAt || new Date(), updatedAt: new Date(),
        }).where(eq(schema.storeOrders.id, order.id)).returning();
        return { action: "already_paid" as const, order: updated };
      }
      return { ...decision, order };
    }
    const [paid] = await transaction.update(schema.storeOrders).set({
      status: "paid", zohoPaymentId: event.paymentId || order.zohoPaymentId || null,
      paidAt: new Date(), updatedAt: new Date(),
    }).where(unpaidOrderCondition(order.id)).returning();
    if (!paid) return { action: "already_paid" as const, order };
    const [client] = order.clientId
      ? await transaction.select().from(schema.portalClients).where(eq(schema.portalClients.id, order.clientId)).limit(1)
      : [];
    const payload = buildStoreOrderCreatedPayload({ ...paid, status: "paid", lineItems: Array.isArray(paid.lineItems) ? paid.lineItems : [] });
    if (!payload) throw new Error("Paid Store order has no handoff payload");
    await enqueueOutbox({
      eventType: "store.order_created", source: "website", destination: "hub", entityType: "store",
      entityId: paid.id, canonicalAccountId: client?.hubAccountId || null,
      payload: { ...payload, paidOrderSnapshot: paidOrderSnapshot(paid) },
    }, transaction);
    return { action: "mark_paid" as const, order: paid, oldStatus: order.status };
  });
}

/** Recheck a queued paid command against current Store truth before transport. */
export async function prepareStorePaidHandoff(
  database: StoreHandoffDatabase,
  envelope: DeSyncEnvelope,
  now = new Date(),
): Promise<DeSyncEnvelope> {
  const commercial = envelope.payload.commercial as Record<string, unknown> | undefined;
  if (envelope.eventType !== "store.order_created" || commercial?.status !== "paid") return envelope;
  return database.transaction(async transaction => {
    const block = (reason: string): never => { throw new Error(`Store paid handoff blocked: ${reason}`); };
    const [order] = await transaction.select().from(schema.storeOrders).where(eq(schema.storeOrders.id, envelope.entityId)).limit(1).for("update");
    if (!order || !(PAID_OR_LATER_STATUSES as readonly string[]).includes(order.status || "")) block("order_not_paid");
    if (envelope.source !== "website" || envelope.entityType !== "store" || envelope.payload.id !== order.id || (envelope.payload.portalClientId ?? null) !== order.clientId) block("tenant_mismatch");
    const [client] = order.clientId
      ? await transaction.select().from(schema.portalClients).where(eq(schema.portalClients.id, order.clientId)).limit(1)
      : [];
    const accountId = client?.hubAccountId || null;
    const [queued] = await transaction.select().from(schema.syncOutbox).where(eq(schema.syncOutbox.eventId, envelope.eventId)).limit(1).for("update");
    if (!queued || queued.entityId !== order.id || queued.eventType !== "store.order_created" || queued.source !== "website" ||
      queued.destination !== "hub" || queued.entityType !== "store" || !isDeepStrictEqual(queued.payload, envelope.payload)) block("queued_order_mismatch");
    // Earlier unpaid intake may have learned the mapping after payment queued.
    // A known mapping can never be replaced. Bind a previously unknown mapping
    // durably before transport so later retries also enforce this identity.
    if ((order.clientId && !client) ||
      (envelope.canonicalAccountId && envelope.canonicalAccountId !== accountId) ||
      (queued.canonicalAccountId && queued.canonicalAccountId !== accountId)) block("tenant_mapping_changed");
    const [hold] = await transaction.select().from(schema.storeOrderHolds).where(eq(schema.storeOrderHolds.orderId, order.id)).limit(1);
    if (hold && hold.heldUntil > now.toISOString().slice(0, 10)) block("on_hold");
    const requests = await transaction.select().from(schema.storeOrderChangeRequests).where(eq(schema.storeOrderChangeRequests.orderId, order.id));
    if (requests.some(blocksOriginalStorePurchase)) block("change_requires_reconciliation");
    const current = buildStoreOrderCreatedPayload({ ...order, status: "paid", lineItems: Array.isArray(order.lineItems) ? order.lineItems : [] });
    const withoutTimestamp = (value: Record<string, unknown>) => {
      const { occurredAt: _timestamp, ...purchase } = value;
      return purchase;
    };
    if (!isDeepStrictEqual(envelope.payload.paidOrderSnapshot, paidOrderSnapshot(order))) block("paid_amounts_changed");
    if (!current || envelope.payload.email !== current.email || envelope.payload.name !== current.name || envelope.payload.company !== current.company ||
      !isDeepStrictEqual(withoutTimestamp(commercial!), withoutTimestamp(current.commercial!))) block("purchase_changed");
    if (!queued.canonicalAccountId && accountId) {
      await transaction.update(schema.syncOutbox).set({ canonicalAccountId: accountId }).where(eq(schema.syncOutbox.eventId, envelope.eventId));
    }
    return { ...envelope, canonicalAccountId: accountId };
  });
}
