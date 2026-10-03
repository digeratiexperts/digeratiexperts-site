/**
 * Durable single-use tokens for email verification and password reset (#251, #241).
 *
 * - Only the SHA-256 of a token is stored; the raw value exists in the emailed link.
 * - Consuming is one atomic UPDATE: a token works exactly once, and an expired,
 *   consumed or revoked token never matches.
 * - Issuing revokes older unconsumed tokens of the same purpose for that user.
 * - No database: production fails closed (PortalPersistenceError); dev/test fall
 *   back to a process-local map so local work and unit tests keep running.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, dbReady, initPromise } from "./db";
import { portalAuthTokens } from "@shared/schema";
import { PortalPersistenceError, memoryOnlyWritesAllowed } from "./portalAuthStore";

export type AuthTokenPurpose = "email_verification" | "password_reset";

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export type ConsumeResult =
  | { ok: true; id: string; userId: string; email: string }
  | { ok: false; reason: "invalid" | "expired" };

type TokenRow = {
  id: string;
  purpose: string;
  tokenHash: string;
  userId: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
};

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function normEmail(email: string): string {
  return email.trim().toLowerCase();
}

interface Repo {
  insert(row: TokenRow): Promise<void>;
  revokeActive(purpose: string, userId: string, now: Date): Promise<void>;
  consume(tokenHash: string, purpose: string, now: Date): Promise<TokenRow | undefined>;
  find(tokenHash: string, purpose: string): Promise<TokenRow | undefined>;
  release(id: string): Promise<void>;
  latestActiveCreatedAt(purpose: string, email: string, now: Date): Promise<Date | undefined>;
}

const memRows = new Map<string, TokenRow>();

const memRepo: Repo = {
  async insert(row) {
    memRows.set(row.id, row);
  },
  async revokeActive(purpose, userId, now) {
    for (const r of memRows.values()) {
      if (r.purpose === purpose && r.userId === userId && !r.consumedAt && !r.revokedAt) r.revokedAt = now;
    }
  },
  async consume(tokenHash, purpose, now) {
    for (const r of memRows.values()) {
      if (r.tokenHash === tokenHash && r.purpose === purpose && !r.consumedAt && !r.revokedAt && r.expiresAt > now) {
        r.consumedAt = now;
        return { ...r };
      }
    }
    return undefined;
  },
  async find(tokenHash, purpose) {
    for (const r of memRows.values()) if (r.tokenHash === tokenHash && r.purpose === purpose) return { ...r };
    return undefined;
  },
  async release(id) {
    const r = memRows.get(id);
    if (r) r.consumedAt = null;
  },
  async latestActiveCreatedAt(purpose, email, now) {
    let best: Date | undefined;
    for (const r of memRows.values()) {
      if (r.purpose !== purpose || r.email !== email || r.consumedAt || r.revokedAt || r.expiresAt <= now) continue;
      if (!best || r.createdAt > best) best = r.createdAt;
    }
    return best;
  },
};

const pgRepo: Repo = {
  async insert(row) {
    await db!.insert(portalAuthTokens).values({
      id: row.id,
      purpose: row.purpose,
      tokenHash: row.tokenHash,
      userId: row.userId,
      email: row.email,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    });
  },
  async revokeActive(purpose, userId, now) {
    await db!
      .update(portalAuthTokens)
      .set({ revokedAt: now })
      .where(
        and(
          eq(portalAuthTokens.purpose, purpose),
          eq(portalAuthTokens.userId, userId),
          isNull(portalAuthTokens.consumedAt),
          isNull(portalAuthTokens.revokedAt),
        ),
      );
  },
  async consume(tokenHash, purpose, now) {
    const rows = await db!
      .update(portalAuthTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(portalAuthTokens.tokenHash, tokenHash),
          eq(portalAuthTokens.purpose, purpose),
          isNull(portalAuthTokens.consumedAt),
          isNull(portalAuthTokens.revokedAt),
          gt(portalAuthTokens.expiresAt, now),
        ),
      )
      .returning();
    return rows[0] as TokenRow | undefined;
  },
  async find(tokenHash, purpose) {
    const rows = await db!
      .select()
      .from(portalAuthTokens)
      .where(and(eq(portalAuthTokens.tokenHash, tokenHash), eq(portalAuthTokens.purpose, purpose)))
      .limit(1);
    return rows[0] as TokenRow | undefined;
  },
  async release(id) {
    await db!.update(portalAuthTokens).set({ consumedAt: null }).where(eq(portalAuthTokens.id, id));
  },
  async latestActiveCreatedAt(purpose, email, now) {
    const rows = await db!
      .select({ createdAt: portalAuthTokens.createdAt })
      .from(portalAuthTokens)
      .where(
        and(
          eq(portalAuthTokens.purpose, purpose),
          eq(portalAuthTokens.email, email),
          isNull(portalAuthTokens.consumedAt),
          isNull(portalAuthTokens.revokedAt),
          gt(portalAuthTokens.expiresAt, now),
        ),
      )
      .orderBy(desc(portalAuthTokens.createdAt))
      .limit(1);
    return rows[0]?.createdAt as Date | undefined;
  },
};

async function repo(): Promise<Repo> {
  await initPromise;
  if (dbReady && db) return pgRepo;
  if (!memoryOnlyWritesAllowed()) throw new PortalPersistenceError();
  return memRepo;
}

async function guarded<T>(fn: (r: Repo) => Promise<T>): Promise<T> {
  const r = await repo();
  try {
    return await fn(r);
  } catch (err: any) {
    if (err instanceof PortalPersistenceError) throw err;
    console.error("[portalAuthTokens] database error:", err?.message || err);
    throw new PortalPersistenceError();
  }
}

/** Mint a token, revoking older active tokens of the same purpose for that user. Returns the raw token for the emailed link. */
export async function issueAuthToken(opts: {
  purpose: AuthTokenPurpose;
  userId: string;
  email: string;
  ttlMs: number;
  now?: Date;
}): Promise<string> {
  const now = opts.now ?? new Date();
  const raw = randomBytes(32).toString("hex");
  await guarded(async (r) => {
    await r.revokeActive(opts.purpose, opts.userId, now);
    await r.insert({
      id: randomBytes(16).toString("hex"),
      purpose: opts.purpose,
      tokenHash: hashToken(raw),
      userId: opts.userId,
      email: normEmail(opts.email),
      createdAt: now,
      expiresAt: new Date(now.getTime() + opts.ttlMs),
      consumedAt: null,
      revokedAt: null,
    });
  });
  return raw;
}

