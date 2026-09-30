import { afterEach, describe, expect, it } from "vitest";
import { memoryOnlySmokeAllowed, probeStatus } from "./healthProbe";

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
});
