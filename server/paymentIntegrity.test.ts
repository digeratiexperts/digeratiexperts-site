import { describe, expect, it, vi } from "vitest";
import {
  PaymentIntegrityError,
  resolveAuthoritativeInvoicePayment,
  reconcileSucceededPayment,
  type AtomicPaymentConsumption,
  type ExpectedPaymentBinding,
  type PaymentConsumptionResult,
  type PaymentIntegrityPorts,
  type ProviderPaymentSession,
  type SucceededPaymentEvent,
} from "./paymentIntegrity";

const NOW_MS = Date.UTC(2026, 7, 23, 12, 0, 0);

const binding: ExpectedPaymentBinding = {
  targetKind: "store_order",
  targetId: "order-123",
  paymentSessionId: "ps-123",
  referenceNumber: "ORD-123",
  invoiceNumber: "ORD-123",
  amount: "117.00",
  currency: "USD",
};

const event: SucceededPaymentEvent = {
  eventId: "evt-123",
  eventTimeMs: NOW_MS - 1_000,
  liveMode: true,
  eventType: "payment.succeeded",
  paymentId: "pay-123",
  paymentSessionId: "ps-123",
  referenceNumber: "ORD-123",
  invoiceNumber: "ORD-123",
  amount: "117.00",
  currency: "USD",
  status: "succeeded",
};

const providerSession: ProviderPaymentSession = {
  paymentSessionId: "ps-123",
  referenceNumber: "ORD-123",
  invoiceNumber: "ORD-123",
  amount: "117.00",
  currency: "USD",
  status: "succeeded",
  payments: [{ paymentId: "pay-123", status: "succeeded" }],
};

function createAtomicConsumption(): AtomicPaymentConsumption & {
  calls: Array<{ eventId: string; paymentId: string; targetId: string }>;
} {
  const consumedEvents = new Set<string>();
  const consumedPayments = new Set<string>();
  const calls: Array<{ eventId: string; paymentId: string; targetId: string }> = [];

  return {
    atomicity: "transactional_unique",
    calls,
    async consumeSucceededPayment(input): Promise<PaymentConsumptionResult> {
      // A production implementation must perform this check-and-insert plus the
      // paid transition in one database transaction protected by unique keys.
      if (consumedEvents.has(input.eventId) || consumedPayments.has(input.paymentId)) {
        return { outcome: "duplicate", targetId: input.targetId, targetKind: input.targetKind };
      }
      consumedEvents.add(input.eventId);
      consumedPayments.add(input.paymentId);
      calls.push({ eventId: input.eventId, paymentId: input.paymentId, targetId: input.targetId });
      return { outcome: "consumed", targetId: input.targetId, targetKind: input.targetKind };
    },
  };
}

function createPorts(
  overrides: Partial<PaymentIntegrityPorts> = {},
): PaymentIntegrityPorts & { consumption: ReturnType<typeof createAtomicConsumption> } {
  const consumption = createAtomicConsumption();
  return {
    expectedLiveMode: true,
    loadExpectedPayment: vi.fn(async () => binding),
    retrievePaymentSession: vi.fn(async () => providerSession),
    consumption,
    ...overrides,
  };
}

async function expectIntegrityCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toMatchObject<Partial<PaymentIntegrityError>>({ code });
}

