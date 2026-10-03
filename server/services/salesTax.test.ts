import { afterEach, describe, expect, it } from "vitest";
import { quoteSalesTax, TAX_RATE_UNAVAILABLE } from "./salesTax";

const ENV = "AZ_TPT_RATE_TABLE_JSON";

afterEach(() => {
  delete process.env[ENV];
});

describe("quoteSalesTax", () => {
  it("refuses to invent a rate or a zero-tax charge when no table is configured", () => {
    delete process.env[ENV];
    const decision = quoteSalesTax(750);
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe(TAX_RATE_UNAVAILABLE);
      expect(decision.error).toMatch(/will not record tax as zero/i);
    }
  });

  it("uses only a verified table supplied outside git", () => {
    process.env[ENV] = JSON.stringify({
      source: "https://azdor.gov/transaction-privilege-tax/tax-rate-table",
      retrievedOn: "2026-09-01",
      rate: 0.056,
    });
    const decision = quoteSalesTax(100);
    expect(decision).toMatchObject({ ok: true, tax: "5.60", total: "105.60" });
  });
});
