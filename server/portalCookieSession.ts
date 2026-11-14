import type { Response } from "express";
import { randomBytes } from "crypto";

export const PORTAL_AUTH_COOKIE = "portalAuth";
export const PORTAL_SESSION_COOKIE = "portalSession";
export const PORTAL_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export type PortalSessionRecord = {
  userId: string;
  createdAt: number;
  lastRotated: number;
  expiresAt: number;
};

type PortalSessionStore = Map<string, PortalSessionRecord>;

type SessionCreationOptions = {
  now?: number;
  maxAgeMs?: number;
  sessionIdFactory?: () => string;
};

type PortalCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  maxAge: number;
  path: "/";
};

type PortalCookieClearOptions = Omit<PortalCookieOptions, "maxAge">;

export function portalCookieOptions(maxAgeMs = PORTAL_SESSION_EXPIRY_MS): PortalCookieOptions {
  const options: PortalCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: maxAgeMs,
    path: "/",
  };

  return options;
}

function portalCookieClearOptions(): PortalCookieClearOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

export function setPortalSessionCookies(
  res: Response,
  sessionId: string,
  token: string,
  maxAgeMs = PORTAL_SESSION_EXPIRY_MS,
): void {
  const options = portalCookieOptions(maxAgeMs);
  res.cookie(PORTAL_SESSION_COOKIE, sessionId, options);
  res.cookie(PORTAL_AUTH_COOKIE, token, options);
}

export function clearPortalSessionCookies(res: Response): void {
  const options = portalCookieClearOptions();
  res.clearCookie(PORTAL_SESSION_COOKIE, options);
  res.clearCookie(PORTAL_AUTH_COOKIE, options);
  // Remove the legacy cookie after the migration so old sessions cannot linger.
  res.clearCookie("sessionId", options);
}

export function createPortalSession(
  sessions: PortalSessionStore,
  userId: string,
  options: SessionCreationOptions = {},
): { sessionId: string; record: PortalSessionRecord } {
  const now = options.now ?? Date.now();
  const maxAgeMs = options.maxAgeMs ?? PORTAL_SESSION_EXPIRY_MS;
  const sessionId = (options.sessionIdFactory ?? (() => randomBytes(32).toString("hex")))();
  const record: PortalSessionRecord = {
    userId,
    createdAt: now,
    lastRotated: now,
    expiresAt: now + maxAgeMs,
  };
  sessions.set(sessionId, record);
  return { sessionId, record };
}

export function rotatePortalSession(
  sessions: PortalSessionStore,
  currentSessionId: string | null | undefined,
  userId: string,
  options: SessionCreationOptions = {},
): { sessionId: string; record: PortalSessionRecord } {
  if (currentSessionId) sessions.delete(currentSessionId);
  return createPortalSession(sessions, userId, options);
}

export function revokePortalSession(
  sessions: PortalSessionStore,
  sessionId: string | null | undefined,
): boolean {
  return sessionId ? sessions.delete(sessionId) : false;
}

export function revokePortalUserSessions(
  sessions: PortalSessionStore,
  userId: string,
): number {
  let revoked = 0;
  for (const [sessionId, session] of sessions.entries()) {
    if (session.userId !== userId) continue;
    sessions.delete(sessionId);
    revoked += 1;
  }
  return revoked;
}

type PortalSessionBindingResult =
  | { ok: true; sessionId: string; session: PortalSessionRecord }
  | {
      ok: false;
      reason:
        | "missing_session_cookie"
        | "missing_session_claim"
        | "session_mismatch"
        | "session_not_found"
        | "session_expired"
        | "session_user_mismatch";
    };

export function validatePortalSessionBinding(input: {
  sessions: PortalSessionStore;
  cookieSessionId: unknown;
  tokenSessionId: string | null | undefined;
  tokenUserId: string;
  now?: number;
}): PortalSessionBindingResult {
  if (typeof input.cookieSessionId !== "string" || !input.cookieSessionId.trim()) {
    return { ok: false, reason: "missing_session_cookie" };
  }
  if (!input.tokenSessionId) {
    return { ok: false, reason: "missing_session_claim" };
  }

  const sessionId = input.cookieSessionId.trim();
  if (sessionId !== input.tokenSessionId) {
    return { ok: false, reason: "session_mismatch" };
  }

  const session = input.sessions.get(sessionId);
  if (!session) {
    return { ok: false, reason: "session_not_found" };
  }
  if ((input.now ?? Date.now()) >= session.expiresAt) {
    return { ok: false, reason: "session_expired" };
  }
  if (session.userId !== input.tokenUserId) {
    return { ok: false, reason: "session_user_mismatch" };
  }

  return { ok: true, sessionId, session };
}
