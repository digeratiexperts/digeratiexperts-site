import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyStockMovement, type StockBook, type StockMovement } from "./warehouseStock";

const filePath = path.join(process.cwd(), "server", "data", "warehouse-on-hand.json");

async function readBook(): Promise<StockBook> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as StockBook;
    if (!parsed || !Array.isArray(parsed.lines)) return { lines: [] };
    return parsed;
  } catch {
    return { lines: [] };
  }
}

export async function listWarehouseStock(): Promise<StockBook> {
  return readBook();
}

export async function recordWarehouseMovement(movement: StockMovement): Promise<StockBook> {
  const next = applyStockMovement(await readBook(), movement);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2));
  return next;
}
