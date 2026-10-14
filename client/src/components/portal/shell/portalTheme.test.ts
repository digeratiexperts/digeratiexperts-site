import { describe, expect, it } from "vitest";
import { DEFAULT_PORTAL_THEME_PREFERENCE, isDarkPortalTheme, resolvePortalTheme } from "./portalTheme";

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

  it("the admin console theme is opt-in only and paints dark", () => {
    expect(resolvePortalTheme("console", true)).toBe("console");
    expect(resolvePortalTheme("console", false)).toBe("console");
    expect(resolvePortalTheme("system", false)).not.toBe("console");
    expect(isDarkPortalTheme("console")).toBe(true);
    expect(isDarkPortalTheme("dark")).toBe(true);
    expect(isDarkPortalTheme("light")).toBe(false);
  });
});
