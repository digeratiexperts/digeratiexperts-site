/**
 * Post-payment order fulfillment orchestrator.
 *
 * Reliability model:
 * - the payment webhook durably marks an order `paid`
 * - exactly one worker atomically claims `paid -> provisioning`
 * - completed/cancelled/refunded orders are terminal
 * - a fatal exception returns our still-owned `provisioning` claim to `paid`
 * - a bounded reconciler recovers paid orders and stale provisioning claims
 */

import { and, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { storeOrders, type StoreOrder } from "@shared/schema";
import { notificationService } from "./notificationService";
import { zohoClient } from "../zoho/zohoClient";
import { zohoDeskService } from "../zoho/zohoDesk";

const ACTIVE_FULFILLMENT_STATUSES = new Set(["provisioning", "processing"]);
const TERMINAL_FULFILLMENT_STATUSES = new Set(["completed", "cancelled", "refunded"]);
const FULFILLED_NOTE_MARKER = "[FULFILLED]";
const STALE_PROVISIONING_MS = 30 * 60 * 1000;
const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
const RECONCILE_BATCH_SIZE = 25;

let reconciliationRunning = false;
let reconciliationTimer: NodeJS.Timeout | null = null;

type LineItem = {
  name?: string;
  sku?: string;
  unitPrice?: number | string;
  price?: number | string;
  quantity?: number | string;
};

function logSecurity(event: string, data: Record<string, unknown>) {
  console.log(`[SECURITY] ${event}`, data);
}

export function isFulfillmentTerminalStatus(status: string | null | undefined): boolean {
  return TERMINAL_FULFILLMENT_STATUSES.has(status || "");
}

export function isFulfillmentActiveStatus(status: string | null | undefined): boolean {
  return ACTIVE_FULFILLMENT_STATUSES.has(status || "");
}

export function isStaleProvisioning(
  status: string | null | undefined,
  updatedAt: Date | string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (status !== "provisioning" || !updatedAt) return false;
  const updatedMs = new Date(updatedAt).getTime();
  return Number.isFinite(updatedMs) && nowMs - updatedMs >= STALE_PROVISIONING_MS;
}

function alreadyCompleted(order: StoreOrder): boolean {
  if (order.status === "completed") return true;
  return (order.notes || "").includes(FULFILLED_NOTE_MARKER);
}

function parseLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw as LineItem[];
}

function formatItemsForEmail(items: LineItem[]) {
  return items.map((item) => ({
    name: item.name || item.sku || "Item",
    price: Number(item.unitPrice ?? item.price ?? 0) || 0,
    quantity: Number(item.quantity ?? 1) || 1,
  }));
}

function buildDeskDescription(order: StoreOrder, items: LineItem[]): string {
  const lines = items.map((item) => {
    const qty = Number(item.quantity ?? 1) || 1;
    const price = Number(item.unitPrice ?? item.price ?? 0) || 0;
    const label = item.name || item.sku || "Item";
    return `- ${label} × ${qty} @ $${price.toFixed(2)}`;
  });

  return [
    `Paid store order requires fulfillment.`,
    ``,
    `Order Number: ${order.orderNumber}`,
    `Order ID: ${order.id}`,
    `Total: $${Number(order.total || 0).toFixed(2)}`,
    `Payment method: ${order.paymentMethod || "unknown"}`,
    `Zoho Payment ID: ${order.zohoPaymentId || "n/a"}`,
    `Zoho Session ID: ${order.zohoPaymentSessionId || "n/a"}`,
    `Billing: ${order.billingName || "n/a"} <${order.billingEmail || "n/a"}>`,
    order.billingCompany ? `Company: ${order.billingCompany}` : null,
    `Paid at: ${order.paidAt ? new Date(order.paidAt).toISOString() : "n/a"}`,
    ``,
    `Line items:`,
    ...lines,
  ]
    .filter(Boolean)
    .join("\n");
}

async function createFulfillmentDeskTicket(order: StoreOrder, items: LineItem[]): Promise<string | null> {
  if (!zohoClient.isDeskConfigured()) {
    console.log("[ORDER FULFILLMENT] Zoho Desk not configured — skipping ticket");
    return null;
  }

  try {
    let contactId: string | undefined;
    if (order.billingEmail) {
      try {
        const contact = await zohoDeskService.getContactByEmail(order.billingEmail);
        if (contact) contactId = contact.id;
      } catch (contactErr) {
        console.warn("[ORDER FULFILLMENT] Desk contact lookup failed:", contactErr);
      }
    }

    const ticket = await zohoDeskService.createTicket({
      source: "order-fulfillment",
      subject: `Store order fulfillment: ${order.orderNumber}`,
      description: buildDeskDescription(order, items),
      contactId,
      email: contactId ? undefined : order.billingEmail || undefined,
      priority: "Medium",
    });

    logSecurity("ORDER_FULFILLMENT_DESK_TICKET", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      zohoTicketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
    });

    return ticket.id;
  } catch (err: any) {
    console.warn(
      "[ORDER FULFILLMENT] Zoho Desk ticket failed:",
      err?.response?.data || err?.message || err,
    );
    return null;
  }
}

