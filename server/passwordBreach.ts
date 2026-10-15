import { createHash } from "node:crypto";
import { PASSWORD_MAX_LENGTH, passwordPolicyError, type PasswordContext } from "@shared/passwordPolicy";
import { logger } from "./logger";

/**
 * Breached-password check against Have I Been Pwned's Pwned Passwords range API
 * (https://haveibeenpwned.com/API/v3#PwnedPasswords). Free, no key.
 *
 * k-anonymity: only the first 5 hex characters of the password's SHA-1 leave
 * the server; HIBP answers with every suffix in that bucket and the match is
 * done here. "Add-Padding" hides the bucket size from anyone watching traffic.
 *
 * Fails open: if HIBP is slow or down, the password is accepted on the local
 * rules alone and a warning is logged, so an outage at HIBP never locks people
 * out of signing up or resetting.
 */

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const HIBP_TIMEOUT_MS = 3000;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Times the password appears in known breaches; 0 when absent; null when the check could not run. */
export async function pwnedCount(password: string, fetchImpl: FetchLike = fetch): Promise<number | null> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const res = await fetchImpl(HIBP_RANGE_URL + prefix, {
      headers: { "Add-Padding": "true", "User-Agent": "DigeratiExperts-Portal" },
      signal: AbortSignal.timeout(HIBP_TIMEOUT_MS),
    });
    if (!res.ok) {
      logger.warn(`Pwned Passwords check skipped: HTTP ${res.status}`);
      return null;
    }
    const body = await res.text();
    for (const line of body.split(/\r?\n/)) {
      const [hashSuffix, count] = line.trim().split(":");
      if (hashSuffix === suffix) return Number.parseInt(count, 10) || 0;
    }
    return 0;
  } catch (error: any) {
    logger.warn(`Pwned Passwords check skipped: ${error?.name || "error"}`);
    return null;
  }
}

export const BREACHED_PASSWORD_MESSAGE =
  "This password has appeared in a known data breach, so it is easy for attackers to guess. Please choose a different one.";

/**
 * The full policy for a new password: the shared local rules first (cheap,
 * offline), then the breach check. null means the password is acceptable.
 */
export async function newPasswordError(
  password: unknown,
  ctx: PasswordContext = {},
  fetchImpl: FetchLike = fetch,
): Promise<string | null> {
  if (typeof password !== "string") return "Password is required";
  // Bound the work before hashing anything an attacker sends.
  if (password.length > PASSWORD_MAX_LENGTH * 4) return passwordPolicyError(password, ctx);
  const local = passwordPolicyError(password, ctx);
  if (local) return local;
  const count = await pwnedCount(password, fetchImpl);
  return count && count > 0 ? BREACHED_PASSWORD_MESSAGE : null;
}
