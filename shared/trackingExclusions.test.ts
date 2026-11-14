import { describe, expect, it } from "vitest";
import { isPortalContext, isStoreTrackingPath, skipMarketingPixels } from "./trackingExclusions";

describe("tracking exclusions", () => {
  it("skips the portal, checkout, payment, and store paths", () => {
    expect(skipMarketingPixels("digeratiexperts.com", "/portal/tickets")).toBe(true);
    expect(skipMarketingPixels("portal.digeratiexperts.com", "/")).toBe(true);
    expect(skipMarketingPixels("digeratiexperts.com", "/store/checkout")).toBe(true);
    expect(skipMarketingPixels("digeratiexperts.com", "/store")).toBe(true);
    expect(skipMarketingPixels("digeratiexperts.com", "/store/kits/proactive")).toBe(true);
    expect(skipMarketingPixels("digeratiexperts.com", "/support/pay-invoice")).toBe(true);
    expect(skipMarketingPixels("digeratiexperts.com", "/")).toBe(false);
    expect(skipMarketingPixels("digeratiexperts.com", "/legal/privacy-policy")).toBe(false);
  });

  it("treats portal hosts and aliases as portal context", () => {
    expect(isPortalContext("portal.digeratiexperts.com", "/login")).toBe(true);
    expect(isPortalContext("digeratiexperts.com", "/login")).toBe(true);
    expect(isStoreTrackingPath("/STORE/Checkout/")).toBe(true);
  });
});
