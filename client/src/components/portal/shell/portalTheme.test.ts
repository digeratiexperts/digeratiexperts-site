import { describe, expect, it } from "vitest";
import { DEFAULT_PORTAL_THEME_PREFERENCE, resolvePortalTheme } from "./portalTheme";

describe("portal theme", () => {
  it("defaults to graphite dark whatever the device says", () => {
    expect(DEFAULT_PORTAL_THEME_PREFERENCE).toBe("dark");
    expect(resolvePortalTheme(DEFAULT_PORTAL_THEME_PREFERENCE, true)).toBe("dark");
    expect(resolvePortalTheme(DEFAULT_PORTAL_THEME_PREFERENCE, false)).toBe("dark");
  });

  it("Match device follows the device's light/dark setting", () => {
    expect(resolvePortalTheme("system", true)).toBe("light");
    expect(resolvePortalTheme("system", false)).toBe("dark");
  });

  it("an explicit choice beats the device", () => {
    expect(resolvePortalTheme("dark", true)).toBe("dark");
    expect(resolvePortalTheme("light", false)).toBe("light");
  });
});
