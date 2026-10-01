import { describe, expect, it } from "vitest";
import { resolvePortalInvoicePayAmount } from "./invoicePaymentAmount";

describe("resolvePortalInvoicePayAmount", () => {
  it("derives the payable amount from invoice balance, ignoring a matching client amount", () => {
    const result = resolvePortalInvoicePayAmount(
      { balance: 5000, total: 5000 },
      5000_00,
    );
    expect(result).toEqual({ ok: true, amountDollars: 5000 });
  });

  it("prefers balance over total when both are present", () => {
    const result = resolvePortalInvoicePayAmount({ balance: 1234.56, total: 9999 });
    expect(result).toEqual({ ok: true, amountDollars: 1234.56 });
  });

  it("falls back to total when balance is missing", () => {
    const result = resolvePortalInvoicePayAmount({ total: "250.10" });
    expect(result).toEqual({ ok: true, amountDollars: 250.1 });
  });

  it("rejects a client underpay ($0.01 against a $5,000 invoice)", () => {
    const result = resolvePortalInvoicePayAmount({ balance: 5000, total: 5000 }, 1);
    expect(result).toEqual({
      ok: false,
      status: 409,
      error: "Payment amount does not match the invoice balance due",
    });
  });

  it("rejects a client overpay above the invoice balance", () => {
    const result = resolvePortalInvoicePayAmount({ balance: 100 }, 10_000_00);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });

  it("rejects zero, negative, and non-integer client amounts", () => {
    expect(resolvePortalInvoicePayAmount({ balance: 50 }, 0).ok).toBe(false);
    expect(resolvePortalInvoicePayAmount({ balance: 50 }, -100).ok).toBe(false);
    expect(resolvePortalInvoicePayAmount({ balance: 50 }, 12.5).ok).toBe(false);
  });

  it("rejects invoices with no positive balance or total", () => {
    expect(resolvePortalInvoicePayAmount({ balance: 0, total: 0 })).toEqual({
      ok: false,
      status: 400,
      error: "Invoice has no balance due",
    });
    expect(resolvePortalInvoicePayAmount({ balance: -5, total: undefined }).ok).toBe(false);
  });

  it("allows omitting the client amount and still charges the server balance", () => {
    const result = resolvePortalInvoicePayAmount({ balance: 88.01 });
    expect(result).toEqual({ ok: true, amountDollars: 88.01 });
  });
});
