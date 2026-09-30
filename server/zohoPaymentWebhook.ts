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

const PAID_OR_LATER = new Set(["paid", "processing", "provisioning", "completed"]);
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
