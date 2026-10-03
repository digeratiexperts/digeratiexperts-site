export type StockMovementKind = "receive" | "pick" | "ship";

export type StockLine = {
  sku: string;
  onHand: number;
  reserved: number;
};

export type StockMovement = {
  sku: string;
  kind: StockMovementKind;
  quantity: number;
  carrier?: string;
  trackingNumber?: string;
};

export type StockBook = {
  lines: StockLine[];
};

export function applyStockMovement(book: StockBook, movement: StockMovement): StockBook {
  const sku = movement.sku.trim();
  const quantity = movement.quantity;
  if (!sku) throw new Error("SKU is required");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive integer");

  const lines = book.lines.map((line) => ({ ...line }));
  const index = lines.findIndex((line) => line.sku === sku);
  const current = index >= 0 ? lines[index] : { sku, onHand: 0, reserved: 0 };

  if (movement.kind === "receive") {
    current.onHand += quantity;
  } else if (movement.kind === "pick") {
    if (current.onHand < quantity) throw new Error("Not enough on-hand quantity to pick");
    current.onHand -= quantity;
    current.reserved += quantity;
  } else {
    const carrier = movement.carrier?.trim() ?? "";
    const trackingNumber = movement.trackingNumber?.trim() ?? "";
    if (!carrier || !trackingNumber) throw new Error("Ship requires a carrier and tracking number");
    if (current.reserved < quantity) throw new Error("Not enough picked quantity to ship");
    current.reserved -= quantity;
  }

  if (index >= 0) lines[index] = current;
  else lines.push(current);
  return { lines };
}
