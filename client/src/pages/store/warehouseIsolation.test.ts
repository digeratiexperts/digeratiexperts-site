import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(import.meta.dirname, "../../../..");

const prohibitedInApp = [
  "storeProducts",
  "vendorLogos",
  "CartContext",
  "ShoppingCart",
  "SolutionMobileBar",
  "StoreLanding",
  "CoManagedStore",
  "ManagedStore",
  "ProductDetail",
];

describe("public SPA isolation from the Digital Warehouse", () => {
  it("does not statically import the warehouse catalog from App.tsx", () => {
    const app = readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
    expect(app).toContain("WarehouseGate");
    expect(app).not.toMatch(/from ["']@\/contexts\/CartContext["']/);
    expect(app).not.toMatch(/from ["']@\/data\/storeProducts["']/);
    expect(app).not.toMatch(/from ["']@\/data\/vendorLogos["']/);
    expect(app).not.toMatch(/from ["']@\/pages\/store\/StoreLanding["']/);
    for (const term of prohibitedInApp.filter((name) => name !== "storeProducts")) {
      if (term === "WarehouseGate") continue;
      if (["StoreLanding", "CoManagedStore", "ManagedStore", "ProductDetail", "ShoppingCart", "SolutionMobileBar", "CartContext"].includes(term)) {
        expect(app).not.toContain(`pages/store/${term}`);
      }
    }
  });

  it("loads catalog code only after WarehouseGate", () => {
    const gate = readFileSync(path.join(root, "client/src/pages/store/WarehouseGate.tsx"), "utf8");
    expect(gate).not.toContain("storeProducts");
    expect(gate).not.toContain("vendorLogos");
    expect(gate).toContain('import("./WarehouseApp")');
  });

  it("uses a staff ops home instead of the old client StoreLanding", () => {
    const app = readFileSync(path.join(root, "client/src/pages/store/WarehouseApp.tsx"), "utf8");
    expect(app).toContain("WarehouseHome");
    expect(app).toContain("WarehouseShell");
    expect(app).not.toMatch(/from ["']\.\/StoreLanding["']/);
    expect(app).not.toMatch(/import\(["']\.\/StoreLanding["']\)/);
  });

  it("relabels merchandising and checkout as staff, not a public storefront", () => {
    const catalog = readFileSync(path.join(root, "client/src/pages/store/CoManagedStore.tsx"), "utf8");
    const checkout = readFileSync(path.join(root, "client/src/pages/store/Checkout.tsx"), "utf8");
    const shell = readFileSync(path.join(root, "client/src/pages/store/WarehouseShell.tsx"), "utf8");
    expect(catalog).toContain("Staff SKU workshop");
    expect(catalog).not.toContain("Guided IT Storefront");
    expect(checkout).toContain("Staff Pay Now (card)");
    expect(checkout).not.toContain("Complete your purchase");
    expect(shell).toContain("warehouse-chrome-health");
  });
});
