import { describe, expect, it } from "vitest";
import {
  classifyPaymentWebhookEvent,
  paymentWebhookRetryDelayMs,
  sanitizedPaymentWebhookEvent,
} from "./zohoPaymentWebhookInbox";

describe("Zoho payment webhook inbox policy", () => {
  it.each([
    ["payment.succeeded", "succeeded"],
    ["payment.pending", "attempt_update"],
    ["payment.failed", "attempt_update"],
    ["refund.succeeded", "financial_exception"],
    ["payment.refunded", "financial_exception"],
    ["dispute.created", "financial_exception"],
    ["chargeback.opened", "financial_exception"],
    ["unknown.event", "ignored"],
  ] as const)("classifies %s as %s", (eventType, expected) => {
    expect(classifyPaymentWebhookEvent(eventType)).toBe(expected);
  });

  it("bounds exponential retry delay at one hour", () => {
    expect(paymentWebhookRetryDelayMs(1)).toBe(60_000);
    expect(paymentWebhookRetryDelayMs(2)).toBe(120_000);
    expect(paymentWebhookRetryDelayMs(100)).toBe(3_600_000);
  });

  it("stores only the normalized envelope and drops PII metadata", () => {
    const event = sanitizedPaymentWebhookEvent({
      eventId: "evt-1",
      eventTimeMs: 1,
      liveMode: true,
      eventType: "payment.succeeded",
      paymentId: "pay-1",
      paymentSessionId: "ps-1",
      referenceNumber: "ORD-1",
      invoiceNumber: "ORD-1",
      amount: "1.00",
      currency: "USD",
      status: "succeeded",
      metadata: [
        { key: "orderId", value: "order-1" },
        { key: "billingEmail", value: "person@example.com" },
      ],
    });

    expect(event.metadata).toEqual([{ key: "orderId", value: "order-1" }]);
    expect(JSON.stringify(event)).not.toContain("person@example.com");
  });
});
