import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNotNull, isNull, lte, or } from "drizzle-orm";
import { portalSessions } from "@shared/schema";
import { db, dbReady } from "./db";
import { PORTAL_SESSION_EXPIRY_MS } from "./portalCookieSession";

export type PortalSessionRecord = {
  sessionHash: string;
  userId: string;
  createdAt: Date;
  lastRotatedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type CreatedPortalSession = {
  /** Opaque bearer-equivalent value delivered only through an HttpOnly cookie. */
  sessionId: string;
  record: PortalSessionRecord;
};

export type PortalSessionMutationOptions = {
  now?: Date;
  maxAgeMs?: number;
  sessionIdFactory?: () => string;
};

export interface PortalSessionRepository {
  create(userId: string, options?: PortalSessionMutationOptions): Promise<CreatedPortalSession>;
  find(sessionId: string): Promise<PortalSessionRecord | null>;
  rotate(
    currentSessionId: string | null | undefined,
    userId: string,
    options?: PortalSessionMutationOptions,
  ): Promise<CreatedPortalSession>;
  revoke(sessionId: string | null | undefined, now?: Date): Promise<boolean>;
  revokeAllForUser(userId: string, now?: Date): Promise<number>;
  cleanup(now?: Date, revokedRetentionMs?: number): Promise<number>;
}

export type PortalSessionBindingResult =
  | { ok: true; sessionId: string; session: PortalSessionRecord }
  | {
      ok: false;
      reason:
        | "missing_session_cookie"
        | "missing_session_claim"
        | "session_mismatch"
        | "session_not_found"
        | "session_expired"
        | "session_revoked"
        | "session_user_mismatch";
    };

export async function validatePortalRepositorySessionBinding(input: {
  repository: PortalSessionRepository;
  cookieSessionId: unknown;
  tokenSessionId: string | null | undefined;
  tokenUserId: string;
  now?: Date;
}): Promise<PortalSessionBindingResult> {
  if (typeof input.cookieSessionId !== "string" || !input.cookieSessionId.trim()) {
    return { ok: false, reason: "missing_session_cookie" };
  }
  if (!input.tokenSessionId) return { ok: false, reason: "missing_session_claim" };

  const sessionId = input.cookieSessionId.trim();
  if (sessionId !== input.tokenSessionId) return { ok: false, reason: "session_mismatch" };

  const session = await input.repository.find(sessionId);
  if (!session) return { ok: false, reason: "session_not_found" };
  if (session.revokedAt) return { ok: false, reason: "session_revoked" };
  if ((input.now ?? new Date()).getTime() >= session.expiresAt.getTime()) {
    return { ok: false, reason: "session_expired" };
  }
  if (session.userId !== input.tokenUserId) {
    return { ok: false, reason: "session_user_mismatch" };
  }

  return { ok: true, sessionId, session };
}

export function hashPortalSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId, "utf8").digest("hex");
}

function createOpaqueSessionId(): string {
  return randomBytes(32).toString("base64url");
}

function buildSession(
  userId: string,
  options: PortalSessionMutationOptions = {},
): CreatedPortalSession {
  const now = options.now ?? new Date();
  const maxAgeMs = options.maxAgeMs ?? PORTAL_SESSION_EXPIRY_MS;
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    throw new Error("Portal session max age must be a positive finite duration");
  }

  const sessionId = (options.sessionIdFactory ?? createOpaqueSessionId)();
  if (!sessionId || sessionId.length < 16) {
    throw new Error("Portal session identifiers must contain at least 16 characters");
  }

  return {
    sessionId,
    record: {
      sessionHash: hashPortalSessionId(sessionId),
      userId,
      createdAt: new Date(now),
      lastRotatedAt: new Date(now),
      expiresAt: new Date(now.getTime() + maxAgeMs),
      revokedAt: null,
    },
  };
}

function cloneRecord(record: PortalSessionRecord): PortalSessionRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    lastRotatedAt: new Date(record.lastRotatedAt),
    expiresAt: new Date(record.expiresAt),
    revokedAt: record.revokedAt ? new Date(record.revokedAt) : null,
  };
}

export type PortalSessionMemoryState = {
  /** Keys are SHA-256 digests, never raw session IDs. */
  records: Map<string, PortalSessionRecord>;
};

export function createPortalSessionMemoryState(): PortalSessionMemoryState {
  return { records: new Map<string, PortalSessionRecord>() };
}

/** Explicit non-production/test adapter. Never selected for production. */
export class MemoryPortalSessionRepository implements PortalSessionRepository {
  constructor(private readonly state = createPortalSessionMemoryState()) {}

  async create(
    userId: string,
    options: PortalSessionMutationOptions = {},
  ): Promise<CreatedPortalSession> {
    const created = buildSession(userId, options);
    if (this.state.records.has(created.record.sessionHash)) {
      throw new Error("Portal session identifier collision");
    }
    this.state.records.set(created.record.sessionHash, cloneRecord(created.record));
    return { sessionId: created.sessionId, record: cloneRecord(created.record) };
  }

  async find(sessionId: string): Promise<PortalSessionRecord | null> {
    const found = this.state.records.get(hashPortalSessionId(sessionId));
    return found ? cloneRecord(found) : null;
  }

