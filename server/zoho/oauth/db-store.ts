/**
 * Postgres-backed ZohoTokenStore over `zoho_oauth_tokens`
 * (migrations/0017_zoho_oauth_tokens.sql).
 *
 * The website keeps running without a database (server/db.ts memory mode), so
 * this store falls back to memory whenever the database or the table is not
 * there: tokens are then cached for the life of the process only, exactly as
 * before this store existed.
 *
 * Refresh and access tokens are encrypted at rest (enc:v1, AES-256-GCM, same
 * format as server/portalMfaCrypto.ts) with ZOHO_TOKEN_ENCRYPTION_KEY, falling
 * back to MFA_ENCRYPTION_KEY, which production already requires.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { db, dbReady } from "../../db";
import { fingerprint } from "./manager";
import {
  MemoryZohoTokenStore,
  type StoredZohoCredential,
  type ZohoAuthStatus,
  type ZohoGrantInput,
  type ZohoStatePatch,
  type ZohoTokenState,
  type ZohoTokenStore,
} from "./store";

const PREFIX = "enc:v1:";
const STATUSES = new Set<ZohoAuthStatus>(["ok", "degraded", "revoked", "client_error"]);
let developmentKey: Buffer | null = null;

function encryptionKey(): Buffer {
  const configured = (process.env.ZOHO_TOKEN_ENCRYPTION_KEY || process.env.MFA_ENCRYPTION_KEY || "").trim();
  if (configured) return createHash("sha256").update(configured, "utf8").digest();
  if (process.env.NODE_ENV === "production") {
    throw new Error("ZOHO_TOKEN_ENCRYPTION_KEY (or MFA_ENCRYPTION_KEY) must be set before Zoho tokens can be stored");
  }
  developmentKey ||= randomBytes(32);
  return developmentKey;
}

export function encryptZohoSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptZohoSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) throw new Error("Zoho token is not encrypted");
  const parts = stored.slice(PREFIX.length).split(".");
  if (parts.length !== 3) throw new Error("Invalid encrypted Zoho token");
  const [iv, tag, ciphertext] = parts.map((value) => Buffer.from(value, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** A value we cannot decrypt (key rotated) is a cache miss, never an error page. */
function decryptOrNull(v: unknown): string | null {
  const raw = typeof v === "string" ? v.trim() : "";
  if (!raw) return null;
  try {
    return decryptZohoSecret(raw);
  } catch {
    return null;
  }
}

const rows = (result: any): any[] => (Array.isArray(result) ? result : result?.rows ?? []);
const date = (v: unknown): Date | null => (v ? new Date(v as string) : null);
const text = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

function toState(r: any): ZohoTokenState {
  const status = r.auth_status as ZohoAuthStatus | null;
  return {
    clientId: text(r.client_id),
    apiDomain: text(r.api_domain),
    accessToken: decryptOrNull(r.access_token),
    accessExpiresAt: date(r.access_expires_at),
    authStatus: status && STATUSES.has(status) ? status : null,
    lastError: text(r.last_error),
    lastErrorAt: date(r.last_error_at),
    lastSuccessAt: date(r.last_success_at),
    nextAttemptAt: date(r.next_attempt_at),
    failureCount: Number(r.failure_count) || 0,
  };
}

const COLUMNS: Record<keyof ZohoStatePatch, string> = {
  clientId: "client_id",
  apiDomain: "api_domain",
  orgId: "org_id",
  accessToken: "access_token",
  accessExpiresAt: "access_expires_at",
  authStatus: "auth_status",
  lastError: "last_error",
  lastErrorAt: "last_error_at",
  lastSuccessAt: "last_success_at",
  nextAttemptAt: "next_attempt_at",
  failureCount: "failure_count",
};

function patchValues(patch: ZohoStatePatch): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(patch) as Array<[keyof ZohoStatePatch, unknown]>) {
    if (value === undefined) continue;
    out.push([COLUMNS[key], key === "accessToken" && typeof value === "string" ? encryptZohoSecret(value) : value]);
  }
  return out;
}

const envProvider = (fp: string) => `env:${fp}`;

export class DbZohoTokenStore implements ZohoTokenStore {
  async read(provider: string): Promise<StoredZohoCredential | null> {
    const [r] = rows(await db.execute(sql`SELECT * FROM zoho_oauth_tokens WHERE provider = ${provider} LIMIT 1`));
    const refreshToken = r ? decryptOrNull(r.refresh_token) : null;
    if (!r || !refreshToken) return null;
    return {
      ...toState(r),
      provider: String(r.provider),
      refreshToken,
      orgId: text(r.org_id),
      accountsServer: text(r.accounts_server),
      scope: text(r.scope),
    };
  }

