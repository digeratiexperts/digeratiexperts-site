import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  Minus,
  Plus,
  Trash2,
  Layers,
  ArrowRight,
  ChevronDown,
  Calendar,
  FileText,
  Phone,
  BookmarkPlus,
  RotateCcw,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart, isRecurringPricing } from "@/contexts/CartContext";
import { categoryLabels, formatPrice } from "@/data/storeProducts";
import { solutionGroupFor, getCartComplements } from "@/data/storeMerchandising";
import { getProductVisual } from "@/data/productImages";
import { billingLabel } from "@shared/storeCommerce";
import {
  getMissingRequirements,
  recommendationWhy,
} from "@/lib/storeSolutionIntelligence";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CoverageScorePanel } from "@/components/store/CoverageScorePanel";
import { analytics } from "@/lib/analytics";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

export function ShoppingCart() {
  const {
    items,
    savedForLater,
    isOpen,
    closeCart,
    removeFromCart,
    undoRemove,
    canUndoRemove,
    updateQuantity,
    saveForLater,
    moveToSolution,
    getSavings,
    clearCart,
    addToCart,
    totals,
    lastUpdated,
    announcement,
  } = useCart();
  const [isMinimized, setIsMinimized] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const savings = getSavings();
  const cartProducts = useMemo(() => items.map((item) => item.product), [items]);
  const complements = useMemo(() => getCartComplements(cartProducts, { limit: 3 }), [cartProducts]);
  const missing = useMemo(() => getMissingRequirements(cartProducts), [cartProducts]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const group = solutionGroupFor(item.product);
      const list = map.get(group) || [];
      list.push(item);
      map.set(group, list);
    }
    return Array.from(map.entries());
  }, [items]);

  useEffect(() => {
    if (!isOpen) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      returnFocusRef.current?.focus();
    };
  }, [closeCart, isOpen]);

  const goCheckout = () => {
    analytics.storeCheckoutStarted(totals.dueToday + totals.monthly + totals.annual);
    closeCart();
    setLocation("/store/checkout");
  };

  const goQuote = () => {
    analytics.storeRequestQuote(totals.dueToday + totals.monthly + totals.annual);
    closeCart();
    setLocation("/store/checkout");
  };

  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={closeCart}
            data-testid="cart-overlay"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="solution-drawer-title"
            initial={prefersReducedMotion ? false : { x: "100%" }}
            animate={{ x: 0, height: isMinimized ? "auto" : "100%" }}
            exit={prefersReducedMotion ? undefined : { x: "100%" }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { type: "spring", damping: 26, stiffness: 320 }
            }
            className={`fixed right-0 z-50 flex w-full flex-col border-l border-white/10 bg-[#0a0a0a] sm:max-w-md ${
              isMinimized ? "bottom-0 top-auto rounded-tl-2xl" : "inset-y-0 max-sm:inset-0"
            }`}
            data-testid="shopping-cart-panel"
          >
            <div className="flex items-center justify-between border-b border-white/10 p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-de-accent-ink" />
                <div>
                  <h2 id="solution-drawer-title" className="text-xl font-semibold text-white">
                    Your Solution
                  </h2>
                  <span className="text-sm text-white/50">
                    {items.length} service{items.length === 1 ? "" : "s"}
                    {lastUpdatedLabel ? ` · Updated ${lastUpdatedLabel}` : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="hidden h-11 w-11 text-white/60 hover:bg-de-accent/10 hover:text-white sm:inline-flex"
                  data-testid="button-minimize-cart"
                  title={isMinimized ? "Expand solution" : "Minimize"}
                >
                  <ChevronDown
                    className={`h-5 w-5 transition-transform ${isMinimized ? "rotate-180" : ""}`}
                  />
                </Button>
                <Button
                  ref={closeRef}
                  variant="ghost"
                  size="icon"
                  onClick={closeCart}
                  className="h-11 w-11 text-white/60 hover:bg-de-accent/10 hover:text-white"
                  data-testid="button-close-cart"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="sr-only" aria-live="polite">
              {announcement}
            </div>

            {!isMinimized && (
              <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                {items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
                      <Layers className="h-10 w-10 text-white/55" />
                    </div>
                    <h3 className="mb-2 text-lg font-medium text-white">No services yet</h3>
                    <p className="mb-6 text-white/50">
                      Build a solution from outcomes, rails, or the catalog.
                    </p>
                    <Button
                      asChild
                      className="bg-de-accent text-white hover:bg-[#6548ff]"
                      onClick={closeCart}
                      data-testid="button-browse-products"
                    >
                      <Link href="/store/co-managed">
                        Browse Products
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    <CoverageScorePanel
                      products={cartProducts}
                      onAddSuggestion={(product) => {
                        addToCart(product, Math.max(1, product.minimumQuantity), product.basePrice);
                        toast({ title: "Added to solution", description: product.name });
                      }}
                    />

                    {missing.length > 0 && (
                      <div
                        className="rounded-xl border border-amber-400/25 bg-amber-400/5 p-4"
                        data-testid="solution-missing-requirements"
                      >
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-200">
                          Missing prerequisites
                        </p>
                        {missing.map((warning) => (
                          <div key={`${warning.forSku}-${warning.sku}`} className="mb-2 last:mb-0">
                            <p className="text-sm text-white/80">{warning.message}</p>
                            {warning.product && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="mt-2 h-10 border-white/15 bg-transparent text-white hover:bg-white/5"
                                onClick={() =>
                                  addToCart(
                                    warning.product!,
                                    Math.max(1, warning.product!.minimumQuantity),
                                    warning.product!.basePrice,
                                  )
                                }
                              >
                                Add required item
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {grouped.map(([group, groupItems]) => (
                      <div key={group}>
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/55">
                          {group}
                        </h3>
                        <div className="space-y-3">
                          {groupItems.map((item) => {
                            const visual = getProductVisual(item.product);
                            const recurring = isRecurringPricing(item.product.pricingType);
                            return (
                              <div
                                key={item.product.id}
                                className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                                data-testid={`cart-item-${item.product.id}`}
                              >
                                <div className="mb-3 flex items-start gap-3">
                                  <img
                                    src={visual.logoUrl || visual.cardUrl}
                                    alt=""
                                    className="h-12 w-12 shrink-0 rounded-md border border-white/10 bg-white object-contain p-1"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <h4 className="line-clamp-2 font-medium text-white">
                                      {item.product.name}
                                    </h4>
                                    <p className="text-xs text-white/50">
                                      {categoryLabels[item.product.category]} ·{" "}
                                      {billingLabel(item.product.pricingType, item.product.pricingUnit)}
                                    </p>
                                    <p className="text-sm text-white/50">{formatPrice(item.product)}</p>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                      disabled={item.quantity <= item.product.minimumQuantity}
                                      className="h-11 w-11 border-de-accent/30 bg-de-accent/10 text-white hover:bg-de-accent/20"
                                      data-testid={`button-decrease-${item.product.id}`}
                                      aria-label={`Decrease ${item.product.name}`}
                                    >
                                      <Minus className="h-3 w-3" />
                                    </Button>
                                    <input
                                      type="number"
                                      min={item.product.minimumQuantity}
                                      value={item.quantity}
                                      onChange={(event) =>
                                        updateQuantity(item.product.id, Number(event.target.value))
                                      }
                                      className="h-11 w-14 rounded-md border border-white/10 bg-transparent text-center text-sm text-white"
                                      data-testid={`quantity-${item.product.id}`}
                                      aria-label={`${item.product.name} quantity`}
                                    />
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                      className="h-11 w-11 border-de-accent/30 bg-de-accent/10 text-white hover:bg-de-accent/20"
                                      data-testid={`button-increase-${item.product.id}`}
                                      aria-label={`Increase ${item.product.name}`}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <span className="text-sm font-semibold text-de-accent-ink">
                                    $
                                    {(
                                      (item.clientPrice ?? item.product.basePrice) * item.quantity
                                    ).toFixed(2)}
                                    {recurring
                                      ? item.product.pricingType === "yearly"
                                        ? "/yr"
                                        : "/mo"
                                      : ""}
                                  </span>
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-10 px-2 text-white/60 hover:text-white"
                                    onClick={() => saveForLater(item.product.id)}
                                    data-testid={`button-save-later-${item.product.id}`}
                                  >
                                    <BookmarkPlus className="mr-1 h-3.5 w-3.5" />
                                    Save for later
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeFromCart(item.product.id)}
                                    className="h-10 px-2 text-red-300 hover:bg-red-500/10"
                                    data-testid={`button-remove-${item.product.id}`}
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {canUndoRemove && (
                      <Button
                        variant="outline"
                        className="h-11 w-full border-white/15 bg-transparent text-white hover:bg-white/5"
                        onClick={undoRemove}
                        data-testid="button-undo-remove"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Undo remove
                      </Button>
                    )}

                    {savedForLater.length > 0 && (
                      <div data-testid="saved-for-later">
                        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/55">
                          Saved for later
                        </h3>
                        <div className="space-y-2">
                          {savedForLater.map((item) => (
                            <div
                              key={item.product.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
                            >
                              <p className="truncate text-sm text-white">{item.product.name}</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-10 border-white/15 bg-transparent text-white hover:bg-white/5"
                                onClick={() => moveToSolution(item.product.id)}
                              >
                                Move to solution
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {complements.length > 0 && (
                      <div
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                        data-testid="cart-complements"
                      >
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/55">
                          Recommended because
                        </p>
                        <div className="space-y-3">
                          {complements.map((product) => {
                            const why = recommendationWhy(product, cartProducts);
                            return (
                              <div key={product.sku} className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm text-white">{product.name}</p>
                                  <p className="text-xs text-white/55">{why}</p>
                                  <p className="text-xs text-white/45">{formatPrice(product)}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-10 shrink-0 border-white/15 bg-transparent text-xs text-white hover:bg-white/5"
                                  onClick={() => {
                                    addToCart(
                                      product,
                                      Math.max(1, product.minimumQuantity),
                                      product.basePrice,
                                    );
                                    if (why) {
                                      analytics.storeAcceptRecommendation(product.name, why);
                                    }
                                    toast({ title: "Added to solution", description: product.name });
                                  }}
                                  data-testid={`button-complement-${product.id}`}
                                >
                                  Add
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-white/55">
                      Estimated onboarding: typically 7–10 business days after kickoff (varies by
                      stack). Questions?{" "}
                      <a
                        href={PRIMARY_PHONE.telHref}
                        className="inline-flex items-center gap-1 text-de-accent-ink hover:text-de-accent-ink"
                      >
                        <Phone className="h-3 w-3" />
                        {PRIMARY_PHONE.display}
                      </a>
                    </p>
                  </>
                )}
              </div>
            )}

            {items.length > 0 && (
              <div className="border-t border-white/10 bg-white/[0.02] p-5 sm:p-6">
                <div className="mb-4 space-y-2">
                  {totals.dueToday > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Due today</span>
                      <span className="text-white">${totals.dueToday.toFixed(2)}</span>
                    </div>
                  )}
                  {totals.monthly > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Monthly</span>
                      <span className="text-white">${totals.monthly.toFixed(2)} / month</span>
                    </div>
                  )}
                  {totals.annual > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Annual</span>
                      <span className="text-white">${totals.annual.toFixed(2)}/yr</span>
                    </div>
                  )}
                  {savings > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-emerald-400">Client pricing save</span>
                      <span className="font-medium text-emerald-400">-${savings.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-white/10 pt-2">
                    <span className="font-medium text-white">Ongoing equivalent</span>
                    <span className="text-lg font-bold text-de-accent-ink">
                      ${totals.recurringMonthlyEquivalent.toFixed(2)}/mo
                    </span>
                  </div>
                  <p className="flex items-start gap-1.5 text-xs text-white/45">
                    <Clock className="mt-0.5 h-3 w-3 shrink-0" />
                    Recurring services bill on the start date after kickoff. One-time work is due
                    when the order is placed. Tax is calculated at checkout when applicable.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <Button
                    className="h-12 w-full bg-de-accent text-white hover:bg-[#6548ff]"
                    onClick={goCheckout}
                    data-testid="button-checkout"
                  >
                    Continue to Checkout
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 w-full border-white/15 bg-transparent text-white hover:bg-white/5"
                    onClick={goQuote}
                    data-testid="button-save-quote"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Request Formal Quote
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="ghost"
                      className="h-11 text-white/70 hover:bg-white/5 hover:text-white"
                      onClick={closeCart}
                      data-testid="button-continue-shopping"
                    >
                      Continue shopping
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      className="h-11 text-white/70 hover:bg-de-accent/10 hover:text-white"
                      onClick={closeCart}
                      data-testid="button-schedule-from-cart"
                    >
                      <a href="/book">
                        <Calendar className="mr-1 h-4 w-4" />
                        {CTA.primaryShort}
                      </a>
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={clearCart}
                    className="h-10 w-full text-white/50 hover:bg-white/5 hover:text-white"
                    data-testid="button-clear-cart"
                  >
                    Clear solution
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ShoppingCart;
