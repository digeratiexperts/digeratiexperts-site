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
import { db, dbGeneration, dbReady, markDatabaseDown } from "../../db";
import { isDeadlineError, withDeadline } from "../../deadline";
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
 * How long one token-store statement may take before the store gives up on
 * the database for that call. /api/health and /api/zoho/desk/status both
 * read this store; on 2026-10-20 (#657) those reads hung for hours on a
 * pool whose sockets the database had dropped, and both endpoints answered
 * nothing at all. Below the pg query_timeout in db.ts so the caller gets an
 * answer first.
 */
const DB_STORE_TIMEOUT_MS = 8_000;
let dbStoreTimeoutMs = DB_STORE_TIMEOUT_MS;

export function setZohoTokenStoreTimeoutForTests(ms?: number): void {
  dbStoreTimeoutMs = ms ?? DB_STORE_TIMEOUT_MS;
}

/**
 * Messages from pg and pg-pool for a server that is not there. Server-side
 * cancellations ("canceling statement due to statement timeout", 57014;
 * "terminating connection due to idle-in-transaction timeout", 25P03) are
 * deliberately absent: the server is up and answering, and one cancelled
 * statement must not end the whole pool. "terminating connection due to
 * administrator command" is caught by its code (57P01) below.
 */
const OUTAGE_MESSAGE = /ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE|Connection terminated|connection to server|endpoint has been disabled|timeout exceeded when trying to connect|Query read timeout|Cannot use a pool after calling end|socket hang up/i;

/**
 * Node socket codes and the Postgres SQLSTATE classes that mean the server
 * went away: 08xxx connection exceptions, 57P01..57P03 (admin shutdown,
 * crash shutdown, cannot connect now).
 */
const OUTAGE_CODE = /^(ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|EPIPE|08\d{3}|57P0[123])$/;

/**
 * A failure that means "the database is not answering", not "this statement
 * is wrong". drizzle 0.44+ wraps every driver error in DrizzleQueryError
 * ("Failed query: …") with the pg error as `cause`, and pg reports a refused
 * connect on several addresses as an AggregateError with `errors`, so the
 * message of the outermost error alone says nothing: walk `cause` and
 * `errors` (bounded, cycle-safe).
 */
/** The message of an error-like value, never throwing (a null-prototype cause has no toString). */
function messageOf(value: unknown): string {
  if (typeof value === "string") return value;
  const message = (value as { message?: unknown } | null)?.message;
  if (typeof message === "string") return message;
  try {
    return String(value);
  } catch {
    return ""; // a null-prototype cause has nothing to say
  }
}

/**
 * First non-blank line, trimmed. drizzle's "Failed query:" puts the statement
 * on the next line (the SQL templates begin with a newline), so a line that
 * ends in a colon takes the following non-blank line with it.
 */
function firstLine(message: string): string {
  const lines = message.split("\n").map((line) => line.trim());
  const index = lines.findIndex(Boolean);
  if (index < 0) return "";
  const first = lines[index];
  if (!first.endsWith(":")) return first;
  const next = lines.slice(index + 1).find(Boolean);
  return next && !next.startsWith("params:") ? `${first} ${next}` : first;
}

/** What went into `cause` (or, for Node's AggregateError, the first of `errors`). */
function underlying(error: unknown): unknown {
  const cause = (error as { cause?: unknown } | null)?.cause;
  if (cause !== undefined) return cause;
  const errors = (error as { errors?: unknown } | null)?.errors;
  return Array.isArray(errors) && errors.length ? errors[0] : undefined;
}

/** "Failed query: … <- connect ECONNREFUSED …": the wrapper and what it hides, for logs. */
export function describeDatabaseError(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current != null && !seen.has(current); depth += 1) {
    seen.add(current);
    const line = firstLine(messageOf(current));
    if (line) parts.push(line);
    current = underlying(current);
  }
  return parts.join(" <- ");
}

