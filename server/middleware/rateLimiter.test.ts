import { describe, expect, it } from "vitest";
import type { Request } from "express";

import { portalAccountRateLimitKey } from "./rateLimiter";

function request(body: Record<string, unknown>, ip = "203.0.113.10"): Request {
  return { body, ip } as Request;
}

describe("portalAccountRateLimitKey", () => {
  it("normalizes equivalent account identifiers without retaining the email", () => {
    const first = portalAccountRateLimitKey(request({ email: " User@Example.COM " }));
    const second = portalAccountRateLimitKey(request({ email: "user@example.com" }, "198.51.100.2"));

    expect(first).toBe(second);
    expect(first).not.toContain("user@example.com");
  });

  it("separates different accounts and falls back to a normalized IP key", () => {
    expect(portalAccountRateLimitKey(request({ email: "one@example.com" })))
      .not.toBe(portalAccountRateLimitKey(request({ email: "two@example.com" })));
    expect(portalAccountRateLimitKey(request({}))).toMatch(/^ip:/);
  });
});
