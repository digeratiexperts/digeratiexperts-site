import { describe, expect, it } from "vitest";
import { parseOrderConfirmationParams } from "./orderConfirmationParams";

describe("parseOrderConfirmationParams", () => {
  it("parses the real post-checkout URL query (wouter useSearch format, no leading '?')", () => {
    const params = parseOrderConfirmationParams("orderId=abc-123&ct=0f9e8d");
    expect(params.orderId).toBe("abc-123");
    expect(params.confirmationToken).toBe("0f9e8d");
    expect(params.method).toBeNull();
  });

  it("also accepts a search string with a leading '?'", () => {
    const params = parseOrderConfirmationParams("?orderId=abc-123&method=quote");
    expect(params.orderId).toBe("abc-123");
    expect(params.method).toBe("quote");
  });

  it("falls back to the legacy session_id parameter", () => {
    expect(parseOrderConfirmationParams("session_id=sess-9").orderId).toBe("sess-9");
  });

  it("returns nulls for an empty query", () => {
    const params = parseOrderConfirmationParams("");
    expect(params.orderId).toBeNull();
    expect(params.confirmationToken).toBeNull();
  });
});
