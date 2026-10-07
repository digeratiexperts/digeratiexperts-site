import { storeTaxItem, type StoreCategory } from "@shared/storeTaxCodes";
import { calculateBooksSalesTax, zohoBooksTaxConfig, type BooksCallOptions } from "./zohoBooksTax";

/**
 * Sales tax is fail-closed.
 *
 * Staff Pay Now asks Zoho Books Sales Tax Automation when the server is
 * connected to Books (server/services/zohoBooksTax.ts); Zoho Payments still
 * takes the card. Without that connection, a rate is used only when
 * AZ_TPT_RATE_TABLE_JSON holds a verified table (https source, retrieval date,
 * numeric rate). Nothing in git invents a rate, and any failure answers
 * TAX_RATE_UNAVAILABLE so checkout steps aside to a quote.
 */
export const TAX_RATE_UNAVAILABLE = "TAX_RATE_UNAVAILABLE" as const;

export type SalesTaxQuote =
  | {
      ok: true;
      tax: string;
      total: string;
      rate: string;
      source: string;
      /** The Books estimate number the tax was read from, when Books answered. */
      calculationId?: string;
      /** One line for the order record: who calculated the tax and why. */
      note?: string;
    }
  | {
      ok: false;
      code: typeof TAX_RATE_UNAVAILABLE;
      error: string;
      /** Lines that have no confirmed Books tax item, when that is the reason. */
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

/** Whether Pay Now asks Zoho Books for tax, and so needs a full billing address. */
export function booksTaxConnected(env: NodeJS.ProcessEnv = process.env): boolean {
  return zohoBooksTaxConfig(env) !== null;
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

const READINESS_HINT: Record<string, string> = {
  NOT_CONFIGURED: "Sales tax is paused until the server is connected to Zoho Books.",
  AUTH_REQUIRED: "Zoho refused the Books token, so sales tax could not be calculated.",
  INCOMPLETE: "Zoho Books sales tax setup is incomplete, so sales tax could not be calculated.",
  UNKNOWN: "Zoho Books did not confirm its sales tax setup, so sales tax could not be calculated.",
};

/**
 * The staff Pay Now tax decision. Zoho Books when the server is connected to
 * it and its readiness check reads READY, otherwise the verified table,
 * otherwise TAX_RATE_UNAVAILABLE.
 */
export async function quotePayNowSalesTax(
  input: { lines: TaxableLine[]; subtotal: number; address: TaxAddress | null; reference?: string },
  options: BooksCallOptions & {
    env?: NodeJS.ProcessEnv;
    /** Readiness gate; defaults to the cached Books readiness check. */
    readiness?: () => Promise<{ status: string }>;
  } = {},
): Promise<SalesTaxQuote> {
  const env = options.env ?? process.env;
  const config = zohoBooksTaxConfig(env);
  if (!config) return quoteSalesTax(input.subtotal);

  const { lines, subtotal, address } = input;
  if (!Number.isFinite(subtotal) || subtotal <= 0 || lines.length === 0) {
    return unavailable("Sales tax needs a cart with a positive total.");
  }
  if (!isTaxAddress(address)) {
    return unavailable("Sales tax needs a complete US billing address.");
  }

  const mapped = lines.map((line) => ({ line, itemId: storeTaxItem(line.category, config.serviceItemId, config.itemOverrides) }));
  const unmapped = mapped.filter((entry) => !entry.itemId).map((entry) => entry.line.sku);
  if (unmapped.length > 0) {
    return unavailable("These items are not set up for online sales tax yet. Request a quote for them.", unmapped);
  }

  // A Books organization without a tax registration answers zero tax rather
  // than an error, so never trust its number until the readiness check agrees.
  const readiness = options.readiness ?? (async () => (await import("./salesTaxReadiness")).cachedSalesTaxReadiness());
  let status = "UNKNOWN";
  try {
    status = (await readiness()).status;
  } catch {
    status = "UNKNOWN";
  }
  if (status !== "READY") {
    return unavailable(READINESS_HINT[status] ?? READINESS_HINT.UNKNOWN);
  }

  const answer = await calculateBooksSalesTax(
    config,
    {
      lines: mapped.map(({ line, itemId }) => ({ sku: line.sku, itemId: itemId!, quantity: line.quantity, total: line.total })),
      address,
      reference: input.reference ?? "Pay Now tax check",
    },
    options,
  );
  if (!answer.ok) {
    return unavailable(
      answer.failure === "implausible"
        ? "Zoho Books returned a rate above 20%."
        : answer.failure === "malformed"
          ? "Zoho Books returned an answer that does not add up."
          : "Zoho Books could not calculate sales tax for this cart.",
    );
  }

  const subtotalCents = lines.reduce((sum, line) => sum + cents(line.total), 0);
  const tax = answer.taxCents / 100;
  const total = (subtotalCents + answer.taxCents) / 100;
  const taxes = answer.taxNames.length ? answer.taxNames.join(", ") : "no tax lines";
  return {
    ok: true,
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    rate: (answer.taxCents / subtotalCents).toFixed(5),
    source: "Zoho Books sales tax",
    calculationId: answer.estimateNumber,
    note: `Sales tax $${tax.toFixed(2)} by Zoho Books (${taxes}; draft estimate ${answer.estimateNumber} ${answer.deleted ? "deleted" : "NOT deleted, remove it in Books"}); billing ${address.city}, ${address.state} ${address.postalCode}.`,
  };
}