export function looksLikeDatabaseOutage(error: unknown): boolean {
  const seen = new Set<unknown>();
  const pending: unknown[] = [error];
  while (pending.length && seen.size < 16) {
    const current = pending.pop();
    if (current == null || seen.has(current)) continue;
    seen.add(current);
    if (isDeadlineError(current)) return true;
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && OUTAGE_CODE.test(code)) return true;
    const message = messageOf(current);
    // DrizzleQueryError's text embeds the statement and its parameters, which
    // can carry any upstream string (a Zoho error message with "socket hang
    // up" in it); only its cause is judged.
    if (!message.startsWith("Failed query:") && OUTAGE_MESSAGE.test(message)) return true;
    const cause = (current as { cause?: unknown }).cause;
    if (cause !== undefined) pending.push(cause);
    const errors = (current as { errors?: unknown }).errors;
    if (Array.isArray(errors)) pending.push(...errors);
  }
  return false;
}

/**
 * The database store while the database and table are there, memory otherwise.
 * Never throws for a missing database: token caching just stays in-process.
 * Never hangs on a dead one either: every statement has a deadline, and a
 * database that stops answering is marked down (db.ts) so the health probe
 * reconnects and this store answers from memory until then.
 */
export class ResilientZohoTokenStore implements ZohoTokenStore {
  readonly memory = new MemoryZohoTokenStore();
  private readonly database = new DbZohoTokenStore();
  private tableChecked: boolean | null = null;
  private databaseSeen = false;

  private async useDb(): Promise<boolean> {
    if (!dbReady || !db) return false;
    this.databaseSeen = true;
    if (this.tableChecked !== null) return this.tableChecked;
    const generation = dbGeneration;
    try {
      const [r] = rows(await withDeadline(
        db.execute(sql`SELECT to_regclass('public.zoho_oauth_tokens') AS present`),
        dbStoreTimeoutMs,
        "zoho token store table check",
      ));
      this.tableChecked = Boolean(r?.present);
      if (!this.tableChecked) {
        console.error("[zoho-oauth] table zoho_oauth_tokens is missing; run `npm run db:migrate` (migrations/0017_zoho_oauth_tokens.sql). Tokens are cached in memory only.");
      }
    } catch (error: any) {
      console.warn("[zoho-oauth] could not verify zoho_oauth_tokens:", describeDatabaseError(error));
      if (looksLikeDatabaseOutage(error)) markDatabaseDown(`zoho token store table check: ${describeDatabaseError(error)}`, generation);
      return false;
    }
    return this.tableChecked;
  }

  /**
   * Run `operation` on the database store with a deadline; on an outage
   * (deadline, dropped connection) mark the database down and answer from
   * memory. Any other database error is the caller's to see, as before.
   */
  private async viaDatabase<T>(label: string, operation: (store: ZohoTokenStore) => Promise<T>, onUnavailable?: () => void): Promise<T> {
    if (!(await this.useDb())) {
      // No configured database is intentional memory-only operation. A
      // configured or previously used database falling away is an outage,
      // including a cold process whose first connection never succeeded.
      if (this.databaseSeen || Boolean(process.env.DATABASE_URL)) onUnavailable?.();
      return operation(this.memory);
    }
    // Which pool this statement runs on; a failure that lands after the pool
    // was replaced must not take the replacement down (db.ts).
    const generation = dbGeneration;
    try {
      return await withDeadline(operation(this.database), dbStoreTimeoutMs, `zoho token store ${label}`);
    } catch (error: any) {
      if (!looksLikeDatabaseOutage(error)) throw error;
      onUnavailable?.();
      const message = describeDatabaseError(error);
      console.warn(`[zoho-oauth] ${label} did not reach the database (${message}); answering from memory until it reconnects`);
      markDatabaseDown(`zoho token store ${label}: ${message}`, generation);
      return operation(this.memory);
    }
  }

  async read(provider: string, onUnavailable?: () => void) {
    return this.viaDatabase("read", (store) => store.read(provider), onUnavailable);
  }
  async saveGrant(input: ZohoGrantInput) {
    return this.viaDatabase("saveGrant", (store) => store.saveGrant(input));
  }
  async patch(provider: string, refreshToken: string, patch: ZohoStatePatch) {
    return this.viaDatabase("patch", (store) => store.patch(provider, refreshToken, patch));
  }
  async remove(provider: string) {
    return this.viaDatabase("remove", (store) => store.remove(provider));
  }
  async readState(fp: string, onUnavailable?: () => void) {
    return this.viaDatabase("readState", (store) => store.readState(fp), onUnavailable);
  }
  async writeState(fp: string, patch: ZohoStatePatch) {
    return this.viaDatabase("writeState", (store) => store.writeState(fp, patch));
  }
}
