import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "crypto";

const ENCRYPTED_PREFIX = "enc:v1:";
const HASH_PREFIX = "sha256:v1:";
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

export function hashBackupCode(code: string): string {
  return `${HASH_PREFIX}${createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex")}`;
}

export function prepareBackupCodesForStorage(codes: string[]): string[] {
  return codes.map((code) => code.startsWith(HASH_PREFIX) ? code : hashBackupCode(code));
}

export function findBackupCodeIndex(storedCodes: string[], candidate: string): number {
  const candidateHash = hashBackupCode(candidate);
  return storedCodes.findIndex((stored) => {
    const normalized = stored.startsWith(HASH_PREFIX) ? stored : hashBackupCode(stored);
    const left = Buffer.from(normalized);
    const right = Buffer.from(candidateHash);
    return left.length === right.length && timingSafeEqual(left, right);
  });
}
