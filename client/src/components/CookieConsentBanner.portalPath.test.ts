import { describe, expect, it } from "vitest";
import { isAuthenticatedPortalPath } from "./CookieConsentBanner";

describe("isAuthenticatedPortalPath", () => {
  it("suppresses the consent banner inside the authenticated portal", () => {
    for (const p of ["/portal", "/portal/", "/portal/dashboard", "/portal/tickets/new", "/portal/admin/companies", "/portal/settings?tab=security"]) {
      expect(isAuthenticatedPortalPath(p), p).toBe(true);
    }
  });
  it("keeps it on the portal's public auth pages and the marketing site", () => {
    for (const p of ["/", "/store", "/portal/login", "/portal/signup", "/portal/forgot-password", "/portal/reset-password?token=x", "/portals", "/about/team"]) {
      expect(isAuthenticatedPortalPath(p), p).toBe(false);
    }
  });
});
