import { describe, expect, it } from "vitest";
import { applyStockMovement, type StockBook } from "./warehouseStock";

const empty: StockBook = { lines: [] };

describe("warehouse stock", () => {
  it("receives, picks, and ships with tracking", () => {
    const received = applyStockMovement(empty, { sku: "DE-SKU", kind: "receive", quantity: 3 });
    const picked = applyStockMovement(received, { sku: "DE-SKU", kind: "pick", quantity: 2 });
    const shipped = applyStockMovement(picked, {
      sku: "DE-SKU",
      kind: "ship",
      quantity: 2,
      carrier: "ups",
      trackingNumber: "1Z999",
    });
    expect(shipped.lines).toEqual([{ sku: "DE-SKU", onHand: 1, reserved: 0 }]);
  });

  it("refuses a ship without tracking", () => {
    const received = applyStockMovement(empty, { sku: "DE-SKU", kind: "receive", quantity: 1 });
    const picked = applyStockMovement(received, { sku: "DE-SKU", kind: "pick", quantity: 1 });
    expect(() => applyStockMovement(picked, { sku: "DE-SKU", kind: "ship", quantity: 1 })).toThrow(/tracking/i);
  });
});
