import { describe, expect, it } from "vitest";
import { requestableLicenses, resolveBaseLicense, validateLicensePolicy, type LicensePolicy } from "./licensing";

const POLICY: LicensePolicy = {
  platforms: [{ platform: "microsoft_commercial", tenantLabel: "acme.onmicrosoft.com" }],
  tiers: ["Executive"],
  baseRules: [
    { platform: "microsoft_commercial", accountType: "standard", tier: null, licenseKey: "ms_m365_e3", assignment: "automatic", group: "LIC-M365-E3" },
    { platform: "microsoft_commercial", accountType: "standard", tier: "Executive", licenseKey: "ms_m365_e5", assignment: "request", group: "LIC-M365-E5" },
    { platform: "microsoft_commercial", accountType: "frontline", tier: null, licenseKey: "ms_m365_f3", assignment: "automatic", group: "LIC-M365-F3" },
  ],
  addons: [{ platform: "microsoft_commercial", licenseKey: "ms_visio_p2", eligibleAccountTypes: ["standard"], group: "LIC-VISIO", approval: "manager" }],
  notes: "",
};

describe("validateLicensePolicy", () => {
  it("accepts a consistent policy", () => {
    expect(validateLicensePolicy(POLICY)).toEqual({ policy: expect.any(Object), errors: [] });
  });

  it("refuses an undeclared platform, a licence from another platform, an add-on used as a base and an undeclared tier", () => {
    const { policy, errors } = validateLicensePolicy({
      ...POLICY,
      baseRules: [
        { platform: "google_workspace", accountType: "standard", tier: null, licenseKey: "gws_business_plus", assignment: "automatic", group: "" },
        { platform: "microsoft_commercial", accountType: "standard", tier: null, licenseKey: "gcc_m365_g5", assignment: "automatic", group: "" },
        { platform: "microsoft_commercial", accountType: "admin", tier: null, licenseKey: "ms_visio_p2", assignment: "request", group: "" },
        { platform: "microsoft_commercial", accountType: "standard", tier: "Board", licenseKey: "ms_m365_e5", assignment: "request", group: "" },
      ],
    });
    expect(policy).toBeUndefined();
    expect(errors).toHaveLength(4);
    expect(errors.join("\n")).toMatch(/not declared/);
    expect(errors.join("\n")).toMatch(/tier "Board"/);
  });

  it("refuses an unknown account type", () => {
    const { errors } = validateLicensePolicy({ ...POLICY, addons: [{ ...POLICY.addons[0], eligibleAccountTypes: ["robot"] }] });
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe("resolveBaseLicense", () => {
  it("prefers the matching tier over the any-tier rule", () => {
    expect(resolveBaseLicense(POLICY, "microsoft_commercial", { accountType: "standard", tier: "Executive" }).license?.key).toBe("ms_m365_e5");
    expect(resolveBaseLicense(POLICY, "microsoft_commercial", { accountType: "standard", tier: null }).license?.key).toBe("ms_m365_e3");
  });

  it("licenses frontline workers with F3, and leaves an account type without a rule not eligible", () => {
    expect(resolveBaseLicense(POLICY, "microsoft_commercial", { accountType: "frontline", tier: null })).toMatchObject({ assignment: "automatic", license: { key: "ms_m365_f3" } });
    expect(resolveBaseLicense(POLICY, "microsoft_commercial", { accountType: "service", tier: null })).toMatchObject({ assignment: "not_eligible", license: null });
  });
});

describe("requestableLicenses", () => {
  it("lists the base licence and add-ons with eligibility, group and approval from the policy", () => {
    const standard = requestableLicenses(POLICY, { accountType: "standard", tier: null });
    expect(standard).toEqual([
      expect.objectContaining({ licenseKey: "ms_m365_e3", kind: "base", assignment: "automatic", group: "LIC-M365-E3" }),
      expect.objectContaining({ licenseKey: "ms_visio_p2", kind: "addon", assignment: "request", group: "LIC-VISIO", approval: "manager" }),
    ]);
    const frontline = requestableLicenses(POLICY, { accountType: "frontline", tier: null });
    expect(frontline.find((l) => l.licenseKey === "ms_visio_p2")?.assignment).toBe("not_eligible");
  });

  it("offers nothing on a platform the company doesn't use", () => {
    expect(requestableLicenses({ ...POLICY, platforms: [] }, { accountType: "standard", tier: null })).toEqual([]);
  });
});
