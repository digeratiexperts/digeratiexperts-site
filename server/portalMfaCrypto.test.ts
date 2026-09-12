import { afterEach, describe, expect, it } from "vitest";
import { decryptTotpSecret, encryptTotpSecret, findBackupCodeIndex, prepareBackupCodesForStorage } from "./portalMfaCrypto";

afterEach(() => {
  delete process.env.MFA_ENCRYPTION_KEY;
  process.env.NODE_ENV = "test";
});

describe("portal MFA storage protection", () => {
  it("encrypts TOTP secrets and authenticates the ciphertext", () => {
    process.env.MFA_ENCRYPTION_KEY = "test-key-with-enough-entropy-for-the-test";
    const encrypted = encryptTotpSecret("JBSWY3DPEHPK3PXP")!;
    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptTotpSecret(encrypted)).toBe("JBSWY3DPEHPK3PXP");
    const [prefixAndIv, tag, ciphertext] = encrypted.split(".");
    const replacement = ciphertext[0] === "A" ? "B" : "A";
    expect(() => decryptTotpSecret(`${prefixAndIv}.${tag}.${replacement}${ciphertext.slice(1)}`)).toThrow();
  });

  it("stores backup codes as hashes and accepts each code once", () => {
    const stored = prepareBackupCodesForStorage(["ABC123", "DEF456"]);
    expect(stored.join(" ")).not.toContain("ABC123");
    expect(findBackupCodeIndex(stored, "abc123")).toBe(0);
    expect(findBackupCodeIndex(stored, "wrong")).toBe(-1);
  });

  it("fails closed without an encryption key in production", () => {
    process.env.NODE_ENV = "production";
    expect(() => encryptTotpSecret("secret")).toThrow(/MFA_ENCRYPTION_KEY/);
  });
});
