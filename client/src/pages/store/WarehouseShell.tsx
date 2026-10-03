import { Link, useLocation } from "wouter";
import { Warehouse } from "lucide-react";
import { MegaMenu } from "@/components/MegaMenu";
import { WAREHOUSE_BASE, warehousePath } from "@/lib/warehousePaths";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const NAV = [
  { href: WAREHOUSE_BASE, label: "Ops home", match: "exact" as const },
  { href: warehousePath("co-managed"), label: "SKU catalog", match: "prefix" as const },
  { href: warehousePath("managed"), label: "Managed packages", match: "prefix" as const },
  { href: warehousePath("hub-catalog"), label: "Hub feed", match: "prefix" as const },
  { href: warehousePath("vendors"), label: "Vendors", match: "prefix" as const },
  { href: warehousePath("quote-request"), label: "Quotes", match: "prefix" as const },
  { href: warehousePath("checkout"), label: "Checkout", match: "prefix" as const },
] as const;

function navActive(pathname: string, href: string, match: "exact" | "prefix"): boolean {
  const path = pathname.split("?")[0] ?? pathname;
  if (match === "exact") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

/**
 * Staff chrome for the Digital Warehouse. Not the public Store shell —
 * ops navigation, staff-only copy, electric accent (Joe-decided warehouse lock).
 */
export function WarehouseShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="relative min-h-screen bg-[#0a0a0a]" data-testid="warehouse-shell" data-accent="electric">
      <MegaMenu />
      <div className="border-b border-de-hairline bg-de-raised/80 de-nav-clear">
        <div className="mx-auto flex max-w-[var(--de-canvas)] flex-col gap-3 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-de-accent/40 bg-de-accent/10 text-de-accent-ink">
              <Warehouse className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-de-accent-ink">
                Staff only
              </p>
              <p className="truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
                DE Digital Warehouse
              </p>
            </div>
          </div>
          <nav
            aria-label="Warehouse sections"
            className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {NAV.map((item) => {
              const active = navActive(location, item.href, item.match);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-2 text-sm transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]",
                    active
                      ? "border-de-accent bg-de-accent/15 text-white"
                      : "border-de-hairline bg-transparent text-white/70 hover:border-de-accent/50 hover:text-white",
                  )}
                  data-testid={`warehouse-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}
