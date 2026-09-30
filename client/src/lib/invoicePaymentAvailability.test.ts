import { describe, expect, it } from "vitest";
import { cardCheckoutFromAvailability } from "./invoicePaymentAvailability";

describe("cardCheckoutFromAvailability", () => {
  it("accepts only an explicit true flag", () => {
    expect(cardCheckoutFromAvailability({ cardCheckout: true })).toBe(true);
    expect(cardCheckoutFromAvailability({ cardCheckout: false })).toBe(false);
    expect(cardCheckoutFromAvailability({ cardCheckout: "true" })).toBe(false);
    expect(cardCheckoutFromAvailability(null)).toBe(false);
    expect(cardCheckoutFromAvailability({})).toBe(false);
  });
});
