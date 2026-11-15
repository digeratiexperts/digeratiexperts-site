/**
 * Idle TTL for the in-memory advisor / situation-match session.
 * The describe-box notice and the session store both use this value.
 */
export const ADVISOR_SESSION_IDLE_TTL_MS = 2 * 60 * 60 * 1000;

/** Same idle TTL, in hours, for visitor-facing copy. */
export const ADVISOR_SESSION_IDLE_TTL_HOURS = ADVISOR_SESSION_IDLE_TTL_MS / (60 * 60 * 1000);

/** Formats the idle TTL as hours, e.g. "2 hours". */
export function formatAdvisorSessionIdleTtl(): string {
  const hours = ADVISOR_SESSION_IDLE_TTL_HOURS;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
