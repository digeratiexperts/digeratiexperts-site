import type { VerifiedPortalAuthToken } from "./authTokens";
import type { PortalAuthClient, PortalAuthUser } from "./portalAuthStore";
import { resolveLivePortalAuthorization } from "./portalLiveAuth";
import type { PortalSessionRecord, PortalSessionRepository } from "./portalSessionRepository";

export interface PortalIdentityReader {
  findUserById(userId: string): Promise<PortalAuthUser | undefined>;
  findClientById(clientId: string): Promise<PortalAuthClient | undefined>;
}

type AuthorizedPortalUser = Extract<
  ReturnType<typeof resolveLivePortalAuthorization>,
  { ok: true }
>["user"];

export type PortalRequestAuthenticationResult =
  | {
      ok: true;
      sessionId: string;
      session: PortalSessionRecord;
      user: AuthorizedPortalUser;
    }
  | {
      ok: false;
      status: 401 | 403 | 503;
      error: string;
      reason:
        | "missing_session_cookie"
        | "missing_session_claim"
        | "session_mismatch"
        | "session_not_found"
        | "session_expired"
        | "session_revoked"
        | "session_user_mismatch"
        | "live_authorization_rejected"
        | "auth_backend_unavailable";
      clearCookies: boolean;
    };

const backendUnavailable = (): PortalRequestAuthenticationResult => ({
  ok: false,
  status: 503,
  error: "Portal authentication is temporarily unavailable",
  reason: "auth_backend_unavailable",
  clearCookies: false,
});

export async function authenticatePortalRequestAuthorization(input: {
  cookieSessionId: unknown;
  token: VerifiedPortalAuthToken;
  sessions: PortalSessionRepository;
  identities: PortalIdentityReader;
  now?: Date;
}): Promise<PortalRequestAuthenticationResult> {
  if (typeof input.cookieSessionId !== "string" || !input.cookieSessionId.trim()) {
    return {
      ok: false,
      status: 401,
      error: "Portal session is invalid or expired",
      reason: "missing_session_cookie",
      clearCookies: true,
    };
  }
  if (!input.token.portalSessionId) {
    return {
      ok: false,
      status: 401,
      error: "Portal session is invalid or expired",
      reason: "missing_session_claim",
      clearCookies: true,
    };
  }

  const sessionId = input.cookieSessionId.trim();
  if (sessionId !== input.token.portalSessionId) {
    return {
      ok: false,
      status: 401,
      error: "Portal session is invalid or expired",
      reason: "session_mismatch",
      clearCookies: true,
    };
  }

  let session: PortalSessionRecord | null;
  try {
    session = await input.sessions.find(sessionId);
  } catch {
    return backendUnavailable();
  }
  if (!session) {
    return {
      ok: false,
      status: 401,
      error: "Portal session is invalid or expired",
      reason: "session_not_found",
      clearCookies: true,
    };
  }

  const now = input.now ?? new Date();
  if (session.revokedAt) {
    return {
      ok: false,
      status: 401,
      error: "Portal session is invalid or expired",
      reason: "session_revoked",
      clearCookies: true,
    };
  }
  if (now.getTime() >= session.expiresAt.getTime()) {
    try {
      await input.sessions.revoke(sessionId, now);
    } catch {
      return backendUnavailable();
    }
    return {
      ok: false,
      status: 401,
      error: "Portal session is invalid or expired",
      reason: "session_expired",
      clearCookies: true,
    };
  }
  if (session.userId !== input.token.userId) {
    try {
      await input.sessions.revoke(sessionId, now);
    } catch {
      return backendUnavailable();
    }
    return {
      ok: false,
      status: 401,
      error: "Portal session is invalid or expired",
      reason: "session_user_mismatch",
      clearCookies: true,
    };
  }

  try {
    const liveUser = await input.identities.findUserById(input.token.userId);
    const clientIds = new Set<string>();
    if (liveUser?.clientId) clientIds.add(liveUser.clientId);
    if (input.token.impersonatingCompanyId) {
      clientIds.add(String(input.token.impersonatingCompanyId));
    }

    const clients = new Map<string, PortalAuthClient>();
    for (const clientId of clientIds) {
      const client = await input.identities.findClientById(clientId);
      if (client) clients.set(clientId, client);
    }

    const authorization = resolveLivePortalAuthorization(
      input.token,
      liveUser,
      (clientId) => clients.get(clientId),
    );
    if (!authorization.ok) {
      await input.sessions.revoke(sessionId, now);
      return {
        ok: false,
        status: authorization.status,
        error: authorization.error,
        reason: "live_authorization_rejected",
        clearCookies: true,
      };
    }

    return {
      ok: true,
      sessionId,
      session,
      user: authorization.user,
    };
  } catch {
    return backendUnavailable();
  }
}
