import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

const ENCRYPTED_PREFIX = "enc:v1:";
const HASH_PREFIX = "hmac-sha256:v1:";
// Rows written before the HMAC migration. They stay verifiable and are never re-hashed.
const LEGACY_HASH_PREFIX = "sha256:v1:";
let developmentKey: Buffer | null = null;

function encryptionKey(): Buffer {
  const configured = process.env.MFA_ENCRYPTION_KEY?.trim();
  if (configured) return createHash("sha256").update(configured, "utf8").digest();
  if (process.env.NODE_ENV === "production") {
    throw new Error("MFA_ENCRYPTION_KEY must be set in production before MFA secrets can be stored");
  }
  developmentKey ||= randomBytes(32);
  return developmentKey;
}

export function encryptTotpSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  if (secret.startsWith(ENCRYPTED_PREFIX)) return secret;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `${ENCRYPTED_PREFIX}${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptTotpSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  // Compatibility for existing rows. They are encrypted on the next write.
  if (!stored.startsWith(ENCRYPTED_PREFIX)) return stored;
  const parts = stored.slice(ENCRYPTED_PREFIX.length).split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted MFA secret");
  const [iv, tag, ciphertext] = parts.map((value) => Buffer.from(value, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase();
}

export function hashBackupCode(code: string): string {
  return `${HASH_PREFIX}${createHmac("sha256", encryptionKey()).update(normalizeBackupCode(code), "utf8").digest("hex")}`;
}

function hashBackupCodeLegacy(code: string): string {
  return `${LEGACY_HASH_PREFIX}${createHash("sha256").update(normalizeBackupCode(code), "utf8").digest("hex")}`;
}

export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString("hex").toUpperCase());
}

export function prepareBackupCodesForStorage(codes: string[]): string[] {
  return codes.map((code) =>
    code.startsWith(HASH_PREFIX) || code.startsWith(LEGACY_HASH_PREFIX) ? code : hashBackupCode(code),
  );
}

export function findBackupCodeIndex(storedCodes: string[], candidate: string): number {
  const candidateHash = hashBackupCode(candidate);
  const legacyCandidateHash = hashBackupCodeLegacy(candidate);
  return storedCodes.findIndex((stored) => {
    // Legacy rows are verified against plain SHA-256; everything else against the HMAC.
    const isLegacy = stored.startsWith(LEGACY_HASH_PREFIX);
    const expected = isLegacy ? legacyCandidateHash : candidateHash;
    const normalized = isLegacy || stored.startsWith(HASH_PREFIX) ? stored : hashBackupCode(stored);
    const left = Buffer.from(normalized);
    const right = Buffer.from(expected);
    return left.length === right.length && timingSafeEqual(left, right);
  });
}
