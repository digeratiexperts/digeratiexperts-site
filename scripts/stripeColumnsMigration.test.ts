import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Retired Stripe columns, step 2 (Joe, 2026-11-05). The first destructive
 * migration in the ledger, so its shape is pinned here: archive before drop,
 * every statement guarded, exactly the four columns, nothing else dropped.
 * CI has no Postgres; the migration was also run against a real Postgres 16
 * built from the pre-change schema (recorded in the PR).
 */
const ROOT = path.resolve(__dirname, "..");
const MIGRATION = "migrations/0025_drop_retired_stripe_columns.sql";
const COLUMNS = [
  ["store_orders", "stripe_session_id"],
  ["store_orders", "stripe_payment_intent_id"],
  ["store_products", "stripe_price_id"],
  ["store_products", "stripe_product_id"],
] as const;

const sql = readFileSync(path.join(ROOT, MIGRATION), "utf8");
const code = sql.replace(/^\s*--.*$/gm, "");

describe("retired Stripe columns migration", () => {
  it("copies every value to the archive before anything is dropped", () => {
    const archive = code.indexOf("INSERT INTO retired_stripe_references");
    const firstDrop = code.search(/DROP\s+COLUMN/i);
    expect(code).toMatch(/CREATE TABLE IF NOT EXISTS retired_stripe_references/);
    expect(archive).toBeGreaterThan(-1);
    expect(firstDrop).toBeGreaterThan(archive);
  });

  it("archives and drops exactly the four retired columns, each guarded", () => {
    for (const [table, column] of COLUMNS) {
      expect(code).toContain(`('${table}', '${column}')`);
      expect(code).toMatch(new RegExp(`DROP COLUMN IF EXISTS ${column}\\b`));
    }
    expect(code.match(/DROP\s+COLUMN/gi)).toHaveLength(COLUMNS.length);
    expect(code.match(/DROP COLUMN IF EXISTS/g)).toHaveLength(COLUMNS.length);
    expect(code.match(/ALTER TABLE IF EXISTS/g)).toHaveLength(2);
  });

  it("drops no table, type or enum value, and keeps the store rows", () => {
    expect(code).not.toMatch(/DROP\s+(TABLE|TYPE|SCHEMA|INDEX)/i);
    expect(code).not.toMatch(/\bDELETE\b|\bTRUNCATE\b|\bUPDATE\s+store_/i);
    expect(code).not.toMatch(/store_payment_method/);
  });

  it("is never paired with a schema that still declares the columns", () => {
    // The columns can only be dropped once no running code selects them
    // (Drizzle names every schema column). Re-adding one here would make
    // every store order or product read fail after this migration.
    const schema = readFileSync(path.join(ROOT, "shared/schema.ts"), "utf8");
    for (const [, column] of COLUMNS) expect(schema).not.toContain(`"${column}"`);
  });
});
