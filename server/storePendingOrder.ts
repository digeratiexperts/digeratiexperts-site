import {
  canonicalCheckoutTotal,
  canonicalizeCheckoutLineItems,
  type CanonicalCheckoutLineItem,
} from "./secureStoreCheckout";

type StoreRole = "public" | "prospect" | "managed" | "comanaged" | "admin";

function stringValue(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export interface PendingStoreOrderValues {
  orderNumber: string;
  userId: string | null;
  clientId: string | null;
  status: "pending";
  paymentMethod: string;
  lineItems: CanonicalCheckoutLineItem[];
  subtotal: string;
  tax: null;
  total: string;
  billingEmail: string;
  billingName: string;
  billingCompany: string | null;
  notes: string | null;
}

export function buildPendingStoreOrderValues(input: {
  body: unknown;
  role: StoreRole;
  priceOverrides?: Record<string, number>;
  userId?: string | null;
  clientId?: string | null;
  orderNumber: string;
}): PendingStoreOrderValues {
  const body = input.body && typeof input.body === "object"
    ? (input.body as Record<string, unknown>)
    : {};
  const billing = body.billing && typeof body.billing === "object"
    ? (body.billing as Record<string, unknown>)
    : {};

  const billingName = stringValue(billing.name, 150);
  const billingEmail = stringValue(billing.email, 254).toLowerCase();
  const billingCompany = stringValue(billing.company, 200);
  if (!billingName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) {
    throw new Error("Valid billing name and email are required");
  }

  const lineItems = canonicalizeCheckoutLineItems(
    body.lineItems,
    input.role,
    input.priceOverrides || {},
  );
  const trustedTotal = canonicalCheckoutTotal(lineItems);

  return {
    orderNumber: input.orderNumber,
    userId: input.userId || null,
    clientId: input.clientId || null,
    status: "pending",
    paymentMethod: stringValue(body.paymentMethod, 50) || "quote_request",
    lineItems,
    subtotal: trustedTotal.toFixed(2),
    tax: null,
    total: trustedTotal.toFixed(2),
    billingEmail,
    billingName,
    billingCompany: billingCompany || null,
    notes: stringValue(body.notes, 4000) || null,
  };
}
