/** Password-first Portal MFA sign-in. Uses the existing identity and challenge stores. */
import type { Express, Request, RequestHandler, Response } from "express";
import { buildAuthenticationOptions, newChallenge, resolveRpId, verifyAuthentication, type StoredPasskey } from "./portalPasskeys";

type AuthenticatedRequest = Request & { userId?: string; user?: any };
export type PortalMfaChallenge = {
  userId: string;
  email: string;
  method: "totp" | "email" | "passkey";
  emailCode?: string;
  passkeyChallenge?: string;
  passkeyRpId?: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
};
export type PasskeyLoginUser = {
  id: string;
  email: string;
  isActive?: boolean;
  mfaPasskeys?: StoredPasskey[];
};
export type PasskeyLoginDeps = {
  rateLimit: RequestHandler;
  validateInput: RequestHandler;
  challenges: Map<string, PortalMfaChallenge>;
  maxAttempts: number;
  users: { get: (email: string) => PasskeyLoginUser | undefined; commit: (user: any) => Promise<unknown> };
  completeLogin: (user: any, req: AuthenticatedRequest, res: Response) => unknown;
  logSecurityEvent: (event: string, req: AuthenticatedRequest, data: any) => void;
  sendPersistenceFailure: (res: Response, error: unknown) => boolean;
  logger: { error: (message: string, error?: unknown) => void };
};

export function registerPortalPasskeyLoginRoutes(app: Express, deps: PasskeyLoginDeps) {
  const { rateLimit, validateInput, challenges, maxAttempts, users, completeLogin, logSecurityEvent, sendPersistenceFailure, logger } = deps;
  // Login step 2 with a passkey: options for navigator.credentials.get().
  app.post("/api/portal/mfa/passkey/login/options", [rateLimit, validateInput] as RequestHandler[], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { mfaToken } = req.body || {};
      const challenge = typeof mfaToken === "string" ? challenges.get(mfaToken) : undefined;
      if (!challenge || Date.now() > challenge.expiresAt) {
        if (typeof mfaToken === "string") challenges.delete(mfaToken);
        return res.status(400).json({ message: "MFA session expired. Please log in again." });
      }
      const user = users.get(challenge.email);
      if (challenge.attempts >= maxAttempts) {
        challenges.delete(mfaToken);
        logSecurityEvent("MFA_LOCKED_OUT", req, { email: challenge.email });
        return res.status(429).json({ message: "Too many attempts. Please log in again." });
      }
      if (!user || user.id !== challenge.userId || user.isActive === false) {
        challenges.delete(mfaToken);
        return res.status(400).json({ message: "MFA session expired. Please log in again." });
      }
      const rpId = resolveRpId(req.hostname);
      const passkeys = (user?.mfaPasskeys || []).filter((p) => p.rpId === rpId);
      if (!user || passkeys.length === 0) {
        return res.status(400).json({ message: "No passkey is registered for this account on this site." });
      }
      challenge.passkeyChallenge = newChallenge();
      challenge.passkeyRpId = rpId;
      return res.json({ options: buildAuthenticationOptions({ rpId, challenge: challenge.passkeyChallenge, passkeys }) });
    } catch (error: any) {
      logger.error("Passkey login options failed", error);
      return res.status(500).json({ message: "Could not start passkey sign-in" });
    }
  });

  // Login step 2 with a passkey: verify the assertion and sign in.
  app.post("/api/portal/mfa/passkey/login/verify", [rateLimit, validateInput] as RequestHandler[], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { mfaToken, credential } = req.body || {};
      const challenge = typeof mfaToken === "string" ? challenges.get(mfaToken) : undefined;
      if (!challenge || Date.now() > challenge.expiresAt || !challenge.passkeyChallenge || !challenge.passkeyRpId) {
        if (challenge && Date.now() > challenge.expiresAt) challenges.delete(mfaToken);
        return res.status(400).json({ message: "MFA session expired. Please log in again." });
      }
      if (challenge.attempts >= maxAttempts) {
        challenges.delete(mfaToken);
        logSecurityEvent("MFA_LOCKED_OUT", req, { email: challenge.email });
        return res.status(429).json({ message: "Too many attempts. Please log in again." });
      }
      challenge.attempts++;
      const expectedChallenge = challenge.passkeyChallenge;
      challenge.passkeyChallenge = undefined; // single use

      const user = users.get(challenge.email);
      if (!user || user.id !== challenge.userId || user.isActive === false) {
        challenges.delete(mfaToken);
        return res.status(400).json({ message: "MFA session expired. Please log in again." });
      }

      let updated;
      try {
        updated = verifyAuthentication({
          credential,
          expectedChallenge,
          rpId: challenge.passkeyRpId,
          passkeys: user.mfaPasskeys || [],
          userId: user.id,
        });
      } catch (err: any) {
        logSecurityEvent("MFA_VERIFICATION_FAILED", req, { email: challenge.email, method: "passkey", attempt: challenge.attempts, reason: err?.message });
        return res.status(401).json({ message: "That passkey could not be verified. Try again or use a backup code." });
      }

      // Consume the entire password-proven MFA token before awaiting persistence:
      // another options request must not start a parallel ceremony for this login.
      challenges.delete(mfaToken);
      // Do not publish the new counter/last-used timestamp in the shared cache
      // until the durable store confirms the write.
      const nextUser = { ...user, mfaPasskeys: (user.mfaPasskeys || []).map((p) => (p.id === updated.id ? updated : p)) };
      await users.commit(nextUser);
      logSecurityEvent("MFA_VERIFICATION_SUCCESS", req, { email: challenge.email, method: "passkey" });
      return completeLogin(nextUser, req, res);
    } catch (error: any) {
      if (sendPersistenceFailure(res, error)) return;
      logger.error("Passkey login failed", error);
      return res.status(500).json({ message: "Verification failed" });
    }
  });

}
