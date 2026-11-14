import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  MemoryPortalMfaBackupCodeRepository,
  PortalMfaConfigurationError,
  consumePortalMfaBackupCodeFromRepository,
  decryptPortalTotpSecret,
  encryptPortalTotpSecret,
  generatePortalMfaBackupCodes,
  hashPortalMfaBackupCode,
  protectPortalMfaRecordForStorage,
  verifyPortalMfaBackupCode,
} from "./portalMfaSecurity";

function productionMfaEnv(): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    PORTAL_MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64url"),
  };
}

describe("portal MFA secret protection", () => {
  it("encrypts TOTP seeds with a user-bound authenticated envelope", () => {
    const env = productionMfaEnv();
    const plaintext = "JBSWY3DPEHPK3PXP";
    const encrypted = encryptPortalTotpSecret("user-1", plaintext, env);

    expect(encrypted).not.toContain(plaintext);
    expect(encrypted).toMatch(/^mfa-totp:v1:/);
    expect(decryptPortalTotpSecret("user-1", encrypted, env)).toBe(plaintext);
    expect(() => decryptPortalTotpSecret("user-2", encrypted, env)).toThrow();
  });

  it("fails closed in production when the dedicated MFA key is missing", () => {
    const env = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
    expect(() => encryptPortalTotpSecret("user-1", "secret", env)).toThrow(
      PortalMfaConfigurationError,
    );
  });

  it("stores only keyed recovery-code hashes while returning high-entropy display codes", () => {
    const env = productionMfaEnv();
    const [displayCode] = generatePortalMfaBackupCodes(1);
    const stored = hashPortalMfaBackupCode(displayCode, env);

    expect(displayCode).toMatch(/^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2}$/);
    expect(stored).toMatch(/^mfa-backup:v1:/);
    expect(stored).not.toContain(displayCode.replaceAll("-", ""));
    expect(verifyPortalMfaBackupCode(displayCode.toLowerCase(), stored, env)).toBe(true);
    expect(verifyPortalMfaBackupCode("WRONG-CODE-0000", stored, env)).toBe(false);
  });

  it("converts legacy plaintext seeds and backup codes before persistence", () => {
    const env = productionMfaEnv();
    const protectedRecord = protectPortalMfaRecordForStorage(
      "user-legacy",
      "LEGACY-TOTP-SEED",
      ["ABC123", "DEF456"],
      env,
    );

    expect(protectedRecord.mfaTotpSecret).toMatch(/^mfa-totp:v1:/);
    expect(protectedRecord.mfaTotpSecret).not.toContain("LEGACY-TOTP-SEED");
    expect(protectedRecord.mfaBackupCodes).toHaveLength(2);
    expect(protectedRecord.mfaBackupCodes.every((code) => code.startsWith("mfa-backup:v1:"))).toBe(true);
    expect(verifyPortalMfaBackupCode("abc123", protectedRecord.mfaBackupCodes[0], env)).toBe(true);
  });

  it("rewraps TOTP seeds while retaining old keyed backup codes during rotation", () => {
    const oldKey = randomBytes(32).toString("base64url");
    const newKey = randomBytes(32).toString("base64url");
    const oldEnv = {
      NODE_ENV: "production",
      PORTAL_MFA_ENCRYPTION_KEY: oldKey,
    } as NodeJS.ProcessEnv;
    const rotatingEnv = {
      NODE_ENV: "production",
      PORTAL_MFA_ENCRYPTION_KEY: newKey,
      PORTAL_MFA_PREVIOUS_ENCRYPTION_KEYS: oldKey,
    } as NodeJS.ProcessEnv;
    const oldSecret = encryptPortalTotpSecret("user-1", "ROTATE-ME", oldEnv);
    const oldBackupHash = hashPortalMfaBackupCode("ABCD-EFGH-JKLM", oldEnv);

    const rotated = protectPortalMfaRecordForStorage(
      "user-1",
      oldSecret,
      [oldBackupHash],
      rotatingEnv,
    );

    expect(rotated.mfaTotpSecret).not.toBe(oldSecret);
    expect(decryptPortalTotpSecret("user-1", rotated.mfaTotpSecret!, rotatingEnv)).toBe("ROTATE-ME");
    expect(verifyPortalMfaBackupCode("ABCD-EFGH-JKLM", rotated.mfaBackupCodes[0], rotatingEnv)).toBe(true);
  });

  it("allows exactly one concurrent consumer for a one-time recovery code", async () => {
    const env = productionMfaEnv();
    const displayCode = "ABCD-EFGH-JKLM";
    const repository = new MemoryPortalMfaBackupCodeRepository([
      hashPortalMfaBackupCode(displayCode, env),
    ]);

    const results = await Promise.all([
      consumePortalMfaBackupCodeFromRepository(repository, "user-1", displayCode, env),
      consumePortalMfaBackupCodeFromRepository(repository, "user-1", displayCode, env),
    ]);

    expect(results.filter((result) => result.consumed)).toHaveLength(1);
    expect(repository.snapshot()).toEqual([]);
  });
});