  async saveGrant(input: ZohoGrantInput): Promise<void> {
    const refresh = input.refreshToken.trim();
    const access = input.accessToken ? encryptZohoSecret(input.accessToken) : null;
    const lastSuccessAt = input.accessToken ? new Date() : null;
    await db.execute(sql`
      INSERT INTO zoho_oauth_tokens (
        provider, refresh_token, refresh_fingerprint, client_id, org_id, api_domain, accounts_server, scope,
        access_token, access_expires_at, auth_status, last_error, last_error_at, last_success_at,
        next_attempt_at, failure_count, updated_at
      ) VALUES (
        ${input.provider}, ${encryptZohoSecret(refresh)}, ${fingerprint(refresh)}, ${input.clientId},
        ${input.orgId ?? null}, ${input.apiDomain ?? null}, ${input.accountsServer ?? null}, ${input.scope ?? null},
        ${access}, ${input.accessExpiresAt ?? null}, 'ok', NULL, NULL, ${lastSuccessAt}, NULL, 0, now()
      )
      ON CONFLICT (provider) DO UPDATE SET
        refresh_token = EXCLUDED.refresh_token,
        refresh_fingerprint = EXCLUDED.refresh_fingerprint,
        client_id = EXCLUDED.client_id,
        org_id = EXCLUDED.org_id,
        api_domain = EXCLUDED.api_domain,
        accounts_server = EXCLUDED.accounts_server,
        scope = EXCLUDED.scope,
        access_token = EXCLUDED.access_token,
        access_expires_at = EXCLUDED.access_expires_at,
        auth_status = 'ok',
        last_error = NULL,
        last_error_at = NULL,
        last_success_at = EXCLUDED.last_success_at,
        next_attempt_at = NULL,
        failure_count = 0,
        updated_at = now()
    `);
  }

  async patch(provider: string, refreshToken: string, patch: ZohoStatePatch): Promise<void> {
    const values = patchValues(patch);
    if (!values.length) return;
    const sets = sql.join(
      [...values.map(([column, value]) => sql`${sql.identifier(column)} = ${value}`), sql`updated_at = now()`],
      sql`, `,
    );
    // Only while the stored grant is still this refresh token (a reconnect wins).
    await db.execute(sql`
      UPDATE zoho_oauth_tokens SET ${sets}
      WHERE provider = ${provider} AND refresh_fingerprint = ${fingerprint(refreshToken)}
    `);
  }

  async remove(provider: string): Promise<void> {
    await db.execute(sql`DELETE FROM zoho_oauth_tokens WHERE provider = ${provider}`);
  }

  async readState(fp: string): Promise<ZohoTokenState | null> {
    const [r] = rows(await db.execute(sql`SELECT * FROM zoho_oauth_tokens WHERE provider = ${envProvider(fp)} LIMIT 1`));
    return r ? toState(r) : null;
  }

  async writeState(fp: string, patch: ZohoStatePatch): Promise<void> {
    const { orgId: _orgId, ...rest } = patch;
    const values = patchValues(rest);
    if (!values.length) return;
    const columns = sql.join(values.map(([column]) => sql.identifier(column)), sql`, `);
    const inserts = sql.join(values.map(([, value]) => sql`${value}`), sql`, `);
    const updates = sql.join(
      [...values.map(([column]) => sql`${sql.identifier(column)} = EXCLUDED.${sql.identifier(column)}`), sql`updated_at = now()`],
      sql`, `,
    );
    await db.execute(sql`
      INSERT INTO zoho_oauth_tokens (provider, refresh_fingerprint, ${columns})
      VALUES (${envProvider(fp)}, ${fp}, ${inserts})
      ON CONFLICT (provider) DO UPDATE SET ${updates}
    `);
  }
}

/**
 * The database store while the database and table are there, memory otherwise.
 * Never throws for a missing database: token caching just stays in-process.
 */
export class ResilientZohoTokenStore implements ZohoTokenStore {
  readonly memory = new MemoryZohoTokenStore();
  private readonly database = new DbZohoTokenStore();
  private tableChecked: boolean | null = null;

  private async useDb(): Promise<boolean> {
    if (!dbReady || !db) return false;
    if (this.tableChecked !== null) return this.tableChecked;
    try {
      const [r] = rows(await db.execute(sql`SELECT to_regclass('public.zoho_oauth_tokens') AS present`));
      this.tableChecked = Boolean(r?.present);
      if (!this.tableChecked) {
        console.error("[zoho-oauth] table zoho_oauth_tokens is missing; run `npm run db:migrate` (migrations/0017_zoho_oauth_tokens.sql). Tokens are cached in memory only.");
      }
    } catch (error: any) {
      console.warn("[zoho-oauth] could not verify zoho_oauth_tokens:", error?.message || error);
      return false;
    }
    return this.tableChecked;
  }

  private async pick(): Promise<ZohoTokenStore> {
    return (await this.useDb()) ? this.database : this.memory;
  }

  async read(provider: string) {
    return (await this.pick()).read(provider);
  }
  async saveGrant(input: ZohoGrantInput) {
    return (await this.pick()).saveGrant(input);
  }
  async patch(provider: string, refreshToken: string, patch: ZohoStatePatch) {
    return (await this.pick()).patch(provider, refreshToken, patch);
  }
  async remove(provider: string) {
    return (await this.pick()).remove(provider);
  }
  async readState(fp: string) {
    return (await this.pick()).readState(fp);
  }
  async writeState(fp: string, patch: ZohoStatePatch) {
    return (await this.pick()).writeState(fp, patch);
  }
}
