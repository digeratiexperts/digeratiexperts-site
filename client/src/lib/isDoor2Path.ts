/** Public Door 2 routes — Solve a Business Need + Solution Request. */
export function isDoor2Path(path: string): boolean {
  // The server serves `/store/` and `/store/solution/` as the same pages (spaKnownPaths), so match them too.
  const pathname = ((path.split("?")[0] ?? path).replace(/\/+$/, "") || "/").toLowerCase();
  return (
    pathname === "/store" ||
    pathname === "/store/checkout" ||
    pathname === "/store/solution" ||
    pathname.startsWith("/store/solutions/") ||
    pathname.startsWith("/store/solution/submitted/") ||
    pathname === "/solutions/business-needs" ||
    pathname.startsWith("/solutions/business-needs/") ||
    pathname === "/solutions/request" ||
    pathname.startsWith("/solutions/request/")
  );
}
