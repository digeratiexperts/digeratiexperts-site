import { isPaymentPagePath } from "./paymentPage";

/**
 * Marketing pixels, GA, and Microsoft Clarity stay off on the portal,
 * checkout, the store, and payment pages. DE Desk chat is masked or paused
 * separately because it is a widget, not a path.
 */
export function isStoreTrackingPath(pathname: string): boolean {
  const path = String(pathname || "").split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase() || "/";
  return path === "/store" || path.startsWith("/store/");
}

export function skipMarketingPixels(hostname: string, pathname: string): boolean {
  return isPortalContext(hostname, pathname) || isPaymentPagePath(pathname) || isStoreTrackingPath(pathname);
}

export function isPortalContext(hostname: string, pathname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "portal.digeratiexperts.com" || host.startsWith("portal.")) return true;
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase() || "/";
  return path === "/portal" || path.startsWith("/portal/") ||
    path === "/login" || path === "/signup" || path === "/agreement-gate" ||
    path === "/internal" || path.startsWith("/internal/") ||
    path === "/official-network-planner" || path === "/homepage-challenger";
}
