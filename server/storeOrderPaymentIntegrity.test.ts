import { describe, expect, it, vi } from "vitest";
import {
  createAtomicStoreOrderPaymentConsumption,
  createStoreOrderPaymentIntegrityPorts,
  persistPortalInvoicePaymentBinding,
  type PaymentConsumptionLedgerRecord,
  type PortalInvoicePaymentBindingRecord,
  type StoreOrderPaymentRecord,
  type StoreOrderPaymentRepository,
  type StoreOrderPaymentTransaction,
} from "./storeOrderPaymentIntegrity";
import { PaymentIntegrityError, type ConsumedSucceededPayment } from "./paymentIntegrity";

const consumedPayment: ConsumedSucceededPayment = {
  eventId: "evt-123",
  paymentId: "pay-123",
  targetKind: "store_order",
  targetId: "order-123",
  paymentSessionId: "ps-123",
  referenceNumber: "ORD-123",
  invoiceNumber: "ORD-123",
  amountDecimal: "117.00",
  amountMinor: "11700",
  currency: "USD",
  paidAt: new Date("2026-08-23T12:00:00.000Z"),
};

class FakeRepository implements StoreOrderPaymentRepository {
  readonly orders = new Map<string, StoreOrderPaymentRecord>();
  readonly invoiceBindings = new Map<string, PortalInvoicePaymentBindingRecord>();
  readonly ledger: PaymentConsumptionLedgerRecord[] = [];
  markPaidCalls = 0;
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(...orders: StoreOrderPaymentRecord[]) {
    for (const order of orders) this.orders.set(order.id, { ...order });
  }

  async findExpectedStoreOrder(candidate: { orderId: string | null; orderNumber: string | null }) {
    if (candidate.orderId) return this.orders.get(candidate.orderId) || null;
    return Array.from(this.orders.values()).find((order) => order.orderNumber === candidate.orderNumber) || null;
  }

  async findPortalInvoiceBinding(paymentSessionId: string) {
    return this.invoiceBindings.get(paymentSessionId) || null;
  }

  async reservePortalInvoiceBinding(binding: PortalInvoicePaymentBindingRecord) {
    const active = Array.from(this.invoiceBindings.values()).find(
      (existing) => existing.targetId === binding.targetId && ["pending", "consumed"].includes(existing.status),
    );
    if (active) return active.status === "consumed" ? "consumed" as const : "pending" as const;
    if (this.invoiceBindings.has(binding.paymentSessionId)) return "pending" as const;
    this.invoiceBindings.set(binding.paymentSessionId, { ...binding });
    return "reserved" as const;
  }

  async transaction<T>(work: (transaction: StoreOrderPaymentTransaction) => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.transactionTail;
    this.transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await previous;

    const orderSnapshot = new Map(Array.from(this.orders, ([id, order]) => [id, { ...order }]));
    const ledgerSnapshot = this.ledger.map((row) => ({ ...row }));
    const bindingSnapshot = new Map(
      Array.from(this.invoiceBindings, ([id, binding]) => [id, { ...binding }]),
    );
    const markPaidSnapshot = this.markPaidCalls;

    const transaction: StoreOrderPaymentTransaction = {
      tryInsertConsumption: async (input) => {
        if (this.ledger.some((row) => row.eventId === input.eventId || row.paymentId === input.paymentId)) {
          return false;
        }
        this.ledger.push({ ...input });
        return true;
      },
      findConsumptionConflicts: async (eventId, paymentId) => this.ledger.filter(
        (row) => row.eventId === eventId || row.paymentId === paymentId,
      ),
      lockStoreOrder: async (orderId) => this.orders.get(orderId) || null,
      markStoreOrderPaid: async (input) => {
        const order = this.orders.get(input.targetId);
        if (
          !order ||
          order.status !== "awaiting_payment" ||
          order.paymentMethod !== "zoho" ||
          order.zohoPaymentSessionId !== input.paymentSessionId ||
          order.zohoPaymentId !== null
        ) return false;
        order.status = "paid";
        order.zohoPaymentId = input.paymentId;
        this.markPaidCalls += 1;
        return true;
      },
      lockPortalInvoiceBinding: async (paymentSessionId) => this.invoiceBindings.get(paymentSessionId) || null,
      markPortalInvoiceBindingConsumed: async (input) => {
        const binding = this.invoiceBindings.get(input.paymentSessionId);
        if (
          !binding ||
          binding.status !== "pending" ||
          binding.targetId !== input.targetId ||
          binding.amountMinor !== input.amountMinor ||
          binding.currency !== input.currency
        ) return false;
        binding.status = "consumed";
        binding.consumedAt = input.paidAt;
        return true;
      },
    };

    try {
      return await work(transaction);
    } catch (error) {
      this.orders.clear();
      for (const [id, order] of orderSnapshot) this.orders.set(id, order);
      this.ledger.splice(0, this.ledger.length, ...ledgerSnapshot);
      this.invoiceBindings.clear();
      for (const [id, binding] of bindingSnapshot) this.invoiceBindings.set(id, binding);
      this.markPaidCalls = markPaidSnapshot;
      throw error;
    } finally {
      release();
    }
  }
}

