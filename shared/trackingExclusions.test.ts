import { describe, expect, it } from "vitest";
import {
  clarityDenial,
  isPortalContext,
  isStoreTrackingPath,
  skipClarity,
  skipMarketingPixels,
} from "./trackingExclusions";

describe("tracking exclusions", () => {
  it("skips marketing pixels on the portal, checkout, payment, and store paths", () => {
    expect(skipMarketingPixels("digeratiexperts.com", "/portal/tickets")).toBe(true);
    expect(skipMarketingPixels("portal.digeratiexperts.com", "/")).toBe(true);
    expect(skipMarketingPixels("digeratiexperts.com", "/store/checkout")).toBe(true);
    expect(skipMarketingPixels("digeratiexperts.com", "/store")).toBe(true);
    expect(skipMarketingPixels("digeratiexperts.com", "/store/kits/proactive")).toBe(true);
    expect(skipMarketingPixels("digeratiexperts.com", "/support/pay-invoice")).toBe(true);
    expect(skipMarketingPixels("digeratiexperts.com", "/")).toBe(false);
    expect(skipMarketingPixels("digeratiexperts.com", "/legal/privacy-policy")).toBe(false);
    expect(skipMarketingPixels("digeratiexperts.com", "/contact")).toBe(false);
  });

  it("treats portal hosts and aliases as portal context", () => {
    expect(isPortalContext("portal.digeratiexperts.com", "/login")).toBe(true);
    expect(isPortalContext("digeratiexperts.com", "/login")).toBe(true);
    expect(isStoreTrackingPath("/STORE/Checkout/")).toBe(true);
  });
});

describe("Clarity deny list", () => {
  const host = "digeratiexperts.com";

  it("blocks Clarity on each denied route type", () => {
    const cases: Array<[string, string, ReturnType<typeof clarityDenial>]> = [
      ["/portal/dashboard", "portal", "portal"],
      ["/store/checkout", "checkout", "checkout"],
      ["/store/checkout/confirm", "checkout", "checkout"],
      ["/support/pay-invoice", "checkout", "checkout"],
      ["/store/order", "store-order", "store-order"],
      ["/store/order/review", "store-order", "store-order"],
      ["/store/solution/submitted/REF-1", "store-order", "store-order"],
      ["/portal/chat", "desk", "desk"],
      ["/contact", "form-contact", "form-contact"],
      ["/book", "form-assessment", "form-assessment"],
      ["/assessment", "form-assessment", "form-assessment"],
      ["/describe-your-situation", "form-describe", "form-describe"],
      ["/signup", "form-signup", "form-signup"],
      ["/portal/signup", "form-signup", "form-signup"],
      ["/support/submit-ticket", "form-ticket", "form-ticket"],
      ["/portal/tickets/new", "form-ticket", "form-ticket"],
    ];
    for (const [path, label, reason] of cases) {
      expect(clarityDenial(host, path), label + " " + path).toBe(reason);
      expect(skipClarity(host, path), label + " " + path).toBe(true);
    }
  });

  it("blocks Clarity for the DE Desk widget even on an otherwise allowed page", () => {
    expect(clarityDenial(host, "/", true)).toBe("desk-widget");
    expect(skipClarity(host, "/", true)).toBe(true);
    expect(skipClarity(host, "/", false)).toBe(false);
  });

  it("leaves Clarity eligible on ordinary marketing pages", () => {
    expect(skipClarity(host, "/")).toBe(false);
    expect(skipClarity(host, "/solutions/managed-it-support")).toBe(false);
    expect(skipClarity(host, "/store")).toBe(false);
    expect(skipClarity(host, "/legal/privacy-policy")).toBe(false);
  });
});
