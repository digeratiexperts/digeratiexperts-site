// Zoho retries webhook deliveries for up to two days. The HMAC delivery
// timestamp still has a five-minute replay window in zohoPayments.ts; this
// longer event-time window lets a freshly signed retry reconcile safely.
const DEFAULT_EVENT_MAX_AGE_MS = 3 * 24 * 60 * 60_000;
const DEFAULT_EVENT_FUTURE_TOLERANCE_MS = 60_000;

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);
const THREE_DECIMAL_CURRENCIES = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);
const PAYABLE_INVOICE_STATUSES = new Set([
  "sent",
  "overdue",
  "unpaid",
  "partially_paid",
  "viewed",
]);

export type PaymentTargetKind = "store_order" | "portal_invoice";

export type PaymentIntegrityErrorCode =
  | "invalid_event"
  | "stale_event"
  | "future_event"
  | "mode_mismatch"
  | "binding_not_found"
  | "invalid_binding"
  | "invalid_amount"
  | "invalid_currency"
  | "invoice_not_payable"
  | "amount_mismatch"
  | "currency_mismatch"
  | "reference_mismatch"
  | "invoice_mismatch"
  | "session_mismatch"
  | "provider_amount_mismatch"
  | "provider_currency_mismatch"
  | "provider_reference_mismatch"
  | "provider_invoice_mismatch"
  | "provider_session_mismatch"
  | "provider_status_mismatch"
  | "provider_payment_mismatch"
  | "non_atomic_consumption"
  | "invalid_consumption_result"
  | "payment_conflict"
  | "order_not_payable"
  | "invoice_payment_in_progress";

export class PaymentIntegrityError extends Error {
  readonly code: PaymentIntegrityErrorCode;

  constructor(code: PaymentIntegrityErrorCode, message: string) {
    super(message);
    this.name = "PaymentIntegrityError";
    this.code = code;
  }
}

export interface AuthoritativeInvoice {
  invoiceId: string;
  invoiceNumber: string;
  balance: string | number;
  currency: string;
  status?: string | null;
}

export interface AuthoritativeInvoicePayment {
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  amountDecimal: string;
  amountMinor: string;
  currency: string;
}

export interface ExpectedPaymentBinding {
  targetKind: PaymentTargetKind;
  targetId: string;
  paymentSessionId: string;
  referenceNumber: string;
  invoiceNumber: string;
  amount: string | number;
  currency: string;
}

export interface SucceededPaymentEvent {
  eventId: string | null;
  eventTimeMs: number | null;
  liveMode: boolean | null;
  eventType: string;
  paymentId: string | null;
  paymentSessionId: string | null;
  referenceNumber: string | null;
  invoiceNumber: string | null;
  amount: string | null;
  currency: string | null;
  status: string | null;
  metadata?: Array<{ key: string; value: string }>;
}

export interface ProviderPaymentSession {
  paymentSessionId: string | null;
  referenceNumber: string | null;
  invoiceNumber: string | null;
  amount: string | null;
  currency: string | null;
  status: string | null;
  payments: Array<{ paymentId: string; status: string }>;
}

export interface ConsumedSucceededPayment {
  eventId: string;
  paymentId: string;
  targetKind: PaymentTargetKind;
  targetId: string;
  paymentSessionId: string;
  referenceNumber: string;
  invoiceNumber: string;
  amountDecimal: string;
  amountMinor: string;
  currency: string;
  paidAt: Date;
}

export type PaymentConsumptionResult =
  | { outcome: "consumed"; targetId: string; targetKind: PaymentTargetKind }
  | { outcome: "duplicate"; targetId: string; targetKind: PaymentTargetKind };

/**
 * This port is intentionally strict. The implementation must insert unique
 * provider event/payment identifiers and transition the bound target to paid
 * in the same durable database transaction. A process-local set, read-then-
 * write sequence, or cache does not satisfy this contract in production.
 */
