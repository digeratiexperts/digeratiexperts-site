import { describe, expect, it } from "vitest";
import { COMPANY, PHONE_REGISTRY, PRIMARY_PHONE } from "./companyContact";

describe("companyContact", () => {
  it("exposes a single primary public phone identity", () => {
    expect(PRIMARY_PHONE.display).toBe("325-480-9870");
    expect(PRIMARY_PHONE.e164).toBe("+13254809870");
    expect(PRIMARY_PHONE.telHref).toBe("tel:+13254809870");
    expect(PRIMARY_PHONE.schemaTelephone).toBe("+1-325-480-9870");
    expect(PHONE_REGISTRY.primary).toEqual(PRIMARY_PHONE);
  });

  it("does not publish a second public phone identity", () => {
    expect(Object.keys(PHONE_REGISTRY)).toEqual(["primary"]);
  });

  it("keeps canonical company identity on digeratexperts.com", () => {
    expect(COMPANY.website).toBe("https://digeratiexperts.com");
    expect(COMPANY.addressLocality).toBe("Chandler");
    expect(COMPANY.addressRegion).toBe("AZ");
    expect(COMPANY.mapsUrl).toBe("https://maps.google.com/?cid=1710856351091471339");
  });

  it("routes public topics to dedicated digeratexperts.com mailboxes", () => {
    expect(COMPANY.email).toBe("admin@digeratiexperts.com");
    expect(COMPANY.legalEmail).toBe("legal@digeratiexperts.com");
    expect(COMPANY.privacyEmail).toBe("privacy@digeratiexperts.com");
    expect(COMPANY.accessibilityEmail).toBe("accessibility@digeratiexperts.com");
    expect(COMPANY.securityEmail).toBe("security@digeratiexperts.com");
    for (const address of [
      COMPANY.email,
      COMPANY.legalEmail,
      COMPANY.privacyEmail,
      COMPANY.accessibilityEmail,
      COMPANY.securityEmail,
      COMPANY.supportEmail,
      COMPANY.billingEmail,
    ]) {
      expect(address.endsWith("@digeratiexperts.com")).toBe(true);
      expect(address).not.toContain("@digerati-experts.com");
    }
  });
});
