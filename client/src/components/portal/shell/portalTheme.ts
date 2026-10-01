import { useCallback, useEffect, useState } from "react";

export type PortalTheme = "dark" | "light";

const STORAGE_KEY = "de-portal-theme";
const EVENT = "de-portal-theme-change";

export function readPortalTheme(): PortalTheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* private mode */
  }
  return "dark";
}

export function writePortalTheme(theme: PortalTheme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: theme }));
}

/** Per-viewer preference; dark graphite is the portal default. */
export function usePortalTheme(): [PortalTheme, (next: PortalTheme) => void] {
  const [theme, setTheme] = useState<PortalTheme>(() =>
    typeof window === "undefined" ? "dark" : readPortalTheme(),
  );

  useEffect(() => {
    const onChange = (event: Event) => {
      const next = (event as CustomEvent<PortalTheme>).detail;
      if (next === "light" || next === "dark") setTheme(next);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const update = useCallback((next: PortalTheme) => {
    setTheme(next);
    writePortalTheme(next);
  }, []);

  return [theme, update];
}
