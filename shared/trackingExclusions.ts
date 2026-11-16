import { isPaymentPagePath } from "./paymentPage";

export function normalizeSitePath(pathname: string): string {
  return String(pathname || "").split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase() || "/";
}

export function pathIsOrUnder(pathname: string, route: string): boolean {
  const path = normalizeSitePath(pathname);
  const base = normalizeSitePath(route);
  return path === base || path.startsWith(base + "/");
}

/**
 * Marketing pixels and GA stay off on the portal, checkout, the store, and
 * payment pages. Clarity uses a tighter deny list (see skipClarity).
 */
export function isStoreTrackingPath(pathname: string): boolean {
  return pathIsOrUnder(pathname, "/store");
}

export function skipMarketingPixels(hostname: string, pathname: string): boolean {
  return isPortalContext(hostname, pathname) || isPaymentPagePath(pathname) || isStoreTrackingPath(pathname);
}

export function isPortalContext(hostname: string, pathname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "portal.digeratiexperts.com" || host.startsWith("portal.")) return true;
  const path = normalizeSitePath(pathname);
  return path === "/portal" || path.startsWith("/portal/") ||
    path === "/login" || path === "/signup" || path === "/agreement-gate" ||
    path === "/internal" || path.startsWith("/internal/") ||
    path === "/official-network-planner" || path === "/homepage-challenger";
}

/**
 * Microsoft Clarity must not record these routes: the portal, checkout and
 * store order pages, DE Desk chat, and pages whose purpose is a form
 * (contact, assessment, describe, sign-up, ticket). The DE Desk widget is
 * handled by the deskOpen flag, not a path.
 *
 * Strict masking (mask all text and inputs) is a Clarity dashboard setting.
 */
export const CLARITY_DENIED_ROUTES = [
  { type: "checkout", routes: ["/store/checkout"] },
  { type: "store-order", routes: ["/store/order", "/store/solution/submitted"] },
  { type: "desk", routes: ["/portal/chat"] },
  { type: "form-contact", routes: ["/contact"] },
  { type: "form-assessment", routes: ["/book", "/assessment"] },
  { type: "form-describe", routes: ["/describe-your-situation"] },
  { type: "form-signup", routes: ["/signup", "/portal/signup"] },
  { type: "form-ticket", routes: ["/support/submit-ticket", "/portal/tickets"] },
] as const;

export type ClarityDenial = (typeof CLARITY_DENIED_ROUTES)[number]["type"] | "portal" | "checkout" | "desk-widget";

function denialFromRoutes(pathname: string): ClarityDenial | null {
  if (isPaymentPagePath(pathname)) return "checkout";
  for (const group of CLARITY_DENIED_ROUTES) {
    for (const route of group.routes) {
      if (pathIsOrUnder(pathname, route)) return group.type;
    }
  }
  return null;
}

export function clarityDenial(hostname: string, pathname: string, deskOpen = false): ClarityDenial | null {
  if (deskOpen) return "desk-widget";
  const fromRoutes = denialFromRoutes(pathname);
  if (fromRoutes) return fromRoutes;
  if (isPortalContext(hostname, pathname)) return "portal";
  return null;
}

export function skipClarity(hostname: string, pathname: string, deskOpen = false): boolean {
  return clarityDenial(hostname, pathname, deskOpen) != null;
}
