import { and, eq, isNull, or } from "drizzle-orm";
import { storeOrders, zohoPaymentBindings, zohoPaymentConsumptions } from "@shared/schema";
import {
  PaymentIntegrityError,
  normalizePaymentAmount,
  type AtomicPaymentConsumption,
  type ConsumedSucceededPayment,
  type PaymentIntegrityPorts,
  type PaymentConsumptionResult,
  type ProviderPaymentSession,
} from "./paymentIntegrity";

export interface StoreOrderPaymentRecord {
  id: string;
  orderNumber: string;
  paymentMethod: string | null;
  status: string | null;
  total: string;
  zohoPaymentSessionId: string | null;
  zohoPaymentId: string | null;
}

export interface PaymentConsumptionLedgerRecord extends ConsumedSucceededPayment {}

export interface PortalInvoicePaymentBindingRecord {
  paymentSessionId: string;
  targetKind: "portal_invoice";
  targetId: string;
  referenceNumber: string;
  invoiceNumber: string;
  amountDecimal: string;
  amountMinor: string;
  currency: string;
  status: "pending" | "consumed" | "cancelled";
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}

export interface NewPortalInvoicePaymentBinding {
  paymentSessionId: string;
  invoiceId: string;
  providerReference: string;
  amount: string | number;
  currency: string;
  now?: Date;
  expiresAt?: Date;
}

export interface StoreOrderPaymentTransaction {
  tryInsertConsumption(input: ConsumedSucceededPayment): Promise<boolean>;
  findConsumptionConflicts(eventId: string, paymentId: string): Promise<PaymentConsumptionLedgerRecord[]>;
  lockStoreOrder(orderId: string): Promise<StoreOrderPaymentRecord | null>;
  markStoreOrderPaid(input: ConsumedSucceededPayment): Promise<boolean>;
  lockPortalInvoiceBinding(paymentSessionId: string): Promise<PortalInvoicePaymentBindingRecord | null>;
  markPortalInvoiceBindingConsumed(input: ConsumedSucceededPayment): Promise<boolean>;
}

export interface StoreOrderPaymentRepository {
  findExpectedStoreOrder(candidate: {
    orderId: string | null;
    orderNumber: string | null;
  }): Promise<StoreOrderPaymentRecord | null>;
  findPortalInvoiceBinding(paymentSessionId: string): Promise<PortalInvoicePaymentBindingRecord | null>;
  reservePortalInvoiceBinding(binding: PortalInvoicePaymentBindingRecord): Promise<"reserved" | "pending" | "consumed">;
  transaction<T>(work: (transaction: StoreOrderPaymentTransaction) => Promise<T>): Promise<T>;
}

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function toStoreOrderRecord(order: any): StoreOrderPaymentRecord {
  return {
    id: String(order.id),
    orderNumber: String(order.orderNumber),
    paymentMethod: order.paymentMethod ? String(order.paymentMethod) : null,
    status: order.status ? String(order.status) : null,
    total: String(order.total),
    zohoPaymentSessionId: order.zohoPaymentSessionId ? String(order.zohoPaymentSessionId) : null,
    zohoPaymentId: order.zohoPaymentId ? String(order.zohoPaymentId) : null,
  };
}

function toLedgerRecord(row: any): PaymentConsumptionLedgerRecord {
  return {
    eventId: String(row.eventId),
    paymentId: String(row.paymentId),
    targetKind: row.targetKind,
    targetId: String(row.targetId),
    paymentSessionId: String(row.paymentSessionId),
    referenceNumber: String(row.referenceNumber),
    invoiceNumber: String(row.invoiceNumber),
    amountDecimal: String(row.amountDecimal),
    amountMinor: String(row.amountMinor),
    currency: String(row.currency),
    paidAt: new Date(row.consumedAt),
  };
}

