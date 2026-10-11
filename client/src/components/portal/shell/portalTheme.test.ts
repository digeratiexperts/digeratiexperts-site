import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PORTAL_THEME_PREFERENCE, readPortalContrast, readPortalThemePreference, resolvePortalTheme, writePortalContrast, writePortalThemePreference } from "./portalTheme";

afterEach(() => vi.unstubAllGlobals());

describe("portal theme", () => {
  it("defaults to pure black whatever the device says", () => {
    expect(DEFAULT_PORTAL_THEME_PREFERENCE).toBe("black");
    expect(resolvePortalTheme(DEFAULT_PORTAL_THEME_PREFERENCE, true)).toBe("black");
    expect(resolvePortalTheme(DEFAULT_PORTAL_THEME_PREFERENCE, false)).toBe("black");
  });

  it("Match device follows the device's light/dark setting", () => {
    expect(resolvePortalTheme("system", true)).toBe("light");
    expect(resolvePortalTheme("system", false)).toBe("dark");
  });

  it("an explicit choice beats the device", () => {
    expect(resolvePortalTheme("black", true)).toBe("black");
    expect(resolvePortalTheme("black", false)).toBe("black");
    expect(resolvePortalTheme("dark", true)).toBe("dark");
    expect(resolvePortalTheme("light", false)).toBe("light");
  });

  it("keeps existing saved choices and persists Black and contrast independently", () => {
    const values = new Map([["de-portal-theme", "light"]]);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    expect(readPortalThemePreference()).toBe("light");
    writePortalThemePreference("black");
    writePortalContrast("boost");
    expect(readPortalThemePreference()).toBe("black");
    expect(readPortalContrast()).toBe("boost");
    expect(dispatchEvent.mock.calls.map(([event]) => [event.type, event.detail])).toEqual([
      ["de-portal-theme-change", "black"],
      ["de-portal-contrast-change", "boost"],
    ]);
  });

  it("falls back safely for missing, invalid or unavailable browser storage", () => {
    for (const value of [null, "unknown"]) {
      vi.stubGlobal("localStorage", { getItem: () => value });
      expect(readPortalThemePreference()).toBe("black");
      expect(readPortalContrast()).toBe("none");
    }
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("Storage unavailable"); } });
    expect(readPortalThemePreference()).toBe("black");
    expect(readPortalContrast()).toBe("none");
  });
});
