// Turnstile siteverify has a time budget (2026-11-06 backlog). A hung Cloudflare
// call must end in the verify-error branch, not hold the request open. In
// production that branch answers 500 (fail closed); in development it keeps the
// existing permissive next().
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { TURNSTILE_VERIFY_TIMEOUT_MS, verifyTurnstile } from "./security";

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

async function run(token = "real-token") {
  const req = {
    body: { email: "a@example.com", turnstileToken: token },
    headers: {},
    ip: "203.0.113.9",
    originalUrl: "/api/portal/register",
  } as unknown as Request;
  const res = fakeRes();
  const next = vi.fn() as unknown as NextFunction;
  await verifyTurnstile(req, res as unknown as Response, next);
  return { res, next: next as unknown as ReturnType<typeof vi.fn> };
}

describe("Turnstile siteverify timeout", () => {
  const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    vi.unstubAllGlobals();
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("gives the siteverify call an abort signal with the budget", async () => {
    let seenSignal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      seenSignal = init.signal as AbortSignal;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }));
    process.env.NODE_ENV = "production";
    const { next } = await run();
    expect(next).toHaveBeenCalledTimes(1);
    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(seenSignal!.aborted).toBe(false);
    expect(TURNSTILE_VERIFY_TIMEOUT_MS).toBe(8000);
  });

  it("production fails closed with 500 when siteverify times out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }));
    process.env.NODE_ENV = "production";
    const { res, next } = await run();
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ message: "Security verification unavailable. Please try again." });
  });

  it("development still lets the request through when siteverify fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    }));
    process.env.NODE_ENV = "development";
    const { next } = await run();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
