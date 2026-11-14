import { describe, expect, it } from "vitest";
import {
  clientMfaRequired,
  clientSignInStep,
  enrollDeadline,
  secondFactorFor,
  usesEnrollmentFallback,
  zohoCallbackSignInStep,
} from "./portalClientMfaPolicy";

const on = { PORTAL_CLIENT_MFA_REQUIRED: "1" } as NodeJS.ProcessEnv;
const off = {} as NodeJS.ProcessEnv;

describe("client MFA requirement", () => {
  it("is off unless the flag is exactly 1", () => {
    expect(clientMfaRequired(off)).toBe(false);
    expect(clientMfaRequired({ PORTAL_CLIENT_MFA_REQUIRED: "true" } as NodeJS.ProcessEnv)).toBe(false);
    expect(clientMfaRequired(on)).toBe(true);
  });

  it("leaves unenrolled clients alone while off", () => {
    expect(secondFactorFor({ role: "user", mfaEnabled: false }, off)).toBeNull();
  });

  it("asks unenrolled clients for an email code while on", () => {
    const user = { role: "user", mfaEnabled: false, mfaMethod: null };
    expect(secondFactorFor(user, on)).toBe("email");
    expect(usesEnrollmentFallback(user, on)).toBe(true);
  });

  it("keeps an enrolled client's own method", () => {
    for (const env of [on, off]) {
      expect(secondFactorFor({ role: "user", mfaEnabled: true, mfaMethod: "totp" }, env)).toBe("totp");
      expect(secondFactorFor({ role: "user", mfaEnabled: true, mfaMethod: "passkey" }, env)).toBe("passkey");
    }
    expect(usesEnrollmentFallback({ role: "user", mfaEnabled: true, mfaMethod: "totp" }, on)).toBe(false);
  });

  it("treats a missing role as a client", () => {
    expect(secondFactorFor({ mfaEnabled: false }, on)).toBe("email");
  });

  it("does not change staff accounts", () => {
    expect(secondFactorFor({ role: "admin", mfaEnabled: false }, on)).toBeNull();
    expect(secondFactorFor({ role: "admin", mfaEnabled: true, mfaMethod: "passkey" }, on)).toBe("passkey");
  });

  it("treats any other enrolled method as an authenticator code, as before", () => {
    expect(secondFactorFor({ role: "user", mfaEnabled: true, mfaMethod: "app" }, off)).toBe("totp");
  });

  it("ignores an enabled flag with no method", () => {
    expect(secondFactorFor({ role: "user", mfaEnabled: true, mfaMethod: null }, off)).toBeNull();
    expect(secondFactorFor({ role: "user", mfaEnabled: true, mfaMethod: null }, on)).toBe("email");
  });
});

const dated = (enrollBy: string) =>
  ({ PORTAL_CLIENT_MFA_REQUIRED: "1", PORTAL_CLIENT_MFA_ENROLL_BY: enrollBy }) as NodeJS.ProcessEnv;
// 2027-01-15 ends at midnight Phoenix time, which is 07:00 UTC on the 16th.
const beforeDeadline = new Date("2027-01-16T06:59:59Z");
const atDeadline = new Date("2027-01-16T07:00:00Z");
const unenrolled = { role: "user", mfaEnabled: false, mfaMethod: null };
const emailOnly = { role: "user", mfaEnabled: true, mfaMethod: "email" };
const totp = { role: "user", mfaEnabled: true, mfaMethod: "totp" };
const passkey = { role: "user", mfaEnabled: true, mfaMethod: "passkey" };

