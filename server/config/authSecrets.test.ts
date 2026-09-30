import { afterEach, describe, expect, it } from "vitest";
import { getJwtSecretOrNull, resolveJwtSecret } from "./authSecrets";

const originalEnv = process.env.NODE_ENV;
const originalSecret = process.env.JWT_SECRET;

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

describe("resolveJwtSecret", () => {
  it("returns the configured secret", () => {
    process.env.JWT_SECRET = "a-real-secret-value-that-is-long-enough";
    expect(resolveJwtSecret()).toBe("a-real-secret-value-that-is-long-enough");
  });

  it("fails closed in production when the secret is missing or a placeholder", () => {
    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/);
    expect(getJwtSecretOrNull()).toBeNull();

    process.env.JWT_SECRET = "dev-secret-key-change-in-production";
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/);
    process.env.JWT_SECRET = "CHANGE_THIS_IN_PRODUCTION";
    expect(() => resolveJwtSecret()).toThrow(/JWT_SECRET/);
  });

  it("uses one stable ephemeral secret outside production when unset", () => {
    process.env.NODE_ENV = "development";
    delete process.env.JWT_SECRET;
    const first = resolveJwtSecret();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(resolveJwtSecret()).toBe(first);
  });
});
