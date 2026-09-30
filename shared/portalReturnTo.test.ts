import { describe, expect, it } from "vitest";
import {
  marketplaceReturnTo,
  PORTAL_DASHBOARD_PATH,
  PORTAL_MARKETPLACE_PATH,
  sanitizeReturnTo,
} from "./portalReturnTo";

describe("sanitizeReturnTo", () => {
  it("keeps Client Marketplace and other portal pages", () => {
    expect(sanitizeReturnTo("/portal/marketplace")).toBe(PORTAL_MARKETPLACE_PATH);
    expect(sanitizeReturnTo("/portal/dashboard")).toBe("/portal/dashboard");
    expect(sanitizeReturnTo("/portal/tickets?id=1")).toBe("/portal/tickets?id=1");
  });

  it("rejects login loops, protocol-relative URLs, and off-site hosts", () => {
    expect(sanitizeReturnTo("/portal/login")).toBe(PORTAL_DASHBOARD_PATH);
    expect(sanitizeReturnTo("//login")).toBe(PORTAL_DASHBOARD_PATH);
    expect(sanitizeReturnTo("https://evil.example/portal/marketplace")).toBe(PORTAL_DASHBOARD_PATH);
    expect(sanitizeReturnTo("javascript:alert(1)")).toBe(PORTAL_DASHBOARD_PATH);
  });

  it("unwraps same-site absolute URLs to a path", () => {
    expect(sanitizeReturnTo("https://portal.digeratiexperts.com/portal/marketplace")).toBe(
      PORTAL_MARKETPLACE_PATH,
    );
    expect(sanitizeReturnTo("https://digeratiexperts.com/portal/tickets")).toBe("/portal/tickets");
  });
});

describe("marketplaceReturnTo", () => {
  it("sends Store and marketplace intents back to Client Marketplace", () => {
    expect(marketplaceReturnTo("/store")).toBe(PORTAL_MARKETPLACE_PATH);
    expect(marketplaceReturnTo("/store/checkout")).toBe(PORTAL_MARKETPLACE_PATH);
    expect(marketplaceReturnTo("https://digeratiexperts.com/store")).toBe(PORTAL_MARKETPLACE_PATH);
    expect(marketplaceReturnTo("/portal/marketplace")).toBe(PORTAL_MARKETPLACE_PATH);
  });

  it("does not hijack unrelated portal pages", () => {
    expect(marketplaceReturnTo("/portal/tickets")).toBe("/portal/tickets");
  });

  it("preserves the Digital Warehouse quote-request destination through login", () => {
    expect(marketplaceReturnTo("/internal/warehouse/quote-request")).toBe(
      "/internal/warehouse/quote-request",
    );
    expect(sanitizeReturnTo("/internal/warehouse/quote-request")).toBe(
      "/internal/warehouse/quote-request",
    );
  });
});