describe("resolveAuthoritativeInvoicePayment", () => {
  it.each([
    ["underpayment", { browserAmountMinor: 1 }],
    ["zero", { browserAmountMinor: 0 }],
    ["negative", { browserAmountMinor: -10_000 }],
    ["overpayment", { browserAmountMinor: 9_999_999 }],
    ["wrong currency", { browserAmountMinor: 11_700, browserCurrency: "EUR" }],
  ])("uses the current server invoice balance and ignores browser %s data", (_label, hostileRequestData) => {
    const result = resolveAuthoritativeInvoicePayment({
      invoice: {
        invoiceId: "invoice-123",
        invoiceNumber: "INV-123",
        balance: "117.00",
        currency: "USD",
        status: "overdue",
      },
      // This field intentionally models hostile request data. It is not part of
      // the trusted calculation and must have no effect.
      ...hostileRequestData,
    } as any);

    expect(result).toEqual({
      invoiceId: "invoice-123",
      invoiceNumber: "INV-123",
      amount: 117,
      amountDecimal: "117.00",
      amountMinor: "11700",
      currency: "USD",
    });
  });

  it.each([
    ["0.00", "invoice_not_payable"],
    ["-1.00", "invalid_amount"],
  ])("rejects a non-payable balance of %s", (balance, code) => {
    expect(() => resolveAuthoritativeInvoicePayment({
      invoice: {
        invoiceId: "invoice-123",
        invoiceNumber: "INV-123",
        balance,
        currency: "USD",
        status: "sent",
      },
    })).toThrowError(expect.objectContaining({ code }));
  });

  it("rejects a terminal invoice even when stale data reports a balance", () => {
    expect(() => resolveAuthoritativeInvoicePayment({
      invoice: {
        invoiceId: "invoice-123",
        invoiceNumber: "INV-123",
        balance: "117.00",
        currency: "USD",
        status: "paid",
      },
    })).toThrowError(expect.objectContaining({ code: "invoice_not_payable" }));
  });

  it.each(["draft", "unknown", "pending", "void"])(
    "rejects the non-payable invoice status %s",
    (status) => {
      expect(() => resolveAuthoritativeInvoicePayment({
        invoice: {
          invoiceId: "invoice-123",
          invoiceNumber: "INV-123",
          balance: "117.00",
          currency: "USD",
          status,
        },
      })).toThrowError(expect.objectContaining({ code: "invoice_not_payable" }));
    },
  );

  it.each(["sent", "overdue", "unpaid", "partially_paid", "viewed"])(
    "accepts the explicit payable invoice status %s",
    (status) => {
      expect(resolveAuthoritativeInvoicePayment({
        invoice: {
          invoiceId: "invoice-123",
          invoiceNumber: "INV-123",
          balance: "117.00",
          currency: "USD",
          status,
        },
      })).toMatchObject({ invoiceId: "invoice-123", amountDecimal: "117.00" });
    },
  );
});

