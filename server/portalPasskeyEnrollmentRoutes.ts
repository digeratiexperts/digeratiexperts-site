/**
 * Passkey (WebAuthn) enrollment routes for signed-in portal users.
 *
 * Moved out of routes.ts unchanged so the enrollment ceremony can be tested
 * over HTTP (#153): enrollment needs an authenticated session, the challenge
 * expires after 10 minutes, and each challenge is single use and bound to the
 * user that requested it. Sign-in with a passkey uses the same identity store
 * through portalPasskeyLoginRoutes.ts.
 */
import { randomBytes } from "crypto";
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import {
  buildRegistrationOptions,
  isPasskeyProvider,
  newChallenge,
  PASSKEY_PROVIDERS,
  publicPasskeyView,
  resolveRpId,
  verifyRegistration,
  type PasskeyProviderId,
  type StoredPasskey,
} from "./portalPasskeys";

type AuthenticatedRequest = Request & { userId?: string; user?: any };

export type PasskeyEnrollmentUser = {
  id: string;
  email: string;
  fullName?: string | null;
  mfaEnabled?: boolean | null;
  mfaMethod?: string | null;
  mfaBackupCodes?: string[];
  mfaPasskeys?: StoredPasskey[];
};

export type PasskeyEnrollmentDeps = {
  auth: RequestHandler | ((req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown);
  validateInput: RequestHandler | ((req: AuthenticatedRequest, res: Response, next: NextFunction) => unknown);
  users: {
    get: (email: string) => PasskeyEnrollmentUser | undefined;
    /** Awaited durable write; throws when the database did not confirm. */
    commit: (user: any) => Promise<unknown>;
  };
  generateBackupCodes: (count: number) => string[];
  logSecurityEvent: (event: string, req: AuthenticatedRequest, data: any) => void;
  /** 503 for an unconfirmed durable write; false for any other error. */
  sendPersistenceFailure: (res: Response, error: unknown) => boolean;
  logger: { error: (message: string, error?: unknown) => void };
};

/** A registration challenge is single use and lives for 10 minutes. */
export const PASSKEY_CEREMONY_TTL = 10 * 60 * 1000;
/** Most passkeys one account may register. */
export const MAX_PASSKEYS_PER_USER = 10;

const randomId = () => randomBytes(16).toString("hex");

export function registerPortalPasskeyEnrollmentRoutes(app: Express, deps: PasskeyEnrollmentDeps) {
  const { auth, validateInput, users, generateBackupCodes, logSecurityEvent, sendPersistenceFailure, logger } = deps;

  // Passkey registration ceremonies in flight (challenge is single use, 10 minutes).
  const passkeyRegistrations = new Map<string, {
    userId: string;
    challenge: string;
    rpId: string;
    provider: PasskeyProviderId;
    nickname: string;
    createdAt: number;
  }>();

  const prunePasskeyCeremonies = () => {
    const now = Date.now();
    for (const [token, entry] of passkeyRegistrations) {
      if (now - entry.createdAt > PASSKEY_CEREMONY_TTL) passkeyRegistrations.delete(token);
    }
  };

  // Step 1: options for navigator.credentials.create(), tuned to the chosen provider.
  app.post("/api/portal/mfa/passkey/register/options", [auth, validateInput] as RequestHandler[], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { provider, nickname } = req.body || {};
      if (!isPasskeyProvider(provider)) {
        return res.status(400).json({ message: "Provider must be apple, android, microsoft or jumpcloud" });
      }
      const user = users.get(req.user?.email || "");
      if (!user) return res.status(404).json({ message: "User not found" });
      if ((user.mfaPasskeys || []).length >= MAX_PASSKEYS_PER_USER) {
        return res.status(400).json({ message: "You can register up to 10 passkeys. Remove one first." });
      }

      prunePasskeyCeremonies();
      const rpId = resolveRpId(req.hostname);
      const challenge = newChallenge();
      const setupToken = randomId();
      passkeyRegistrations.set(setupToken, {
        userId: user.id,
        challenge,
        rpId,
        provider,
        nickname: typeof nickname === "string" ? nickname : "",
        createdAt: Date.now(),
      });

      const options = buildRegistrationOptions({
        rpId,
        user: { id: user.id, email: user.email, fullName: user.fullName },
        provider,
        challenge,
        existing: user.mfaPasskeys || [],
        userAgent: String(req.headers["user-agent"] || ""),
      });
      return res.json({ setupToken, provider, providerLabel: PASSKEY_PROVIDERS[provider].store, options });
    } catch (error: any) {
      logger.error("Passkey registration options failed", error);
      return res.status(500).json({ message: "Could not start passkey setup" });
    }
  });

  // Step 2: verify the new credential and save it. Turns MFA on when it was off.
  app.post("/api/portal/mfa/passkey/register/verify", [auth, validateInput] as RequestHandler[], async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { setupToken, credential } = req.body || {};
      const pending = typeof setupToken === "string" ? passkeyRegistrations.get(setupToken) : undefined;
      if (typeof setupToken === "string") passkeyRegistrations.delete(setupToken); // single use
      if (!pending || Date.now() - pending.createdAt > PASSKEY_CEREMONY_TTL) {
        return res.status(400).json({ message: "Passkey setup expired. Please try again." });
      }
      const user = users.get(req.user?.email || "");
      if (!user || user.id !== pending.userId) return res.status(403).json({ message: "Unauthorized" });

      let passkey;
      try {
        passkey = verifyRegistration({
          credential,
          expectedChallenge: pending.challenge,
          rpId: pending.rpId,
          provider: pending.provider,
          nickname: pending.nickname,
        });
      } catch (err: any) {
        logSecurityEvent("PASSKEY_REGISTRATION_REJECTED", req, { email: user.email, reason: err?.message });
        return res.status(400).json({ message: `Passkey could not be verified: ${err?.message || "invalid response"}` });
      }
      if ((user.mfaPasskeys || []).some((p) => p.id === passkey.id)) {
        return res.status(409).json({ message: "This passkey is already registered." });
      }

      user.mfaPasskeys = [...(user.mfaPasskeys || []), passkey];
      let backupCodes: string[] | undefined;
      if (!user.mfaEnabled) {
        backupCodes = generateBackupCodes(8);
        user.mfaEnabled = true;
        user.mfaMethod = "passkey";
        user.mfaBackupCodes = backupCodes;
      }
      await users.commit(user);

      logSecurityEvent("PASSKEY_REGISTERED", req, { email: user.email, provider: passkey.provider, aaguid: passkey.aaguid });
      if (backupCodes) logSecurityEvent("MFA_ENABLED", req, { email: user.email, method: "passkey" });

      return res.json({ success: true, passkey: publicPasskeyView(passkey), backupCodes });
    } catch (error: any) {
      if (sendPersistenceFailure(res, error)) return;
      logger.error("Passkey registration failed", error);
      return res.status(500).json({ message: "Passkey setup failed" });
    }
  });
}
