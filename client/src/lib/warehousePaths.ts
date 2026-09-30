/** Staff Digital Warehouse — never link here from public marketing chrome. */
export const WAREHOUSE_BASE = "/internal/warehouse";

export function warehousePath(subpath = ""): string {
  if (!subpath || subpath === "/") return WAREHOUSE_BASE;
  const suffix = subpath.startsWith("/") ? subpath : `/${subpath}`;
  return `${WAREHOUSE_BASE}${suffix}`;
}

export function isWarehousePath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return pathname === WAREHOUSE_BASE || pathname.startsWith(`${WAREHOUSE_BASE}/`);
}

/**
 * The four transactional Warehouse screens. Floating solution chrome must not
 * render over them (issue #239): checkout and quote-request carry their own
 * order summary, and the two confirmations show the completed record.
 */
export const WAREHOUSE_TRANSACTIONAL_SEGMENTS = [
  "checkout",
  "quote-request",
  "quote-confirmation",
  "order-confirmation",
] as const;

export function isWarehouseTransactionalPath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return WAREHOUSE_TRANSACTIONAL_SEGMENTS.some((segment) => {
    const base = warehousePath(segment);
    return pathname === base || pathname.startsWith(`${base}/`);
  });
}
