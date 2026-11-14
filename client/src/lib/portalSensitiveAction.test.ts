import { describe, expect, it } from "vitest";

import { requiresPortalReauthentication } from "./portalSensitiveAction";

describe("requiresPortalReauthentication", () => {
  it("recognizes an explicit server reauthentication requirement", () => {
    expect(requiresPortalReauthentication({ reauthenticationRequired: true })).toBe(true);
  });

  it("fails closed for malformed or ordinary responses", () => {
    expect(requiresPortalReauthentication({ reauthenticationRequired: false })).toBe(false);
    expect(requiresPortalReauthentication({})).toBe(false);
    expect(requiresPortalReauthentication(null)).toBe(false);
    expect(requiresPortalReauthentication("true")).toBe(false);
  });
});
