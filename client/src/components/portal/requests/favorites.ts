import { useCallback, useEffect, useState } from "react";

/**
 * Portal favourites (catalog items by id, knowledge articles as "kb:<id>"),
 * kept per browser. Storage can be missing (private window, blocked site
 * data), so every access is guarded and the UI works without it.
 */

const FAV_KEY = "de-portal-request-favorites";
const EVENT = "de-portal-favorites-changed";

export function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAV_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function writeFavorites(list: string[]) {
  try {
    window.localStorage.setItem(FAV_KEY, JSON.stringify(list));
  } catch {
    /* not persisted */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useFavorites() {
  const [list, setList] = useState<string[]>(() => (typeof window === "undefined" ? [] : readFavorites()));
  useEffect(() => {
    const sync = () => setList(readFavorites());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const toggle = useCallback((id: string) => {
    const current = readFavorites();
    writeFavorites(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }, []);
  return { favorites: list, isFavorite: (id: string) => list.includes(id), toggle };
}
