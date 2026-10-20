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
        mod.pool = { connect: async () => ({ release: () => released.push("ok"), query: async () => ({ rows: [] }) }) };
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

  it("does not reconnect when a pool already exists", async () => {
    let attempts = 0;
    const mod = {
      pool: { connect: async () => ({ release() {}, query: async () => ({ rows: [] }) }) },
      reconnectDatabase: async () => (attempts++, true),
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(true);
    expect(attempts).toBe(0);
  });

  // 2026-10-20 (#657): the pool existed, its sockets were dead, and nothing
  // ever gave the process a reason to reconnect.
  it("marks the database down when the probe query fails on an existing pool", async () => {
    const releasedWith: unknown[] = [];
    const downReasons: string[] = [];
    const mod = {
      pool: {
        connect: async () => ({
          release: (error?: Error) => releasedWith.push(error),
          query: async () => { throw new Error("Connection terminated unexpectedly"); },
        }),
      },
      reconnectDatabase: async () => true,
      markDatabaseDown: (reason: string) => downReasons.push(reason),
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(false);
    expect(releasedWith).toHaveLength(1);
    expect(releasedWith[0]).toBeInstanceOf(Error);
    expect(downReasons).toEqual(["health probe: Connection terminated unexpectedly"]);
  });

  it("marks the database down when the probe stalls past its deadline", async () => {
    const downReasons: string[] = [];
    const mod = {
      pool: {
        connect: async () => ({ release() {}, query: () => new Promise<never>(() => {}) }),
      },
      reconnectDatabase: async () => true,
      markDatabaseDown: (reason: string) => downReasons.push(reason),
    };
    expect(await databaseAcceptsConnections(async () => mod, 20)).toBe(false);
    expect(downReasons).toEqual(["health probe: database probe query did not finish within 20ms"]);
  });

  it("marks the database down when connecting to an existing pool stalls", async () => {
    const downReasons: string[] = [];
    const mod = {
      pool: { connect: () => new Promise<never>(() => {}) },
      reconnectDatabase: async () => true,
      markDatabaseDown: (reason: string) => downReasons.push(reason),
    };
    expect(await databaseAcceptsConnections(async () => mod, 20)).toBe(false);
    expect(downReasons).toEqual(["health probe: database connect did not finish within 20ms"]);
  });

  it("does not mark anything down when there was no pool to begin with", async () => {
    let marked = 0;
    const mod = {
      pool: null,
      reconnectDatabase: async () => false,
      markDatabaseDown: () => { marked++; },
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(false);
    expect(marked).toBe(0);
  });
});
