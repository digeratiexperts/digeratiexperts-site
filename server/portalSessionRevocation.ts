/**
 * Server-side revocation of portal JWTs (#242).
 *
 * Two durable mechanisms, both checked synchronously by authMiddleware from
 * in-memory state that is loaded at boot and written through to Postgres:
 *  - per-token: logout revokes the presented token (keyed by its SHA-256, so
 *    legacy tokens without a jti are covered too) until the token's own expiry;
 *  - per-user: `sessionsValidAfter` on the portal user rejects every token
 *    issued earlier (password reset signs the account out everywhere).
 * Account disable already fails closed in authMiddleware and stays authoritative.
 */
import { createHash } from "node:crypto";
import { gt, lt } from "drizzle-orm";
import { db, dbReady, initPromise } from "./db";
import { portalRevokedSessions } from "@shared/schema";
import { PortalPersistenceError, memoryOnlyWritesAllowed } from "./portalAuthStore";

/** token hash -> expiry (epoch ms) */
const revoked = new Map<string, number>();

export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function prune(now: number): void {
  for (const [hash, exp] of revoked) if (exp <= now) revoked.delete(hash);
}

/** Load unexpired revocations at boot so a restart does not resurrect a logged-out token. */
export async function loadRevokedSessions(now: Date = new Date()): Promise<void> {
  await initPromise;
  if (!dbReady || !db) return;
  try {
    const rows = await db.select().from(portalRevokedSessions).where(gt(portalRevokedSessions.expiresAt, now));
    for (const row of rows as Array<{ tokenHash: string; expiresAt: Date }>) {
      revoked.set(row.tokenHash, new Date(row.expiresAt).getTime());
    }
    await db.delete(portalRevokedSessions).where(lt(portalRevokedSessions.expiresAt, now));
  } catch (err: any) {
    console.error("[session-revocation] load failed:", err?.message || err);
  }
}

export function isTokenRevoked(token: string, now: number = Date.now()): boolean {
  prune(now);
  return revoked.has(tokenFingerprint(token));
}

/**
 * True when `iat` (seconds) predates the user's cutoff. Fail closed: a cutoff
 * with no usable iat rejects. Strictly-earlier only, so a login completed in the
 * same second as the reset is not signed out by it.
 */
export function issuedBeforeCutoff(iat: unknown, cutoff: Date | string | null | undefined): boolean {
  if (!cutoff) return false;
  const cutoffSec = Math.floor(new Date(cutoff).getTime() / 1000);
  if (!Number.isFinite(cutoffSec)) return false;
  if (typeof iat !== "number" || !Number.isFinite(iat)) return true;
  return iat < cutoffSec;
}

/** Cutoff value for "invalidate everything issued so far". */
export function cutoffNow(now: Date = new Date()): Date {
  return new Date(Math.floor(now.getTime() / 1000) * 1000);
}

/**
 * Revoke a token. The in-memory revocation always applies immediately; the durable
 * write must succeed or this throws, so the caller can say the revocation may not
 * survive a restart instead of pretending it will.
 */
export async function revokeToken(token: string, opts: { userId?: string | null; expiresAtSec?: number | null }): Promise<void> {
  const hash = tokenFingerprint(token);
  const expMs = (opts.expiresAtSec ? opts.expiresAtSec * 1000 : Date.now() + 24 * 60 * 60 * 1000) + 1000;
  revoked.set(hash, expMs);
  await initPromise;
  if (!dbReady || !db) {
    if (!memoryOnlyWritesAllowed()) throw new PortalPersistenceError();
    return;
  }
  try {
    await db
      .insert(portalRevokedSessions)
      .values({ tokenHash: hash, userId: opts.userId ?? null, expiresAt: new Date(expMs) })
      .onConflictDoNothing();
  } catch (err: any) {
    console.error("[session-revocation] persist failed:", err?.message || err);
    throw new PortalPersistenceError();
  }
}

export function resetRevocationsForTests(): void {
  if (process.env.VITEST !== "true") throw new Error("resetRevocationsForTests is test-only");
  revoked.clear();
}
