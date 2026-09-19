import { describe, expect, it } from "vitest";
import { isKnownSpaPath, normalizeSpaPath } from "./spaKnownPaths";

describe("spaKnownPaths", () => {
  it("normalizes trailing slashes", () => {
    expect(normalizeSpaPath("/store/")).toBe("/store");
    expect(normalizeSpaPath("/")).toBe("/");
  });

  it("allows known marketing and portal routes", () => {
    expect(isKnownSpaPath("/")).toBe(true);
    expect(isKnownSpaPath("/store")).toBe(true);
    expect(isKnownSpaPath("/store/")).toBe(true);
    expect(isKnownSpaPath("/portal/marketplace")).toBe(true);
    expect(isKnownSpaPath("/resources/blog/some-slug")).toBe(true);
  });

  it("returns false for unknown paths so the SPA catch-all can send HTTP 404", () => {
    expect(isKnownSpaPath("/this-is-not-a-real-page")).toBe(false);
    expect(isKnownSpaPath("/store/product/secret-sku")).toBe(false);
  });
});
