import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem("hc-theme");
  } catch {
    stored = null;
  }
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export type { Theme };

/** `applyToRoot: false` leaves the page's own `.hc` elements alone (the mesh themes each band itself). */
export function useTheme({ applyToRoot = true }: { applyToRoot?: boolean } = {}) {
  const [theme, setTheme] = useState<Theme>(readInitialTheme);
  useEffect(() => {
    document.documentElement.dataset.hcTheme = theme;
    if (applyToRoot) {
      const root = document.querySelector<HTMLElement>(".hc");
      if (root) root.dataset.theme = theme;
    }
    try {
      window.localStorage.setItem("hc-theme", theme);
    } catch {
      // Storage can be blocked (private window); the toggle still works for this visit.
    }
  }, [theme, applyToRoot]);
  return { theme, setTheme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button type="button" className="hc-theme-toggle" onClick={onToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} aria-pressed={theme === "light"}>
      {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}
