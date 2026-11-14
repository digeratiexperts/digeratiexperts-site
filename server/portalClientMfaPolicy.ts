/**
 * Client users must pass a second factor at sign-in once
 * PORTAL_CLIENT_MFA_REQUIRED is on. Until the enrollment deadline in
 * PORTAL_CLIENT_MFA_ENROLL_BY, a client without an authenticator or passkey
 * gets a one-time code by email so nobody is locked out on the day the switch
 * flips. After the deadline only an authenticator code or a passkey is
 * accepted, and a client with neither must enroll before signing in.
 * Staff accounts (role "admin") keep their own rules, including the
 * break-glass passkey requirement.
 */

export type PortalMfaMethod = "totp" | "email" | "passkey";

export type ClientSignInStep =
  | { kind: "none" }
  | { kind: "challenge"; method: PortalMfaMethod; enrollmentFallback: boolean }
  | { kind: "must_enroll"; reason: "deadline_passed" | "deadline_invalid" };

type MfaSubject = {
  role?: string | null;
  mfaEnabled?: boolean | null;
  mfaMethod?: string | null;
};

const ENROLL_BY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
// America/Phoenix does not observe daylight saving time.
const PHOENIX_OFFSET_HOURS = 7;

export function clientMfaRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.PORTAL_CLIENT_MFA_REQUIRED || "").trim() === "1";
}

export type EnrollDeadline =
  | { state: "unset" }
  | { state: "invalid" }
  | { state: "set"; endsAt: Date };

/**
 * PORTAL_CLIENT_MFA_ENROLL_BY is a calendar date (YYYY-MM-DD) in
 * America/Phoenix. Clients may use the email fallback through the end of that
 * day; the deadline passes at midnight Phoenix time that night.
 */
export function enrollDeadline(env: NodeJS.ProcessEnv = process.env): EnrollDeadline {
  const raw = (env.PORTAL_CLIENT_MFA_ENROLL_BY || "").trim();
  if (!raw) return { state: "unset" };
  const m = ENROLL_BY_PATTERN.exec(raw);
  if (!m) return { state: "invalid" };
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return { state: "invalid" };
  }
  return { state: "set", endsAt: new Date(Date.UTC(year, month - 1, day + 1, PHOENIX_OFFSET_HOURS)) };
}

function enrolledMethod(user: MfaSubject): PortalMfaMethod | null {
  if (!user.mfaEnabled || !user.mfaMethod) return null;
  const m = user.mfaMethod;
  return m === "email" || m === "passkey" ? m : "totp";
}

/**
 * What a sign-in must do after the first factor (password or Zoho) succeeds.
 * An invalid deadline with the requirement on is treated as already passed.
 */
export function clientSignInStep(
  user: MfaSubject,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): ClientSignInStep {
  const enrolled = enrolledMethod(user);
  if (user.role === "admin" || !clientMfaRequired(env)) {
    return enrolled ? { kind: "challenge", method: enrolled, enrollmentFallback: false } : { kind: "none" };
  }

  if (enrolled === "totp" || enrolled === "passkey") {
    return { kind: "challenge", method: enrolled, enrollmentFallback: false };
  }

  const deadline = enrollDeadline(env);
  if (deadline.state === "invalid") return { kind: "must_enroll", reason: "deadline_invalid" };
  if (deadline.state === "set" && now.getTime() >= deadline.endsAt.getTime()) {
    return { kind: "must_enroll", reason: "deadline_passed" };
  }
  return { kind: "challenge", method: "email", enrollmentFallback: enrolled === null };
}

/**
 * Which second factor to ask for after a correct password, or null to finish
 * sign-in. Returns null as well when the client must enroll first; check
 * clientSignInStep for that case.
 */
export function secondFactorFor(
  user: MfaSubject,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): PortalMfaMethod | null {
  const step = clientSignInStep(user, env, now);
  return step.kind === "challenge" ? step.method : null;
}

/** True when the sign-in used the email fallback because the client has not enrolled. */
export function usesEnrollmentFallback(
  user: MfaSubject,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): boolean {
  const step = clientSignInStep(user, env, now);
  return step.kind === "challenge" && step.enrollmentFallback;
}

/**
 * The same check for the Zoho sign-in callback. Zoho is only the first
 * factor, so a client still owes a second factor when the requirement is on.
 * Staff accounts and the requirement being off leave the callback as it was.
 */
export function zohoCallbackSignInStep(
  user: MfaSubject,
  env: NodeJS.ProcessEnv = process.env,
  now: Date = new Date(),
): ClientSignInStep {
  if (user.role === "admin" || !clientMfaRequired(env)) return { kind: "none" };
  return clientSignInStep(user, env, now);
}

export const MFA_ENROLL_REQUIRED_CODE = "MFA_ENROLL_REQUIRED";
export const MFA_ENROLL_REQUIRED_MESSAGE =
  "Sign-in now requires an authenticator app or passkey. Contact DE support to finish setup.";
