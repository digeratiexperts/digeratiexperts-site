import { afterEach, describe, expect, it } from "vitest";
import { databaseAcceptsConnections, memoryOnlySmokeAllowed, probeStatus } from "./healthProbe";

const ORIGINAL = process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;
  else process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = ORIGINAL;
});

describe("health probes", () => {
  it("fails when Postgres is down", () => {
    delete process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;
    expect(memoryOnlySmokeAllowed()).toBe(false);
    expect(probeStatus(false)).toBe(503);
  });

  it("passes when Postgres accepts a connection", () => {
    delete process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;
    expect(probeStatus(true)).toBe(200);
  });

  it("passes a memory-only CI smoke only when that flag is exactly 1", () => {
    process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = "1";
    expect(probeStatus(false)).toBe(200);

    process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = "true";
    expect(probeStatus(false)).toBe(503);
  });

  it("retries the database connection when the boot-time connect left no pool", async () => {
    const released: string[] = [];
    const mod: any = {
      pool: null,
      reconnectDatabase: async () => {
        mod.pool = { connect: async () => ({ release: () => released.push("ok") }) };
        return true;
      },
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(true);
    expect(released).toEqual(["ok"]);
  });

  it("stays down when the reconnect also fails", async () => {
    let attempts = 0;
    const mod = { pool: null, reconnectDatabase: async () => (attempts++, false) };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(false);
    expect(attempts).toBe(1);
  });

  it("drops a pool that died after boot and rebuilds it, instead of staying at 503 until a restart", async () => {
    // 2026-10-20: the live pool lost Neon; dbReady stayed true, reconnect
    // short-circuited, /healthz read 503 for nine hours.
    const log: string[] = [];
    const mod: any = {
      pool: { connect: async () => { throw new Error("Connection terminated unexpectedly"); } },
      markDatabaseDown: (reason: string) => { log.push(`down:${reason}`); mod.pool = null; },
      reconnectDatabase: async () => {
        log.push("reconnect");
        mod.pool = { connect: async () => ({ release: () => log.push("released") }) };
        return true;
      },
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(true);
    expect(log).toEqual(["down:Connection terminated unexpectedly", "reconnect", "released"]);
  });

  it("stays down, pool dropped, when the rebuild also fails", async () => {
    const mod: any = {
      pool: { connect: async () => { throw new Error("endpoint has been disabled"); } },
      markDatabaseDown: () => { mod.pool = null; },
      reconnectDatabase: async () => false,
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(false);
    expect(mod.pool).toBeNull();
  });

  it("answers false within the timeout when a connect never settles, so /healthz cannot hang", async () => {
    let marked = false;
    const mod: any = {
      pool: { connect: () => new Promise(() => {}) },
      markDatabaseDown: () => { marked = true; mod.pool = null; },
      reconnectDatabase: async () => false,
    };
    const started = Date.now();
    expect(await databaseAcceptsConnections(async () => mod, 50)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(marked).toBe(true);
  });

  it("does not reconnect when a pool already exists", async () => {
    let attempts = 0;
    const mod = {
      pool: { connect: async () => ({ release() {} }) },
      reconnectDatabase: async () => (attempts++, true),
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(true);
    expect(attempts).toBe(0);
  });
});
