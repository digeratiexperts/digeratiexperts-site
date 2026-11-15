/**
 * Client users must pass a second factor at sign-in once
 * PORTAL_CLIENT_MFA_REQUIRED is on. A client who has not enrolled an
 * authenticator or passkey gets a one-time code by email, so nobody is
 * locked out on the day the switch flips. Staff accounts (role "admin") keep
 * their own rules, including the break-glass passkey requirement.
 */

export type PortalMfaMethod = "totp" | "email" | "passkey";

type MfaSubject = {
  role?: string | null;
  mfaEnabled?: boolean | null;
  mfaMethod?: string | null;
};

export function clientMfaRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.PORTAL_CLIENT_MFA_REQUIRED || "").trim() === "1";
}

function enrolledMethod(user: MfaSubject): PortalMfaMethod | null {
  if (!user.mfaEnabled || !user.mfaMethod) return null;
  const m = user.mfaMethod;
  return m === "email" || m === "passkey" ? m : "totp";
}

/**
 * Which second factor to ask for after a correct password, or null to finish
 * sign-in. Enrolled users always get their own method, whether or not the
 * requirement is on.
 */
export function secondFactorFor(
  user: MfaSubject,
  env: NodeJS.ProcessEnv = process.env,
): PortalMfaMethod | null {
  const enrolled = enrolledMethod(user);
  if (enrolled) return enrolled;
  if (user.role === "admin") return null;
  return clientMfaRequired(env) ? "email" : null;
}

/** True when the sign-in used the email fallback because the client has not enrolled. */
export function usesEnrollmentFallback(
  user: MfaSubject,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return enrolledMethod(user) === null && secondFactorFor(user, env) === "email";
}