/** Atomically use a token once. Distinguishes expired from unknown/used/revoked for the caller's message only. */
export async function consumeAuthToken(
  purpose: AuthTokenPurpose,
  raw: string,
  now: Date = new Date(),
): Promise<ConsumeResult> {
  if (typeof raw !== "string" || raw.length < 16 || raw.length > 256) return { ok: false, reason: "invalid" };
  const tokenHash = hashToken(raw);
  return guarded(async (r) => {
    const row = await r.consume(tokenHash, purpose, now);
    if (row) return { ok: true as const, id: row.id, userId: row.userId, email: row.email };
    const existing = await r.find(tokenHash, purpose);
    if (existing && !existing.consumedAt && !existing.revokedAt && existing.expiresAt <= now) {
      return { ok: false as const, reason: "expired" as const };
    }
    return { ok: false as const, reason: "invalid" as const };
  });
}

/** Undo a consume when the work it unlocked could not be saved, so the user can retry the same link. */
export async function releaseAuthToken(id: string): Promise<void> {
  await guarded((r) => r.release(id));
}

/** Was an active token for this email minted within `cooldownMs`? (resend cooldown) */
export async function hasFreshAuthToken(
  purpose: AuthTokenPurpose,
  email: string,
  cooldownMs: number,
  now: Date = new Date(),
): Promise<boolean> {
  const created = await guarded((r) => r.latestActiveCreatedAt(purpose, normEmail(email), now));
  return Boolean(created) && now.getTime() - created!.getTime() < cooldownMs;
}

export function resetAuthTokensForTests(): void {
  if (process.env.VITEST !== "true") throw new Error("resetAuthTokensForTests is test-only");
  memRows.clear();
}
