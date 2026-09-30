import { describe, expect, it } from "vitest";
import { formatPrice, isResolvedPrice, storeProducts } from "./storeProducts";

// Fail-closed pricing on the client: an unresolved price (missing, NaN, zero)
// must never render as a currency amount. Zero is a real monetary value and
// cannot mean "we don't know" (DE source-of-truth contract, ECO-002).
describe("client price resolution", () => {
  it("treats zero, NaN, undefined and negatives as unresolved", () => {
    for (const v of [0, -1, NaN, Infinity, undefined, null, "12"]) expect(isResolvedPrice(v)).toBe(false);
    expect(isResolvedPrice(0.01)).toBe(true);
    expect(isResolvedPrice(1499)).toBe(true);
  });

  it("never formats an unresolved price as $0.00", () => {
    const sample = storeProducts[0];
    const zero = { ...sample, basePrice: 0, isContractOnly: false };
    expect(formatPrice(zero)).toBe("Contact for Quote");
    expect(formatPrice(sample, 0)).toBe("Contact for Quote");
    expect(formatPrice(sample, Number.NaN)).toBe("Contact for Quote");
    expect(formatPrice({ ...sample, basePrice: 0, isContractOnly: true })).toBe("Contact for Quote");
  });

  it("still formats real prices", () => {
    const sample = storeProducts.find((p) => p.basePrice > 0)!;
    expect(formatPrice(sample)).toMatch(/^\$[\d,]+\.\d{2}/);
    expect(formatPrice(sample)).not.toBe("$0.00");
  });

  it("ships no catalog entry whose displayed price is $0.00", () => {
    for (const p of storeProducts) expect(formatPrice(p)).not.toMatch(/^\$0\.00/);
  });
});