describe("reconcileSucceededPayment", () => {
  it("consumes an exact provider-confirmed binding and requests fulfillment once", async () => {
    const ports = createPorts();
    const fulfilled = vi.fn(async () => undefined);

    const result = await reconcileSucceededPayment(event, ports, {
      nowMs: NOW_MS,
      onConsumed: fulfilled,
    });

    expect(result).toEqual({ outcome: "consumed", targetId: "order-123", targetKind: "store_order" });
    expect(ports.retrievePaymentSession).toHaveBeenCalledWith("ps-123");
    expect(ports.consumption.calls).toHaveLength(1);
    expect(fulfilled).toHaveBeenCalledTimes(1);
    expect(fulfilled).toHaveBeenCalledWith({ targetId: "order-123", targetKind: "store_order" });
  });

  it.each([
    ["amount", { amount: "0.01" }, "amount_mismatch"],
    ["currency", { currency: "EUR" }, "currency_mismatch"],
    ["reference", { referenceNumber: "ORD-OTHER" }, "reference_mismatch"],
    ["invoice", { invoiceNumber: "ORD-OTHER" }, "invoice_mismatch"],
    ["session", { paymentSessionId: "ps-other" }, "session_mismatch"],
  ] as const)("fails closed on a wrong webhook %s", async (_label, changed, code) => {
    const ports = createPorts();
    await expectIntegrityCode(
      reconcileSucceededPayment({ ...event, ...changed }, ports, { nowMs: NOW_MS }),
      code,
    );
    expect(ports.retrievePaymentSession).not.toHaveBeenCalled();
    expect(ports.consumption.calls).toHaveLength(0);
  });

  it.each([
    ["amount", { amount: "0.01" }, "provider_amount_mismatch"],
    ["currency", { currency: "EUR" }, "provider_currency_mismatch"],
    ["reference", { referenceNumber: "ORD-OTHER" }, "provider_reference_mismatch"],
    ["invoice", { invoiceNumber: "ORD-OTHER" }, "provider_invoice_mismatch"],
    ["session", { paymentSessionId: "ps-other" }, "provider_session_mismatch"],
    ["status", { status: "pending" }, "provider_status_mismatch"],
  ] as const)("fails closed on a wrong provider %s", async (_label, changed, code) => {
    const ports = createPorts({
      retrievePaymentSession: vi.fn(async () => ({ ...providerSession, ...changed })),
    });
    await expectIntegrityCode(reconcileSucceededPayment(event, ports, { nowMs: NOW_MS }), code);
    expect(ports.consumption.calls).toHaveLength(0);
  });

  it("fails closed when the provider session does not bind the webhook payment ID", async () => {
    const ports = createPorts({
      retrievePaymentSession: vi.fn(async () => ({
        ...providerSession,
        payments: [{ paymentId: "pay-other", status: "succeeded" }],
      })),
    });
    await expectIntegrityCode(
      reconcileSucceededPayment(event, ports, { nowMs: NOW_MS }),
      "provider_payment_mismatch",
    );
    expect(ports.consumption.calls).toHaveLength(0);
  });

  it("rejects a test-mode payment in a live environment", async () => {
    const ports = createPorts();
    await expectIntegrityCode(
      reconcileSucceededPayment({ ...event, liveMode: false }, ports, { nowMs: NOW_MS }),
      "mode_mismatch",
    );
    expect(ports.loadExpectedPayment).not.toHaveBeenCalled();
  });

  it.each([
    [NOW_MS - 3 * 24 * 60 * 60_000 - 1, "stale_event"],
    [NOW_MS + 60_000 + 1, "future_event"],
  ])("rejects an event outside the freshness window", async (eventTimeMs, code) => {
    const ports = createPorts();
    await expectIntegrityCode(
      reconcileSucceededPayment({ ...event, eventTimeMs }, ports, { nowMs: NOW_MS }),
      code,
    );
    expect(ports.loadExpectedPayment).not.toHaveBeenCalled();
    expect(ports.consumption.calls).toHaveLength(0);
  });

  it("accepts a freshly delivered provider retry whose event is two days old", async () => {
    const ports = createPorts();
    await expect(reconcileSucceededPayment({
      ...event,
      eventTimeMs: NOW_MS - 2 * 24 * 60 * 60_000,
    }, ports, { nowMs: NOW_MS })).resolves.toMatchObject({
      outcome: "consumed",
      targetId: "order-123",
    });
    expect(ports.consumption.calls).toHaveLength(1);
  });

  it("treats replay and concurrent delivery as duplicates without repeating fulfillment", async () => {
    const ports = createPorts();
    const fulfilled = vi.fn(async () => undefined);

    const results = await Promise.all([
      reconcileSucceededPayment(event, ports, { nowMs: NOW_MS, onConsumed: fulfilled }),
      reconcileSucceededPayment(event, ports, { nowMs: NOW_MS, onConsumed: fulfilled }),
    ]);
    const replay = await reconcileSucceededPayment(event, ports, { nowMs: NOW_MS, onConsumed: fulfilled });

    expect(results.map((result) => result.outcome).sort()).toEqual(["consumed", "duplicate"]);
    expect(replay.outcome).toBe("duplicate");
    expect(ports.consumption.calls).toHaveLength(1);
    expect(fulfilled).toHaveBeenCalledTimes(1);
  });

  it("refuses an adapter that does not explicitly guarantee transactional uniqueness", async () => {
    const ports = createPorts({
      consumption: {
        atomicity: "best_effort" as any,
        consumeSucceededPayment: vi.fn(async () => ({
          outcome: "consumed",
          targetId: "order-123",
          targetKind: "store_order" as const,
        })),
      },
    });

    await expectIntegrityCode(
      reconcileSucceededPayment(event, ports, { nowMs: NOW_MS }),
      "non_atomic_consumption",
    );
  });
});
