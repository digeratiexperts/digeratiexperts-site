import { PORTAL_LOGIN } from "./portalUrls";
import { marketplaceReturnTo, PORTAL_DASHBOARD_PATH, PORTAL_LOGIN_PATH } from "@shared/portalReturnTo";

function portalAuthHeaders(extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = {};
  if (extra) {
    if (extra instanceof Headers) {
      extra.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(extra)) {
      for (const [key, value] of extra) headers[key] = value;
    } else {
      Object.assign(headers, extra);
    }
  }
  // Shared HttpOnly portalAuth cookie is canonical; do not reintroduce
  // localStorage bearer tokens for browser session gates.
  return headers;
}

export const PORTAL_SESSION_RESET_EVENT = "de-portal-session-reset";

export function clearPortalUserSnapshot() {
  for (const key of ["portalUser", "portalUserId", "userEmail"]) {
    try { localStorage.removeItem(key); } catch { /* storage is optional */ }
  }
}

/** Purge only legacy keys owned by portal sign-in, even when storage is denied. */
export function clearPortalLocalSession() {
  clearPortalUserSnapshot();
  for (const key of ["portalToken", "impersonatingCompany"]) {
    try {
      localStorage.removeItem(key);
    } catch {
      // One denied key must not prevent memory invalidation or navigation.
    }
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PORTAL_SESSION_RESET_EVENT));
}

/** Redirect to canonical portal login (absolute host — never //login). */
export function redirectToPortalLogin(returnTo?: string) {
  if (typeof window === "undefined") return;
  clearPortalLocalSession();
  const path = window.location.pathname || "";
  if (path === PORTAL_LOGIN_PATH || path.startsWith(`${PORTAL_LOGIN_PATH}?`)) return;

  const dest = marketplaceReturnTo(returnTo || `${path}${window.location.search || ""}`);
  const safeReturn = dest === PORTAL_LOGIN_PATH ? PORTAL_DASHBOARD_PATH : dest;

  const qs = new URLSearchParams({ returnTo: safeReturn });
  window.location.href = `${PORTAL_LOGIN}?${qs.toString()}`;
}

export async function portalFetch(url: string, options: RequestInit = {}, notifySessionExpiry = true) {
  const headers = portalAuthHeaders(options.headers);

  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && notifySessionExpiry && typeof window !== "undefined") {
    // A background query must never hard-navigate away from a form or ticket
    // draft. The portal shell can present a re-auth prompt and explicitly call
    // redirectToPortalLogin after it has preserved the user's work.
    window.dispatchEvent(new CustomEvent("de-portal-session-expired", {
      detail: { returnTo: `${window.location.pathname}${window.location.search}` },
    }));
  }

  return response;
}

export async function portalGet<T>(url: string, { notifySessionExpiry = true }: { notifySessionExpiry?: boolean } = {}): Promise<T> {
  const response = await portalFetch(url, {}, notifySessionExpiry);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status}: ${text}`);
  }

  return response.json();
}

export async function portalPost<T>(url: string, data: unknown): Promise<T> {
  const response = await portalFetch(url, {
    method: "POST",
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      if (json.message) message = json.message;
      else if (json.error) message = json.error;
    } catch {}
    throw new Error(message);
  }

  return response.json();
}
