// Turnstile with no TURNSTILE_SECRET_KEY (2026-11-04 review): production fails
// closed, development stays permissive, and the only production exception is
// CI's memory-only smoke run, which a real (database-backed) deployment cannot
// satisfy. These tests pin that decision at the middleware and at boot.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import {
  TURNSTILE_UNCONFIGURED_ERROR,
  resetTurnstileUnconfiguredLogForTests,
  turnstileUnconfiguredMode,
  verifyTurnstile,
} from "./security";
import { collectProductionConfigWarnings } from "../production.config";

const KEYS = ["NODE_ENV", "TURNSTILE_SECRET_KEY", "TURNSTILE_ENFORCE", "DE_SMOKE_ALLOW_MEMORY_ONLY", "DATABASE_URL"] as const;

function fakeRes() {
  const res: { statusCode: number; body: unknown; status: (c: number) => typeof res; json: (b: unknown) => typeof res } = {
    statusCode: 200,
    body: undefined,
    status(code) { res.statusCode = code; return res; },
    json(body) { res.body = body; return res; },
  };
  return res;
}

async function run(body: Record<string, unknown> = {}) {
  const req = { body, headers: {}, ip: "203.0.113.9", originalUrl: "/api/portal/login" } as unknown as Request;
  const res = fakeRes();
  const next = vi.fn() as unknown as NextFunction;
  await verifyTurnstile(req, res as unknown as Response, next);
  return { res, next: next as unknown as ReturnType<typeof vi.fn> };
}

describe("Turnstile with no secret key", () => {
  const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    resetTurnstileUnconfiguredLogForTests();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("production rejects the protected form with a clear 503, even with a token", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://example/db";
    const { res, next } = await run({ email: "a@example.com", turnstileToken: "anything" });
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: TURNSTILE_UNCONFIGURED_ERROR, code: "TURNSTILE_UNCONFIGURED" });
  });

  it("production logs the misconfiguration once, not on every request", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://example/db";
    await run();
    await run();
    await run();
    const rejectLogs = errorSpy.mock.calls.filter((c) => String(c[0]).includes("TURNSTILE_UNCONFIGURED_REJECT"));
    expect(rejectLogs).toHaveLength(1);
  });

  it("the smoke flag alone does not open production when a database is configured", async () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://example/db";
    process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = "1";
    expect(turnstileUnconfiguredMode()).toBe("reject");
    const { res, next } = await run();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
  });

  it("CI's memory-only production smoke (flag and no database) passes through", async () => {
    process.env.NODE_ENV = "production";
    process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = "1";
    expect(turnstileUnconfiguredMode()).toBe("ci-smoke-bypass");
    const { next } = await run();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("development stays permissive", async () => {
    process.env.NODE_ENV = "development";
    const { next } = await run();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("an unset NODE_ENV (tests, local tools) stays permissive", async () => {
    const { next } = await run();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("TURNSTILE_ENFORCE=1 fails closed outside production too, and beats the smoke bypass", async () => {
    process.env.TURNSTILE_ENFORCE = "1";
    expect(turnstileUnconfiguredMode()).toBe("reject");
    process.env.NODE_ENV = "production";
    process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = "1";
    expect(turnstileUnconfiguredMode()).toBe("reject");
    const { res, next } = await run();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
  });

  it("the boot warning says production refuses the forms", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgres://example/db";
    const warning = collectProductionConfigWarnings().find((w) => w.startsWith("TURNSTILE_SECRET_KEY"));
    expect(warning).toMatch(/fails closed/);
    expect(warning).toMatch(/REFUSED/);
    expect(warning).not.toMatch(/fails open/);
  });

  it("the boot warning names the CI smoke exception when that is what applies", () => {
    process.env.NODE_ENV = "production";
    process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = "1";
    const warning = collectProductionConfigWarnings().find((w) => w.startsWith("TURNSTILE_SECRET_KEY"));
    expect(warning).toMatch(/CI memory-only smoke run only/);
  });

  it("a configured secret is not affected: a missing token is still refused with 400", async () => {
    process.env.NODE_ENV = "production";
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    vi.doMock("../portalLoginKnocksStore", () => ({ recordLoginKnock: vi.fn(), clientIpFromReq: () => "203.0.113.9" }));
    const { res, next } = await run();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    vi.doUnmock("../portalLoginKnocksStore");
  });
});
