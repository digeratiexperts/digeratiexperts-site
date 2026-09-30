import { createHash } from "crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  findBackupCodeIndex,
  generateBackupCodes,
  prepareBackupCodesForStorage,
} from "./portalMfaCrypto";

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
    process.env.MFA_ENCRYPTION_KEY = "test-key-with-enough-entropy-for-the-test";
    const stored = prepareBackupCodesForStorage(["ABC123", "DEF456"]);
    expect(stored.join(" ")).not.toContain("ABC123");
    expect(stored[0]).toMatch(/^hmac-sha256:v1:/);
    expect(findBackupCodeIndex(stored, "abc123")).toBe(0);
    expect(findBackupCodeIndex(stored, "wrong")).toBe(-1);
  });

  it("verifies legacy sha256 backup codes without re-hashing either prefix", () => {
    process.env.MFA_ENCRYPTION_KEY = "test-key-with-enough-entropy-for-the-test";
    const legacy = `sha256:v1:${createHash("sha256").update("ABC123", "utf8").digest("hex")}`;
    const hmac = prepareBackupCodesForStorage(["DEF456"])[0];

    // Neither prefix is re-hashed on the way back into storage.
    expect(prepareBackupCodesForStorage([legacy, hmac])).toEqual([legacy, hmac]);

    // Legacy rows verify against plain SHA-256, HMAC rows against the keyed hash.
    expect(findBackupCodeIndex([legacy, hmac], "abc123")).toBe(0);
    expect(findBackupCodeIndex([legacy, hmac], "def456")).toBe(1);
    expect(findBackupCodeIndex([legacy, hmac], "wrong")).toBe(-1);
  });

  it("issues 10-character hex backup codes", () => {
    const codes = generateBackupCodes(8);
    expect(codes).toHaveLength(8);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{10}$/);
    }
  });

  it("fails closed without an encryption key in production", () => {
    process.env.NODE_ENV = "production";
    expect(() => encryptTotpSecret("secret")).toThrow(/MFA_ENCRYPTION_KEY/);
  });
});