function toPortalInvoiceBindingRecord(row: any): PortalInvoicePaymentBindingRecord {
  return {
    paymentSessionId: String(row.paymentSessionId),
    targetKind: "portal_invoice",
    targetId: String(row.targetId),
    referenceNumber: String(row.referenceNumber),
    invoiceNumber: String(row.invoiceNumber),
    amountDecimal: String(row.amountDecimal),
    amountMinor: String(row.amountMinor),
    currency: String(row.currency),
    status: row.status,
    createdAt: new Date(row.createdAt),
    expiresAt: new Date(row.expiresAt),
    consumedAt: row.consumedAt ? new Date(row.consumedAt) : null,
  };
}

function drizzleTransaction(transaction: any): StoreOrderPaymentTransaction {
  return {
    async tryInsertConsumption(input) {
      const inserted = await transaction
        .insert(zohoPaymentConsumptions)
        .values({
          eventId: input.eventId,
          paymentId: input.paymentId,
          targetKind: input.targetKind,
          targetId: input.targetId,
          paymentSessionId: input.paymentSessionId,
          referenceNumber: input.referenceNumber,
          invoiceNumber: input.invoiceNumber,
          amountDecimal: input.amountDecimal,
          amountMinor: input.amountMinor,
          currency: input.currency,
          consumedAt: input.paidAt,
        })
        .onConflictDoNothing()
        .returning({ eventId: zohoPaymentConsumptions.eventId });
      return inserted.length === 1;
    },

    async findConsumptionConflicts(eventId, paymentId) {
      const rows = await transaction
        .select()
        .from(zohoPaymentConsumptions)
        .where(or(
          eq(zohoPaymentConsumptions.eventId, eventId),
          eq(zohoPaymentConsumptions.paymentId, paymentId),
        ))
        .limit(2);
      return rows.map(toLedgerRecord);
    },

    async lockStoreOrder(orderId) {
      const [order] = await transaction
        .select()
        .from(storeOrders)
        .where(eq(storeOrders.id, orderId))
        .limit(1)
        .for("update");
      return order ? toStoreOrderRecord(order) : null;
    },

    async markStoreOrderPaid(input) {
      const [paid] = await transaction
        .update(storeOrders)
        .set({
          status: "paid",
          zohoPaymentId: input.paymentId,
          paidAt: input.paidAt,
          updatedAt: input.paidAt,
        })
        .where(and(
          eq(storeOrders.id, input.targetId),
          eq(storeOrders.status, "awaiting_payment"),
          eq(storeOrders.paymentMethod, "zoho"),
          eq(storeOrders.zohoPaymentSessionId, input.paymentSessionId),
          eq(storeOrders.total, input.amountDecimal),
          isNull(storeOrders.zohoPaymentId),
        ))
        .returning({ id: storeOrders.id });
      return Boolean(paid);
    },

    async lockPortalInvoiceBinding(paymentSessionId) {
      const [binding] = await transaction
        .select()
        .from(zohoPaymentBindings)
        .where(eq(zohoPaymentBindings.paymentSessionId, paymentSessionId))
        .limit(1)
        .for("update");
      return binding ? toPortalInvoiceBindingRecord(binding) : null;
    },

    async markPortalInvoiceBindingConsumed(input) {
      const [consumed] = await transaction
        .update(zohoPaymentBindings)
        .set({ status: "consumed", consumedAt: input.paidAt })
        .where(and(
          eq(zohoPaymentBindings.paymentSessionId, input.paymentSessionId),
          eq(zohoPaymentBindings.targetKind, "portal_invoice"),
          eq(zohoPaymentBindings.targetId, input.targetId),
          eq(zohoPaymentBindings.status, "pending"),
          eq(zohoPaymentBindings.amountMinor, input.amountMinor),
          eq(zohoPaymentBindings.currency, input.currency),
        ))
        .returning({ paymentSessionId: zohoPaymentBindings.paymentSessionId });
      return Boolean(consumed);
    },
  };
}

