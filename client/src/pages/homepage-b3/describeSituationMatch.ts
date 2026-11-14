import {
  composeRead,
  SITUATION_TEXT_MAX,
  localMatch,
  sanitizeMatch,
  type SituationMatch,
} from "@shared/situationMatch";
import { CARD_DATA_REJECTED_CODE, CARD_DATA_REJECTED_MESSAGE, looksLikeCardData } from "@shared/pciGuard";

import {
  SITUATION_MATCH_NOTICE_VERSION,
} from "@shared/situationMatchNotice";

export {
  CHAT_RETENTION,
  HEALTH_INFO_WARNING,
  looksLikeHealthInfo,
  SITUATION_MATCH_AI_DISCLOSURE,
  SITUATION_MATCH_NO_TRAINING,
  SITUATION_MATCH_NOTICE_VERSION,
  SITUATION_MATCH_PRIVACY_LINK_TEXT,
  SITUATION_MATCH_PRIVACY_PATH,
} from "@shared/situationMatchNotice";

/** DE Desk answers inside this window or the page answers on its own (localMatch). */
export const DESK_MATCH_TIMEOUT_MS = 2500;

type DeskReply = {
  sessionId?: string;
  scenarioIds?: string[];
  situationIds?: string[];
  serviceIds?: string[];
  pageServiceIds?: string[];
  intentIds?: string[];
  urgent?: boolean;
  confident?: boolean;
  draftEnabled?: boolean;
};

export type DeskMatchOk = { match: SituationMatch; sessionId?: string; draftEnabled: boolean };
export type DeskMatchErr = { error: { code: string; message: string } };

export function isDeskMatchErr(got: DeskMatchOk | DeskMatchErr): got is DeskMatchErr {
  return "error" in got;
}

/**
 * Ask DE Desk's AI (the msp-advisor behind /api/public/advisor/chat) for a structured match.
 * Card-data and missing-consent refusals are shown to the visitor and never fall back to
 * a local match. Other errors or a reply slower than 2.5 s fall back to localMatch.
 */
export async function deskMatch(
  text: string,
  opts: { turnstileToken: string; sessionId?: string; fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<DeskMatchOk | DeskMatchErr> {
  if (looksLikeCardData(text)) {
    return { error: { code: CARD_DATA_REJECTED_CODE, message: CARD_DATA_REJECTED_MESSAGE } };
  }
  const local = (): DeskMatchOk => ({ match: localMatch(text), sessionId: opts.sessionId, draftEnabled: false });
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? DESK_MATCH_TIMEOUT_MS);
  try {
    const res = await (opts.fetchImpl || fetch)("/api/public/advisor/situation-match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      signal: ctl.signal,
      body: JSON.stringify({
        text: text.slice(0, SITUATION_TEXT_MAX),
        sessionId: opts.sessionId,
        turnstileToken: opts.turnstileToken,
        consent: true,
        consentVersion: SITUATION_MATCH_NOTICE_VERSION,
      }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => null)) as { code?: unknown; error?: unknown } | null;
      if (j?.code === CARD_DATA_REJECTED_CODE) {
        return { error: { code: CARD_DATA_REJECTED_CODE, message: CARD_DATA_REJECTED_MESSAGE } };
      }
      if (res.status === 400 && typeof j?.error === "string" && /consent/i.test(j.error)) {
        return { error: { code: "consent_required", message: j.error } };
      }
      return local();
    }
    const j = (await res.json()) as DeskReply;
    const match = sanitizeMatch({
      scenarioIds: j.scenarioIds,
      familyIds: j.situationIds as SituationMatch["familyIds"],
      serviceIds: j.serviceIds,
      pageServiceIds: j.pageServiceIds as SituationMatch["pageServiceIds"],
      intentIds: j.intentIds,
      summary: composeRead(j.intentIds || []),
      urgent: j.urgent,
      confident: j.confident,
      source: "de-desk",
    });
    if (!match.confident) return local();
    return { match, sessionId: typeof j.sessionId === "string" ? j.sessionId : opts.sessionId, draftEnabled: Boolean(j.draftEnabled) };
  } catch {
    return local();
  } finally {
    clearTimeout(timer);
  }
}

