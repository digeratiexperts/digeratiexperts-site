import { useCallback, useEffect, useState } from "react";

/**
 * The theme actually painted. "console" is the opt-in admin-console dark theme
 * (Joe, 2026-10-14: "a dark theme that is like Entra and IT dashboards"): neutral
 * greys, blue accent, square corners. It is never the default and never what
 * "Match device" picks.
 */
export type PortalTheme = "dark" | "light" | "console";
/** What the viewer chose. "system" follows the device's light/dark setting. */
export type PortalThemePreference = PortalTheme | "system";

const STORAGE_KEY = "de-portal-theme";
const EVENT = "de-portal-theme-change";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

/**
 * Joe, 2026-10-02: "keep dark as the default" and "follow each visitor's
 * device setting". Browsers never report "no preference" (an unset device
 * reads as light), so both can only hold together this way: graphite dark is
 * the default, and "Match device" is a choice in the user menu that follows
 * the device's light/dark setting live.
 */
export const DEFAULT_PORTAL_THEME_PREFERENCE: PortalThemePreference = "dark";

const STORED = new Set<string>(["dark", "light", "console", "system"]);

function isPreference(value: unknown): value is PortalThemePreference {
  return typeof value === "string" && STORED.has(value);
}

/** Themes painted on a dark field, which also take Tailwind's `dark` class. */
export function isDarkPortalTheme(theme: PortalTheme): boolean {
  return theme !== "light";
}

export function resolvePortalTheme(preference: PortalThemePreference, deviceWantsLight: boolean): PortalTheme {
  if (preference !== "system") return preference;
  return deviceWantsLight ? "light" : "dark";
}

export function readPortalThemePreference(): PortalThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isPreference(stored)) return stored;
  } catch {
    /* private mode */
  }
  return DEFAULT_PORTAL_THEME_PREFERENCE;
}

function deviceWantsLight(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(LIGHT_QUERY).matches;
  } catch {
    return false;
  }
}

/** Resolved theme for code outside React (e.g. first paint). */
export function readPortalTheme(): PortalTheme {
  return resolvePortalTheme(readPortalThemePreference(), deviceWantsLight());
}

export function writePortalThemePreference(preference: PortalThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: preference }));
}

/**
 * Per-viewer preference. Returns the painted theme, the stored preference and
 * a setter. Follows the device live while the preference is "system".
 */
export function usePortalTheme(): [PortalTheme, PortalThemePreference, (next: PortalThemePreference) => void] {
  const [preference, setPreference] = useState<PortalThemePreference>(() =>
    typeof window === "undefined" ? DEFAULT_PORTAL_THEME_PREFERENCE : readPortalThemePreference(),
  );
  const [light, setLight] = useState<boolean>(() => deviceWantsLight());

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<PortalThemePreference>).detail;
      if (isPreference(next)) setPreference(next);
    };
    window.addEventListener(EVENT, onChange);

    let media: MediaQueryList | null = null;
    const onMedia = (e: MediaQueryListEvent) => setLight(e.matches);
    try {
      media = typeof window.matchMedia === "function" ? window.matchMedia(LIGHT_QUERY) : null;
      media?.addEventListener?.("change", onMedia);
    } catch {
      media = null;
    }

    return () => {
      window.removeEventListener(EVENT, onChange);
      media?.removeEventListener?.("change", onMedia);
    };
  }, []);

  const update = useCallback((next: PortalThemePreference) => {
    setPreference(next);
    writePortalThemePreference(next);
  }, []);

  return [resolvePortalTheme(preference, light), preference, update];
}
