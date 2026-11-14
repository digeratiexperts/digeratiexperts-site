/**
 * DE Desk situation match and IT & Security Profile drafts (B3 homepage).
 *
 *   POST /api/public/advisor/situation-match   same rate limiter as /api/public/advisor/chat,
 *        small body cap, Turnstile; returns ids + pre-written rationale only.
 *   POST /api/public/advisor/situation-draft   site-server proxy to the Hub's anonymous
 *        profile-draft endpoint. Uses the match the SERVER kept on the DE Desk session,
 *        never ids from the browser. Off (404) until HUB_PROFILE_DRAFTS_ENABLED=1.
 */
import type { Express, NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import { verifyTurnstile } from "./middleware/security";
import { createProfileDraft, profileDraftsEnabled } from "./integrations/hubProfileDraft";
import { PROFILE_DRAFT_CONSENT_VERSION, itPlan, type SituationMatch } from "@shared/situationMatch";
import { isPreChatConsentGranted, PRE_CHAT_CONSENT_REQUIRED_MESSAGE } from "@shared/preChatConsent";
import { SITUATION_MATCH_NOTICE_VERSION } from "@shared/situationMatchNotice";
import { sendCardDataRejected, sendCardDataRejectedError } from "./pciGuard";

export const SITUATION_BODY_MAX_BYTES = 4 * 1024;

const defaultMatchRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many chat messages. Please try again shortly." },
});

const defaultDraftRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again shortly." },
});

/** Rejects a body over 4 KB (the text itself is capped at 1,000 characters). */
export function situationBodyCap(req: Request, res: Response, next: NextFunction) {
  const declared = Number(req.get("content-length") || 0);
  const actual = Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8");
  if (declared > SITUATION_BODY_MAX_BYTES || actual > SITUATION_BODY_MAX_BYTES) {
    return res.status(413).json({ error: "Payload too large" });
  }
  next();
}

export function registerSituationMatchRoutes(
  app: Express,
  opts: { rateLimiter?: RequestHandler; draftRateLimiter?: RequestHandler; turnstile?: RequestHandler } = {},
): void {
  const turnstile = opts.turnstile || verifyTurnstile;
  const matchLimiter = opts.rateLimiter ?? defaultMatchRateLimiter;
  const draftLimiter = opts.draftRateLimiter ?? defaultDraftRateLimiter;

  app.post("/api/public/advisor/situation-match", matchLimiter, situationBodyCap, turnstile, async (req: Request, res: Response) => {
    try {
      const { handleSituationMatch } = await import("./services/msp-advisor/situation-match");
      const { text, sessionId } = req.body || {};
      if (!text || typeof text !== "string") return res.status(400).json({ error: "text is required" });
      if (sendCardDataRejected(res, text)) return;
      if (!isPreChatConsentGranted(req.body || {}, SITUATION_MATCH_NOTICE_VERSION)) {
        return res.status(400).json({ error: PRE_CHAT_CONSENT_REQUIRED_MESSAGE });
      }
      const r = await handleSituationMatch({ text, sessionId: typeof sessionId === "string" ? sessionId : undefined });
      const { getSession } = await import("./services/msp-advisor");
      const { recordSituationMatchConsent } = await import("./services/msp-advisor/situationMatchConsent");
      const consent = recordSituationMatchConsent({
        version: SITUATION_MATCH_NOTICE_VERSION,
        sessionId: r.sessionId,
      });
      const session = getSession(r.sessionId);
      if (session) session.situationMatchConsent = { version: consent.version, at: consent.at };
      res.json({
        sessionId: r.sessionId,
        scenarioIds: r.scenarioIds,
        situationIds: r.familyIds,
        serviceIds: r.serviceIds,
        pageServiceIds: r.pageServiceIds,
        intentIds: r.intentIds,
        rationale: r.rationale,
        urgent: r.urgent,
        confident: r.confident,
        source: r.source,
        draftEnabled: profileDraftsEnabled(),
      });
    } catch (error: any) {
      if (sendCardDataRejectedError(res, error)) return;
      const status = error?.status || 500;
      console.error("[msp-advisor] situation-match failed:", error?.message || error);
      res.status(status).json({ error: status === 400 ? error.message : "Situation match unavailable" });
    }
  });

  app.post("/api/public/advisor/situation-draft", draftLimiter, situationBodyCap, turnstile, async (req: Request, res: Response) => {
    if (!profileDraftsEnabled()) return res.status(404).json({ error: "Not available" });
    try {
      const { getSession } = await import("./services/msp-advisor");
      const { sessionSituation } = await import("./services/msp-advisor/situation-match");
      const { sessionId, consent, consentTextVersion } = req.body || {};
      if (consent !== true || consentTextVersion !== PROFILE_DRAFT_CONSENT_VERSION) {
        return res.status(400).json({ error: "Consent is required" });
      }
      const sid = typeof sessionId === "string" ? sessionId.slice(0, 64) : "";
      const situation = sessionSituation(sid, getSession);
      if (!sid || !situation) return res.status(404).json({ error: "Nothing to save yet. Run a match first." });
      const match = { ...situation, urgent: false, confident: true, source: "de-desk" } as unknown as SituationMatch;
      const draft = await createProfileDraft({
        sessionId: sid,
        words: situation.text,
        situationIds: situation.familyIds,
        serviceIds: situation.serviceIds,
        itPlan: itPlan(match),
      });
      if (!draft) return res.status(502).json({ error: "Could not save the draft right now" });
      res.json(draft);
    } catch (error: any) {
      console.error("[msp-advisor] situation-draft failed:", error?.message || error);
      res.status(500).json({ error: "Could not save the draft right now" });
    }
  });
}

