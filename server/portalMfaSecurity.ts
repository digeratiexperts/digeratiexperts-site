import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, sql } from "drizzle-orm";

import { portalUsers } from "@shared/schema";
import { db, dbReady } from "./db";

const TOTP_ENVELOPE_PREFIX = "mfa-totp:v1";
const BACKUP_HASH_PREFIX = "mfa-backup:v1";
const MFA_KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const BACKUP_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LOCAL_DEVELOPMENT_KEY = createHash("sha256")
  .update("digeratiexperts-portal-mfa-local-development-only", "utf8")
  .digest();

type MfaKey = { id: string; value: Buffer };

export type PortalMfaBackupCodeConsumeResult = {
  consumed: boolean;
  remainingCodes: string[];
};

export interface PortalMfaBackupCodeRepository {
  read(userId: string): Promise<string[]>;
  removeIfPresent(userId: string, storedCode: string): Promise<string[] | null>;
}

export class PortalMfaConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PortalMfaConfigurationError";
  }
}

export class PortalMfaStoreUnavailableError extends Error {
  constructor() {
    super("The authoritative MFA store is unavailable");
    this.name = "PortalMfaStoreUnavailableError";
  }
}

function keyId(value: Buffer): string {
  return createHash("sha256").update(value).digest("base64url").slice(0, 12);
}

function parseConfiguredKey(value: string, variableName: string): MfaKey {
  const normalized = value.trim();
  if (!MFA_KEY_PATTERN.test(normalized)) {
    throw new PortalMfaConfigurationError(
      `${variableName} must be an unpadded base64url-encoded 32-byte key`,
    );
  }
  const decoded = Buffer.from(normalized, "base64url");
  if (decoded.length !== 32) {
    throw new PortalMfaConfigurationError(`${variableName} must decode to exactly 32 bytes`);
  }
  return { id: keyId(decoded), value: decoded };
}

