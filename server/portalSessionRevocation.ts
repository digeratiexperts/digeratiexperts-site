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
import { memoryOnlySmokeAllowed } from "./healthProbe";

/** token hash -> expiry (epoch ms) */
const revoked = new Map<string, number>();

export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function prune(now: number): void {
  for (const [hash, exp] of revoked) if (exp <= now) revoked.delete(hash);
}

/**
 * Authentication readiness (#393). A token can only be checked against the
 * durable revocation set once that set is in memory; until then an empty map
 * would resurrect every logged-out token. So authMiddleware refuses
 * authenticated requests (503) unless the state is "ready". A failed load
 * retries with backoff; pruning expired rows is separate and cannot undo a
 * successful load.
 *
 * Under Vitest the state starts "ready" so suites that call authMiddleware
 * without booting the server keep working; the readiness tests reset it.
 */
export type RevocationLoadState = "pending" | "ready" | "failed";
let loadState: RevocationLoadState = process.env.VITEST === "true" ? "ready" : "pending";
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelayMs = 2_000;
const MAX_RETRY_MS = 60_000;

export function revocationsReady(): boolean {
  return loadState === "ready";
}

/** For /api/health: the state only, never the set. */
export function revocationLoadState(): RevocationLoadState {
  return loadState;
}

function scheduleRetry(): void {
  if (retryTimer) return;
  const delay = retryDelayMs;
  retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_MS);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void loadRevokedSessions();
  }, delay);
  retryTimer.unref?.();
}

/** Load unexpired revocations at boot so a restart does not resurrect a logged-out token. */
export async function loadRevokedSessions(now: Date = new Date()): Promise<void> {
  await initPromise;
  if (!dbReady || !db) {
    // Development and the CI memory-only smoke keep revocations in memory only;
    // there is no durable set to load. Production without the database has a
    // durable set it cannot read: fail closed.
    if (memoryOnlyWritesAllowed() || memoryOnlySmokeAllowed()) {
      loadState = "ready";
    } else {
      loadState = "failed";
      console.error("[session-revocation] database unavailable; authenticated requests refused until loaded");
      scheduleRetry();
    }
    return;
  }
  try {
    const rows = await db.select().from(portalRevokedSessions).where(gt(portalRevokedSessions.expiresAt, now));
    for (const row of rows as Array<{ tokenHash: string; expiresAt: Date }>) {
      revoked.set(row.tokenHash, new Date(row.expiresAt).getTime());
    }
  } catch (err: any) {
    loadState = "failed";
    console.error(
      "[session-revocation] load failed; authenticated requests refused until loaded:",
      err?.message || err,
    );
    scheduleRetry();
    return;
  }
  loadState = "ready";
  retryDelayMs = 2_000;
  try {
    await db.delete(portalRevokedSessions).where(lt(portalRevokedSessions.expiresAt, now));
  } catch (err: any) {
    // Expired rows are inert; a failed cleanup must not undo readiness.
    console.warn("[session-revocation] prune failed:", err?.message || err);
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
 *
 * Residual window (#393, documented, accepted): JWT `iat` has whole-second
 * resolution, so a token minted earlier in the same second as the reset also
 * survives. Reaching it needs a successful login inside that one second before
 * the reset completes; the token's own logout still revokes it by hash.
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

export function resetRevocationsForTests(opts: { loadState?: RevocationLoadState } = {}): void {
  if (process.env.VITEST !== "true") throw new Error("resetRevocationsForTests is test-only");
  revoked.clear();
  loadState = opts.loadState ?? "ready";
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  retryDelayMs = 2_000;
}
