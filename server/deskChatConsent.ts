import { createHash } from "crypto";
import type { Request, Response } from "express";
import {
  DESK_CHAT_CONSENT_NOTICE,
  DESK_CHAT_CONSENT_NOTICE_SHA256,
  DESK_CHAT_CONSENT_REQUIRED,
  DESK_CHAT_CONSENT_VERSION,
  isCurrentDeskChatConsent,
} from "@shared/deskChatConsent";
import { recordDeskChatConsent } from "./services/msp-advisor/persist";


/** Use Express req.ip (honors trust proxy). Never read client-supplied headers. */
function consentIpFromReq(req: Request): string | null {
  const ip = typeof req.ip === "string" ? req.ip.trim() : "";
  if (ip) return ip.slice(0, 64);
  const remote = req.socket?.remoteAddress;
  return remote ? String(remote).slice(0, 64) : null;
}

export function currentDeskChatNoticeHash(): string {
  return createHash("sha256").update(DESK_CHAT_CONSENT_NOTICE, "utf8").digest("hex");
}

export function rejectIfMissingDeskChatConsent(req: Request, res: Response): boolean {
  if (isCurrentDeskChatConsent(req.body?.consent) && currentDeskChatNoticeHash() === DESK_CHAT_CONSENT_NOTICE_SHA256) {
    return false;
  }
  res.status(403).json({
    error: DESK_CHAT_CONSENT_REQUIRED,
    code: DESK_CHAT_CONSENT_REQUIRED,
  });
  return true;
}

export async function recordAcceptedDeskChatConsent(req: Request, sessionId: string): Promise<void> {
  const id = String(sessionId || "").trim();
  if (!id) return;
  await recordDeskChatConsent({
    sessionId: id,
    version: DESK_CHAT_CONSENT_VERSION,
    noticeHash: currentDeskChatNoticeHash(),
    consentedAt: new Date().toISOString(),
    ip: consentIpFromReq(req),
  });
}
