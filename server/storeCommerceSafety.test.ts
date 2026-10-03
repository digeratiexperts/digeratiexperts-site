import { afterEach, describe, expect, it } from "vitest";
import { storeProducts } from "../client/src/data/storeProducts";
import {
  canonicalizeCheckoutLineItems,
  isPhysicalFulfillmentProduct,
  isRecurringSubscriptionProduct,
  physicalFulfillmentSkus,
  recurringCheckoutSkus,
} from "./secureStoreCheckout";
import {
  isDemoClientPricingAllowed,
  listDemoClientPricing,
  upsertDemoClientPricing,
} from "./storeClientPricing";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
});

describe("Store commerce safety", () => {
  it("rebuilds checkout pricing from the server catalog", () => {
    const [line] = canonicalizeCheckoutLineItems(
      [
        {
          productId: "prod-020",
          sku: "DE-SVC-CM-ONBOARD-S-OT",
          quantity: 1,
          unitPrice: 0.01,
          total: 0.01,
        },
      ],
      "comanaged",
    );

    expect(line.unitPrice).toBe(750);
    expect(line.total).toBe(750);
  });

  it("enforces catalog minimum quantities", () => {
    expect(() =>
      canonicalizeCheckoutLineItems(
        [
          {
            productId: "prod-036",
            sku: "DE-SVC-NET-ONSITE-HR",
            quantity: 1,
          },
        ],
        "comanaged",
      ),
    ).toThrow(/Invalid quantity/);
  });

  it("identifies recurring catalog families before one-time payment", () => {
    const recurringProduct = storeProducts.find((product) => product.id === "prod-010");
    const oneTimeProduct = storeProducts.find((product) => product.id === "prod-020");

    expect(recurringProduct).toBeDefined();
    expect(oneTimeProduct).toBeDefined();
    expect(isRecurringSubscriptionProduct(recurringProduct!)).toBe(true);
    expect(isRecurringSubscriptionProduct(oneTimeProduct!)).toBe(false);

    const recurringLines = canonicalizeCheckoutLineItems(
      [
        {
          productId: "prod-010",
          sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
          quantity: 2,
        },
      ],
      "comanaged",
    );
    expect(recurringCheckoutSkus(recurringLines)).toEqual(["DE-SVC-CM-ENDPOINT-CORE-MO"]);

    const oneTimeLines = canonicalizeCheckoutLineItems(
      [
        {
          productId: "prod-020",
          sku: "DE-SVC-CM-ONBOARD-S-OT",
          quantity: 1,
        },
      ],
      "comanaged",
    );
    expect(recurringCheckoutSkus(oneTimeLines)).toEqual([]);
  });

  it("holds physical hardware out of one-time payment (ships with a quote)", () => {
    const hardware = storeProducts.find((product) => product.id === "prod-055");
    const digital = storeProducts.find((product) => product.id === "prod-070");
    expect(hardware).toBeDefined();
    expect(digital).toBeDefined();
    expect(isPhysicalFulfillmentProduct(hardware!)).toBe(true);
    expect(isPhysicalFulfillmentProduct(digital!)).toBe(false);

    const hardwareLines = canonicalizeCheckoutLineItems(
      [{ productId: "prod-055", sku: "DE-HW-NET-FW-SMB-OT", quantity: 1 }],
      "admin",
    );
    expect(physicalFulfillmentSkus(hardwareLines)).toEqual(["DE-HW-NET-FW-SMB-OT"]);

    const digitalLines = canonicalizeCheckoutLineItems(
      [{ productId: "prod-070", sku: "DE-DIG-ASMT-QUICK-OT", quantity: 1 }],
      "admin",
    );
    expect(physicalFulfillmentSkus(digitalLines)).toEqual([]);

    // Every checkout-enabled hardware_physical SKU is caught, so none can be charged directly.
    const enabledHardware = storeProducts.filter(
      (p) => p.category === "hardware_physical" && p.isCheckoutEnabled,
    );
    expect(enabledHardware.length).toBeGreaterThan(0);
    for (const product of enabledHardware) {
      expect(isPhysicalFulfillmentProduct(product), product.sku).toBe(true);
    }
  });

  it("blocks laptop, phone and access point carts, and mixed carts cannot bypass the block", () => {
    const laptop = { productId: "prod-060", sku: "DE-HW-ENDPOINT-LT-BASE-OT", quantity: 2 };
    const phone = { productId: "prod-061", sku: "DE-HW-UC-PHONE-STD-OT", quantity: 5 };
    const accessPoint = { productId: "prod-057", sku: "DE-HW-NET-AP-BIZ-OT", quantity: 1 };
    const digital = { productId: "prod-070", sku: "DE-DIG-ASMT-QUICK-OT", quantity: 1 };

    for (const line of [laptop, phone, accessPoint]) {
      expect(physicalFulfillmentSkus(canonicalizeCheckoutLineItems([line], "admin"))).toEqual([line.sku]);
    }

    // A digital item alongside hardware does not dilute the block: every
    // physical SKU in the cart is reported, the digital one is not.
    const mixed = canonicalizeCheckoutLineItems([digital, laptop, accessPoint], "admin");
    expect(physicalFulfillmentSkus(mixed)).toEqual([laptop.sku, accessPoint.sku]);

    // Co-managed buyers reach the same checkout and get the same block.
    const coManaged = canonicalizeCheckoutLineItems([digital, phone], "comanaged");
    expect(physicalFulfillmentSkus(coManaged)).toEqual([phone.sku]);
  });

  it("never exposes demo client pricing in production", () => {
    process.env.NODE_ENV = "production";

    expect(isDemoClientPricingAllowed()).toBe(false);
    expect(listDemoClientPricing("client-1")).toEqual([]);
    expect(() =>
      upsertDemoClientPricing("client-1", {
        productId: "prod-020",
        customPrice: 1,
        discountPercent: 99,
      }),
    ).toThrow(/disabled in production/);
  });
});