async function sendConfirmation(order: StoreOrder, items: LineItem[]): Promise<void> {
  if (!order.billingEmail) {
    console.warn("[ORDER FULFILLMENT] No billing email — skipping confirmation", {
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
    return;
  }

  try {
    const sent = await notificationService.sendOrderConfirmation({
      email: order.billingEmail,
      name: order.billingName || "Customer",
      orderId: order.orderNumber,
      items: formatItemsForEmail(items),
      total: Number(order.total || 0) || 0,
    });

    logSecurity("ORDER_CONFIRMATION_EMAIL", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      email: order.billingEmail,
      sent: !!sent,
    });
  } catch (err: any) {
    console.warn("[ORDER FULFILLMENT] Confirmation email failed:", err?.message || err);
  }
}

/**
 * Record the paid order as a Zoho Books invoice and payment
 * (server/services/zohoBooksInvoice.ts). Best effort: the note says what
 * happened, and Books trouble never stops fulfillment.
 */
async function recordInBooks(order: StoreOrder): Promise<string | null> {
  try {
    const { recordPaidOrderInBooks } = await import("./zohoBooksInvoice");
    return await recordPaidOrderInBooks(order);
  } catch (err: any) {
    console.warn("[ORDER FULFILLMENT] Books invoice step failed:", err?.message || err);
    return "booksInvoice:failed (unexpected error)";
  }
}

async function loadOrder(id: string): Promise<StoreOrder | null> {
  const [order] = await db.select().from(storeOrders).where(eq(storeOrders.id, id)).limit(1);
  return order || null;
}

/**
 * Atomically claim a paid order. Returning null means another worker owns it,
 * it is already complete/terminal, or it is not yet eligible for fulfillment.
 */
async function claimPaidOrder(id: string): Promise<StoreOrder | null> {
  const [claimed] = await db
    .update(storeOrders)
    .set({ status: "provisioning", updatedAt: new Date() })
    .where(and(eq(storeOrders.id, id), eq(storeOrders.status, "paid")))
    .returning();
  return claimed || null;
}

async function releaseFailedClaim(id: string): Promise<void> {
  const [released] = await db
    .update(storeOrders)
    .set({ status: "paid", updatedAt: new Date() })
    .where(and(eq(storeOrders.id, id), eq(storeOrders.status, "provisioning")))
    .returning({ id: storeOrders.id, orderNumber: storeOrders.orderNumber });

  if (released) {
    logSecurity("ORDER_FULFILLMENT_CLAIM_RELEASED", {
      orderId: released.id,
      orderNumber: released.orderNumber,
      reason: "fatal_error",
      newStatus: "paid",
    });
  }
}

/**
 * Fulfill one durably paid order.
 *
 * The atomic `paid -> provisioning` update is the concurrency lock. Orders in
 * `awaiting_payment` are never eligible; provider confirmation must first mark
 * them paid. A fatal exception releases our claim back to paid for reconciliation.
 */
export async function fulfillPaidOrder(orderId: string | number): Promise<boolean> {
  const id = String(orderId);
  let claimed = false;

  try {
    // A client or DE hold pauses fulfilment until its end date; reconciliation picks the order up afterwards.
    const { isStoreOrderHeld } = await import("../storeOrderControls");
    if (await isStoreOrderHeld(id)) {
      logSecurity("ORDER_FULFILLMENT_SKIPPED", { orderId: id, reason: "on_hold" });
      return false;
    }
    const order = await claimPaidOrder(id);
    if (!order) {
      const latest = await loadOrder(id);
      if (!latest) {
        logSecurity("ORDER_FULFILLMENT_SKIPPED", { orderId: id, reason: "not_found" });
        return false;
      }

      const reason = alreadyCompleted(latest)
        ? "already_completed"
        : isFulfillmentTerminalStatus(latest.status)
          ? "terminal_status"
          : isFulfillmentActiveStatus(latest.status)
            ? "already_claimed"
            : "not_paid";

      logSecurity("ORDER_FULFILLMENT_SKIPPED", {
        orderId: latest.id,
        orderNumber: latest.orderNumber,
        reason,
        status: latest.status,
      });
      return false;
    }

    claimed = true;
    const items = parseLineItems(order.lineItems);

    logSecurity("ORDER_STATUS_CHANGED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      oldStatus: "paid",
      newStatus: "provisioning",
      triggeredBy: "order_fulfillment",
    });

    await sendConfirmation(order, items);
    const deskTicketId = await createFulfillmentDeskTicket(order, items);
    const booksNote = await recordInBooks(order);

    // The paid store.order_created command for the Hub is queued once, by the
    // Zoho Payments webhook at the paid transition (server/index.ts). Queuing it
    // again here would hand the Hub a duplicate order event.

    const fulfilledAt = new Date().toISOString();
    const noteParts = [
      order.notes?.trim() || "",
      `${FULFILLED_NOTE_MARKER} at ${fulfilledAt}`,
      deskTicketId ? `deskTicket:${deskTicketId}` : "deskTicket:skipped",
      booksNote ?? "",
    ].filter(Boolean);

    const [completed] = await db
      .update(storeOrders)
      .set({
        status: "completed",
        notes: noteParts.join(" | "),
        updatedAt: new Date(),
      })
      .where(and(eq(storeOrders.id, order.id), eq(storeOrders.status, "provisioning")))
      .returning({ id: storeOrders.id });

    if (!completed) {
      throw new Error("Fulfillment claim was lost before completion");
    }

    claimed = false;
    logSecurity("ORDER_STATUS_CHANGED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      oldStatus: "provisioning",
      newStatus: "completed",
      triggeredBy: "order_fulfillment",
      deskTicketId,
    });

    logSecurity("ORDER_FULFILLED", {
      orderId: order.id,
      orderNumber: order.orderNumber,
      deskTicketId,
      total: order.total,
    });
    return true;
  } catch (error: any) {
    console.error("[ORDER FULFILLMENT ERROR]", {
      orderId: id,
      message: error?.message || String(error),
    });
    logSecurity("ORDER_FULFILLMENT_FAILED", {
      orderId: id,
      error: error?.message || String(error),
    });

    if (claimed) {
      try {
        await releaseFailedClaim(id);
      } catch (releaseError: any) {
        console.error("[ORDER FULFILLMENT CLAIM RELEASE ERROR]", {
          orderId: id,
          message: releaseError?.message || String(releaseError),
        });
      }
    }
    return false;
  }
}

