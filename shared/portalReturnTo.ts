/**
 * Safe post-login destinations for the Client Portal.
 * Never allow protocol-relative //login or off-site hosts.
 */

export const PORTAL_DASHBOARD_PATH = "/portal/dashboard";
export const PORTAL_MARKETPLACE_PATH = "/portal/marketplace";
export const PORTAL_LOGIN_PATH = "/portal/login";

const BLOCKED_PREFIXES = [
  PORTAL_LOGIN_PATH,
  "/portal/signup",
  "/portal/forgot-password",
  "/portal/reset-password",
];

const EXTRA_ALLOWED = [
  "/official-network-planner",
  "/de-ecosystem-matrix-offical",
  // Staff Digital Warehouse checkout/quote flows resume after portal login.
  "/internal/warehouse",
];

const ALLOWED_HOSTS = new Set([
  "portal.digeratiexperts.com",
  "digeratiexperts.com",
  "www.digeratiexperts.com",
]);

function extractReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("//") || trimmed.includes("\\")) return null;
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed)) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
      return `${url.pathname}${url.search}`;
    } catch {
      return null;
    }
  }

  if (!trimmed.startsWith("/")) return null;
  return trimmed.split("#")[0];
}

function isBlockedAuthPath(path: string): boolean {
  const pathname = path.split("?")[0] || path;
  return BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAllowedPath(path: string): boolean {
  const pathname = path.split("?")[0] || path;
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return true;
  return EXTRA_ALLOWED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Public Store is Door 2. Existing-client catalog lives at /portal/marketplace. */
export function marketplaceReturnTo(raw: unknown): string {
  const path = extractReturnPath(raw);
  if (path) {
    const pathname = path.split("?")[0] || path;
    if (pathname === "/store" || pathname.startsWith("/store/") || pathname === PORTAL_MARKETPLACE_PATH) {
      return PORTAL_MARKETPLACE_PATH;
    }
  }
  return sanitizeReturnTo(raw);
}

export function sanitizeReturnTo(raw: unknown): string {
  const path = extractReturnPath(raw);
  if (!path || path.length > 200) return PORTAL_DASHBOARD_PATH;
  if (isBlockedAuthPath(path) || !isAllowedPath(path)) return PORTAL_DASHBOARD_PATH;
  return path;
}
