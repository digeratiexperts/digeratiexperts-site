/**
 * Threads a Describe Your Situation match into DE Desk. The situation-match
 * route already stores the match on a DE Desk advisor session; this helper
 * carries that session id through openMspAdvisor so the Desk widget reuses it.
 */

export const SITUATION_SESSION_STORAGE_KEY = "de-situation-session";

/** Server-minted advisor ids are 32–64 hex characters (see session.createSession). */
export function isAdvisorSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{32,64}$/i.test(value.trim());
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function readSituationSessionId(): string | undefined {
  const raw = storage()?.getItem(SITUATION_SESSION_STORAGE_KEY);
  return isAdvisorSessionId(raw) ? raw.trim() : undefined;
}

export function writeSituationSessionId(id: string): void {
  if (!isAdvisorSessionId(id)) return;
  try {
    storage()?.setItem(SITUATION_SESSION_STORAGE_KEY, id.trim());
  } catch {
    /* private mode: the match still shows */
  }
}

/**
 * Prefer an explicit handoff from Describe Your Situation. Otherwise keep the
 * current Desk session, or adopt a situation session already stored in this tab.
 */
export function resolveDeskAdvisorSessionId(params: {
  requestedSessionId?: string | null;
  currentSessionId?: string | null;
}): string | null {
  if (isAdvisorSessionId(params.requestedSessionId)) return params.requestedSessionId.trim();
  if (isAdvisorSessionId(params.currentSessionId)) return params.currentSessionId.trim();
  return readSituationSessionId() ?? null;
}
