import { describe, expect, it } from "vitest";
import {
  WAREHOUSE_BASE,
  isWarehousePath,
  isWarehouseTransactionalPath,
  warehousePath,
} from "./warehousePaths";

describe("warehouse paths", () => {
  it("builds staff-only routes under /internal/warehouse", () => {
    expect(WAREHOUSE_BASE).toBe("/internal/warehouse");
    expect(warehousePath()).toBe("/internal/warehouse");
    expect(warehousePath("/product/DE-SVC-MGD-IT-MO")).toBe(
      "/internal/warehouse/product/DE-SVC-MGD-IT-MO",
    );
  });

  it("does not treat public store or Door 2 as warehouse", () => {
    expect(isWarehousePath("/internal/warehouse/managed")).toBe(true);
    expect(isWarehousePath("/store")).toBe(false);
    expect(isWarehousePath("/solutions/business-needs")).toBe(false);
  });

  it("recognises every transactional Warehouse screen, with ids and query strings", () => {
    expect(isWarehouseTransactionalPath("/internal/warehouse/checkout")).toBe(true);
    expect(isWarehouseTransactionalPath("/internal/warehouse/checkout?x=1")).toBe(true);
    expect(isWarehouseTransactionalPath("/internal/warehouse/quote-request")).toBe(true);
    expect(isWarehouseTransactionalPath("/internal/warehouse/quote-confirmation/abc-123")).toBe(true);
    expect(isWarehouseTransactionalPath("/internal/warehouse/order-confirmation?orderId=1")).toBe(true);
  });

  it("does not treat catalog, product or legacy public paths as transactional", () => {
    expect(isWarehouseTransactionalPath("/internal/warehouse")).toBe(false);
    expect(isWarehouseTransactionalPath("/internal/warehouse/co-managed")).toBe(false);
    expect(isWarehouseTransactionalPath("/internal/warehouse/product/DE-SVC-MGD-IT-MO")).toBe(false);
    expect(isWarehouseTransactionalPath("/internal/warehouse/checkout-history")).toBe(false);
    expect(isWarehouseTransactionalPath("/store/checkout")).toBe(false);
    expect(isWarehouseTransactionalPath("/store/quote-request")).toBe(false);
  });
});
