import { beforeAll, describe, expect, it } from "vitest";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-order-confirmation-token";

import {
  isValidOrderConfirmationToken,
  orderConfirmationToken,
} from "./orderConfirmationToken";

describe("order confirmation token", () => {
  let token: string;

  beforeAll(() => {
    token = orderConfirmationToken("order-a")!;
  });

  it("issues a token that validates for its own order", () => {
    expect(token).toBeTruthy();
    expect(isValidOrderConfirmationToken("order-a", token)).toBe(true);
  });

  it("rejects the token for any other order (no cross-order retrieval)", () => {
    expect(isValidOrderConfirmationToken("order-b", token)).toBe(false);
  });

  it("rejects garbage, empty, and non-string tokens", () => {
    expect(isValidOrderConfirmationToken("order-a", "deadbeef")).toBe(false);
    expect(isValidOrderConfirmationToken("order-a", "")).toBe(false);
    expect(isValidOrderConfirmationToken("order-a", undefined)).toBe(false);
    expect(isValidOrderConfirmationToken("order-a", ["a", "b"])).toBe(false);
  });
});
