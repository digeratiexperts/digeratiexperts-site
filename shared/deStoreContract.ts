/**
 * Shared types and helpers for the public Digerati Experts store.
 * Payloads match the Hub contract in docs/architecture/DE-STORE-CONTRACT.md.
 */
export const DE_STORE_CONTRACT_VERSION = "1" as const;

export const DE_STORE_ENABLED_ENV = "DE_STORE_ENABLED";
export const DE_STORE_STATE_BLOCKLIST_ENABLED_ENV = "DE_STORE_STATE_BLOCKLIST_ENABLED";
export const DE_STORE_EXCLUDED_STATES_ENV = "DE_STORE_EXCLUDED_STATES";
export const DE_STORE_STATE_LIST_MODE_ENV = "DE_STORE_STATE_LIST_MODE";
export const DE_STORE_CONSUMER_CHECKOUT_ENV = "DE_STORE_CONSUMER_CHECKOUT";
export const DE_STORE_PREVIEW_CATALOG_ENV = "DE_STORE_PREVIEW_CATALOG";

export const DE_STORE_TERMS_VERSION = "2026.10-store";
export const DE_STORE_PLACE_ORDER_BUTTON = "I agree and place order";

export const DE_STORE_CLIENT_EMAILS = {
  billing: "billing@digeratiexperts.com",
  admin: "admin@digeratiexperts.com",
  sales: "sales@digeratiexperts.com",
} as const;

export type TaxCategory =
  | "saas"
  | "managed_service"
  | "labor"
  | "hardware"
  | "shipping"
  | "telecom"
  | "ewaste_fee"
  | "covered_electronic_device_fee"
  | "battery_fee";

export type DeviceClass = "laptop" | "tablet" | "monitor" | "battery" | "other";

export type CaliforniaFeeKind =
  | "ca_ewaste"
  | "ca_covered_electronic_device"
  | "ca_battery";

export type BuyerRole = "managed" | "comanaged" | "self_managed";

export type AddressUse = "ship_to" | "service" | "bill_to";

export type OrderStatus =
  | "received"
  | "awaiting_signature"
  | "paid_accepted"
  | "awaiting_buyer_delay_decision"
  | "cancelled"
  | "in_fulfillment"
  | "shipped"
  | "refunded";

export type SignatureState = "requested" | "accepted" | "declined" | "expired";

export type StoreOffering = "proactive_ecosystem" | "refurbished_kits" | "standalone_services";

export type StateListMode = "deny" | "allow";

export interface PostalAddress {
  name?: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}

export interface OrderLineInput {
  lineId: string;
  sku: string;
  description: string;
  taxCategory: TaxCategory;
  quantity: number;
  unitAmountCents: number;
  deviceClass?: DeviceClass;
  kitId?: string;
  parentLineId?: string;
  fccCoveredListCheckRequired?: boolean;
  fccCoveredListCleared?: boolean;
}

export interface TaxedLine {
  lineId: string;
  taxCategory: TaxCategory;
  feeKind?: CaliforniaFeeKind;
  taxableAmountCents: number;
  taxCents: number;
  feeCents: number;
  description?: string;
  quantity?: number;
  unitAmountCents?: number;
  jurisdictions?: Array<{
    name: string;
    region?: string;
    taxCents: number;
  }>;
}

export interface TaxQuoteRequest {
  contractVersion: typeof DE_STORE_CONTRACT_VERSION;
  idempotencyKey?: string;
  currency: "USD";
  accountId?: number;
  email: string;
  buyerRole: BuyerRole;
  shipTo: PostalAddress;
  serviceAddress: PostalAddress;
  billTo: PostalAddress;
  lines: OrderLineInput[];
  exemptionCertificateId?: string;
}

export interface TaxQuoteResponse {
  calculationId: string;
  quotedAt: string;
  expiresAt: string;
  currency: "USD";
  lines: TaxedLine[];
  fees: TaxedLine[];
  subtotalCents: number;
  taxCents: number;
  feeCents: number;
  totalCents: number;
  destination: {
    region: string;
    country: string;
    sourcedFrom: "ship_to" | "service";
  };
}

export interface StateNotServedIssue {
  path: "billTo.region" | "shipTo.region" | "serviceAddress.region";
  code: "state_not_served";
}

export interface StateNotServedResponse {
  error: string;
  code: "state_not_served";
  blockedRegions: string[];
  blockedAddressUses: Array<{
    path: StateNotServedIssue["path"];
    use: AddressUse;
    region: string;
  }>;
  issues: StateNotServedIssue[];
}

export interface AgreementAcceptance {
  documentKey: string;
  version: string;
  hash: string;
  buttonText: string;
  acceptedAt: string;
  ip: string;
  userAgent: string;
  accountId?: number;
  email: string;
}

export function termLabel(termMonths: number): string {
  if (!Number.isInteger(termMonths) || termMonths < 1) {
    throw new Error("termMonths must be a positive integer");
  }
  return termMonths === 1 ? "1 month" : `${termMonths} months`;
}

export function formatUsdFromCents(amountCents: number): string {
  const cents = Math.round(amountCents);
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  return `${sign}$${(absolute / 100).toFixed(2)}`;
}

export const US_REGION_NAMES: Readonly<Record<string, string>> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "District of Columbia",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
  AS: "American Samoa",
  GU: "Guam",
  MP: "Northern Mariana Islands",
  PR: "Puerto Rico",
  VI: "U.S. Virgin Islands",
};

export const US_REGION_CODES: ReadonlySet<string> = new Set(Object.keys(US_REGION_NAMES));

export function normalizeUsRegion(value: string | null | undefined): string | null {
  const code = (value ?? "").trim().toUpperCase();
  return US_REGION_CODES.has(code) ? code : null;
}

export function regionDisplayName(code: string): string {
  const normalized = normalizeUsRegion(code) ?? code.trim().toUpperCase();
  return US_REGION_NAMES[normalized] ?? normalized;
}

export function isRouterSku(sku: string, flags?: { isRouter?: boolean }): boolean {
  if (flags?.isRouter) return true;
  return /(^|-)(RTR|ROUTER)(-|$)/i.test(sku);
}

export type CombinedShippingLineError = {
  ok: false;
  code: "combined_shipping_line";
  error: string;
};

export function rejectCombinedShippingAndHandling(
  lines: Array<{ taxCategory: string; description?: string }>,
): CombinedShippingLineError | { ok: true } {
  for (const line of lines) {
    const description = (line.description ?? "").toLowerCase();
    const bundled =
      description.includes("shipping and handling") ||
      description.includes("shipping & handling") ||
      (line.taxCategory === "shipping" && description.includes("handling"));
    if (bundled) {
      return {
        ok: false,
        code: "combined_shipping_line",
        error: "Shipping must appear as its own line. Handling cannot be combined with shipping.",
      };
    }
  }
  return { ok: true };
}
