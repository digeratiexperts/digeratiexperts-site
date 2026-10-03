/**
 * Per-email cooldown for the "resend verification" endpoint (issue #252).
 *
 * The endpoint's IP rate limit caps how often one client can call it, but a
 * caller rotating IPs could still have the server mint and email a fresh
 * verification link to one victim's inbox on every call. This pure check lets
 * the route skip re-minting when a still-valid token for that email was
 * created within the cooldown, so a given inbox gets at most one link per
 * window regardless of source IP.
 */

export interface VerificationTokenRecord {
  email: string;
  createdAt?: number;
  expiresAt?: number;
}

export const RESEND_COOLDOWN_MS = 60_000;

/**
 * True if an unexpired verification token for `email` was minted within
 * `cooldownMs` of `now` — i.e. a link was just sent and we should not send
 * another yet.
 */
export function hasFreshVerificationToken(
  tokens: Iterable<VerificationTokenRecord>,
  email: string,
  now: number,
  cooldownMs: number = RESEND_COOLDOWN_MS,
): boolean {
  for (const token of tokens) {
    if (token.email !== email) continue;
    if (typeof token.expiresAt === "number" && token.expiresAt <= now) continue;
    if (typeof token.createdAt === "number" && now - token.createdAt < cooldownMs) return true;
  }
  return false;
}