  async rotate(
    currentSessionId: string | null | undefined,
    userId: string,
    options: PortalSessionMutationOptions = {},
  ): Promise<CreatedPortalSession> {
    const created = buildSession(userId, options);
    if (this.state.records.has(created.record.sessionHash)) {
      throw new Error("Portal session identifier collision");
    }

    if (currentSessionId) {
      const currentHash = hashPortalSessionId(currentSessionId);
      const current = this.state.records.get(currentHash);
      const now = new Date(options.now ?? new Date());
      if (
        !current ||
        current.userId !== userId ||
        current.revokedAt ||
        current.expiresAt.getTime() <= now.getTime()
      ) {
        throw new Error("Current portal session cannot be rotated");
      }
      current.revokedAt = now;
    }
    this.state.records.set(created.record.sessionHash, cloneRecord(created.record));
    return { sessionId: created.sessionId, record: cloneRecord(created.record) };
  }

  async revoke(sessionId: string | null | undefined, now = new Date()): Promise<boolean> {
    if (!sessionId) return false;
    const record = this.state.records.get(hashPortalSessionId(sessionId));
    if (!record || record.revokedAt) return false;
    record.revokedAt = new Date(now);
    return true;
  }

  async revokeAllForUser(userId: string, now = new Date()): Promise<number> {
    let revoked = 0;
    for (const record of this.state.records.values()) {
      if (record.userId !== userId || record.revokedAt) continue;
      record.revokedAt = new Date(now);
      revoked += 1;
    }
    return revoked;
  }

  async cleanup(now = new Date(), revokedRetentionMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const revokedCutoff = now.getTime() - revokedRetentionMs;
    let removed = 0;
    for (const [sessionHash, record] of this.state.records.entries()) {
      const expired = record.expiresAt.getTime() <= now.getTime();
      const oldRevocation = !!record.revokedAt && record.revokedAt.getTime() <= revokedCutoff;
      if (!expired && !oldRevocation) continue;
      this.state.records.delete(sessionHash);
      removed += 1;
    }
    return removed;
  }
}

type DrizzleDatabase = any;

function rowToRecord(row: typeof portalSessions.$inferSelect): PortalSessionRecord {
  return {
    sessionHash: row.sessionHash,
    userId: row.userId,
    createdAt: row.createdAt,
    lastRotatedAt: row.lastRotatedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

async function insertSession(
  database: DrizzleDatabase,
  created: CreatedPortalSession,
): Promise<void> {
  await database.insert(portalSessions).values(created.record);
}

export class PostgresPortalSessionRepository implements PortalSessionRepository {
  constructor(private readonly database: DrizzleDatabase) {
    if (!database) throw new Error("Portal session PostgreSQL adapter requires a database");
  }

  async create(
    userId: string,
    options: PortalSessionMutationOptions = {},
  ): Promise<CreatedPortalSession> {
    const created = buildSession(userId, options);
    await insertSession(this.database, created);
    return created;
  }

  async find(sessionId: string): Promise<PortalSessionRecord | null> {
    const [row] = await this.database
      .select()
      .from(portalSessions)
      .where(eq(portalSessions.sessionHash, hashPortalSessionId(sessionId)))
      .limit(1);
    return row ? rowToRecord(row) : null;
  }

  async rotate(
    currentSessionId: string | null | undefined,
    userId: string,
    options: PortalSessionMutationOptions = {},
  ): Promise<CreatedPortalSession> {
    const created = buildSession(userId, options);
    const revokedAt = options.now ?? new Date();
    await this.database.transaction(async (transaction: DrizzleDatabase) => {
      if (currentSessionId) {
        const revoked = await transaction
          .update(portalSessions)
          .set({ revokedAt })
          .where(
            and(
              eq(portalSessions.sessionHash, hashPortalSessionId(currentSessionId)),
              eq(portalSessions.userId, userId),
              isNull(portalSessions.revokedAt),
              gt(portalSessions.expiresAt, revokedAt),
            ),
          )
          .returning({ sessionHash: portalSessions.sessionHash });
        if (revoked.length !== 1) {
          throw new Error("Current portal session cannot be rotated");
        }
      }
      await insertSession(transaction, created);
    });
    return created;
  }

  async revoke(sessionId: string | null | undefined, now = new Date()): Promise<boolean> {
    if (!sessionId) return false;
    const rows = await this.database
      .update(portalSessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(portalSessions.sessionHash, hashPortalSessionId(sessionId)),
          isNull(portalSessions.revokedAt),
        ),
      )
      .returning({ sessionHash: portalSessions.sessionHash });
    return rows.length > 0;
  }

  async revokeAllForUser(userId: string, now = new Date()): Promise<number> {
    const rows = await this.database
      .update(portalSessions)
      .set({ revokedAt: now })
      .where(and(eq(portalSessions.userId, userId), isNull(portalSessions.revokedAt)))
      .returning({ sessionHash: portalSessions.sessionHash });
    return rows.length;
  }

  async cleanup(now = new Date(), revokedRetentionMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const revokedCutoff = new Date(now.getTime() - revokedRetentionMs);
    const rows = await this.database
      .delete(portalSessions)
      .where(
        or(
          lte(portalSessions.expiresAt, now),
          and(isNotNull(portalSessions.revokedAt), lte(portalSessions.revokedAt, revokedCutoff)),
        ),
      )
      .returning({ sessionHash: portalSessions.sessionHash });
    return rows.length;
  }
}

export function createRuntimePortalSessionRepository(): PortalSessionRepository {
  if (dbReady && db) return new PostgresPortalSessionRepository(db);

  const environment = process.env.NODE_ENV || "development";
  if (environment === "production") {
    throw new Error("Portal sessions require PostgreSQL in production");
  }
  if (environment !== "test" && process.env.PORTAL_AUTH_USE_MEMORY !== "true") {
    throw new Error(
      "Portal session memory mode is disabled; set PORTAL_AUTH_USE_MEMORY=true explicitly for local development",
    );
  }

  return new MemoryPortalSessionRepository();
}
