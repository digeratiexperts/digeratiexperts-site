/**
 * Paths where a visitor pays or is sent to Zoho hosted checkout.
 * Marketing pixels must not load here, and the response CSP is tighter.
 */
export function isPaymentPagePath(pathname: string): boolean {
  const path = String(pathname || "").split(/[?#]/)[0].replace(/\/+$/, "").toLowerCase() || "/";
  if (path === "/store/checkout" || path.startsWith("/store/checkout/")) return true;
  if (path === "/support/pay-invoice") return true;
  if (path === "/portal/billing") return true;
  if (path === "/portal/payment" || path === "/pay") return true;
  if (/^\/portal\/invoices\/[^/]+\/pay$/.test(path)) return true;
  return false;
}
