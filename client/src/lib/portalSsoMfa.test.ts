import { describe, expect, it } from "vitest";
import {
  portalLoginUrlAfterMfaHydration,
  readPortalSsoMfaHandoff,
  safePortalReturnTo,
} from "./portalSsoMfa";

describe("portal SSO MFA callback hydration", () => {
  it("hydrates the existing MFA form from an opaque callback fragment", () => {
    expect(readPortalSsoMfaHandoff(
      "?mfa=required&returnTo=%2Fportal%2Ftickets",
      "#mfaToken=0123456789abcdef0123456789abcdef&mfaMethod=email",
    )).toEqual({
      mfaToken: "0123456789abcdef0123456789abcdef",
      mfaMethod: "email",
      message: "A verification code has been sent to your email.",
    });
  });

  it("rejects missing or malformed callback challenges", () => {
    expect(readPortalSsoMfaHandoff("?mfa=required", "")).toBeNull();
    expect(readPortalSsoMfaHandoff(
      "?mfa=required",
      "#mfaToken=attacker-controlled&mfaMethod=totp",
    )).toBeNull();
    expect(readPortalSsoMfaHandoff(
      "?mfa=required",
      "#mfaToken=0123456789abcdef0123456789abcdef&mfaMethod=unknown",
    )).toBeNull();
  });

  it("scrubs callback state while preserving only a safe portal return path", () => {
    expect(portalLoginUrlAfterMfaHydration(
      "/portal/login",
      "?mfa=required&returnTo=%2Fportal%2Fcompany",
    )).toBe("/portal/login?returnTo=%2Fportal%2Fcompany");
    expect(safePortalReturnTo("/store/checkout")).toBe("/store/checkout");
    expect(safePortalReturnTo("//attacker.example/portal")).toBe("/portal/dashboard");
    expect(safePortalReturnTo("https://attacker.example/portal")).toBe("/portal/dashboard");
  });
});
