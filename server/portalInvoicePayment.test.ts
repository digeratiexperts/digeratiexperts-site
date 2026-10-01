import { describe, expect, it } from "vitest";
import { resolveInvoicePayAmount } from "./portalInvoicePayment";

const EMAIL = "billing@example.com";

describe("resolveInvoicePayAmount", () => {
  it("uses the balance due when no client amount is supplied", () => {
    expect(resolveInvoicePayAmount("5000", undefined, EMAIL)).toEqual({ ok: true, payAmount: 5000 });
    expect(resolveInvoicePayAmount(1250.5, null, EMAIL)).toEqual({ ok: true, payAmount: 1250.5 });
  });

  it("accepts a client amount that matches the balance exactly (cents → dollars)", () => {
    expect(resolveInvoicePayAmount(5000, 500000, EMAIL)).toEqual({ ok: true, payAmount: 5000 });
    expect(resolveInvoicePayAmount(1250.5, 125050, EMAIL)).toEqual({ ok: true, payAmount: 1250.5 });
    // sub-cent float noise is tolerated (diff < 0.01)
    expect(resolveInvoicePayAmount(5000.004, 500000, EMAIL)).toEqual({ ok: true, payAmount: 5000.004 });
  });

  it("rejects a client amount a full cent short of the balance", () => {
    expect(resolveInvoicePayAmount(5000, 499999, EMAIL)).toMatchObject({ ok: false, reason: "amount_mismatch" });
  });

  it("rejects underpayment — the core bug (amount:1 against a $5,000 balance)", () => {
    const r = resolveInvoicePayAmount(5000, 1, EMAIL);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.reason).toBe("amount_mismatch");
    }
  });

  it("rejects overpayment too", () => {
    const r = resolveInvoicePayAmount(5000, 600000, EMAIL);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("amount_mismatch");
  });

  it("rejects an invoice with no balance due", () => {
    expect(resolveInvoicePayAmount(0, undefined, EMAIL)).toMatchObject({ ok: false, status: 400 });
    expect(resolveInvoicePayAmount(null, 100, EMAIL)).toMatchObject({ ok: false, status: 400 });
    expect(resolveInvoicePayAmount("not-a-number", 100, EMAIL)).toMatchObject({ ok: false, status: 400 });
  });

  it("ignores a zero/negative client amount and falls back to the balance", () => {
    expect(resolveInvoicePayAmount(5000, 0, EMAIL)).toEqual({ ok: true, payAmount: 5000 });
    expect(resolveInvoicePayAmount(5000, -100, EMAIL)).toEqual({ ok: true, payAmount: 5000 });
  });
});
