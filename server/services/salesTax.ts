import { parseTaxCodeOverrides, storeTaxCode, type StoreCategory } from "@shared/storeTaxCodes";

/**
 * Sales tax is fail-closed.
 *
 * Staff Pay Now asks Stripe Tax (Calculations API only) when STRIPE_TAX_SECRET_KEY
 * is set; Zoho Payments still takes the card. Without that key, a rate is used
 * only when AZ_TPT_RATE_TABLE_JSON holds a verified table (https source,
 * retrieval date, numeric rate). Nothing in git invents a rate, and any failure
 * answers TAX_RATE_UNAVAILABLE so checkout steps aside to a quote.
 */
export const TAX_RATE_UNAVAILABLE = "TAX_RATE_UNAVAILABLE" as const;

export type SalesTaxQuote =
  | {
      ok: true;
      tax: string;
      total: string;
      rate: string;
      source: string;
      /** Stripe Tax calculation id, when Stripe answered. */
      calculationId?: string;
      /** One line for the order record: who calculated the tax and why. */
      note?: string;
    }
  | {
      ok: false;
      code: typeof TAX_RATE_UNAVAILABLE;
      error: string;
      /** Lines that have no confirmed tax code, when that is the reason. */
      skus?: string[];
    };

type VerifiedTable = {
  source: string;
  retrievedOn: string;
  rate: number;
};

function loadVerifiedAzTptTable(): VerifiedTable | null {
  const raw = process.env.AZ_TPT_RATE_TABLE_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<VerifiedTable>;
    if (typeof parsed.source !== "string" || !parsed.source.startsWith("https://")) return null;
    if (typeof parsed.retrievedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.retrievedOn)) return null;
    if (typeof parsed.rate !== "number" || !Number.isFinite(parsed.rate) || parsed.rate < 0 || parsed.rate > 0.2) {
      return null;
    }
    return { source: parsed.source, retrievedOn: parsed.retrievedOn, rate: parsed.rate };
  } catch {
    return null;
  }
}

const UNAVAILABLE: SalesTaxQuote = {
  ok: false,
  code: TAX_RATE_UNAVAILABLE,
  error:
    "Sales tax cannot be calculated until a verified Arizona TPT rate table is loaded. Checkout will not record tax as zero.",
};

function unavailable(error: string, skus?: string[]): SalesTaxQuote {
  return { ok: false, code: TAX_RATE_UNAVAILABLE, error, ...(skus ? { skus } : {}) };
}

export function quoteSalesTax(subtotal: number): SalesTaxQuote {
  const table = loadVerifiedAzTptTable();
  if (!table || !Number.isFinite(subtotal) || subtotal < 0) return UNAVAILABLE;
  const tax = Math.round(subtotal * table.rate * 100) / 100;
  const total = Math.round((subtotal + tax) * 100) / 100;
  return {
    ok: true,
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    rate: table.rate.toFixed(5),
    source: table.source,
  };
}

export interface TaxableLine {
  sku: string;
  category: StoreCategory;
  quantity: number;
  /** Line total in dollars, after any client pricing. */
  total: number;
}

export interface TaxAddress {
  line1: string;
  city: string;
  /** Two-letter US state code. */
  state: string;
  postalCode: string;
}

type StripeTaxBreakdown = { amount?: unknown; taxability_reason?: unknown };
type StripeTaxCalculation = {
  id?: unknown;
  amount_total?: unknown;
  tax_amount_exclusive?: unknown;
  tax_breakdown?: unknown;
};

export const STRIPE_TAX_CALCULATIONS_URL = "https://api.stripe.com/v1/tax/calculations";
const STRIPE_TAX_TIMEOUT_MS = 8000;

export function stripeTaxKey(env: NodeJS.ProcessEnv = process.env): string | null {
  const key = env.STRIPE_TAX_SECRET_KEY?.trim();
  return key ? key : null;
}

export function isTaxAddress(value: unknown): value is TaxAddress {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.line1 === "string" && a.line1.trim().length > 0 &&
    typeof a.city === "string" && a.city.trim().length > 0 &&
    typeof a.state === "string" && /^[A-Z]{2}$/.test(a.state) &&
    typeof a.postalCode === "string" && /^\d{5}(-\d{4})?$/.test(a.postalCode)
  );
}

function cents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * The staff Pay Now tax decision. Stripe Tax when its key is set, otherwise the
 * verified table, otherwise TAX_RATE_UNAVAILABLE.
 */
