/** Public destage map for legacy /store URLs. Server-only — no vendor/SKU catalog dump. */

export const PUBLIC_STORE_PATH_REDIRECTS: Record<string, string> = {
  "/store/managed": "/solutions/proactive-ecosystem",
  "/store/co-managed": "/store",
  "/store/quote-request": "/solutions/request",
  "/store/order-confirmation": "/store",
};

/** Four public ProActive operating-model SKUs → Door 1 pages. Everything else is generic deny. */
export const PUBLIC_SKU_REDIRECTS: Record<string, string> = {
  "DE-SVC-MGD-IT-MO": "/solutions/proactive-it-ecosystem",
  "DE-SVC-MGD-OFFICE-MO": "/solutions/proactive-office-ecosystem",
  "DE-SVC-MGD-BUSINESS-MO": "/solutions/proactive-business-ecosystem",
  "DE-SVC-MGD-ENTERPRISE-MO": "/solutions/proactive-enterprise-ecosystem",
};

export type LegacyStoreClassification =
  | { kind: "public_store" }
  | { kind: "public_redirect"; to: string }
  | { kind: "generic_deny" };

export function toWarehousePath(storePath: string): string {
  if (storePath === "/store") return "/internal/warehouse";
  if (storePath.startsWith("/store/")) {
    return `/internal/warehouse${storePath.slice("/store".length)}`;
  }
  return "/internal/warehouse";
}

export function classifyLegacyStorePath(pathname: string): LegacyStoreClassification {
  const raw = pathname.split("?")[0] || pathname;
  // /store/ must classify like /store (same for checkout/solution trailing slash).
  const path = raw.length > 1 ? raw.replace(/\/+$/, "") : raw;
  if (PUBLIC_STORE_PATH_REDIRECTS[path]) {
    return { kind: "public_redirect", to: PUBLIC_STORE_PATH_REDIRECTS[path] };
  }
  if (path.startsWith("/store/quote-confirmation/")) {
    return { kind: "public_redirect", to: "/solutions/request" };
  }
  const skuMatch = path.match(/^\/store\/product\/([^/]+)$/);
  if (skuMatch) {
    const sku = decodeURIComponent(skuMatch[1] || "");
    const dest = PUBLIC_SKU_REDIRECTS[sku];
    if (dest) return { kind: "public_redirect", to: dest };
    return { kind: "generic_deny" };
  }
  if (path === "/store" || path === "/store/checkout" || path === "/store/solution" || path.startsWith("/store/solutions/")) {
    return { kind: "public_store" };
  }
  if (path.startsWith("/store/")) {
    return { kind: "generic_deny" };
  }
  return { kind: "generic_deny" };
}
