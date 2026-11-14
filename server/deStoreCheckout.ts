import { randomUUID } from "node:crypto";
import {
  DE_STORE_CONTRACT_VERSION,
  rejectCombinedShippingAndHandling,
  type BuyerRole,
  type OrderLineInput,
  type PostalAddress,
  type TaxQuoteRequest,
  type TaxQuoteResponse,
} from "@shared/deStoreContract";
import { evaluateSiteStateList, type StateListConfig } from "@shared/deStoreStateList";
import {
  recordClickwrapAcceptances,
  type ClickwrapClientInput,
  type ClickwrapFailure,
} from "./deStoreClickwrap";
import type { HubStoreClient, HubStoreResult } from "./integrations/hubStoreClient";

export interface StoreCheckoutAddresses {
  billTo: PostalAddress;
  shipTo: PostalAddress;
  serviceAddress?: PostalAddress | null;
}

export interface PaymentCaptureInput {
  calculationId: string;
  totalCents: number;
  currency: "USD";
  email: string;
  paymentConfirmation?: string;
}

export type PaymentCaptureResult =
  | { ok: true; paymentRef: string; capturedAt: string }
  | { ok: false; code: string; error: string };

export interface StoreCheckoutCommand {
  email: string;
  buyerRole: BuyerRole;
  accountId?: number;
  currency?: "USD";
  addresses: StoreCheckoutAddresses;
  lines: OrderLineInput[];
  clickwrap: ClickwrapClientInput;
  paymentConfirmation?: string;
  idempotencyKey?: string;
}

export interface StoreCheckoutDeps {
  now: () => Date;
  ip: string;
  userAgent: string;
  stateList: StateListConfig;
  consumerCheckout: boolean;
  hub: HubStoreClient;
  capturePayment: (input: PaymentCaptureInput) => Promise<PaymentCaptureResult>;
  newSiteOrderId?: () => string;
}

export type StoreCheckoutFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
  paymentAttempted: boolean;
  missing?: string[];
  blockedRegions?: string[];
};

export type StoreCheckoutSuccess = {
  ok: true;
  status: number;
  paymentAttempted: true;
  siteOrderId: string;
  calculationId: string;
  paymentRef: string;
  totalCents: number;
  acceptancesRecorded: number;
};

export type StoreQuoteResult =
  | { ok: true; status: 200; quote: TaxQuoteResponse; paymentAttempted: false }
  | StoreCheckoutFailure;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isCompleteAddress(address: PostalAddress | null | undefined): address is PostalAddress {
  if (!address) return false;
  return Boolean(
    address.street1?.trim() &&
      address.city?.trim() &&
      address.region?.trim() &&
      address.postalCode?.trim() &&
      address.country?.trim(),
  );
}

function hasHardware(lines: OrderLineInput[]): boolean {
  return lines.some((line) => line.taxCategory === "hardware" || Boolean(line.kitId) || Boolean(line.parentLineId));
}

function routerBlocked(lines: OrderLineInput[]): StoreCheckoutFailure | null {
  for (const line of lines) {
    if (line.fccCoveredListCheckRequired && !line.fccCoveredListCleared) {
      return {
        ok: false,
        status: 409,
        code: "fcc_covered_list_pending",
        error: "This router has not cleared the FCC Covered List check and cannot be sold.",
        paymentAttempted: false,
      };
    }
  }
  return null;
}

function validateLines(lines: OrderLineInput[]): StoreCheckoutFailure | null {
  if (!Array.isArray(lines) || !lines.length) {
    return {
      ok: false,
      status: 400,
      code: "invalid_line",
      error: "The order must include at least one line.",
      paymentAttempted: false,
    };
  }
  const bundled = rejectCombinedShippingAndHandling(lines);
  if (!bundled.ok) {
    return {
      ok: false,
      status: 400,
      code: bundled.code,
      error: bundled.error,
      paymentAttempted: false,
    };
  }
  const ids = new Set<string>();
  for (const line of lines) {
    if (!line.lineId?.trim() || ids.has(line.lineId)) {
      return {
        ok: false,
        status: 400,
        code: "invalid_line",
        error: "Each line needs a unique line id.",
        paymentAttempted: false,
      };
    }
    ids.add(line.lineId);
    if (!line.sku?.trim() || !Number.isInteger(line.quantity) || line.quantity < 1) {
      return {
        ok: false,
        status: 400,
        code: "invalid_line",
        error: "Each line needs a SKU and a positive quantity.",
        paymentAttempted: false,
      };
    }
    if (!Number.isInteger(line.unitAmountCents) || line.unitAmountCents < 0) {
      return {
        ok: false,
        status: 400,
        code: "invalid_line",
        error: "Line amounts must be integer cents.",
        paymentAttempted: false,
      };
    }
    if (line.taxCategory === "hardware" && Boolean(line.kitId) && !line.parentLineId && !line.deviceClass) {
      return {
        ok: false,
        status: 400,
        code: "kit_not_unbundled",
        error: "Kit hardware must be sent as unbundled component lines with a device class.",
        paymentAttempted: false,
      };
    }
    if (line.taxCategory === "battery_fee") {
      return {
        ok: false,
        status: 400,
        code: "invalid_line",
        error: "Statutory fees are returned by the Hub and are not sent by the site.",
        paymentAttempted: false,
      };
    }
  }
  return routerBlocked(lines);
}

