import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { formatSnapshotMoney } from "@/lib/solutionSnapshotView";
import { cn } from "@/lib/utils";
import { rectOverlapsPageContent } from "@/lib/stickyCtaVisibility";
import { isWarehousePath, isWarehouseTransactionalPath, warehousePath } from "@/lib/warehousePaths";

/**
 * Persistent Your Solution dock on /store/* — desktop bottom-right, mobile sticky.
 * Sits above Ask DE / sticky CTA. Does not replace the marketing assessment bar.
 *
 * Its own fixed position is a stable offset from the bottom chrome, so unlike
 * the assessment bar it never moves — but that means whatever product grid or
 * rail happens to scroll into that exact band would sit underneath it with no
 * warning. Reuses the same blocking-target check the assessment bar uses
 * (any StoreProductCard, the trust strip, PDP's related-products rail) and
 * fades out rather than printing over a price or Add/Configure button.
 */
export function SolutionMobileBar() {
  const [location] = useLocation();
  const { items, totals, openCart, isOpen } = useCart();
  // Canonical Warehouse route helpers, not a hand-written /store/ regex: the
  // transactional routes moved to /internal/warehouse/* and the old pattern
  // could never match them, so the dock rendered over checkout (issue #239).
  const onStore = isWarehousePath(location);
  const onCheckoutFlow = isWarehouseTransactionalPath(location);
  const onPdp = location.startsWith(warehousePath("/product/"));
  const barRef = useRef<HTMLDivElement>(null);
  const [overlapping, setOverlapping] = useState(false);

  const hidden = !onStore || onCheckoutFlow || isOpen || items.length === 0;

  useEffect(() => {
    if (hidden) return;
    const measure = () => {
      const el = barRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setOverlapping(rectOverlapsPageContent(rect, (x) => document.elementsFromPoint(x, rect.top + Math.min(20, rect.height / 2))));
    };
    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    const poll = window.setInterval(measure, 500);
    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      window.clearInterval(poll);
    };
  }, [hidden, location]);

  if (hidden) return null;

  return (
    <div
      ref={barRef}
      className={cn(
        "de-fixed-in-canvas fixed z-40 px-3 transition-opacity duration-150 sm:px-0",
        onPdp && "max-lg:hidden",
        overlapping ? "pointer-events-none opacity-0" : "pointer-events-none opacity-100",
      )}
      style={{
        bottom:
          "calc(var(--de-chrome-inset) + var(--de-cookie-h) + var(--de-unified-bar-h) + var(--de-sticky-cta-h, 0px) + 0.75rem)",
        right: "calc(var(--de-chrome-inset) + 0.75rem)",
        left: "0.75rem",
      }}
      data-testid="solution-mobile-bar"
    >
      <div className="pointer-events-auto ml-auto flex w-full max-w-lg items-center gap-3 rounded-xl border border-white/10 bg-[#0a0a0a]/95 px-3 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] sm:max-w-md">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
          <Layers className="h-4 w-4 text-de-accent-ink" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-white/55">
            Your solution · {items.length} item{items.length === 1 ? "" : "s"}
          </p>
          <p className="truncate text-sm font-medium text-white">
            Due today {formatSnapshotMoney(totals.dueToday)}
            {totals.monthly > 0 ? ` · Monthly ${formatSnapshotMoney(totals.monthly)} / month` : ""}
          </p>
        </div>
        <Button
          type="button"
          className="h-11 shrink-0 bg-de-accent px-4 text-white hover:bg-[#6548ff]"
          onClick={openCart}
          data-testid="button-mobile-view-solution"
        >
          View Solution
        </Button>
      </div>
    </div>
  );
}
