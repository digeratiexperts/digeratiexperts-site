import { isDoor2Path } from "@/lib/isDoor2Path";
import { isWarehousePath } from "@/lib/warehousePaths";
import { isQuizRoomPath } from "@/lib/quizRoom";
import { isStoreTrackingPath, normalizeSitePath, pathIsOrUnder, skipClarity } from "@shared/trackingExclusions";

export const SITE_POPUP_STORAGE_KEY = "de_site_popup_v1";
export const SITE_POPUP_COOKIE = "de_site_popup_v1";
/** Storage key used by the scratch-card offer. */
export const SCRATCH_OFFER_STORAGE_KEY = "de_scratch_offer_v1";
export const EXIT_POPUP_DISMISSED_KEY = "exitPopupDismissed";

export type SitePopupId = "goal" | "scratch";

export type SitePopupRecord = { id: SitePopupId; at: number };

const EXTRA_EXCLUDED = ["/checkout", "/order", "/orders", "/legal", "/support"];

/** Marketing pages only: never portal, store, checkout, order, desk, form, legal or support. */
export function isPromoPopupPath(pathname: string, hostname = "digeratiexperts.com"): boolean {
  const path = normalizeSitePath(pathname);
  if (skipClarity(hostname, path)) return false;
  if (isStoreTrackingPath(path) || isDoor2Path(path) || isWarehousePath(path) || isQuizRoomPath(path)) return false;
  return !EXTRA_EXCLUDED.some((route) => pathIsOrUnder(path, route));
}

function isPopupId(value: unknown): value is SitePopupId {
  return value === "goal" || value === "scratch";
}

export function parseSitePopup(raw: string | null): SitePopupRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SitePopupRecord>;
    if (!isPopupId(value.id) || typeof value.at !== "number") return null;
    return { id: value.id, at: value.at };
  } catch {
    if (isPopupId(raw)) return { id: raw, at: 0 };
    return null;
  }
}

export function readCookie(cookieHeader: string, name: string): string | null {
  const prefix = `${name}=`;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return null;
}

export function sitePopupCookieString(id: SitePopupId, maxAgeSec = 60 * 60 * 24 * 400): string {
  return `${SITE_POPUP_COOKIE}=${encodeURIComponent(id)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
}

export function readSitePopup(
  storage: Pick<Storage, "getItem"> | undefined,
  cookieHeader = "",
): SitePopupRecord | null {
  try {
    const fromStorage = parseSitePopup(storage?.getItem(SITE_POPUP_STORAGE_KEY) ?? null);
    if (fromStorage) return fromStorage;
  } catch {
    /* storage blocked */
  }
  return parseSitePopup(readCookie(cookieHeader, SITE_POPUP_COOKIE));
}

export function writeSitePopup(
  storage: Pick<Storage, "setItem"> | undefined,
  record: SitePopupRecord,
  setCookie?: (value: string) => void,
): void {
  try {
    storage?.setItem(SITE_POPUP_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* storage blocked */
  }
  setCookie?.(sitePopupCookieString(record.id));
}

export function clearSitePopup(
  storage: Pick<Storage, "removeItem"> | undefined,
  setCookie?: (value: string) => void,
): void {
  try {
    storage?.removeItem(SITE_POPUP_STORAGE_KEY);
  } catch {
    /* storage blocked */
  }
  setCookie?.(`${SITE_POPUP_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
}

export function scratchOfferConsumed(storage: Pick<Storage, "getItem"> | undefined): boolean {
  try {
    const raw = storage?.getItem(SCRATCH_OFFER_STORAGE_KEY);
    if (!raw) return false;
    const value = JSON.parse(raw) as { claimCode?: unknown; dismissedAt?: unknown; open?: unknown; step?: unknown };
    if (typeof value.claimCode === "string" && value.claimCode.length > 0) return true;
    if (typeof value.dismissedAt === "number") return true;
    if (value.open === true) return true;
    if (typeof value.step === "string" && value.step !== "scratch") return true;
    return false;
  } catch {
    return false;
  }
}

export function exitIntentShownThisSession(session: Pick<Storage, "getItem"> | undefined): boolean {
  try {
    return session?.getItem(EXIT_POPUP_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function markExitIntentShown(session: Pick<Storage, "setItem"> | undefined): void {
  try {
    session?.setItem(EXIT_POPUP_DISMISSED_KEY, "true");
  } catch {
    /* storage blocked */
  }
}

export function otherPromoOpen(doc: Pick<Document, "documentElement" | "querySelector"> | undefined): boolean {
  if (!doc) return false;
  return (
    doc.documentElement.hasAttribute("data-de-desk-open") ||
    !!doc.querySelector('[data-testid="overlay-exit-intent"]') ||
    !!doc.querySelector('[data-testid="scratch-offer"]')
  );
}

/**
 * Whether the goal picker may auto-show. Defers when the scratch offer already
 * ran, when the shared slot is taken, or when the exit-intent popup has shown
 * this session.
 */
export function canAutoShowGoalPicker(input: {
  storage?: Pick<Storage, "getItem">;
  session?: Pick<Storage, "getItem">;
  cookieHeader?: string;
  document?: Pick<Document, "documentElement" | "querySelector">;
}): boolean {
  if (readSitePopup(input.storage, input.cookieHeader ?? "")) return false;
  if (scratchOfferConsumed(input.storage)) return false;
  if (exitIntentShownThisSession(input.session)) return false;
  if (otherPromoOpen(input.document)) return false;
  return true;
}

/** Claim the one-popup slot. Returns false if another offer already claimed it. */
export function claimSitePopup(
  id: SitePopupId,
  storage: Pick<Storage, "getItem" | "setItem"> | undefined,
  now: number,
  cookieHeader = "",
  setCookie?: (value: string) => void,
): boolean {
  const existing = readSitePopup(storage, cookieHeader);
  if (existing && existing.id !== id) return false;
  if (id === "goal" && !existing && scratchOfferConsumed(storage)) return false;
  writeSitePopup(storage, { id, at: now }, setCookie);
  return true;
}
