/**
 * Server-authoritative amount resolution for portal invoice payment.
 *
 * The balance due (from Zoho Billing) is the source of truth. A client may
 * supply `amountCents` but it can only *match* the balance — never set a
 * smaller figure — so an authenticated user cannot underpay their own invoice
 * by posting e.g. amount:1 against a $5,000 balance.
 */

export type InvoicePayAmountResult =
  | { ok: true; payAmount: number }
  | { ok: false; status: number; error: string; reason?: string };

/** Invoice states that must never start a payment session, whatever the balance field says. */
const UNPAYABLE_STATUSES = new Set(["paid", "void", "voided", "draft", "closed", "cancelled", "canceled", "written_off"]);

export function resolveInvoicePayAmount(
  balanceRaw: unknown,
  amountCents: unknown,
  billingEmail: string,
  invoiceStatus?: unknown,
): InvoicePayAmountResult {
  const status = typeof invoiceStatus === "string" ? invoiceStatus.trim().toLowerCase().replace(/\s+/g, "_") : "";
  if (status && UNPAYABLE_STATUSES.has(status)) {
    return { ok: false, status: 400, error: "This invoice cannot be paid online.", reason: "invoice_not_payable" };
  }
  const balanceDue = Number(balanceRaw);
  if (!Number.isFinite(balanceDue) || balanceDue <= 0) {
    return { ok: false, status: 400, error: "Invoice has no balance due" };
  }

  if (typeof amountCents === "number" && Number.isFinite(amountCents) && amountCents > 0) {
    const requested = amountCents / 100;
    // Allow a cent of rounding tolerance; reject anything else (under or over).
    if (Math.abs(requested - balanceDue) >= 0.01) {
      return {
        ok: false,
        status: 400,
        error: `Payment amount must equal the balance due. Please contact ${billingEmail}.`,
        reason: "amount_mismatch",
      };
    }
  }

  return { ok: true, payAmount: balanceDue };
}