/**
 * Recover work after restarts/crashes and pick up paid orders whose webhook-side
 * asynchronous fulfillment did not run. The overlap guard prevents one process
 * from stacking reconciliation passes; atomic claims protect across processes.
 */
export async function reconcilePaidOrders(): Promise<{ recovered: number; attempted: number; fulfilled: number }> {
  if (reconciliationRunning) {
    return { recovered: 0, attempted: 0, fulfilled: 0 };
  }

  reconciliationRunning = true;
  try {
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - STALE_PROVISIONING_MS);

    const recoveredRows = await db
      .update(storeOrders)
      .set({ status: "paid", updatedAt: now })
      .where(and(eq(storeOrders.status, "provisioning"), lt(storeOrders.updatedAt, staleCutoff)))
      .returning({ id: storeOrders.id, orderNumber: storeOrders.orderNumber });

    for (const recovered of recoveredRows) {
      logSecurity("ORDER_FULFILLMENT_STALE_CLAIM_RECOVERED", {
        orderId: recovered.id,
        orderNumber: recovered.orderNumber,
        newStatus: "paid",
      });
    }

    const pending = await db
      .select({ id: storeOrders.id })
      .from(storeOrders)
      .where(eq(storeOrders.status, "paid"))
      .limit(RECONCILE_BATCH_SIZE);

    let fulfilled = 0;
    for (const order of pending) {
      if (await fulfillPaidOrder(order.id)) fulfilled += 1;
    }

    if (recoveredRows.length > 0 || pending.length > 0) {
      logSecurity("ORDER_FULFILLMENT_RECONCILED", {
        recovered: recoveredRows.length,
        attempted: pending.length,
        fulfilled,
      });
    }

    return {
      recovered: recoveredRows.length,
      attempted: pending.length,
      fulfilled,
    };
  } catch (error: any) {
    console.error("[ORDER FULFILLMENT RECONCILIATION ERROR]", error?.message || error);
    return { recovered: 0, attempted: 0, fulfilled: 0 };
  } finally {
    reconciliationRunning = false;
  }
}

/** Start production recovery once after boot, then every five minutes. */
export function startOrderFulfillmentReconciliation(): void {
  if (process.env.NODE_ENV !== "production" || reconciliationTimer) return;

  void reconcilePaidOrders();
  reconciliationTimer = setInterval(() => {
    void reconcilePaidOrders();
  }, RECONCILE_INTERVAL_MS);
  reconciliationTimer.unref?.();
}