export interface AtomicPaymentConsumption {
  readonly atomicity: "transactional_unique";
  consumeSucceededPayment(input: ConsumedSucceededPayment): Promise<PaymentConsumptionResult>;
}

export interface PaymentIntegrityPorts {
  expectedLiveMode: boolean;
  /** Metadata may select a candidate, but the returned binding is authoritative. */
  loadExpectedPayment(event: SucceededPaymentEvent): Promise<ExpectedPaymentBinding | null>;
  /** Must call Zoho's Payment Session Retrieve API, not echo webhook data. */
  retrievePaymentSession(paymentSessionId: string): Promise<ProviderPaymentSession>;
  consumption: AtomicPaymentConsumption;
}

export interface ReconcileSucceededPaymentOptions {
  nowMs?: number;
  maxEventAgeMs?: number;
  futureToleranceMs?: number;
  /** Schedule/trigger fulfillment only after atomic consumption succeeds. */
  onConsumed?: (target: { targetId: string; targetKind: PaymentTargetKind }) => Promise<void>;
}

interface CanonicalMoney {
  currency: string;
  decimal: string;
  minor: bigint;
}

export interface NormalizedPaymentAmount {
  amountDecimal: string;
  amountMinor: string;
  currency: string;
}

function integrityError(code: PaymentIntegrityErrorCode, message: string): never {
  throw new PaymentIntegrityError(code, message);
}

function currencyExponent(currency: string): number {
  if (ZERO_DECIMAL_CURRENCIES.has(currency)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(currency)) return 3;
  return 2;
}

function canonicalCurrency(value: unknown): string {
  const currency = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    integrityError("invalid_currency", "Payment currency must be a three-letter ISO currency code.");
  }
  return currency;
}

function canonicalMoney(value: unknown, currencyValue: unknown): CanonicalMoney {
  const currency = canonicalCurrency(currencyValue);
  const exponent = currencyExponent(currency);
  const raw = typeof value === "number" ? String(value) : String(value ?? "").trim();
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) {
    integrityError("invalid_amount", "Payment amount is not a finite decimal value.");
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const wholeDigits = match[2].replace(/^0+(?=\d)/, "") || "0";
  const suppliedFraction = match[3] || "";
  const significantExtra = suppliedFraction.slice(exponent).replace(/0/g, "");
  if (significantExtra) {
    integrityError("invalid_amount", `Payment amount has too many decimal places for ${currency}.`);
  }

  const fraction = suppliedFraction.slice(0, exponent).padEnd(exponent, "0");
  const factor = 10n ** BigInt(exponent);
  const minor = sign * (BigInt(wholeDigits) * factor + BigInt(fraction || "0"));
  const absoluteMinor = minor < 0n ? -minor : minor;
  const absoluteWhole = absoluteMinor / factor;
  const absoluteFraction = exponent > 0
    ? (absoluteMinor % factor).toString().padStart(exponent, "0")
    : "";
  const decimal = `${minor < 0n ? "-" : ""}${absoluteWhole.toString()}${exponent > 0 ? `.${absoluteFraction}` : ""}`;

  return { currency, decimal, minor };
}

export function normalizePaymentAmount(
  value: string | number,
  currency: string,
): NormalizedPaymentAmount {
  const money = canonicalMoney(value, currency);
  return {
    amountDecimal: money.decimal,
    amountMinor: money.minor.toString(),
    currency: money.currency,
  };
}

function requiredText(value: unknown, code: PaymentIntegrityErrorCode, label: string): string {
  const text = String(value ?? "").trim();
  if (!text) integrityError(code, `${label} is required.`);
  return text;
}

function assertExact(
  actual: unknown,
  expected: string,
  code: PaymentIntegrityErrorCode,
  label: string,
): void {
  if (requiredText(actual, code, label) !== expected) {
    integrityError(code, `${label} does not match the authoritative payment binding.`);
  }
}

