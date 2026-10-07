import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { missingBillingAddress } from "@/lib/billingAddress";
import { checkoutTaxNote, type SalesTaxReadiness } from "@/hooks/useSalesTaxReadiness";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, "Checkout.tsx"), "utf8");

describe("Pay Now when sales tax is unavailable", () => {
  it("switches to Request Quote with an explanation instead of a Checkout Failed error", () => {
    const block = src.match(/if \(errorData\.code === "TAX_RATE_UNAVAILABLE"\) \{[\s\S]*?return;\s*\}/)?.[0] ?? "";
    expect(block).toContain('reason: "tax_unavailable"');
    expect(block).toContain('setPaymentMethod("quote_request")');
    expect(block).toMatch(/title: "Pay Now is paused while sales tax is set up"/);
  });
});

describe("Pay Now billing address", () => {
  it("is asked for only when Pay Now is selected, and travels to the server as billing.address", () => {
    expect(src).toMatch(/\{paymentMethod === "zoho" && \(\s*<fieldset[\s\S]*?data-testid="section-billing-address"/);
    expect(src).toMatch(/if \(flagMissingAddress\(data\)\) return;/);
    expect(src).toMatch(/billing: \{\s*\.\.\.contact,\s*address: \{/);
  });

  it("names exactly the fields that are missing or malformed", () => {
    const full = { line1: "2 N Central Ave", city: "Phoenix", state: "az", postalCode: "85004" };
    expect(missingBillingAddress(full)).toEqual([]);
    expect(missingBillingAddress({ ...full, postalCode: "85004-1234" })).toEqual([]);
    expect(missingBillingAddress({})).toEqual(["line1", "city", "state", "postalCode"]);
    expect(missingBillingAddress({ ...full, state: "Arizona", postalCode: "850" })).toEqual(["state", "postalCode"]);
  });
});

describe("Pay Now sales tax readiness on staff checkout", () => {
  it("tells staff before they pay whether Zoho Books sales tax is ready", () => {
    expect(src).toContain("useSalesTaxReadiness()");
    expect(src).toMatch(/data-testid="text-paynow-tax-status" data-status=\{taxReadiness\.status\}/);
    expect(src).toContain("SALES_TAX_STATUS_LABEL[taxReadiness.status]");
    expect(src).toContain("checkoutTaxNote(taxReadiness)");
    expect(src).not.toMatch(/Stripe/);
  });

  it("gives staff one plain sentence per state, never a server setting name", () => {
    const base = { provider: "zoho_books" as const, message: "", missingSettings: [], quoteOnlyCategories: [], checkedAt: "" };
    const checks = (c: Partial<SalesTaxReadiness["checks"]>): SalesTaxReadiness["checks"] => ({
      connection: "set",
      taxRegistration: "unknown",
      serviceItem: "unknown",
      taxContact: "unknown",
      ...c,
    });
    const notes = [
      checkoutTaxNote({ ...base, status: "READY", checks: checks({ taxRegistration: "active", serviceItem: "set", taxContact: "set" }) }),
      checkoutTaxNote({ ...base, status: "NOT_CONFIGURED", checks: checks({ connection: "missing" }) }),
      checkoutTaxNote({ ...base, status: "AUTH_REQUIRED", checks: checks({}) }),
      checkoutTaxNote({ ...base, status: "INCOMPLETE", checks: checks({ taxRegistration: "missing" }) }),
      checkoutTaxNote({ ...base, status: "INCOMPLETE", checks: checks({ taxRegistration: "active", serviceItem: "missing" }) }),
      checkoutTaxNote({ ...base, status: "UNKNOWN", checks: checks({}) }),
    ];
    expect(new Set(notes).size).toBe(notes.length);
    for (const note of notes) expect(note).not.toMatch(/ZOHO_|_TOKEN|_ID\b|env|Stripe/);
    expect(notes[0]).toMatch(/Zoho Books adds sales tax/);
    expect(notes[3]).toMatch(/Sales Tax Automation/);
  });

  it("stays in the Warehouse: the public Store never asks for the tax status", () => {
    const publicCheckout = readFileSync(resolve(here, "PublicStoreCheckout.tsx"), "utf8");
    expect(publicCheckout).not.toMatch(/useSalesTaxReadiness|tax-status/);
  });
});
