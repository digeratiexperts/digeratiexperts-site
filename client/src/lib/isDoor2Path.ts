/** Public Door 2 routes — Solve a Business Need + Solution Request. */
export function isDoor2Path(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
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
