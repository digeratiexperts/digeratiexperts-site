import { describe, expect, it } from "vitest";
import { GOOGLE_SKU, MS_SKU_PART, MS_TENANT, VENDOR_SKU_DEFAULTS, planVendorPush, pushVendorOf, splitGoogleSku } from "./vendorPush";
import { catalogShelf, starterShelf } from "./licenseShelf";

describe("vendor push", () => {
  it("knows which console a licence belongs in", () => {
    expect(pushVendorOf({ vendor: "Microsoft", catalogKey: "gcch_m365_g5" })).toBe("microsoft");
    expect(pushVendorOf({ vendor: "Google", catalogKey: "gws_business_plus" })).toBe("google");
    expect(pushVendorOf({ vendor: "Microsoft", catalogKey: null })).toBe("microsoft");
    expect(pushVendorOf({ vendor: "Coro", catalogKey: null })).toBeNull();
  });

  it("ships well-formed default SKU codes on the shelf", () => {
    for (const [key, sku] of Object.entries(VENDOR_SKU_DEFAULTS)) {
      expect(key.includes("gws_") ? GOOGLE_SKU.test(sku) : MS_SKU_PART.test(sku), key).toBe(true);
    }
    const shelf = [...catalogShelf(), ...starterShelf()];
    expect(shelf.find((e) => e.key === "catalog:ms_m365_bp")?.sku).toBe("SPB");
    expect(shelf.find((e) => e.key === "starter:entra-p1")?.sku).toBe("AAD_PREMIUM");
    expect(splitGoogleSku("Google-Apps/1010020027")).toEqual({ productId: "Google-Apps", skuId: "1010020027" });
    expect(MS_TENANT.test("0b0e3d2a-1111-4c4c-9a9a-123456789abc")).toBe(true);
    expect(MS_TENANT.test("contoso.onmicrosoft.com")).toBe(true);
    expect(MS_TENANT.test("contoso")).toBe(false);
  });

  it("plans only licences held by people, and explains every skip", () => {
    const plan = planVendorPush(
      {
        pool: [
          { itemId: "bp", kind: "license", vendor: "Microsoft", product: "Business Premium", catalogKey: "ms_m365_bp", sku: "SPB" },
          { itemId: "x", kind: "license", vendor: "Microsoft", product: "Copilot", catalogKey: "ms_copilot", sku: null },
          { itemId: "coro", kind: "license", vendor: "Coro", product: "Coro", catalogKey: null, sku: null },
          { itemId: "teams", kind: "app", vendor: "Microsoft", product: "Teams", catalogKey: null, sku: null },
        ],
        people: [
          { id: "1", name: "Dana", email: "dana@a.test", licenses: [{ itemId: "bp" }, { itemId: "x" }, { itemId: "coro" }, { itemId: "teams" }] },
          { id: "2", name: "Kiosk", email: "", licenses: [{ itemId: "bp" }] },
        ],
        departments: [{ name: "Sales", seats: [{ itemId: "bp", count: 2 }, { itemId: "coro", count: 4 }] }],
      },
      "microsoft",
      true,
    );
    expect(plan.steps.map((s) => `${s.product}:${s.person}:${s.status}:${s.reason ?? ""}`)).toEqual([
      "Business Premium:Dana:ready:",
      "Copilot:Dana:skip:No Microsoft SKU part number on this licence",
      "Business Premium:Kiosk:skip:This person has no email address",
    ]);
    expect(plan.parkedInDepartments).toBe(2);
  });
});
