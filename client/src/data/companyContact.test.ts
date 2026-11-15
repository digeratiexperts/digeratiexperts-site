import { describe, expect, it } from "vitest";
import { COMPANY, PHONE_REGISTRY, PRIMARY_PHONE, PUBLIC_PHONE_NUMBER, PUBLIC_PHONE_PLACEHOLDER, hasPublicPhone } from "./companyContact";

describe("companyContact", () => {
  it("exposes a single primary public phone identity", () => {
    expect(PHONE_REGISTRY.primary).toEqual(PRIMARY_PHONE);
    expect(PRIMARY_PHONE.role).toBe("primary");
  });

  it("derives every phone form from the one configured number", () => {
    if (PUBLIC_PHONE_NUMBER === PUBLIC_PHONE_PLACEHOLDER) {
      expect(hasPublicPhone()).toBe(false);
      expect(PRIMARY_PHONE.display).toBe(PUBLIC_PHONE_PLACEHOLDER);
      expect(PRIMARY_PHONE.telHref).toBe("");
      expect(PRIMARY_PHONE.schemaTelephone).toBeUndefined();
    } else {
      const digits = PRIMARY_PHONE.e164.slice(2);
      expect(PRIMARY_PHONE.telHref).toBe(`tel:+1${digits}`);
      expect(PRIMARY_PHONE.schemaTelephone).toBe(`+1-${PRIMARY_PHONE.display}`);
    }
  });

  it("does not publish a second public phone identity", () => {
    expect(Object.keys(PHONE_REGISTRY)).toEqual(["primary"]);
  });

  it("keeps canonical company identity on digeratiexperts.com", () => {
    expect(COMPANY.website).toBe("https://digeratiexperts.com");
    expect(COMPANY.addressLocality).toBe("Chandler");
    expect(COMPANY.addressRegion).toBe("AZ");
    expect(COMPANY.mapsUrl).toBe("https://maps.google.com/?cid=1710856351091471339");
  });
});