function assertMoney(
  actualAmount: unknown,
  actualCurrency: unknown,
  expected: CanonicalMoney,
  amountCode: PaymentIntegrityErrorCode,
  currencyCode: PaymentIntegrityErrorCode,
  source: string,
): void {
  let actualCurrencyCanonical: string;
  try {
    actualCurrencyCanonical = canonicalCurrency(actualCurrency);
  } catch {
    integrityError(currencyCode, `${source} currency is missing or invalid.`);
  }
  if (actualCurrencyCanonical !== expected.currency) {
    integrityError(currencyCode, `${source} currency does not match the authoritative payment binding.`);
  }

  let actualMoney: CanonicalMoney;
  try {
    actualMoney = canonicalMoney(actualAmount, actualCurrencyCanonical);
  } catch {
    integrityError(amountCode, `${source} amount is missing or invalid.`);
  }
  if (actualMoney.minor !== expected.minor) {
    integrityError(amountCode, `${source} amount does not match the authoritative payment binding.`);
  }
}

export function resolveAuthoritativeInvoicePayment(input: {
  invoice: AuthoritativeInvoice;
}): AuthoritativeInvoicePayment {
  const invoiceId = requiredText(input.invoice.invoiceId, "invalid_binding", "Invoice ID");
  const invoiceNumber = requiredText(input.invoice.invoiceNumber, "invalid_binding", "Invoice number");
  const status = String(input.invoice.status ?? "").trim().toLowerCase();
  if (!PAYABLE_INVOICE_STATUSES.has(status)) {
    integrityError("invoice_not_payable", "Invoice status is not eligible for online payment.");
  }

  const money = canonicalMoney(input.invoice.balance, input.invoice.currency);
  if (money.minor < 0n) {
    integrityError("invalid_amount", "Invoice balance cannot be negative.");
  }
  if (money.minor === 0n) {
    integrityError("invoice_not_payable", "Invoice has no balance due.");
  }
  if (money.minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    integrityError("invalid_amount", "Invoice balance exceeds the safely supported payment range.");
  }
  const numericAmount = Number(money.decimal);
  if (canonicalMoney(numericAmount, money.currency).minor !== money.minor) {
    integrityError("invalid_amount", "Invoice balance cannot be represented exactly by the payment API.");
  }

  return {
    invoiceId,
    invoiceNumber,
    amount: numericAmount,
    amountDecimal: money.decimal,
    amountMinor: money.minor.toString(),
    currency: money.currency,
  };
}

function validateFreshEvent(
  event: SucceededPaymentEvent,
  expectedLiveMode: boolean,
  nowMs: number,
  maxAgeMs: number,
  futureToleranceMs: number,
): { eventId: string; paymentId: string; eventTimeMs: number } {
  if (event.eventType !== "payment.succeeded" || event.status !== "succeeded") {
    integrityError("invalid_event", "Only a succeeded payment event can be reconciled.");
  }
  if (event.liveMode !== expectedLiveMode) {
    integrityError("mode_mismatch", "Provider event live/test mode does not match this environment.");
  }
  const eventId = requiredText(event.eventId, "invalid_event", "Provider event ID");
  const paymentId = requiredText(event.paymentId, "invalid_event", "Provider payment ID");
  const eventTimeMs = Number(event.eventTimeMs);
  if (!Number.isFinite(eventTimeMs) || eventTimeMs <= 0) {
    integrityError("invalid_event", "Provider event timestamp is required.");
  }
  if (eventTimeMs < nowMs - maxAgeMs) {
    integrityError("stale_event", "Provider event is outside the accepted freshness window.");
  }
  if (eventTimeMs > nowMs + futureToleranceMs) {
    integrityError("future_event", "Provider event timestamp is too far in the future.");
  }
  return { eventId, paymentId, eventTimeMs };
}

