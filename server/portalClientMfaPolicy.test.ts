import { describe, expect, it } from "vitest";
import { clientMfaRequired, secondFactorFor, usesEnrollmentFallback } from "./portalClientMfaPolicy";

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
