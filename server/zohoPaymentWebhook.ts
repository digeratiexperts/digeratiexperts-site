import { and, eq, isNull, notInArray, or } from "drizzle-orm";
import { storeOrders } from "@shared/schema";
import type { ZohoPaymentWebhookEvent } from "./zohoPayments";

/**
 * Server-authoritative decision for a verified `payment.succeeded` webhook.
 *
 * A provider "success" alone never marks an order paid: the event's amount and
 * currency must match the stored order total exactly. Mismatches are rejected
 * and logged without any status transition. Orders already at/past `paid` are
 * treated idempotently (the webhook may be delivered more than once).
 */

export interface StoredOrderForPayment {
  id: string;
  orderNumber: string | null;
  status: string | null;
  total: string | null;
  zohoPaymentId: string | null;
}

export type PaymentWebhookDecision =
  | { action: "mark_paid" }
  | { action: "already_paid" }
  | { action: "reject"; reason: string };

export const PAID_OR_LATER_STATUSES = ["paid", "processing", "provisioning", "completed"] as const;
const PAID_OR_LATER: ReadonlySet<string> = new Set(PAID_OR_LATER_STATUSES);
const EXPECTED_CURRENCY = "USD";

export function evaluatePaymentSucceeded(
  order: StoredOrderForPayment,
  event: Pick<ZohoPaymentWebhookEvent, "amount" | "currency">,
): PaymentWebhookDecision {
  if (PAID_OR_LATER.has(order.status || "")) {
    return { action: "already_paid" };
  }

  const expectedTotal = Number.parseFloat(order.total ?? "");
  if (!Number.isFinite(expectedTotal) || expectedTotal <= 0) {
    return { action: "reject", reason: "order_total_unreadable" };
  }

  if (event.amount === null || event.amount === undefined || event.amount === "") {
    return { action: "reject", reason: "event_amount_missing" };
  }
  const paidAmount = Number.parseFloat(String(event.amount));
  if (!Number.isFinite(paidAmount)) {
    return { action: "reject", reason: "event_amount_unreadable" };
  }

  // Exact match at cent precision — a partial payment, retry amount, or a
  // payment attributed from a different (cheaper) session must not pay this order.
  if (Math.abs(paidAmount - expectedTotal) >= 0.005) {
    return { action: "reject", reason: "amount_mismatch" };
  }

  if (event.currency && event.currency.toUpperCase() !== EXPECTED_CURRENCY) {
    return { action: "reject", reason: "currency_mismatch" };
  }

  return { action: "mark_paid" };
}

/**
 * The condition on the write that marks an order paid. It matches only an
 * order that is still unpaid, so a second delivery of the same event updates
 * nothing and the caller skips fulfilment. A null status counts as unpaid.
 */
export function unpaidOrderCondition(orderId: string) {
  return and(
    eq(storeOrders.id, orderId),
    or(isNull(storeOrders.status), notInArray(storeOrders.status, [...PAID_OR_LATER_STATUSES])),
  );
}
