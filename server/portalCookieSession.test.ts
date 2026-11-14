import { describe, expect, it, vi } from "vitest";
import {
  PORTAL_AUTH_COOKIE,
  PORTAL_SESSION_COOKIE,
  clearPortalSessionCookies,
  createPortalSession,
  revokePortalSession,
  revokePortalUserSessions,
  rotatePortalSession,
  setPortalSessionCookies,
  validatePortalSessionBinding,
  type PortalSessionRecord,
} from "./portalCookieSession";
import {
  MemoryPortalSessionRepository,
  createPortalSessionMemoryState,
  validatePortalRepositorySessionBinding,
} from "./portalSessionRepository";

function responseDouble() {
  return {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
}

describe("portal cookie sessions", () => {
  it("sets both secrets as HttpOnly cookies without exposing a response payload", () => {
    const res = responseDouble();

    expect(setPortalSessionCookies(res as never, "session-1", "jwt-1")).toBeUndefined();
    expect(res.cookie).toHaveBeenCalledTimes(2);
    expect(res.cookie).toHaveBeenCalledWith(
      PORTAL_SESSION_COOKIE,
      "session-1",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      PORTAL_AUTH_COOKIE,
      "jwt-1",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" }),
    );
    for (const call of res.cookie.mock.calls) {
      expect(call[2]).not.toHaveProperty("domain");
    }
  });

  it("requires the cookie, JWT claim, live record, and user identity to match", () => {
    const sessions = new Map<string, PortalSessionRecord>();
    createPortalSession(sessions, "user-1", {
      now: 1_000,
      sessionIdFactory: () => "session-1",
    });

    expect(
      validatePortalSessionBinding({
        sessions,
        cookieSessionId: "session-1",
        tokenSessionId: "session-1",
        tokenUserId: "user-1",
        now: 2_000,
      }),
    ).toMatchObject({ ok: true, sessionId: "session-1" });

    expect(
      validatePortalSessionBinding({
        sessions,
        cookieSessionId: undefined,
        tokenSessionId: "session-1",
        tokenUserId: "user-1",
        now: 2_000,
      }),
    ).toEqual({ ok: false, reason: "missing_session_cookie" });

    expect(
      validatePortalSessionBinding({
        sessions,
        cookieSessionId: "session-1",
        tokenSessionId: "different-session",
        tokenUserId: "user-1",
        now: 2_000,
      }),
    ).toEqual({ ok: false, reason: "session_mismatch" });
  });

  it("rotates impersonation sessions and makes logout revocation immediate", () => {
    const sessions = new Map<string, PortalSessionRecord>();
    createPortalSession(sessions, "admin-1", {
      now: 1_000,
      sessionIdFactory: () => "before-impersonation",
    });

    const rotated = rotatePortalSession(sessions, "before-impersonation", "admin-1", {
      now: 2_000,
      sessionIdFactory: () => "during-impersonation",
    });

    expect(sessions.has("before-impersonation")).toBe(false);
    expect(rotated.sessionId).toBe("during-impersonation");
    expect(
      validatePortalSessionBinding({
        sessions,
        cookieSessionId: rotated.sessionId,
        tokenSessionId: rotated.sessionId,
        tokenUserId: "admin-1",
        now: 3_000,
      }).ok,
    ).toBe(true);

    revokePortalSession(sessions, rotated.sessionId);
    expect(
      validatePortalSessionBinding({
        sessions,
        cookieSessionId: rotated.sessionId,
        tokenSessionId: rotated.sessionId,
        tokenUserId: "admin-1",
        now: 3_000,
      }),
    ).toEqual({ ok: false, reason: "session_not_found" });
  });

  it("revokes every active session for a user after a security-sensitive change", () => {
    const sessions = new Map<string, PortalSessionRecord>();
    createPortalSession(sessions, "user-1", { sessionIdFactory: () => "user-1-a" });
    createPortalSession(sessions, "user-1", { sessionIdFactory: () => "user-1-b" });
    createPortalSession(sessions, "user-2", { sessionIdFactory: () => "user-2-a" });

    expect(revokePortalUserSessions(sessions, "user-1")).toBe(2);
    expect(sessions.has("user-1-a")).toBe(false);
    expect(sessions.has("user-1-b")).toBe(false);
    expect(sessions.has("user-2-a")).toBe(true);
  });

  it("survives a process restart through shared durable state", async () => {
    const sharedState = createPortalSessionMemoryState();
    const firstProcess = new MemoryPortalSessionRepository(sharedState);
    const restartedProcess = new MemoryPortalSessionRepository(sharedState);
    const now = new Date("2026-08-23T12:00:00.000Z");
    const created = await firstProcess.create("user-1", {
      now,
      sessionIdFactory: () => "restart-safe-session-00000001",
    });

    await expect(
      validatePortalRepositorySessionBinding({
        repository: restartedProcess,
        cookieSessionId: created.sessionId,
        tokenSessionId: created.sessionId,
        tokenUserId: "user-1",
        now: new Date(now.getTime() + 1_000),
      }),
    ).resolves.toMatchObject({ ok: true, sessionId: created.sessionId });

    await expect(
      validatePortalRepositorySessionBinding({
        repository: restartedProcess,
        cookieSessionId: created.sessionId,
        tokenSessionId: created.sessionId,
        tokenUserId: "user-2",
        now: new Date(now.getTime() + 1_000),
      }),
    ).resolves.toEqual({ ok: false, reason: "session_user_mismatch" });

    expect(await restartedProcess.revoke(created.sessionId, now)).toBe(true);
    await expect(
      validatePortalRepositorySessionBinding({
        repository: firstProcess,
        cookieSessionId: created.sessionId,
        tokenSessionId: created.sessionId,
        tokenUserId: "user-1",
        now: new Date(now.getTime() + 1_000),
      }),
    ).resolves.toEqual({ ok: false, reason: "session_revoked" });
  });

  it("clears current and legacy portal cookies on logout", () => {
    const res = responseDouble();
    clearPortalSessionCookies(res as never);

    expect(res.clearCookie).toHaveBeenCalledWith(PORTAL_AUTH_COOKIE, expect.any(Object));
    expect(res.clearCookie).toHaveBeenCalledWith(PORTAL_SESSION_COOKIE, expect.any(Object));
    expect(res.clearCookie).toHaveBeenCalledWith("sessionId", expect.any(Object));
    for (const call of res.clearCookie.mock.calls) {
      expect(call[1]).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
      expect(call[1]).not.toHaveProperty("maxAge");
      expect(call[1]).not.toHaveProperty("domain");
    }
  });
});
