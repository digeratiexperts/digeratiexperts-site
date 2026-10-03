/**
 * Sales tax is fail-closed.
 * A rate is used only when AZ_TPT_RATE_TABLE_JSON holds a verified table
 * (https source, retrieval date, numeric rate). Nothing in git invents that rate.
 */
export const TAX_RATE_UNAVAILABLE = "TAX_RATE_UNAVAILABLE" as const;

export type SalesTaxQuote =
  | {
      ok: true;
      tax: string;
      total: string;
      rate: string;
      source: string;
    }
  | {
      ok: false;
      code: typeof TAX_RATE_UNAVAILABLE;
      error: string;
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
