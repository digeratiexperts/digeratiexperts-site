import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

import { verifyTurnstile } from "./security";

const originalEnvironment = process.env.NODE_ENV;
const originalSecret = process.env.TURNSTILE_SECRET_KEY;

afterEach(() => {
  if (originalEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment;
  if (originalSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = originalSecret;
  vi.restoreAllMocks();
});

function responseHarness() {
  const state: { status?: number; payload?: unknown } = {};
  const response = {
    status(code: number) {
      state.status = code;
      return response;
    },
    json(payload: unknown) {
      state.payload = payload;
      return response;
    },
  } as unknown as Response;
  return { response, state };
}

describe("verifyTurnstile", () => {
  it("fails closed when the production verification secret is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.TURNSTILE_SECRET_KEY;
    const { response, state } = responseHarness();
    const next = vi.fn() as NextFunction;

    await verifyTurnstile(
      { body: {}, ip: "203.0.113.10" } as Request,
      response,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(state).toEqual({
      status: 503,
      payload: { message: "Security verification is not configured" },
    });
  });

  it("allows an explicit non-production environment to run without the secret", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.TURNSTILE_SECRET_KEY;
    const { response, state } = responseHarness();
    const next = vi.fn() as NextFunction;

    await verifyTurnstile(
      { body: {}, ip: "127.0.0.1" } as Request,
      response,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(state).toEqual({});
  });
});
