import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #233: DatabaseStorage must read store orders from store_orders (the table
 * secure checkout inserts into), scoped to the account in SQL, and surface DB
 * failures instead of returning an empty list. A tiny pg-proxy fake interprets
 * the SQL Drizzle generates, so the real DatabaseStorage code runs.
 */

type Row = Record<string, unknown>;
const store: { rows: Row[] } = { rows: [] };
const statements: string[] = [];
let failReads = false;

function quoted(list: string): string[] {
  return [...list.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);
}

function matches(row: Row, where: string, params: unknown[]): boolean {
  const eqs = [...where.matchAll(/"store_orders"\."([a-z_]+)" = \$(\d+)/g)];
  if (eqs.length === 0) return true;
  const hit = (m: RegExpMatchArray) => row[m[1]] === params[Number(m[2]) - 1];
  return where.includes(" or ") ? eqs.some(hit) : eqs.every(hit);
}

async function fakeDriver(sql: string, params: unknown[]) {
  statements.push(sql);
  if (!sql.includes('"store_orders"')) return { rows: [] };
  if (sql.startsWith("insert")) {
    const [, cols, vals] = sql.match(/\(([^)]*)\) values \(([^)]*)\)/)!;
    const names = quoted(cols);
    const tokens = vals.split(",").map((t) => t.trim());
    const row: Row = {};
    names.forEach((n, i) => {
      row[n] = tokens[i].startsWith("$") ? params[Number(tokens[i].slice(1)) - 1] : null;
    });
    row.created_at = new Date().toISOString();
    row.updated_at = row.created_at;
    store.rows.push(row);
    const returning = sql.match(/returning (.*)$/)![1];
    return { rows: [quoted(returning).map((c) => row[c] ?? null)] };
  }
  if (sql.startsWith("select")) {
    if (failReads) throw new Error("connection terminated");
    const m = sql.match(/^select (.*) from "store_orders"(?: where (.*?))?( order by .*?)?( limit \$\d+)?$/)!;
    const rows = store.rows.filter((r) => matches(r, m[2] ?? "", params));
    return { rows: rows.map((r) => quoted(m[1]).map((c) => r[c] ?? null)) };
  }
  throw new Error(`Unhandled fake SQL: ${sql}`);
}

vi.mock("./db", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const db = drizzle(async (sql, params) => fakeDriver(sql, params));
  return { db, pool: null, dbReady: true, initPromise: Promise.resolve(true), initAttempted: true, dbType: "postgresql" };
});

async function fresh() {
  const { DatabaseStorage } = await import("./storage");
  return new DatabaseStorage();
}

const order = (over: Record<string, unknown>) => ({
  orderNumber: `ORD-${Math.random().toString(36).slice(2, 8)}`,
  lineItems: [{ sku: "A" }],
  subtotal: "10.00",
  total: "10.00",
  ...over,
});

describe("DatabaseStorage store orders come from store_orders (#233)", () => {
  beforeAll(async () => {
    await import("./db");
  });
  beforeEach(() => {
    store.rows = [];
    statements.length = 0;
    failReads = false;
  });

  it("an order written by checkout is visible after a restart, by list and by id", async () => {
    const writer = await fresh();
    const created = await writer.createStoreOrder(order({ userId: "u1", clientId: "c1" }));
    const reader = await fresh(); // restart: no process memory
    expect((await reader.getStoreOrder(created.id))?.id).toBe(created.id);
    const mine = await reader.getStoreOrdersForAccount({ userId: "u1", clientId: "c1" });
    expect(mine.map((o: any) => o.id)).toEqual([created.id]);
  });

  it("account scope is applied in SQL and never returns another account's order", async () => {
    const s = await fresh();
    const a = await s.createStoreOrder(order({ userId: "u1", clientId: "c1" }));
    await s.createStoreOrder(order({ userId: "u2", clientId: "c2" }));
    const byClient = await s.getStoreOrdersForAccount({ userId: null, clientId: "c1" });
    expect(byClient.map((o: any) => o.id)).toEqual([a.id]);
    expect(await s.getStoreOrdersForAccount({ userId: null, clientId: null })).toEqual([]);
    const select = statements.filter((q) => q.startsWith("select") && q.includes('"store_orders"')).pop()!;
    expect(select).toContain('"store_orders"."client_id" = $1');
  });

  it("a database read failure surfaces instead of an empty list", async () => {
    const s = await fresh();
    failReads = true;
    await expect(s.getStoreOrdersForAccount({ userId: "u1" })).rejects.toThrow();
    await expect(s.getStoreOrder("x")).rejects.toThrow();
  });
});