export async function quotePayNowSalesTax(
  input: { lines: TaxableLine[]; subtotal: number; address: TaxAddress | null },
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<SalesTaxQuote> {
  const env = options.env ?? process.env;
  const key = stripeTaxKey(env);
  if (!key) return quoteSalesTax(input.subtotal);

  const { lines, subtotal, address } = input;
  if (!Number.isFinite(subtotal) || subtotal <= 0 || lines.length === 0) {
    return unavailable("Sales tax needs a cart with a positive total.");
  }
  if (!isTaxAddress(address)) {
    return unavailable("Sales tax needs a complete US billing address.");
  }

  const overrides = parseTaxCodeOverrides(env.STRIPE_TAX_CODES);
  const coded = lines.map((line) => ({ line, code: storeTaxCode(line.category, overrides) }));
  const uncoded = coded.filter((entry) => !entry.code).map((entry) => entry.line.sku);
  if (uncoded.length > 0) {
    return unavailable("These items are not set up for online sales tax yet. Request a quote for them.", uncoded);
  }

  const form = new URLSearchParams();
  form.set("currency", "usd");
  coded.forEach(({ line, code }, i) => {
    form.set(`line_items[${i}][amount]`, String(cents(line.total)));
    form.set(`line_items[${i}][quantity]`, String(line.quantity));
    form.set(`line_items[${i}][reference]`, `${i + 1}:${line.sku}`);
    form.set(`line_items[${i}][tax_code]`, code!);
    form.set(`line_items[${i}][tax_behavior]`, "exclusive");
  });
  form.set("customer_details[address][line1]", address.line1);
  form.set("customer_details[address][city]", address.city);
  form.set("customer_details[address][state]", address.state);
  form.set("customer_details[address][postal_code]", address.postalCode);
  form.set("customer_details[address][country]", "US");
  form.set("customer_details[address_source]", "billing");

  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? STRIPE_TAX_TIMEOUT_MS);
  let body: StripeTaxCalculation;
  try {
    const response = await fetchImpl(STRIPE_TAX_CALCULATIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      signal: controller.signal,
    });
    const parsed = (await response.json().catch(() => ({}))) as StripeTaxCalculation & {
      error?: { type?: string; code?: string; param?: string };
    };
    if (!response.ok) {
      console.warn("[TAX] STRIPE_TAX_REJECTED", {
        status: response.status,
        type: parsed.error?.type,
        code: parsed.error?.code,
        param: parsed.error?.param,
      });
      return unavailable("Stripe Tax could not calculate sales tax for this cart.");
    }
    body = parsed;
  } catch (error: any) {
    console.warn("[TAX] STRIPE_TAX_UNREACHABLE", { reason: error?.name === "AbortError" ? "timeout" : "network" });
    return unavailable("Stripe Tax did not answer, so sales tax could not be calculated.");
  } finally {
    clearTimeout(timer);
  }

  const subtotalCents = coded.reduce((sum, { line }) => sum + cents(line.total), 0);
  const taxCents = body.tax_amount_exclusive;
  const breakdown = Array.isArray(body.tax_breakdown) ? (body.tax_breakdown as StripeTaxBreakdown[]) : null;
  if (
    typeof body.id !== "string" ||
    !body.id.startsWith("taxcalc_") ||
    typeof taxCents !== "number" ||
    !Number.isInteger(taxCents) ||
    taxCents < 0 ||
    body.amount_total !== subtotalCents + taxCents ||
    !breakdown
  ) {
    console.warn("[TAX] STRIPE_TAX_MALFORMED", { id: typeof body.id === "string" ? body.id : null });
    return unavailable("Stripe Tax returned an answer that does not add up.");
  }
  if (taxCents > subtotalCents * 0.2) {
    console.warn("[TAX] STRIPE_TAX_IMPLAUSIBLE", { id: body.id, taxCents, subtotalCents });
    return unavailable("Stripe Tax returned a rate above 20%.");
  }

  const reasons = breakdown
    .map((entry) => (typeof entry.taxability_reason === "string" ? entry.taxability_reason : "unknown"))
    .filter((reason, i, all) => all.indexOf(reason) === i);
  // An Arizona customer is in DE's home state. "not_collecting" there means the
  // Stripe account has no Arizona registration yet: setup is incomplete, so do
  // not charge as if no tax were due.
  if (address.state === "AZ" && reasons.includes("not_collecting")) {
    console.warn("[TAX] STRIPE_TAX_NO_AZ_REGISTRATION", { id: body.id });
    return unavailable("Stripe Tax has no Arizona registration yet.");
  }

  const tax = taxCents / 100;
  const total = (subtotalCents + taxCents) / 100;
  return {
    ok: true,
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    rate: (taxCents / subtotalCents).toFixed(5),
    source: `Stripe Tax ${body.id}`,
    calculationId: body.id,
    note: `Sales tax $${tax.toFixed(2)} by Stripe Tax ${body.id} (${reasons.join(", ") || "no breakdown"}); billing ${address.city}, ${address.state} ${address.postalCode}.`,
  };
}
