import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTORENEW_TERMS_VERSION,
  AUTO_RENEW_CANCEL_POLICY_TEXT,
  buildAutoRenewTermsText,
} from "@shared/autoRenewContract";
import {
  deliverSubscriptionConfirmation,
  getAutoRenewEmailDelivery,
  listAutoRenewEmailDeliveries,
  resetAutoRenewEmailDeliveries,
  type SubscriptionConfirmationPayload,
} from "./autoRenewEmailDelivery";

afterEach(() => {
  resetAutoRenewEmailDeliveries();
});

function payload(overrides: Partial<SubscriptionConfirmationPayload> = {}): SubscriptionConfirmationPayload {
  return {
    email: "alex@example.com",
    name: "Alex Rivera",
    subscriptionId: "sub_1",
    status: "pending",
    renewsAt: "2026-12-13T00:00:00.000Z",
    items: [{ name: "Phishing Simulation Starter", sku: "DE-DIG-ASMT-PHISH-MO", price: 199, quantity: 1 }],
    totalCents: 19900,
    currency: "USD",
    frequency: "month",
    termMonths: 1,
    termsVersion: AUTORENEW_TERMS_VERSION,
    termsText: buildAutoRenewTermsText({
      priceCents: 19900,
      currency: "USD",
      frequency: "month",
      termMonths: 1,
    }),
    cancelPolicyText: AUTO_RENEW_CANCEL_POLICY_TEXT,
    ...overrides,
  };
}

describe("deliverSubscriptionConfirmation", () => {
  it("records a sent delivery on the first successful attempt", async () => {
    const send = vi.fn(async () => true);
    const record = await deliverSubscriptionConfirmation(payload(), { send, backoffMs: [5, 5] });
    expect(send).toHaveBeenCalledTimes(1);
    expect(record).toMatchObject({
      subscriptionId: "sub_1",
      to: "alex@example.com",
      status: "sent",
      attempts: 1,
      lastError: null,
    });
    expect(record.sentAt).toBeTruthy();
    expect(getAutoRenewEmailDelivery("sub_1")?.status).toBe("sent");
  });

  it("retries with backoff and keeps the delivery record after a later success", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new Error("SMTP timeout"))
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const slept: number[] = [];
    const record = await deliverSubscriptionConfirmation(payload(), {
      send,
      backoffMs: [25, 40],
      sleep: async (ms) => {
        slept.push(ms);
      },
    });
    expect(send).toHaveBeenCalledTimes(3);
    expect(slept).toEqual([25, 40]);
    expect(record.status).toBe("sent");
    expect(record.attempts).toBe(3);
    expect(record.lastError).toBeNull();
    expect(record.sentAt).toBeTruthy();
  });

  it("marks the record failed and stores the last error when every attempt fails", async () => {
    const send = vi.fn(async () => {
      throw new Error("mailbox rejected");
    });
    const record = await deliverSubscriptionConfirmation(payload({ subscriptionId: "sub_fail" }), {
      send,
      backoffMs: [1],
      sleep: async () => {},
    });
    expect(send).toHaveBeenCalledTimes(2);
    expect(record.status).toBe("failed");
    expect(record.attempts).toBe(2);
    expect(record.lastError).toBe("mailbox rejected");
    expect(record.sentAt).toBeNull();
    expect(listAutoRenewEmailDeliveries()).toHaveLength(1);
  });
});
