/**
 * Server-authoritative portal invoice payment amount.
 *
 * The payable amount is always derived from the canonical Zoho invoice
 * balance (falling back to total). Client-supplied amounts are never used
 * as the charge; if present they must match the server amount or the
 * request is rejected (prevents underpay / overpay manipulation).
 */

export type InvoicePaySource = {
  balance?: unknown;
  total?: unknown;
};

export type InvoicePayAmountResult =
  | { ok: true; amountDollars: number }
  | { ok: false; status: 400 | 409; error: string };

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toPositiveMoney(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return money(n);
}

/**
 * @param invoice Canonical invoice fields from billing (balance preferred).
 * @param clientAmountCents Optional client-supplied amount in cents. Ignored
 *   as authority; when present must equal the server amount in cents.
 */
export function resolvePortalInvoicePayAmount(
  invoice: InvoicePaySource,
  clientAmountCents?: unknown,
): InvoicePayAmountResult {
  const fromBalance = toPositiveMoney(invoice.balance);
  const fromTotal = toPositiveMoney(invoice.total);
  const amountDollars = fromBalance ?? fromTotal;

  if (amountDollars === null) {
    return { ok: false, status: 400, error: "Invoice has no balance due" };
  }

  if (clientAmountCents !== undefined && clientAmountCents !== null && clientAmountCents !== "") {
    const cents =
      typeof clientAmountCents === "number"
        ? clientAmountCents
        : Number(clientAmountCents);
    if (!Number.isFinite(cents) || !Number.isInteger(cents) || cents <= 0) {
      return {
        ok: false,
        status: 400,
        error: "Invalid payment amount",
      };
    }
    const expectedCents = Math.round(amountDollars * 100);
    if (cents !== expectedCents) {
      return {
        ok: false,
        status: 409,
        error: "Payment amount does not match the invoice balance due",
      };
    }
  }

  return { ok: true, amountDollars };
}