describe("enrollment deadline", () => {
  it("is unset by default", () => {
    expect(enrollDeadline({} as NodeJS.ProcessEnv)).toEqual({ state: "unset" });
  });

  it("reads the date as the end of that day in Phoenix", () => {
    const d = enrollDeadline(dated("2027-01-15"));
    expect(d.state).toBe("set");
    if (d.state === "set") expect(d.endsAt.toISOString()).toBe("2027-01-16T07:00:00.000Z");
  });

  it("rejects anything that is not a real calendar date", () => {
    for (const bad of ["2027-02-30", "2027-1-5", "next month", "2027-01-15T00:00:00Z", "30"]) {
      expect(enrollDeadline(dated(bad))).toEqual({ state: "invalid" });
    }
  });

  it("keeps the email fallback for unenrolled clients before the deadline", () => {
    expect(clientSignInStep(unenrolled, dated("2027-01-15"), beforeDeadline)).toEqual({
      kind: "challenge",
      method: "email",
      enrollmentFallback: true,
    });
  });

  it("requires enrollment after the deadline instead of sending an email code", () => {
    expect(clientSignInStep(unenrolled, dated("2027-01-15"), atDeadline)).toEqual({
      kind: "must_enroll",
      reason: "deadline_passed",
    });
    expect(secondFactorFor(unenrolled, dated("2027-01-15"), atDeadline)).toBeNull();
    expect(usesEnrollmentFallback(unenrolled, dated("2027-01-15"), atDeadline)).toBe(false);
  });

  it("refuses an email-only client after the deadline", () => {
    expect(clientSignInStep(emailOnly, dated("2027-01-15"), beforeDeadline)).toEqual({
      kind: "challenge",
      method: "email",
      enrollmentFallback: false,
    });
    expect(clientSignInStep(emailOnly, dated("2027-01-15"), atDeadline)).toEqual({
      kind: "must_enroll",
      reason: "deadline_passed",
    });
  });

  it("accepts an authenticator or passkey on either side of the deadline", () => {
    for (const now of [beforeDeadline, atDeadline]) {
      expect(secondFactorFor(totp, dated("2027-01-15"), now)).toBe("totp");
      expect(secondFactorFor(passkey, dated("2027-01-15"), now)).toBe("passkey");
    }
  });

  it("fails closed on an invalid date while the requirement is on", () => {
    expect(clientSignInStep(unenrolled, dated("soon"), beforeDeadline)).toEqual({
      kind: "must_enroll",
      reason: "deadline_invalid",
    });
    expect(clientSignInStep(emailOnly, dated("soon"), beforeDeadline).kind).toBe("must_enroll");
    expect(secondFactorFor(totp, dated("soon"), beforeDeadline)).toBe("totp");
  });

  it("ignores the deadline while the requirement is off", () => {
    const env = { PORTAL_CLIENT_MFA_ENROLL_BY: "2020-01-01" } as NodeJS.ProcessEnv;
    expect(clientSignInStep(unenrolled, env, atDeadline)).toEqual({ kind: "none" });
    expect(secondFactorFor(emailOnly, env, atDeadline)).toBe("email");
    expect(clientSignInStep(unenrolled, { PORTAL_CLIENT_MFA_ENROLL_BY: "bad" } as NodeJS.ProcessEnv)).toEqual({ kind: "none" });
  });

  it("leaves staff rules unchanged after the deadline", () => {
    expect(clientSignInStep({ role: "admin", mfaEnabled: false }, dated("2027-01-15"), atDeadline)).toEqual({ kind: "none" });
    expect(secondFactorFor({ role: "admin", mfaEnabled: true, mfaMethod: "email" }, dated("2027-01-15"), atDeadline)).toBe("email");
    expect(secondFactorFor({ role: "admin", mfaEnabled: true, mfaMethod: "passkey" }, dated("soon"), atDeadline)).toBe("passkey");
  });
});

describe("Zoho sign-in callback", () => {
  it("is unchanged while the requirement is off", () => {
    expect(zohoCallbackSignInStep(unenrolled, off)).toEqual({ kind: "none" });
    expect(zohoCallbackSignInStep(totp, off)).toEqual({ kind: "none" });
  });

  it("asks for the second factor once the requirement is on", () => {
    expect(zohoCallbackSignInStep(totp, dated("2027-01-15"), atDeadline)).toEqual({
      kind: "challenge",
      method: "totp",
      enrollmentFallback: false,
    });
    expect(zohoCallbackSignInStep(unenrolled, dated("2027-01-15"), beforeDeadline)).toEqual({
      kind: "challenge",
      method: "email",
      enrollmentFallback: true,
    });
  });

  it("blocks unenrolled and email-only clients after the deadline", () => {
    expect(zohoCallbackSignInStep(unenrolled, dated("2027-01-15"), atDeadline).kind).toBe("must_enroll");
    expect(zohoCallbackSignInStep(emailOnly, dated("2027-01-15"), atDeadline).kind).toBe("must_enroll");
    expect(zohoCallbackSignInStep(unenrolled, dated("soon"), beforeDeadline).kind).toBe("must_enroll");
  });

  it("leaves staff sign-in through Zoho unchanged", () => {
    expect(zohoCallbackSignInStep({ role: "admin", mfaEnabled: false }, dated("2027-01-15"), atDeadline)).toEqual({ kind: "none" });
    expect(zohoCallbackSignInStep({ role: "admin", mfaEnabled: true, mfaMethod: "passkey" }, dated("2027-01-15"), atDeadline)).toEqual({ kind: "none" });
  });
});