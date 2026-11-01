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
const SCOPE_EVENT = "de-portal-appearance-scope-change";
export const PORTAL_APPEARANCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SCOPED_PREFIX = "de-portal-appearance:v1:";
type Appearance = { theme: PortalThemePreference; contrast: PortalContrast };
const defaults = (): Appearance => ({ theme: "black", contrast: "none" });
let memory = defaults();
let scopeKey: string | null = null;
let principal: string | null = null;
let scopeEpoch = 0;
let memoryExpiresAt = Infinity;
let storageFallback = false;

function announceScope() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SCOPE_EVENT));
}

function discardLegacyAppearance() {
  // Global choices have no trustworthy owner. Never assign them to the next login.
  for (const key of [STORAGE_KEY, CONTRAST_KEY]) {
    try { localStorage.removeItem(key); } catch { /* storage is optional */ }
  }
}

export function clearPortalAppearanceScope() {
  scopeEpoch += 1;
  scopeKey = null;
  principal = null;
  memory = defaults();
  memoryExpiresAt = Infinity;
  storageFallback = false;
  discardLegacyAppearance();
  announceScope();
}

/** Called only with the canonical /me response; this is never an auth decision. */
export async function setVerifiedPortalAppearanceContext(user: { id?: string; clientId?: string | null; role?: string; accountClass?: string }) {
  const validId = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 256;
  // /me currently returns a staff member's home client, not the acting company.
  // Staff appearance stays in memory until the server exposes that verified scope.
  const canSwitchCompany = user.role === "admin" || user.accountClass === "super_admin" || user.accountClass === "de_staff";
  const next = !canSwitchCompany && validId(user.id) && (user.clientId == null || validId(user.clientId))
    ? JSON.stringify([user.id, user.clientId ?? null]) : null;
  if (next !== null && next === principal) return;
  clearPortalAppearanceScope();
  if (next === null) return;
  principal = next;
  const pendingEpoch = scopeEpoch;
  try {
    // No email, raw account ID or tenant ID goes into preference keys/values.
    // The digest partitions a cache; it is pseudonymous, not proof of identity.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(next));
    if (pendingEpoch !== scopeEpoch) return;
    scopeKey = SCOPED_PREFIX + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    if (pendingEpoch !== scopeEpoch) return;
    // No trustworthy persistent partition is available: use document memory.
  }
  scopeEpoch += 1;
  memory = defaults();
  readAppearance();
  announceScope();
}

function readAppearance(): Appearance {
  discardLegacyAppearance();
  if (memoryExpiresAt <= Date.now()) memory = defaults();
  if (!scopeKey || storageFallback) return memory;
  let raw: string | null;
  try {
    raw = localStorage.getItem(scopeKey);
  } catch {
    return memory;
  }
  if (raw === null) {
    if (!storageFallback) memory = defaults();
    return memory;
  }
  try {
    if (raw.length > 512) throw new Error("Oversized appearance cache");
    const record = JSON.parse(raw);
    const now = Date.now();
    if (!record || Object.keys(record).sort().join(",") !== "contrast,expiresAt,savedAt,theme,version" || record.version !== 1 ||
      !isThemePreference(record.theme) || !isContrast(record.contrast) ||
      !Number.isSafeInteger(record.savedAt) || record.savedAt > now || record.savedAt < 0 ||
      record.expiresAt !== record.savedAt + PORTAL_APPEARANCE_TTL_MS || record.expiresAt <= now) {
      throw new Error("Invalid appearance cache");
    }
    memory = { theme: record.theme, contrast: record.contrast };
    memoryExpiresAt = record.expiresAt;
  } catch {
    memory = defaults();
    try { localStorage.removeItem(scopeKey); } catch { /* optional */ }
  }
  return memory;
}

function writeAppearance(next: Partial<Appearance>, expectedEpoch: number) {
  if (expectedEpoch !== scopeEpoch) return false;
  const appearance = { ...readAppearance(), ...next };
  memory = appearance;
  const savedAt = Date.now();
  memoryExpiresAt = savedAt + PORTAL_APPEARANCE_TTL_MS;
  if (scopeKey) {
    try {
      localStorage.setItem(scopeKey, JSON.stringify({ version: 1, savedAt, expiresAt: savedAt + PORTAL_APPEARANCE_TTL_MS, ...appearance }));
      storageFallback = false;
    } catch { storageFallback = true; }
  }
  return true;
}

/** Captures the current scope so a queued UI operation cannot write into another. */
export function portalAppearanceWriter() {
  const capturedEpoch = scopeEpoch;
  return {
    theme: (value: PortalThemePreference) => writePortalThemePreference(value, capturedEpoch),
    contrast: (value: PortalContrast) => writePortalContrast(value, capturedEpoch),
  };
}

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
  return readAppearance().theme;
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

export function writePortalThemePreference(preference: PortalThemePreference, expectedEpoch = scopeEpoch) {
  if (!isThemePreference(preference) || !writeAppearance({ theme: preference }, expectedEpoch)) return;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: preference }));
}

/**
 * Per-viewer preference. Returns the painted theme, the stored preference and
 * a setter. Follows the device live while the preference is "system".
 */
export function usePortalTheme(): [PortalTheme, PortalThemePreference, (next: PortalThemePreference) => void] {
  const [revision, setRevision] = useState(scopeEpoch);
  const [preference, setPreference] = useState<PortalThemePreference>(() =>
    typeof window === "undefined" ? DEFAULT_PORTAL_THEME_PREFERENCE : readPortalThemePreference(),
  );
  const [light, setLight] = useState<boolean>(() => deviceWantsLight());

  useEffect(() => {
    const onChange = () => {
      setRevision(scopeEpoch);
      setPreference(readPortalThemePreference());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === scopeKey || event.key === null) { memory = defaults(); storageFallback = false; onChange(); }
    };
    window.addEventListener(EVENT, onChange);
    window.addEventListener(SCOPE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    onChange();

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
      window.removeEventListener(SCOPE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
      media?.removeEventListener?.("change", onMedia);
    };
  }, []);

  const update = useCallback((next: PortalThemePreference) => {
    writePortalThemePreference(next, revision);
  }, [revision]);

  return [resolvePortalTheme(preference, light), preference, update];
}

export function readPortalContrast(): PortalContrast {
  return readAppearance().contrast;
}

export function writePortalContrast(contrast: PortalContrast, expectedEpoch = scopeEpoch) {
  if (!isContrast(contrast) || !writeAppearance({ contrast }, expectedEpoch)) return;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CONTRAST_EVENT, { detail: contrast }));
}

export function usePortalContrast(): [PortalContrast, (next: PortalContrast) => void] {
  const [revision, setRevision] = useState(scopeEpoch);
  const [contrast, setContrast] = useState<PortalContrast>(readPortalContrast);
  useEffect(() => {
    const onChange = () => {
      setRevision(scopeEpoch);
      setContrast(readPortalContrast());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === scopeKey || event.key === null) { memory = defaults(); storageFallback = false; onChange(); }
    };
    window.addEventListener(CONTRAST_EVENT, onChange);
    window.addEventListener(SCOPE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    onChange();
    return () => {
      window.removeEventListener(CONTRAST_EVENT, onChange);
      window.removeEventListener(SCOPE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const update = useCallback((next: PortalContrast) => {
    writePortalContrast(next, revision);
  }, [revision]);
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
