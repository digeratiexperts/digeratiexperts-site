import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  evaluatePaymentSucceeded,
  PAID_OR_LATER_STATUSES,
  type StoredOrderForPayment,
  unpaidOrderCondition,
} from "./zohoPaymentWebhook";

const order = (overrides: Partial<StoredOrderForPayment> = {}): StoredOrderForPayment => ({
  id: "order-1",
  orderNumber: "ORD-TEST-1",
  status: "awaiting_payment",
  total: "1250.00",
  zohoPaymentId: null,
  ...overrides,
});

describe("evaluatePaymentSucceeded", () => {
  it("marks paid only when the event amount matches the stored total exactly", () => {
    expect(evaluatePaymentSucceeded(order(), { amount: "1250.00", currency: "USD" })).toEqual({
      action: "mark_paid",
    });
    expect(evaluatePaymentSucceeded(order(), { amount: "1250", currency: null })).toEqual({
      action: "mark_paid",
    });
  });

  it("rejects a partial or mismatched payment without transitioning the order", () => {
    expect(evaluatePaymentSucceeded(order(), { amount: "0.50", currency: "USD" })).toEqual({
      action: "reject",
      reason: "amount_mismatch",
    });
    expect(evaluatePaymentSucceeded(order(), { amount: "1249.99", currency: "USD" })).toEqual({
      action: "reject",
      reason: "amount_mismatch",
    });
  });

  it("rejects when the event carries no readable amount", () => {
    expect(evaluatePaymentSucceeded(order(), { amount: null, currency: "USD" })).toEqual({
      action: "reject",
      reason: "event_amount_missing",
    });
    expect(evaluatePaymentSucceeded(order(), { amount: "not-a-number", currency: "USD" })).toEqual({
      action: "reject",
      reason: "event_amount_unreadable",
    });
  });

  it("rejects a non-USD payment", () => {
    expect(evaluatePaymentSucceeded(order(), { amount: "1250.00", currency: "EUR" })).toEqual({
      action: "reject",
      reason: "currency_mismatch",
    });
  });

  it("rejects when the stored order total is unreadable", () => {
    expect(
      evaluatePaymentSucceeded(order({ total: null }), { amount: "1250.00", currency: "USD" }),
    ).toEqual({ action: "reject", reason: "order_total_unreadable" });
  });

  it("is idempotent for orders already at or past paid", () => {
    for (const status of ["paid", "processing", "provisioning", "completed"]) {
      expect(
        evaluatePaymentSucceeded(order({ status }), { amount: "9999.99", currency: "USD" }),
      ).toEqual({ action: "already_paid" });
    }
  });
});

describe("unpaidOrderCondition", () => {
  // Render the predicate to SQL without a database connection.
  const render = (orderId: string) => new PgDialect().sqlToQuery(unpaidOrderCondition(orderId));

  it("matches only the requested order", () => {
    const { sql, params } = render("order-1");
    expect(sql).toMatch(/"id" = \$1/);
    expect(params[0]).toBe("order-1");
  });

  it("excludes every paid-or-later status and admits a null status", () => {
    const { sql, params } = render("order-1");
    expect(sql).toMatch(/is null/i);
    expect(sql).toMatch(/not in/i);
    expect(params.slice(1)).toEqual([...PAID_OR_LATER_STATUSES]);
  });
});
