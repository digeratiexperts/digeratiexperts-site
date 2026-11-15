/**
 * Permanent redirects for URLs people guess or that duplicate a canonical page
 * (MSP website research, 2026-11-11). Each target is a live page; the SPA mirrors
 * these with <Redirect> in App.tsx for in-app links.
 *
 * - /about and /services returned 404 although they are the first URLs a buyer types.
 * - Pricing lived at both /pricing and /proactive-ecosystem-pricing (same component);
 *   /pricing is canonical. /ecosystem-pricing is a different page (the full service
 *   matrix behind "Compare everything") and stays.
 */
export const MARKETING_REDIRECTS: Readonly<Record<string, string>> = {
  "/about": "/about/mission-values",
  "/services": "/solutions",
  "/proactive-ecosystem-pricing": "/pricing",
};

/** The redirect target for a request path (case- and trailing-slash-insensitive), or undefined. */
export function marketingRedirectFor(pathname: string): string | undefined {
  const key = pathname.length > 1 ? pathname.replace(/\/+$/, "").toLowerCase() : pathname;
  return Object.prototype.hasOwnProperty.call(MARKETING_REDIRECTS, key) ? MARKETING_REDIRECTS[key] : undefined;
}
