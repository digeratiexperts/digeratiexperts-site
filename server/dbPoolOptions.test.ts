import { describe, expect, it } from "vitest";
import { DB_QUERY_TIMEOUT_MS, poolOptions } from "./dbPoolOptions";

describe("database pool options", () => {
  it("caps every query on both drivers (#657: a dropped database must not hang reads forever)", () => {
    for (const kind of ["neon", "postgresql"] as const) {
      const options = poolOptions("postgres://user:pw@host/db", kind);
      expect(options.query_timeout).toBe(DB_QUERY_TIMEOUT_MS);
      expect(options.query_timeout).toBeGreaterThan(0);
      expect(options.connectionTimeoutMillis).toBe(10_000);
      expect(options.max).toBe(5);
      expect(options.connectionString).toBe("postgres://user:pw@host/db");
    }
  });

  it("keeps the idle timeout on node-postgres only (Neon manages its own)", () => {
    expect(poolOptions("postgres://x", "postgresql")).toMatchObject({ idleTimeoutMillis: 30_000 });
    expect(poolOptions("postgres://x", "neon")).not.toHaveProperty("idleTimeoutMillis");
  });
});
