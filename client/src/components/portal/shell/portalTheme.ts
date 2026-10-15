import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/**
 * The theme actually painted. "console" is the opt-in admin-console dark theme
 * (Joe, 2026-10-14: "a dark theme that is like Entra and IT dashboards"): neutral
 * greys, blue accent, square corners. It is never the default and never what
 * "Match device" picks.
 */
export type PortalTheme = "black" | "dark" | "light" | "console";
/** What the viewer chose. "system" follows the device's light/dark setting. */
export type PortalThemePreference = PortalTheme | "system";
export type PortalContrast = "none" | "boost" | "max";

const STORAGE_KEY = "de-portal-theme";
const EVENT = "de-portal-theme-change";
const LIGHT_QUERY = "(prefers-color-scheme: light)";
const CONTRAST_KEY = "de-portal-contrast";
const CONTRAST_EVENT = "de-portal-contrast-change";

/**
 * Joe, 2026-10-11: pure black is the initial portal theme. Existing saved
 * choices still win. Match device resolves only to light or dark; browsers
 * do not have a separate pure-black preference.
 */
export const DEFAULT_PORTAL_THEME_PREFERENCE: PortalThemePreference = "black";

function isThemePreference(value: unknown): value is PortalThemePreference {
  return value === "black" || value === "light" || value === "dark" || value === "console" || value === "system";
}

/** Themes painted on a dark field, which also take Tailwind's `dark` class. */
export function isDarkPortalTheme(theme: PortalTheme): boolean {
  return theme !== "light";
}

function isContrast(value: unknown): value is PortalContrast {
  return value === "none" || value === "boost" || value === "max";
}

export function resolvePortalTheme(preference: PortalThemePreference, deviceWantsLight: boolean): PortalTheme {
  if (preference !== "system") return preference;
  return deviceWantsLight ? "light" : "dark";
}

export function readPortalThemePreference(): PortalThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isThemePreference(stored)) return stored;
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
      if (isThemePreference(next)) setPreference(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) setPreference(readPortalThemePreference());
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);

    let media: MediaQueryList | null = null;
    const onMedia = (e: MediaQueryListEvent) => setLight(e.matches);
    try {
      media = typeof window.matchMedia === "function" ? window.matchMedia(LIGHT_QUERY) : null;
      if (media) setLight(media.matches);
      media?.addEventListener?.("change", onMedia);
    } catch {
      media = null;
    }

    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
      media?.removeEventListener?.("change", onMedia);
    };
  }, []);

  const update = useCallback((next: PortalThemePreference) => {
    setPreference(next);
    writePortalThemePreference(next);
  }, []);

  return [resolvePortalTheme(preference, light), preference, update];
}

export function readPortalContrast(): PortalContrast {
  try {
    const stored = localStorage.getItem(CONTRAST_KEY);
    if (isContrast(stored)) return stored;
  } catch {
    /* private mode */
  }
  return "none";
}

export function writePortalContrast(contrast: PortalContrast) {
  try {
    localStorage.setItem(CONTRAST_KEY, contrast);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(CONTRAST_EVENT, { detail: contrast }));
}

export function usePortalContrast(): [PortalContrast, (next: PortalContrast) => void] {
  const [contrast, setContrast] = useState<PortalContrast>(readPortalContrast);
  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<PortalContrast>).detail;
      if (isContrast(next)) setContrast(next);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === CONTRAST_KEY || event.key === null) setContrast(readPortalContrast());
    };
    window.addEventListener(CONTRAST_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CONTRAST_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const update = useCallback((next: PortalContrast) => {
    setContrast(next);
    writePortalContrast(next);
  }, []);
  return [contrast, update];
}

/** One owner per page, including sign-in. Body scope also reaches Radix portals. */
export function usePortalAppearance() {
  const [theme, themePreference, setThemePreference] = usePortalTheme();
  const [contrast, setContrast] = usePortalContrast();
  useLayoutEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const previous = {
      theme: root.getAttribute("data-theme"),
      contrast: root.getAttribute("data-contrast"),
      portalTheme: body.getAttribute("data-portal-theme"),
      rootScope: root.classList.contains("de-portal-root"),
      bodyScope: body.classList.contains("de-portal-scope"),
      dark: root.classList.contains("dark"),
    };
    root.classList.add("de-portal-root");
    root.classList.toggle("dark", isDarkPortalTheme(theme));
    root.dataset.theme = theme;
    root.dataset.contrast = contrast;
    body.classList.add("de-portal-scope");
    body.dataset.portalTheme = theme;
    return () => {
      const restore = (element: HTMLElement, key: string, value: string | null) => {
        if (value === null) element.removeAttribute(key);
        else element.setAttribute(key, value);
      };
      restore(root, "data-theme", previous.theme);
      restore(root, "data-contrast", previous.contrast);
      restore(body, "data-portal-theme", previous.portalTheme);
      root.classList.toggle("de-portal-root", previous.rootScope);
      root.classList.toggle("dark", previous.dark);
      body.classList.toggle("de-portal-scope", previous.bodyScope);
    };
  }, [theme, contrast]);
  return { theme, themePreference, setThemePreference, contrast, setContrast };
}
