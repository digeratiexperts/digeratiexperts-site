import { describe, expect, it } from "vitest";
import {
  evaluatePassword,
  hasRepeatedRun,
  hasSequentialRun,
  passwordPolicyError,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "./passwordPolicy";

const failing = (pw: string, ctx = {}) => evaluatePassword(pw, ctx).filter((r) => !r.ok).map((r) => r.id);

describe("password policy", () => {
  it("accepts a password that meets every rule", () => {
    expect(failing("Harbor7Lantern!")).toEqual([]);
    expect(passwordPolicyError("Harbor7Lantern!")).toBeNull();
  });

  it("allows spaces and symbols (passphrases)", () => {
    expect(failing("Copper kettle 4 tea")).toEqual([]);
  });

  it("enforces length bounds", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
    expect(failing("Hrb7Lnt!x")).toContain("minLength");
    expect(failing("Hrb7Lnt!xq")).not.toContain("minLength");
    expect(failing("Hb7" + "x".repeat(PASSWORD_MAX_LENGTH)).includes("maxLength")).toBe(true);
  });

  it("requires a number, an uppercase and a lowercase letter", () => {
    expect(failing("HarborLantern!")).toEqual(["number"]);
    expect(failing("harbor7lantern!")).toEqual(["uppercase"]);
    expect(failing("HARBOR7LANTERN!")).toEqual(["lowercase"]);
  });

  it("rejects three of the same character in a row", () => {
    expect(hasRepeatedRun("Harbor7Laaantern")).toBe(true);
    expect(hasRepeatedRun("Harbor777x")).toBe(true);
    expect(hasRepeatedRun("Harbor77Lantern")).toBe(false);
  });

  it("rejects three letters or digits in sequence, either direction", () => {
    for (const pw of ["xxABCx", "x123x", "zyx", "x987", "XyZ"]) expect(hasSequentialRun(pw)).toBe(true);
    for (const pw of ["Harbor7Lantern", "a1b2c3", "ab-c", "12a3"]) expect(hasSequentialRun(pw)).toBe(false);
  });

  it("rejects the email, username, name or company name", () => {
    const ctx = { email: "pat.lee@acme-corp.com", username: "patlee", fullName: "Pat Lee", companyName: "Digerati Experts" };
    expect(failing("Patlee7Harbor!", ctx)).toEqual(["noPersonal"]);
    expect(failing("Harbor7Acme!xq", ctx)).toEqual(["noPersonal"]);
    expect(failing("Harbor7Digeratiexperts", ctx)).toEqual(["noPersonal"]);
    expect(failing("Harbor7Lantern!", ctx)).toEqual([]);
  });

  it("names the first broken rule in the server message", () => {
    expect(passwordPolicyError("short")).toBe("Password must be at least 10 characters.");
  });
});