export function createDrizzleStoreOrderPaymentRepository(database: any): StoreOrderPaymentRepository {
  if (!database || typeof database.transaction !== "function") {
    throw new PaymentIntegrityError(
      "non_atomic_consumption",
      "A transactional database is required for payment consumption.",
    );
  }

  return {
    async findExpectedStoreOrder(candidate) {
      let order: any = null;
      if (candidate.orderId) {
        [order] = await database
          .select()
          .from(storeOrders)
          .where(eq(storeOrders.id, candidate.orderId))
          .limit(1);
      } else if (candidate.orderNumber) {
        [order] = await database
          .select()
          .from(storeOrders)
          .where(eq(storeOrders.orderNumber, candidate.orderNumber))
          .limit(1);
      }
      return order ? toStoreOrderRecord(order) : null;
    },

    async findPortalInvoiceBinding(paymentSessionId) {
      const [binding] = await database
        .select()
        .from(zohoPaymentBindings)
        .where(eq(zohoPaymentBindings.paymentSessionId, paymentSessionId))
        .limit(1);
      return binding ? toPortalInvoiceBindingRecord(binding) : null;
    },

    async reservePortalInvoiceBinding(binding) {
      return database.transaction(async (transaction: any) => {
        // Never release a pending binding based on checkout-session time alone:
        // ACH can remain pending after the 15-minute initiation window. A future
        // cleanup job may cancel it only after an authoritative provider lookup
        // proves the session has failed or expired without a pending payment.
        const inserted = await transaction
          .insert(zohoPaymentBindings)
          .values(binding)
          .onConflictDoNothing()
          .returning({ paymentSessionId: zohoPaymentBindings.paymentSessionId });
        if (inserted.length === 1) return "reserved" as const;

        const [active] = await transaction
          .select({ status: zohoPaymentBindings.status })
          .from(zohoPaymentBindings)
          .where(and(
            eq(zohoPaymentBindings.targetKind, "portal_invoice"),
            eq(zohoPaymentBindings.targetId, binding.targetId),
            or(
              eq(zohoPaymentBindings.status, "pending"),
              eq(zohoPaymentBindings.status, "consumed"),
            ),
          ))
          .limit(1);
        return active?.status === "consumed" ? "consumed" as const : "pending" as const;
      });
    },

    async transaction(work) {
      return database.transaction(async (transaction: any) => work(drizzleTransaction(transaction)));
    },
  };
}

export async function persistPortalInvoicePaymentBinding(options: {
  database?: any;
  repository?: StoreOrderPaymentRepository;
  binding: NewPortalInvoicePaymentBinding;
}): Promise<PortalInvoicePaymentBindingRecord> {
  const repository = options.repository || createDrizzleStoreOrderPaymentRepository(options.database);
  const paymentSessionId = cleanText(options.binding.paymentSessionId);
  const invoiceId = cleanText(options.binding.invoiceId);
  const providerReference = cleanText(options.binding.providerReference);
  if (!paymentSessionId || !invoiceId || !providerReference) {
    throw new PaymentIntegrityError("invalid_binding", "Invoice payment binding is incomplete.");
  }

  const money = normalizePaymentAmount(options.binding.amount, options.binding.currency);
  if (BigInt(money.amountMinor) <= 0n) {
    throw new PaymentIntegrityError("invoice_not_payable", "Invoice has no positive balance to bind.");
  }
  const now = options.binding.now || new Date();
  const expiresAt = options.binding.expiresAt || new Date(now.getTime() + 15 * 60_000);
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    throw new PaymentIntegrityError("invalid_binding", "Invoice payment binding expiry is invalid.");
  }

  const record: PortalInvoicePaymentBindingRecord = {
    paymentSessionId,
    targetKind: "portal_invoice",
    targetId: invoiceId,
    referenceNumber: providerReference,
    invoiceNumber: providerReference,
    amountDecimal: money.amountDecimal,
    amountMinor: money.amountMinor,
    currency: money.currency,
    status: "pending",
    createdAt: now,
    expiresAt,
    consumedAt: null,
  };
  const outcome = await repository.reservePortalInvoiceBinding(record);
  if (outcome === "consumed") {
    throw new PaymentIntegrityError("invoice_not_payable", "Invoice payment was already consumed.");
  }
  if (outcome !== "reserved") {
    throw new PaymentIntegrityError(
      "invoice_payment_in_progress",
      "Another payment session is already active for this invoice.",
    );
  }
  return record;
}

