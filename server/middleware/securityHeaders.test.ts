import { describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { setSecurityHeaders } from "./security";

function run(path: string) {
  const headers: Record<string, string> = {};
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v;
    },
    removeHeader: (k: string) => {
      delete headers[k.toLowerCase()];
    },
  } as unknown as Response;
  let nextCalled = false;
  setSecurityHeaders({ path } as Request, res, (() => {
    nextCalled = true;
  }) as NextFunction);
  return { headers, nextCalled };
}

describe("setSecurityHeaders", () => {
  it("turns the legacy XSS auditor off", () => {
    expect(run("/").headers["x-xss-protection"]).toBe("0");
  });

  it("defaults portal API responses to no-store", () => {
    expect(run("/api/portal/tickets").headers["cache-control"]).toBe("no-store");
  });

  it("leaves cache headers on other paths to their routes", () => {
    expect(run("/").headers["cache-control"]).toBeUndefined();
    expect(run("/api/payments/availability").headers["cache-control"]).toBeUndefined();
    expect(run("/portal/dashboard").headers["cache-control"]).toBeUndefined();
  });

  it("keeps the CSP's framing and plugin locks", () => {
    const { headers, nextCalled } = run("/portal/login");
    expect(nextCalled).toBe(true);
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'self'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  });
});
