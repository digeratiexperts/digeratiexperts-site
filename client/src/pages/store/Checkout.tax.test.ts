import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { missingBillingAddress } from "@/lib/billingAddress";

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