function sameConsumedPayment(
  ledger: PaymentConsumptionLedgerRecord,
  input: ConsumedSucceededPayment,
): boolean {
  return ledger.paymentId === input.paymentId
    && ledger.targetKind === input.targetKind
    && ledger.targetId === input.targetId
    && ledger.paymentSessionId === input.paymentSessionId
    && ledger.referenceNumber === input.referenceNumber
    && ledger.invoiceNumber === input.invoiceNumber
    && ledger.amountMinor === input.amountMinor
    && ledger.currency === input.currency;
}

function assertStoreOrderCanBePaid(
  order: StoreOrderPaymentRecord | null,
  input: ConsumedSucceededPayment,
): asserts order is StoreOrderPaymentRecord {
  if (!order || input.targetKind !== "store_order") {
    throw new PaymentIntegrityError("binding_not_found", "Bound store order was not found.");
  }
  if (order.paymentMethod !== "zoho") {
    throw new PaymentIntegrityError("invalid_binding", "Store order is not bound to Zoho Payments.");
  }
  if (order.status !== "awaiting_payment" || order.zohoPaymentId !== null) {
    throw new PaymentIntegrityError("order_not_payable", "Store order cannot transition to paid.");
  }
  if (order.zohoPaymentSessionId !== input.paymentSessionId) {
    throw new PaymentIntegrityError("session_mismatch", "Stored payment session does not match.");
  }
  if (order.orderNumber !== input.referenceNumber || order.orderNumber !== input.invoiceNumber) {
    throw new PaymentIntegrityError("reference_mismatch", "Stored order reference does not match.");
  }
  const storedMoney = normalizePaymentAmount(order.total, "USD");
  if (
    storedMoney.amountMinor !== input.amountMinor ||
    storedMoney.currency !== input.currency
  ) {
    throw new PaymentIntegrityError("amount_mismatch", "Stored order amount does not match.");
  }
}

function assertPortalInvoiceCanBeConsumed(
  binding: PortalInvoicePaymentBindingRecord | null,
  input: ConsumedSucceededPayment,
): asserts binding is PortalInvoicePaymentBindingRecord {
  if (!binding || input.targetKind !== "portal_invoice") {
    throw new PaymentIntegrityError("binding_not_found", "Bound portal invoice payment was not found.");
  }
  if (binding.status !== "pending") {
    throw new PaymentIntegrityError("invoice_not_payable", "Portal invoice payment is not pending.");
  }
  if (binding.targetId !== input.targetId || binding.paymentSessionId !== input.paymentSessionId) {
    throw new PaymentIntegrityError("session_mismatch", "Portal invoice payment session does not match.");
  }
  if (binding.referenceNumber !== input.referenceNumber || binding.invoiceNumber !== input.invoiceNumber) {
    throw new PaymentIntegrityError("reference_mismatch", "Portal invoice payment reference does not match.");
  }
  if (binding.amountMinor !== input.amountMinor || binding.currency !== input.currency) {
    throw new PaymentIntegrityError("amount_mismatch", "Portal invoice payment amount does not match.");
  }
}