function validateAddresses(addresses: StoreCheckoutAddresses): StoreCheckoutFailure | null {
  if (!isCompleteAddress(addresses.billTo) || !isCompleteAddress(addresses.shipTo)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_address",
      error: "Billing and shipping addresses are required.",
      paymentAttempted: false,
    };
  }
  if (addresses.serviceAddress && !isCompleteAddress(addresses.serviceAddress)) {
    return {
      ok: false,
      status: 400,
      code: "invalid_address",
      error: "The service address is incomplete.",
      paymentAttempted: false,
    };
  }
  return null;
}

function failureFromHubQuote(result: HubStoreResult<TaxQuoteResponse>): StoreCheckoutFailure {
  if (result.ok) {
    return {
      ok: false,
      status: 503,
      code: "tax_unavailable",
      error: "Tax could not be quoted for this order. No payment has been taken.",
      paymentAttempted: false,
    };
  }
  if (result.reason === "state_not_served") {
    return {
      ok: false,
      status: 409,
      code: "state_not_served",
      error: result.error || result.stateNotServed?.error || "",
      paymentAttempted: false,
      blockedRegions: result.stateNotServed?.blockedRegions,
    };
  }
  if (result.reason === "tax_unavailable" || result.reason === "not_configured" || result.reason === "unreachable") {
    return {
      ok: false,
      status: result.status && result.status >= 400 ? result.status : 503,
      code: result.code || "tax_unavailable",
      error: "Tax could not be quoted for this order. No payment has been taken.",
      paymentAttempted: false,
    };
  }
  return {
    ok: false,
    status: result.status && result.status >= 400 ? result.status : 400,
    code: result.code || "invalid_line",
    error: result.error || "The tax quote was refused. No payment has been taken.",
    paymentAttempted: false,
  };
}

function clickwrapFailure(result: ClickwrapFailure): StoreCheckoutFailure {
  return {
    ok: false,
    status: 400,
    code: result.code,
    error: result.error,
    paymentAttempted: false,
    missing: result.missing,
  };
}

export function resolveServiceAddress(addresses: StoreCheckoutAddresses): PostalAddress {
  return addresses.serviceAddress && isCompleteAddress(addresses.serviceAddress)
    ? addresses.serviceAddress
    : addresses.billTo;
}

export async function quoteStoreOrder(
  command: Pick<StoreCheckoutCommand, "email" | "buyerRole" | "accountId" | "currency" | "addresses" | "lines" | "idempotencyKey">,
  deps: Omit<StoreCheckoutDeps, "capturePayment" | "consumerCheckout">,
): Promise<StoreQuoteResult> {
  if (!EMAIL_RE.test(command.email.trim())) {
    return {
      ok: false,
      status: 400,
      code: "invalid_email",
      error: "A valid email is required.",
      paymentAttempted: false,
    };
  }
  const addressError = validateAddresses(command.addresses);
  if (addressError) return addressError;
  const lineError = validateLines(command.lines);
  if (lineError) return lineError;

  const siteBlock = evaluateSiteStateList(
    {
      billTo: command.addresses.billTo,
      shipTo: command.addresses.shipTo,
      serviceAddress: resolveServiceAddress(command.addresses),
    },
    deps.stateList,
  );
  if (siteBlock.blocked) {
    return {
      ok: false,
      status: 409,
      code: "state_not_served",
      error: siteBlock.message || "",
      paymentAttempted: false,
      blockedRegions: siteBlock.regions,
    };
  }

  const request: TaxQuoteRequest = {
    contractVersion: DE_STORE_CONTRACT_VERSION,
    currency: "USD",
    email: command.email.trim(),
    buyerRole: command.buyerRole,
    accountId: command.accountId,
    billTo: command.addresses.billTo,
    shipTo: command.addresses.shipTo,
    serviceAddress: resolveServiceAddress(command.addresses),
    lines: command.lines,
    idempotencyKey: command.idempotencyKey,
  };
  const quoted = await deps.hub.quoteTax(request, command.idempotencyKey);
  if (!quoted.ok) return failureFromHubQuote(quoted);

  const quote = quoted.data;
  if (!quote.calculationId?.startsWith("calc_") || !Number.isInteger(quote.totalCents)) {
    return {
      ok: false,
      status: 503,
      code: "tax_unavailable",
      error: "Tax could not be quoted for this order. No payment has been taken.",
      paymentAttempted: false,
    };
  }
  const expiresAt = Date.parse(quote.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= deps.now().getTime()) {
    return {
      ok: false,
      status: 409,
      code: "tax_quote_expired",
      error: "The tax quote has expired. No payment has been taken.",
      paymentAttempted: false,
    };
  }
  return { ok: true, status: 200, quote, paymentAttempted: false };
}

