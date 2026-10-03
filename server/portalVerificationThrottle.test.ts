import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasFreshVerificationToken, RESEND_COOLDOWN_MS, type VerificationTokenRecord } from "./portalVerificationThrottle";

describe("hasFreshVerificationToken", () => {
  const now = 1_000_000_000_000;
  const rec = (p: Partial<VerificationTokenRecord>): VerificationTokenRecord => ({ email: "v@a.test", createdAt: now, expiresAt: now + 86_400_000, ...p });

  it("is true when a token for the email was minted within the cooldown", () => {
    expect(hasFreshVerificationToken([rec({ createdAt: now - 5_000 })], "v@a.test", now)).toBe(true);
  });

  it("is false once the cooldown has elapsed", () => {
    expect(hasFreshVerificationToken([rec({ createdAt: now - RESEND_COOLDOWN_MS - 1 })], "v@a.test", now)).toBe(false);
  });

  it("ignores tokens for other emails", () => {
    expect(hasFreshVerificationToken([rec({ email: "other@a.test", createdAt: now })], "v@a.test", now)).toBe(false);
  });

  it("ignores an expired token even if just created-stamped", () => {
    expect(hasFreshVerificationToken([rec({ createdAt: now, expiresAt: now - 1 })], "v@a.test", now)).toBe(false);
  });

  it("is false with no tokens", () => {
    expect(hasFreshVerificationToken([], "v@a.test", now)).toBe(false);
  });
});

describe("the resend-verification route is protected (issue #252)", () => {
  const src = readFileSync(resolve(__dirname, "routes.ts"), "utf8");
  const route = src.slice(
    src.indexOf('app.post("/api/portal/resend-verification"'),
    src.indexOf("\n  });", src.indexOf('app.post("/api/portal/resend-verification"')),
  );

  it("mounts the form rate limiter and Turnstile, like forgot-password", () => {
    const guards = route.slice(0, route.indexOf("async"));
    expect(guards).toContain("formSubmissionRateLimiter");
    expect(guards).toContain("verifyTurnstile");
  });

  it("no longer answers a distinct 'already verified' status, which leaked account existence", () => {
    expect(route).not.toContain("Email is already verified");
    // The durable store applies the same per-email cooldown (#251).
    expect(route).toContain("hasFreshAuthToken");
    expect(route).toContain("RESEND_COOLDOWN_MS");
  });
});