export function createAtomicStoreOrderPaymentConsumption(
  repository: StoreOrderPaymentRepository,
): AtomicPaymentConsumption {
  return {
    atomicity: "transactional_unique",
    async consumeSucceededPayment(input): Promise<PaymentConsumptionResult> {
      return repository.transaction(async (transaction) => {
        const inserted = await transaction.tryInsertConsumption(input);
        if (!inserted) {
          const conflicts = await transaction.findConsumptionConflicts(input.eventId, input.paymentId);
          if (conflicts.length === 1 && sameConsumedPayment(conflicts[0], input)) {
            return { outcome: "duplicate", targetId: input.targetId, targetKind: input.targetKind };
          }
          throw new PaymentIntegrityError(
            "payment_conflict",
            "Provider event or payment identifier is already bound to another payment.",
          );
        }

        if (input.targetKind === "store_order") {
          const order = await transaction.lockStoreOrder(input.targetId);
          assertStoreOrderCanBePaid(order, input);
          if (!await transaction.markStoreOrderPaid(input)) {
            throw new PaymentIntegrityError(
              "order_not_payable",
              "Store order lost its payable state before the paid transition.",
            );
          }
        } else {
          const binding = await transaction.lockPortalInvoiceBinding(input.paymentSessionId);
          assertPortalInvoiceCanBeConsumed(binding, input);
          if (!await transaction.markPortalInvoiceBindingConsumed(input)) {
            throw new PaymentIntegrityError(
              "invoice_not_payable",
              "Portal invoice binding lost its pending state before consumption.",
            );
          }
        }
        return { outcome: "consumed", targetId: input.targetId, targetKind: input.targetKind };
      });
    },
  };
}

export function createZohoPaymentIntegrityPorts(options: {
  database?: any;
  repository?: StoreOrderPaymentRepository;
  expectedLiveMode?: boolean;
  retrievePaymentSession: (paymentSessionId: string) => Promise<ProviderPaymentSession>;
}): PaymentIntegrityPorts {
  const repository = options.repository || createDrizzleStoreOrderPaymentRepository(options.database);
  return {
    expectedLiveMode: options.expectedLiveMode ?? process.env.NODE_ENV === "production",
    async loadExpectedPayment(event) {
      const metadata = new Map((event.metadata || []).map((item) => [item.key, item.value]));
      const orderId = cleanText(metadata.get("orderId"));
      const metadataOrderNumber = cleanText(metadata.get("orderNumber"));
      const eventOrderNumber = cleanText(event.referenceNumber || event.invoiceNumber);
      const expected = await repository.findExpectedStoreOrder({
        orderId,
        orderNumber: orderId ? null : (metadataOrderNumber || eventOrderNumber),
      });
      if (expected?.paymentMethod === "zoho") {
        return {
          targetKind: "store_order",
          targetId: expected.id,
          paymentSessionId: expected.zohoPaymentSessionId || "",
          referenceNumber: expected.orderNumber,
          invoiceNumber: expected.orderNumber,
          amount: expected.total,
          // The current store checkout creates Zoho sessions in USD. Add a
          // persisted order currency before enabling multi-currency store orders.
          currency: "USD",
        };
      }

      const paymentSessionId = cleanText(event.paymentSessionId);
      if (!paymentSessionId) return null;
      const invoiceBinding = await repository.findPortalInvoiceBinding(paymentSessionId);
      if (!invoiceBinding || invoiceBinding.status === "cancelled") return null;
      return {
        targetKind: "portal_invoice",
        targetId: invoiceBinding.targetId,
        paymentSessionId: invoiceBinding.paymentSessionId,
        referenceNumber: invoiceBinding.referenceNumber,
        invoiceNumber: invoiceBinding.invoiceNumber,
        amount: invoiceBinding.amountDecimal,
        currency: invoiceBinding.currency,
      };
    },
    retrievePaymentSession: options.retrievePaymentSession,
    consumption: createAtomicStoreOrderPaymentConsumption(repository),
  };
}

/** Backward-compatible name for existing store-only call sites. */
export const createStoreOrderPaymentIntegrityPorts = createZohoPaymentIntegrityPorts;