function order(overrides: Partial<StoreOrderPaymentRecord> = {}): StoreOrderPaymentRecord {
  return {
    id: "order-123",
    orderNumber: "ORD-123",
    paymentMethod: "zoho",
    status: "awaiting_payment",
    total: "117.00",
    zohoPaymentSessionId: "ps-123",
    zohoPaymentId: null,
    ...overrides,
  };
}

describe("store order payment integrity persistence", () => {
  it("loads a server order binding without trusting webhook financial fields", async () => {
    const repository = new FakeRepository(order());
    const retrievePaymentSession = vi.fn();
    const ports = createStoreOrderPaymentIntegrityPorts({ repository, retrievePaymentSession });

    await expect(ports.loadExpectedPayment({
      eventId: "evt-123",
      eventTimeMs: Date.now(),
      liveMode: false,
      eventType: "payment.succeeded",
      paymentId: "pay-123",
      paymentSessionId: "attacker-session",
      referenceNumber: "attacker-reference",
      invoiceNumber: "attacker-invoice",
      amount: "0.01",
      currency: "EUR",
      status: "succeeded",
      metadata: [{ key: "orderId", value: "order-123" }],
    })).resolves.toEqual({
      targetKind: "store_order",
      targetId: "order-123",
      paymentSessionId: "ps-123",
      referenceNumber: "ORD-123",
      invoiceNumber: "ORD-123",
      amount: "117.00",
      currency: "USD",
    });
  });

  it("serializes concurrent replay into one ledger row and one paid transition", async () => {
    const repository = new FakeRepository(order());
    const consumption = createAtomicStoreOrderPaymentConsumption(repository);

    const results = await Promise.all([
      consumption.consumeSucceededPayment(consumedPayment),
      consumption.consumeSucceededPayment(consumedPayment),
    ]);

    expect(results.map((result) => result.outcome).sort()).toEqual(["consumed", "duplicate"]);
    expect(repository.ledger).toHaveLength(1);
    expect(repository.markPaidCalls).toBe(1);
    expect(repository.orders.get("order-123")).toMatchObject({
      status: "paid",
      zohoPaymentId: "pay-123",
    });
  });

  it("rejects a crossed event/payment replay instead of treating it as benign", async () => {
    const repository = new FakeRepository(order(), order({
      id: "order-456",
      orderNumber: "ORD-456",
      zohoPaymentSessionId: "ps-456",
    }));
    const consumption = createAtomicStoreOrderPaymentConsumption(repository);
    await consumption.consumeSucceededPayment(consumedPayment);

    await expect(consumption.consumeSucceededPayment({
      ...consumedPayment,
      eventId: "evt-456",
      targetId: "order-456",
      paymentSessionId: "ps-456",
      referenceNumber: "ORD-456",
      invoiceNumber: "ORD-456",
    })).rejects.toMatchObject<Partial<PaymentIntegrityError>>({ code: "payment_conflict" });
    expect(repository.orders.get("order-456")?.status).toBe("awaiting_payment");
    expect(repository.markPaidCalls).toBe(1);
  });

  it("rolls the ledger insert back when the bound order cannot transition", async () => {
    const repository = new FakeRepository(order({ status: "cancelled" }));
    const consumption = createAtomicStoreOrderPaymentConsumption(repository);

    await expect(consumption.consumeSucceededPayment(consumedPayment))
      .rejects.toMatchObject<Partial<PaymentIntegrityError>>({ code: "order_not_payable" });
    expect(repository.ledger).toHaveLength(0);
    expect(repository.markPaidCalls).toBe(0);
  });

  it("reserves one authoritative portal invoice session and consumes it once", async () => {
    const repository = new FakeRepository();
    const now = new Date("2026-08-23T12:00:00.000Z");
    await expect(persistPortalInvoicePaymentBinding({
      repository,
      binding: {
        paymentSessionId: "ps-invoice",
        invoiceId: "invoice-123",
        providerReference: "INV-INV-123",
        amount: "90.50",
        currency: "USD",
        now,
      },
    })).resolves.toMatchObject({
      targetKind: "portal_invoice",
      targetId: "invoice-123",
      paymentSessionId: "ps-invoice",
      amountMinor: "9050",
      status: "pending",
    });

    await expect(persistPortalInvoicePaymentBinding({
      repository,
      binding: {
        paymentSessionId: "ps-invoice-other",
        invoiceId: "invoice-123",
        providerReference: "INV-INV-123",
        amount: "90.50",
        currency: "USD",
        now,
      },
    })).rejects.toMatchObject<Partial<PaymentIntegrityError>>({ code: "invoice_payment_in_progress" });

    const portalPorts = createStoreOrderPaymentIntegrityPorts({
      repository,
      retrievePaymentSession: vi.fn(),
    });
    await expect(portalPorts.loadExpectedPayment({
      eventId: "evt-invoice",
      eventTimeMs: now.getTime(),
      liveMode: false,
      eventType: "payment.succeeded",
      paymentId: "pay-invoice",
      paymentSessionId: "ps-invoice",
      referenceNumber: "INV-INV-123",
      invoiceNumber: "INV-INV-123",
      amount: "90.50",
      currency: "USD",
      status: "succeeded",
      metadata: [{ key: "invoiceId", value: "invoice-123" }],
    })).resolves.toEqual({
      targetKind: "portal_invoice",
      targetId: "invoice-123",
      paymentSessionId: "ps-invoice",
      referenceNumber: "INV-INV-123",
      invoiceNumber: "INV-INV-123",
      amount: "90.50",
      currency: "USD",
    });

    const consumption = createAtomicStoreOrderPaymentConsumption(repository);
    const invoicePayment: ConsumedSucceededPayment = {
      ...consumedPayment,
      eventId: "evt-invoice",
      paymentId: "pay-invoice",
      targetKind: "portal_invoice",
      targetId: "invoice-123",
      paymentSessionId: "ps-invoice",
      referenceNumber: "INV-INV-123",
      invoiceNumber: "INV-INV-123",
      amountDecimal: "90.50",
      amountMinor: "9050",
    };
    const outcomes = await Promise.all([
      consumption.consumeSucceededPayment(invoicePayment),
      consumption.consumeSucceededPayment(invoicePayment),
    ]);
    expect(outcomes.map((result) => result.outcome).sort()).toEqual(["consumed", "duplicate"]);
    expect(repository.invoiceBindings.get("ps-invoice")).toMatchObject({ status: "consumed" });
    expect(repository.ledger.filter((row) => row.paymentId === "pay-invoice")).toHaveLength(1);

    await expect(persistPortalInvoicePaymentBinding({
      repository,
      binding: {
        paymentSessionId: "ps-after-paid",
        invoiceId: "invoice-123",
        providerReference: "INV-INV-123",
        amount: "90.50",
        currency: "USD",
        now,
      },
    })).rejects.toMatchObject<Partial<PaymentIntegrityError>>({ code: "invoice_not_payable" });
  });
});