export async function placeStoreOrder(
  command: StoreCheckoutCommand,
  deps: StoreCheckoutDeps,
): Promise<StoreCheckoutSuccess | StoreCheckoutFailure> {
  const clickwrap = recordClickwrapAcceptances(command.clickwrap, {
    email: command.email.trim(),
    buyerRole: command.buyerRole,
    hasHardware: hasHardware(command.lines),
    consumerCheckout: deps.consumerCheckout,
    accountId: command.accountId,
  }, {
    ip: deps.ip,
    userAgent: deps.userAgent,
    now: deps.now().toISOString(),
  });
  if (!clickwrap.ok) return clickwrapFailure(clickwrap);

  const quoted = await quoteStoreOrder(command, deps);
  if (!quoted.ok) return quoted;

  const capture = await deps.capturePayment({
    calculationId: quoted.quote.calculationId,
    totalCents: quoted.quote.totalCents,
    currency: "USD",
    email: command.email.trim(),
    paymentConfirmation: command.paymentConfirmation,
  });
  if (!capture.ok) {
    await deps.hub.voidTax({
      contractVersion: DE_STORE_CONTRACT_VERSION,
      calculationId: quoted.quote.calculationId,
      reason: "payment_failed",
    });
    return {
      ok: false,
      status: 402,
      code: capture.code || "payment_failed",
      error: capture.error || "Payment was not captured.",
      paymentAttempted: false,
    };
  }

  const siteOrderId = deps.newSiteOrderId?.() ?? `siteord_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const committed = await deps.hub.commitTax({
    contractVersion: DE_STORE_CONTRACT_VERSION,
    calculationId: quoted.quote.calculationId,
    paymentRef: capture.paymentRef,
    siteOrderId,
  });
  if (!committed.ok) {
    await deps.hub.voidTax({
      contractVersion: DE_STORE_CONTRACT_VERSION,
      calculationId: quoted.quote.calculationId,
      reason: "payment_reversed",
    });
    return {
      ok: false,
      status: 409,
      code: committed.code || "calculation_mismatch",
      error: "The tax quote could not be committed. The payment will be reviewed and is not treated as complete.",
      paymentAttempted: true,
    };
  }

  await deps.hub.submitEvent({
    contractVersion: DE_STORE_CONTRACT_VERSION,
    eventId: `evt_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
    eventType: "store.order_created",
    occurredAt: deps.now().toISOString(),
    producer: "store",
    siteOrderId,
    payload: {
      siteOrderId,
      accountId: command.accountId,
      email: command.email.trim(),
      buyerRole: command.buyerRole,
      currency: "USD",
      calculationId: quoted.quote.calculationId,
      paymentRef: capture.paymentRef,
      paidAt: capture.capturedAt,
      shipTo: command.addresses.shipTo,
      serviceAddress: resolveServiceAddress(command.addresses),
      billTo: command.addresses.billTo,
      lines: command.lines,
      acceptances: clickwrap.acceptances,
      advertisedProcessing: "1_week_then_overnight",
    },
  });

  return {
    ok: true,
    status: 200,
    paymentAttempted: true,
    siteOrderId,
    calculationId: quoted.quote.calculationId,
    paymentRef: capture.paymentRef,
    totalCents: quoted.quote.totalCents,
    acceptancesRecorded: clickwrap.acceptances.length,
  };
}