export async function reconcileSucceededPayment(
  event: SucceededPaymentEvent,
  ports: PaymentIntegrityPorts,
  options: ReconcileSucceededPaymentOptions = {},
): Promise<PaymentConsumptionResult> {
  if (ports.consumption?.atomicity !== "transactional_unique") {
    integrityError(
      "non_atomic_consumption",
      "Payment consumption must guarantee transactional uniqueness before paid transition.",
    );
  }

  const nowMs = options.nowMs ?? Date.now();
  const maxEventAgeMs = options.maxEventAgeMs ?? DEFAULT_EVENT_MAX_AGE_MS;
  const futureToleranceMs = options.futureToleranceMs ?? DEFAULT_EVENT_FUTURE_TOLERANCE_MS;
  const { eventId, paymentId } = validateFreshEvent(
    event,
    ports.expectedLiveMode,
    nowMs,
    maxEventAgeMs,
    futureToleranceMs,
  );

  const binding = await ports.loadExpectedPayment(event);
  if (!binding) integrityError("binding_not_found", "No authoritative payment binding was found.");

  const targetId = requiredText(binding.targetId, "invalid_binding", "Payment target ID");
  if (binding.targetKind !== "store_order" && binding.targetKind !== "portal_invoice") {
    integrityError("invalid_binding", "Payment target kind is not supported.");
  }
  const expectedSessionId = requiredText(binding.paymentSessionId, "invalid_binding", "Payment session ID");
  const expectedReference = requiredText(binding.referenceNumber, "invalid_binding", "Payment reference number");
  const expectedInvoice = requiredText(binding.invoiceNumber, "invalid_binding", "Payment invoice number");
  const expectedMoney = canonicalMoney(binding.amount, binding.currency);
  if (expectedMoney.minor <= 0n) {
    integrityError("invalid_binding", "Authoritative payment amount must be positive.");
  }

  assertExact(event.paymentSessionId, expectedSessionId, "session_mismatch", "Webhook payment session ID");
  assertExact(event.referenceNumber, expectedReference, "reference_mismatch", "Webhook reference number");
  assertExact(event.invoiceNumber, expectedInvoice, "invoice_mismatch", "Webhook invoice number");
  assertMoney(event.amount, event.currency, expectedMoney, "amount_mismatch", "currency_mismatch", "Webhook");

  const provider = await ports.retrievePaymentSession(expectedSessionId);
  assertExact(provider.paymentSessionId, expectedSessionId, "provider_session_mismatch", "Provider payment session ID");
  assertExact(provider.referenceNumber, expectedReference, "provider_reference_mismatch", "Provider reference number");
  assertExact(provider.invoiceNumber, expectedInvoice, "provider_invoice_mismatch", "Provider invoice number");
  assertMoney(
    provider.amount,
    provider.currency,
    expectedMoney,
    "provider_amount_mismatch",
    "provider_currency_mismatch",
    "Provider session",
  );
  if (provider.status !== "succeeded") {
    integrityError("provider_status_mismatch", "Provider session is not succeeded.");
  }
  const providerPayment = provider.payments.find((payment) => payment.paymentId === paymentId);
  if (!providerPayment || providerPayment.status !== "succeeded") {
    integrityError("provider_payment_mismatch", "Provider session does not contain the succeeded webhook payment.");
  }

  const result = await ports.consumption.consumeSucceededPayment({
    eventId,
    paymentId,
    targetKind: binding.targetKind,
    targetId,
    paymentSessionId: expectedSessionId,
    referenceNumber: expectedReference,
    invoiceNumber: expectedInvoice,
    amountDecimal: expectedMoney.decimal,
    amountMinor: expectedMoney.minor.toString(),
    currency: expectedMoney.currency,
    paidAt: new Date(nowMs),
  });

  if (
    (result.outcome !== "consumed" && result.outcome !== "duplicate") ||
    result.targetId !== targetId ||
    result.targetKind !== binding.targetKind
  ) {
    integrityError("invalid_consumption_result", "Payment consumption returned an invalid target or outcome.");
  }

  if (result.outcome === "consumed" && options.onConsumed) {
    await options.onConsumed({ targetId, targetKind: binding.targetKind });
  }
  return result;
}
