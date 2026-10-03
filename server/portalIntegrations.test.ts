import { describe, expect, it } from "vitest";
import { effectiveClientId, readAllIntegrationStatus, readIntegrationStatus } from "./portalIntegrations";

describe("readIntegrationStatus", () => {
  it("defaults to sample when unset or unknown, so production is unchanged", () => {
    expect(readIntegrationStatus("vpn", {})).toEqual({ mode: "sample", provider: null });
    expect(readIntegrationStatus("phone", { PORTAL_PHONE_PROVIDER: "ringcentral" })).toEqual({ mode: "sample", provider: null });
    expect(readIntegrationStatus("shipping", { PORTAL_SHIPPING_PROVIDER: "sample" })).toEqual({ mode: "sample", provider: null });
  });

  it("hides a page on hidden / off / none", () => {
    for (const v of ["hidden", "off", "none", " HIDDEN "]) {
      expect(readIntegrationStatus("vpn", { PORTAL_VPN_PROVIDER: v }).mode).toBe("hidden");
    }
  });

  it("names a vendor adapter only from that area's list", () => {
    expect(readIntegrationStatus("vpn", { PORTAL_VPN_PROVIDER: "Tailscale" })).toEqual({ mode: "live", provider: "tailscale" });
    expect(readIntegrationStatus("shipping", { PORTAL_SHIPPING_PROVIDER: "manual" })).toEqual({ mode: "live", provider: "manual" });
    // a shipping vendor is not a VPN provider
    expect(readIntegrationStatus("vpn", { PORTAL_VPN_PROVIDER: "shippo" }).mode).toBe("sample");
  });

  it("reads all three areas", () => {
    const all = readAllIntegrationStatus({ PORTAL_VPN_PROVIDER: "twingate", PORTAL_PHONE_PROVIDER: "hidden" });
    expect(all.vpn).toEqual({ mode: "live", provider: "twingate" });
    expect(all.phone.mode).toBe("hidden");
    expect(all.shipping.mode).toBe("sample");
  });
});

describe("effectiveClientId", () => {
  it("uses the viewed company for an admin viewing as a client", () => {
    expect(effectiveClientId({ role: "admin", clientId: null, impersonatingCompanyId: "acme" })).toBe("acme");
  });
  it("is null for an admin in admin view", () => {
    expect(effectiveClientId({ role: "admin", clientId: null, impersonatingCompanyId: null })).toBeNull();
  });
  it("pins a client user to their own company and ignores an impersonation field", () => {
    expect(effectiveClientId({ role: "client", clientId: "globex", impersonatingCompanyId: "acme" })).toBe("globex");
  });
  it("is null without a caller or company", () => {
    expect(effectiveClientId(undefined)).toBeNull();
    expect(effectiveClientId({ role: "client", clientId: "" })).toBeNull();
  });
});
