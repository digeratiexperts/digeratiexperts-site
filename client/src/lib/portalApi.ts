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
  const token = localStorage.getItem("portalToken");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function clearPortalLocalSession() {
  localStorage.removeItem("portalToken");
  localStorage.removeItem("portalUser");
  localStorage.removeItem("portalUserId");
  localStorage.removeItem("impersonatingCompany");
}

/** Redirect to canonical portal login (absolute host — never //login). */
export function redirectToPortalLogin(returnTo?: string) {
  if (typeof window === "undefined") return;
  const path = window.location.pathname || "";
  if (path === PORTAL_LOGIN_PATH || path.startsWith(`${PORTAL_LOGIN_PATH}?`)) return;

  const dest = marketplaceReturnTo(returnTo || `${path}${window.location.search || ""}`);
  const safeReturn = dest === PORTAL_LOGIN_PATH ? PORTAL_DASHBOARD_PATH : dest;

  clearPortalLocalSession();
  const qs = new URLSearchParams({ returnTo: safeReturn });
  window.location.href = `${PORTAL_LOGIN}?${qs.toString()}`;
}

export async function portalFetch(url: string, options: RequestInit = {}) {
  const headers = portalAuthHeaders(options.headers);

  if (options.body && typeof options.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && typeof window !== "undefined") {
    // A background query must never hard-navigate away from a form or ticket
    // draft. The portal shell can present a re-auth prompt and explicitly call
    // redirectToPortalLogin after it has preserved the user's work.
    window.dispatchEvent(new CustomEvent("de-portal-session-expired", {
      detail: { returnTo: `${window.location.pathname}${window.location.search}` },
    }));
  }

  return response;
}

export async function portalGet<T>(url: string): Promise<T> {
  const response = await portalFetch(url);

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
