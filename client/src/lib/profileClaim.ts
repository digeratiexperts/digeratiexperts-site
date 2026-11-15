/**
 * The claim token for an anonymous IT & Security Profile draft (Hub contract, 2026-11-13).
 * Kept in this browser only until portal sign-up sends it with /api/portal/register,
 * or until it expires (30 days). It is not an account id and grants nothing on its own.
 */
const KEY = "de-profile-claim";
const TOKEN_RE = /^[A-Za-z0-9._~-]{16,256}$/;

export function saveProfileClaim(j: { claimToken?: unknown; expiresAt?: unknown }): boolean {
  if (typeof j?.claimToken !== "string" || !TOKEN_RE.test(j.claimToken) || typeof j.expiresAt !== "string") return false;
  try {
    localStorage.setItem(KEY, JSON.stringify({ claimToken: j.claimToken, expiresAt: j.expiresAt }));
    return true;
  } catch {
    return false;
  }
}

/** A live claim token, or "" when there is none or it has expired. */
export function readProfileClaim(now: number = Date.now()): string {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return "";
    const j = JSON.parse(raw) as { claimToken?: string; expiresAt?: string };
    const exp = Date.parse(j.expiresAt || "");
    if (!j.claimToken || !TOKEN_RE.test(j.claimToken) || !Number.isFinite(exp) || exp <= now) {
      localStorage.removeItem(KEY);
      return "";
    }
    return j.claimToken;
  } catch {
    return "";
  }
}

export function clearProfileClaim(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