function resolveKeyRing(env: NodeJS.ProcessEnv = process.env): MfaKey[] {
  const configuredPrimary = env.PORTAL_MFA_ENCRYPTION_KEY?.trim();
  const primary = configuredPrimary
    ? parseConfiguredKey(configuredPrimary, "PORTAL_MFA_ENCRYPTION_KEY")
    : env.NODE_ENV === "production"
      ? (() => {
          throw new PortalMfaConfigurationError(
            "PORTAL_MFA_ENCRYPTION_KEY is required in production",
          );
        })()
      : { id: keyId(LOCAL_DEVELOPMENT_KEY), value: LOCAL_DEVELOPMENT_KEY };

  const previousValues = (env.PORTAL_MFA_PREVIOUS_ENCRYPTION_KEYS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const keys = [
    primary,
    ...previousValues.map((value, index) =>
      parseConfiguredKey(value, `PORTAL_MFA_PREVIOUS_ENCRYPTION_KEYS[${index}]`),
    ),
  ];
  return [...new Map(keys.map((key) => [key.id, key])).values()];
}

function totpAssociatedData(userId: string): Buffer {
  return Buffer.from(`digeratiexperts:portal-mfa:totp:v1:${userId}`, "utf8");
}

function encryptedTotpKeyId(value: string): string | null {
  if (!value.startsWith(`${TOTP_ENVELOPE_PREFIX}:`)) return null;
  const parts = value.split(":");
  return parts.length === 6 ? parts[2] : null;
}

export function encryptPortalTotpSecret(
  userId: string,
  plaintext: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!userId || !plaintext) {
    throw new PortalMfaConfigurationError("A user ID and TOTP secret are required");
  }
  const [primary] = resolveKeyRing(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", primary.value, iv);
  cipher.setAAD(totpAssociatedData(userId));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    TOTP_ENVELOPE_PREFIX,
    primary.id,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptPortalTotpSecret(
  userId: string,
  storedValue: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  if (!storedValue.startsWith(`${TOTP_ENVELOPE_PREFIX}:`)) {
    if (env.NODE_ENV === "production") {
      throw new PortalMfaConfigurationError(
        "A legacy plaintext TOTP seed reached authentication before startup protection completed",
      );
    }
    return storedValue;
  }

  const parts = storedValue.split(":");
  if (parts.length !== 6) throw new PortalMfaConfigurationError("Invalid TOTP secret envelope");
  const [, version, storedKeyId, ivText, authTagText, ciphertextText] = parts;
  if (`mfa-totp:${version}` !== TOTP_ENVELOPE_PREFIX) {
    throw new PortalMfaConfigurationError("Unsupported TOTP secret envelope version");
  }
  const key = resolveKeyRing(env).find((candidate) => candidate.id === storedKeyId);
  if (!key) {
    throw new PortalMfaConfigurationError(
      `TOTP secret requires unavailable MFA key ${storedKeyId}; configure it as a previous key`,
    );
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", key.value, Buffer.from(ivText, "base64url"));
    decipher.setAAD(totpAssociatedData(userId));
    decipher.setAuthTag(Buffer.from(authTagText, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new PortalMfaConfigurationError("TOTP secret authentication failed");
  }
}

function normalizeBackupCode(value: string): string {
  return value.trim().replace(/[\s-]+/g, "").toUpperCase();
}

function backupHashKeyId(value: string): string | null {
  if (!value.startsWith(`${BACKUP_HASH_PREFIX}:`)) return null;
  const parts = value.split(":");
  return parts.length === 4 ? parts[2] : null;
}

function backupDigest(normalizedCode: string, key: MfaKey): Buffer {
  return createHmac("sha256", key.value)
    .update("digeratiexperts:portal-mfa:backup-code:v1\0", "utf8")
    .update(normalizedCode, "utf8")
    .digest();
}

export function hashPortalMfaBackupCode(
  displayCode: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const normalized = normalizeBackupCode(displayCode);
  if (!normalized) throw new PortalMfaConfigurationError("Backup codes cannot be empty");
  const [primary] = resolveKeyRing(env);
  return `${BACKUP_HASH_PREFIX}:${primary.id}:${backupDigest(normalized, primary).toString("base64url")}`;
}

export function verifyPortalMfaBackupCode(
  candidate: string,
  storedCode: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const normalized = normalizeBackupCode(candidate);
  if (!normalized) return false;
  const storedKeyId = backupHashKeyId(storedCode);
  if (!storedKeyId) {
    if (env.NODE_ENV === "production") return false;
    const expected = Buffer.from(normalizeBackupCode(storedCode), "utf8");
    const supplied = Buffer.from(normalized, "utf8");
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  }

  const parts = storedCode.split(":");
  const storedDigest = Buffer.from(parts[3], "base64url");
  const key = resolveKeyRing(env).find((candidateKey) => candidateKey.id === storedKeyId);
  if (!key) {
    throw new PortalMfaConfigurationError(
      `Backup codes require unavailable MFA key ${storedKeyId}; configure it as a previous key`,
    );
  }
  const expectedDigest = backupDigest(normalized, key);
  return storedDigest.length === expectedDigest.length && timingSafeEqual(storedDigest, expectedDigest);
}

function randomBackupCode(): string {
  const bytes = randomBytes(12);
  const characters = Array.from(bytes, (value) => BACKUP_CODE_ALPHABET[value & 31]).join("");
  return `${characters.slice(0, 4)}-${characters.slice(4, 8)}-${characters.slice(8, 12)}`;
}

export function generatePortalMfaBackupCodes(count = 8): string[] {
  if (!Number.isSafeInteger(count) || count < 1 || count > 20) {
    throw new RangeError("Backup code count must be between 1 and 20");
  }
  return Array.from({ length: count }, () => randomBackupCode());
}

export function protectPortalMfaRecordForStorage(
  userId: string,
  mfaTotpSecret: string | null | undefined,
  mfaBackupCodes: string[] | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): { mfaTotpSecret: string | null; mfaBackupCodes: string[] } {
  const keys = resolveKeyRing(env);
  let protectedTotpSecret: string | null = mfaTotpSecret || null;
  if (protectedTotpSecret) {
    const storedKeyId = encryptedTotpKeyId(protectedTotpSecret);
    if (!storedKeyId) {
      protectedTotpSecret = encryptPortalTotpSecret(userId, protectedTotpSecret, env);
    } else {
      const plaintext = decryptPortalTotpSecret(userId, protectedTotpSecret, env);
      if (storedKeyId !== keys[0].id) {
        protectedTotpSecret = encryptPortalTotpSecret(userId, plaintext, env);
      }
    }
  }

  const protectedBackupCodes = (mfaBackupCodes || []).map((storedCode) => {
    const storedKeyId = backupHashKeyId(storedCode);
    if (!storedKeyId) return hashPortalMfaBackupCode(storedCode, env);
    if (!keys.some((key) => key.id === storedKeyId)) {
      throw new PortalMfaConfigurationError(
        `Backup codes require unavailable MFA key ${storedKeyId}; configure it as a previous key`,
      );
    }
    return storedCode;
  });

  return { mfaTotpSecret: protectedTotpSecret, mfaBackupCodes: protectedBackupCodes };
}

export class MemoryPortalMfaBackupCodeRepository implements PortalMfaBackupCodeRepository {
  private readonly codes: string[];

  constructor(codes: string[]) {
    this.codes = [...codes];
  }

  async read(): Promise<string[]> {
    return [...this.codes];
  }

  async removeIfPresent(_userId: string, storedCode: string): Promise<string[] | null> {
    const index = this.codes.indexOf(storedCode);
    if (index < 0) return null;
    this.codes.splice(index, 1);
    return [...this.codes];
  }

  snapshot(): string[] {
    return [...this.codes];
  }
}

class PostgresPortalMfaBackupCodeRepository implements PortalMfaBackupCodeRepository {
  async read(userId: string): Promise<string[]> {
    const [row] = await db
      .select({ codes: portalUsers.mfaBackupCodes })
      .from(portalUsers)
      .where(eq(portalUsers.id, userId))
      .limit(1);
    return Array.isArray(row?.codes) ? row.codes : [];
  }

  async removeIfPresent(userId: string, storedCode: string): Promise<string[] | null> {
    const [row] = await db
      .update(portalUsers)
      .set({
        mfaBackupCodes: sql`COALESCE(${portalUsers.mfaBackupCodes}, '[]'::jsonb) - ${storedCode}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(portalUsers.id, userId),
          sql`COALESCE(${portalUsers.mfaBackupCodes}, '[]'::jsonb) ? ${storedCode}`,
        ),
      )
      .returning({ codes: portalUsers.mfaBackupCodes });
    return row && Array.isArray(row.codes) ? row.codes : null;
  }
}

export async function consumePortalMfaBackupCodeFromRepository(
  repository: PortalMfaBackupCodeRepository,
  userId: string,
  candidate: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<PortalMfaBackupCodeConsumeResult> {
  const storedCodes = await repository.read(userId);
  const matchedCode = storedCodes.find((storedCode) =>
    verifyPortalMfaBackupCode(candidate, storedCode, env),
  );
  if (!matchedCode) return { consumed: false, remainingCodes: storedCodes };

  const remainingCodes = await repository.removeIfPresent(userId, matchedCode);
  return remainingCodes
    ? { consumed: true, remainingCodes }
    : { consumed: false, remainingCodes: await repository.read(userId) };
}

export async function consumePortalMfaBackupCode(
  user: { id: string; mfaBackupCodes?: string[] },
  candidate: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  if (dbReady && db) {
    try {
      const result = await consumePortalMfaBackupCodeFromRepository(
        new PostgresPortalMfaBackupCodeRepository(),
        user.id,
        candidate,
        env,
      );
      if (result.consumed) user.mfaBackupCodes = result.remainingCodes;
      return result.consumed;
    } catch (error) {
      if (error instanceof PortalMfaConfigurationError) throw error;
      throw new PortalMfaStoreUnavailableError();
    }
  }

  if (env.NODE_ENV === "production") throw new PortalMfaStoreUnavailableError();
  const repository = new MemoryPortalMfaBackupCodeRepository(user.mfaBackupCodes || []);
  const result = await consumePortalMfaBackupCodeFromRepository(
    repository,
    user.id,
    candidate,
    env,
  );
  if (result.consumed) user.mfaBackupCodes = result.remainingCodes;
  return result.consumed;
}

export async function migratePortalMfaSecretsAtRest(
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  if (!dbReady || !db) {
    if (env.NODE_ENV === "production") throw new PortalMfaStoreUnavailableError();
    return 0;
  }

  const rows = await db
    .select({
      id: portalUsers.id,
      mfaTotpSecret: portalUsers.mfaTotpSecret,
      mfaBackupCodes: portalUsers.mfaBackupCodes,
    })
    .from(portalUsers);
  let updated = 0;
  for (const initialRow of rows) {
    let row = initialRow;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existingCodes = Array.isArray(row.mfaBackupCodes) ? row.mfaBackupCodes : [];
      if (!row.mfaTotpSecret && existingCodes.length === 0) break;
      const protectedRecord = protectPortalMfaRecordForStorage(
        row.id,
        row.mfaTotpSecret,
        existingCodes,
        env,
      );
      const codesChanged = JSON.stringify(protectedRecord.mfaBackupCodes) !== JSON.stringify(existingCodes);
      if (protectedRecord.mfaTotpSecret === row.mfaTotpSecret && !codesChanged) break;

      // Compare both original values before writing so a concurrent one-time-code
      // consumption cannot be overwritten and accidentally resurrected at startup.
      const [changed] = await db
        .update(portalUsers)
        .set({
          mfaTotpSecret: protectedRecord.mfaTotpSecret,
          mfaBackupCodes: protectedRecord.mfaBackupCodes,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(portalUsers.id, row.id),
            sql`${portalUsers.mfaTotpSecret} IS NOT DISTINCT FROM ${row.mfaTotpSecret}`,
            sql`COALESCE(${portalUsers.mfaBackupCodes}, '[]'::jsonb) = ${JSON.stringify(existingCodes)}::jsonb`,
          ),
        )
        .returning({ id: portalUsers.id });
      if (changed) {
        updated += 1;
        break;
      }

      const [fresh] = await db
        .select({
          id: portalUsers.id,
          mfaTotpSecret: portalUsers.mfaTotpSecret,
          mfaBackupCodes: portalUsers.mfaBackupCodes,
        })
        .from(portalUsers)
        .where(eq(portalUsers.id, row.id))
        .limit(1);
      if (!fresh) break;
      row = fresh;
      if (attempt === 2) throw new PortalMfaStoreUnavailableError();
    }
  }
  return updated;
}
