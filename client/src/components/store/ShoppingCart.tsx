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
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPanelThemeStyle, isRecurringPricing, useCart } from "@/contexts/CartContext";
import { categoryLabels, formatPrice } from "@/data/storeProducts";
import { computeCoverageScore, solutionGroupFor, getCartComplements } from "@/data/storeMerchandising";
import { getProductVisual } from "@/data/productImages";
import { billingLabel } from "@shared/storeCommerce";
import {
  getMissingRequirements,
  recommendationWhy,
} from "@/lib/storeSolutionIntelligence";
import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { CoverageScorePanel } from "@/components/store/CoverageScorePanel";
import { shouldShowOngoingEquivalent } from "@/components/store/solutionCartUx";
import { analytics } from "@/lib/analytics";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { useDockHiddenWhileOpen } from "@/hooks/useDockHiddenWhileOpen";
import { formatSnapshotMoney } from "@/lib/solutionSnapshotView";
import { SolutionDrawerPane } from "@/components/store/SolutionDrawerPane";
import {
  checkoutPaneSummary,
  coveragePaneSummary,
  defaultSolutionDrawerPanes,
  itemsPaneSummary,
  openItemsPane,
  readSolutionDrawerViewport,
  toggleSolutionPane,
  type SolutionDrawerPaneId,
  type SolutionDrawerPaneState,
} from "@/components/store/solutionDrawerPanes";

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
    panelTheme,
    togglePanelTheme,
  } = useCart();
  const [isMinimized, setIsMinimized] = useState(false);
  const [panes, setPanes] = useState<SolutionDrawerPaneState>(() =>
    defaultSolutionDrawerPanes("desktop"),
  );
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const paneTouchedRef = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useDockHiddenWhileOpen(isOpen);

  const savings = getSavings();
  const cartProducts = useMemo(() => items.map((item) => item.product), [items]);
  const complements = useMemo(() => getCartComplements(cartProducts, { limit: 3 }), [cartProducts]);
  const missing = useMemo(() => getMissingRequirements(cartProducts), [cartProducts]);
  const coverage = useMemo(() => computeCoverageScore(cartProducts), [cartProducts]);
  const showOngoing = shouldShowOngoingEquivalent(totals);

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
    if (!isOpen) {
      paneTouchedRef.current = false;
      return;
    }
    if (!paneTouchedRef.current) {
      setPanes(defaultSolutionDrawerPanes(readSolutionDrawerViewport(window.innerWidth)));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setPanes((prev) => openItemsPane(prev));
  }, [isOpen, lastUpdated]);

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
    setLocation("/internal/warehouse/checkout");
  };

  const goQuote = () => {
    analytics.storeRequestQuote(totals.dueToday + totals.monthly + totals.annual);
    closeCart();
    setLocation("/internal/warehouse/checkout");
  };

  const lastUpdatedLabel = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  const onTogglePane = (id: SolutionDrawerPaneId) => {
    paneTouchedRef.current = true;
    setPanes((prev) => toggleSolutionPane(prev, id));
  };

  const drawerWidthClass = isMinimized
    ? "bottom-0 top-auto rounded-tl-2xl sm:max-w-xl"
    : items.length === 0
      ? "inset-y-0 max-sm:inset-0 sm:max-w-xl"
      : "inset-y-0 max-sm:inset-0 sm:max-w-4xl lg:max-w-6xl";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            className="fixed inset-0 z-[60] bg-black/60"
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
            className={`de-panel fixed right-0 z-[61] flex w-full flex-col border-l border-[color:var(--dp-border-10)] bg-[color:var(--dp-panel-bg)] ${drawerWidthClass}`}
            data-theme={panelTheme}
            data-accent="electric"
            style={getPanelThemeStyle(panelTheme)}
            data-testid="shopping-cart-panel"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--dp-border-10)] p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <Layers className="h-5 w-5 text-de-accent-ink" />
                <div>
                  <h2 id="solution-drawer-title" className="text-xl font-semibold text-[color:var(--dp-text-primary)]">
                    {/* "Your Solution" is the public Store's object; the staff drawer has its own name (§16.5, approved 2026-09-28). */}
                    Warehouse cart
                  </h2>
                  <span className="text-sm text-[color:var(--dp-text-50)]">
                    {items.length} service{items.length === 1 ? "" : "s"}
                    {lastUpdatedLabel ? ` · Updated ${lastUpdatedLabel}` : ""}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePanelTheme}
                  className="de-panel-theme-toggle h-11 w-11 text-[color:var(--dp-text-60)] hover:bg-de-accent/10 hover:text-[color:var(--dp-text-hover)]"
                  data-testid="button-toggle-cart-theme"
                  title={panelTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  aria-label={panelTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {panelTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="hidden h-11 w-11 text-[color:var(--dp-text-60)] hover:bg-de-accent/10 hover:text-[color:var(--dp-text-hover)] sm:inline-flex"
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
                  className="h-11 w-11 text-[color:var(--dp-text-60)] hover:bg-de-accent/10 hover:text-[color:var(--dp-text-hover)]"
                  data-testid="button-close-cart"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="sr-only" aria-live="polite">
              {announcement}
            </div>

            {!isMinimized && items.length === 0 && (
              <div className="flex flex-1 flex-col items-center justify-center p-5 text-center sm:p-6">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--dp-card-bg)]">
                  <Layers className="h-10 w-10 text-[color:var(--dp-text-55)]" />
                </div>
                <h3 className="mb-2 text-lg font-medium text-[color:var(--dp-text-primary)]">No services yet</h3>
                <p className="mb-6 text-[color:var(--dp-text-50)]">
                  Build a solution from outcomes, rails, or the catalog.
                </p>
                <Button
                  asChild
                  className="bg-de-accent text-white hover:bg-[#6548ff]"
                  onClick={closeCart}
                  data-testid="button-browse-products"
                >
                  <Link href="/internal/warehouse/co-managed">
                    Browse Products
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            )}

            {!isMinimized && items.length > 0 && (
              <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2 md:grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(0,1.35fr)_minmax(13rem,1fr)_minmax(17rem,0.95fr)] lg:grid-rows-1">
                <SolutionDrawerPane
                  id="items"
                  title="In this solution"
                  summary={itemsPaneSummary(items.length)}
                  open={panes.items}
                  onToggle={() => onTogglePane("items")}
                  className="md:row-start-2 lg:col-start-1 lg:row-start-1"
                >
                  <div data-testid="solution-line-items" aria-label="Solution line items">
                  {grouped.map(([group, groupItems]) => (
                    <div key={group} className="mb-5 last:mb-0">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--dp-text-55)]">
                        {group}
                      </h4>
                      <div className="space-y-3">
                        {groupItems.map((item) => {
                          const visual = getProductVisual(item.product);
                          const recurring = isRecurringPricing(item.product.pricingType);
                          const detailsOpen = openItemId === item.product.id;
                          return (
                            <div
                              key={item.product.id}
                              className="rounded-lg border border-[color:var(--dp-border-10)] bg-[color:var(--dp-card-bg)] p-4"
                              data-testid={`cart-item-${item.product.id}`}
                            >
                              <div className="mb-3 flex items-start gap-3">
                                <img
                                  src={visual.logoUrl || visual.cardUrl}
                                  alt=""
                                  className="h-12 w-12 shrink-0 rounded-md border border-[color:var(--dp-border-10)] bg-white object-contain p-1"
                                />
                                <div className="min-w-0 flex-1">
                                  <h4 className="line-clamp-2 font-medium text-[color:var(--dp-text-primary)]">
                                    {item.product.name}
                                  </h4>
                                  <p className="text-xs text-[color:var(--dp-text-50)]">
                                    {categoryLabels[item.product.category]} ·{" "}
                                    {billingLabel(item.product.pricingType, item.product.pricingUnit)}
                                  </p>
                                  <p className="text-sm text-[color:var(--dp-text-50)]">{formatPrice(item.product)}</p>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                    disabled={item.quantity <= item.product.minimumQuantity}
                                    className="h-11 w-11 border-de-accent/30 bg-de-accent/10 text-[color:var(--dp-text-primary)] hover:bg-de-accent/20"
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
                                    className="h-11 w-14 rounded-md border border-[color:var(--dp-border-10)] bg-transparent text-center text-sm text-[color:var(--dp-text-primary)]"
                                    data-testid={`quantity-${item.product.id}`}
                                    aria-label={`${item.product.name} quantity`}
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                    className="h-11 w-11 border-de-accent/30 bg-de-accent/10 text-[color:var(--dp-text-primary)] hover:bg-de-accent/20"
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
                                  className="h-11 px-2 text-[color:var(--dp-text-60)] hover:text-[color:var(--dp-text-hover)]"
                                  onClick={() => setOpenItemId(detailsOpen ? null : item.product.id)}
                                  aria-expanded={detailsOpen}
                                  data-testid={`button-item-details-${item.product.id}`}
                                >
                                  Details
                                  <ChevronDown
                                    className={`ml-1 h-3.5 w-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-10 px-2 text-[color:var(--dp-text-60)] hover:text-[color:var(--dp-text-hover)]"
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
                                  className="h-10 px-2 text-[color:var(--dp-danger)] hover:bg-[color:var(--dp-danger-hover-bg)]"
                                  data-testid={`button-remove-${item.product.id}`}
                                >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                                  Remove
                                </Button>
                              </div>
                              {detailsOpen && item.product.shortDescription && (
                                <p className="mt-2 border-t border-[color:var(--dp-border-10)] pt-2 text-xs leading-relaxed text-[color:var(--dp-text-55)]">
                                  {item.product.shortDescription}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  </div>

                  {canUndoRemove && (
                    <Button
                      variant="outline"
                      className="mt-3 h-11 w-full border-[color:var(--dp-border-15)] bg-transparent text-[color:var(--dp-text-primary)] hover:bg-[color:var(--dp-hover-bg)]"
                      onClick={undoRemove}
                      data-testid="button-undo-remove"
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Undo remove
                    </Button>
                  )}

                  {savedForLater.length > 0 && (
                    <div className="mt-5" data-testid="saved-for-later">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--dp-text-55)]">
                        Saved for later
                      </h4>
                      <div className="space-y-2">
                        {savedForLater.map((item) => (
                          <div
                            key={item.product.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--dp-border-10)] px-3 py-2"
                          >
                            <p className="truncate text-sm text-[color:var(--dp-text-primary)]">{item.product.name}</p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-10 border-[color:var(--dp-border-15)] bg-transparent text-[color:var(--dp-text-primary)] hover:bg-[color:var(--dp-hover-bg)]"
                              onClick={() => moveToSolution(item.product.id)}
                            >
                              Move to solution
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </SolutionDrawerPane>

                <SolutionDrawerPane
                  id="coverage"
                  title="Coverage"
                  summary={coveragePaneSummary(coverage.coveredCount, coverage.dimensionCount)}
                  open={panes.coverage}
                  onToggle={() => onTogglePane("coverage")}
                  className="md:col-span-2 md:row-start-1 md:max-h-[42vh] md:border-b md:border-r-0 lg:col-span-1 lg:col-start-2 lg:row-start-1 lg:max-h-none lg:border-b-0 lg:border-r"
                >
                  <CoverageScorePanel
                    embedded
                    products={cartProducts}
                    onAddSuggestion={(product) => {
                      addToCart(product, Math.max(1, product.minimumQuantity), product.basePrice);
                      toast({ title: "Added to solution", description: product.name });
                    }}
                  />

                  {missing.length > 0 && (
                    <div
                      className="mt-4 rounded-xl border border-[color:var(--dp-warn-border)] bg-[color:var(--dp-warn-bg)] p-4"
                      data-testid="solution-missing-requirements"
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--dp-warn-text)]">
                        Missing prerequisites
                      </p>
                      {missing.map((warning) => (
                        <div key={`${warning.forSku}-${warning.sku}`} className="mb-2 last:mb-0">
                          <p className="text-sm text-[color:var(--dp-text-80)]">{warning.message}</p>
                          {warning.product && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-2 h-10 border-[color:var(--dp-border-15)] bg-transparent text-[color:var(--dp-text-primary)] hover:bg-[color:var(--dp-hover-bg)]"
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

                  {complements.length > 0 && (
                    <div
                      className="mt-4 rounded-xl border border-[color:var(--dp-border-10)] bg-[color:var(--dp-card-bg)] p-4"
                      data-testid="cart-complements"
                    >
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--dp-text-55)]">
                        Recommended because
                      </p>
                      <div className="space-y-3">
                        {complements.map((product) => {
                          const why = recommendationWhy(product, cartProducts);
                          return (
                            <div key={product.sku} className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm text-[color:var(--dp-text-primary)]">{product.name}</p>
                                <p className="text-xs text-[color:var(--dp-text-55)]">{why}</p>
                                <p className="text-xs text-[color:var(--dp-text-45)]">{formatPrice(product)}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-10 shrink-0 border-[color:var(--dp-border-15)] bg-transparent text-xs text-[color:var(--dp-text-primary)] hover:bg-[color:var(--dp-hover-bg)]"
                                onClick={() => {
                                  addToCart(
                                    product,
                                    Math.max(1, product.minimumQuantity),
                                    product.basePrice,
                                  );
                                  analytics.storeAcceptRecommendation(product.name, why ?? "");
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

                  <p className="mt-4 text-xs text-[color:var(--dp-text-55)]">
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
                </SolutionDrawerPane>

                <SolutionDrawerPane
                  id="checkout"
                  title="Totals"
                  summary={checkoutPaneSummary(totals)}
                  open={panes.checkout}
                  onToggle={() => onTogglePane("checkout")}
                  className="md:col-start-2 md:row-start-2 md:border-r-0 lg:col-start-3 lg:row-start-1"
                >
                  <div className="mb-4 space-y-2">
                    {totals.dueToday > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[color:var(--dp-text-60)]">Due today</span>
                        <span className="text-[color:var(--dp-text-primary)]">
                          {formatSnapshotMoney(totals.dueToday)}
                        </span>
                      </div>
                    )}
                    {totals.monthly > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[color:var(--dp-text-60)]">Monthly</span>
                        <span className="text-[color:var(--dp-text-primary)]">
                          {formatSnapshotMoney(totals.monthly)} / month
                        </span>
                      </div>
                    )}
                    {totals.annual > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[color:var(--dp-text-60)]">Annual</span>
                        <span className="text-[color:var(--dp-text-primary)]">
                          {formatSnapshotMoney(totals.annual)}/yr
                        </span>
                      </div>
                    )}
                    {savings > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[color:var(--dp-success)]">Client pricing save</span>
                        <span className="font-medium text-[color:var(--dp-success)]">
                          -{formatSnapshotMoney(savings)}
                        </span>
                      </div>
                    )}
                    {showOngoing && (
                      <div className="flex items-center justify-between border-t border-[color:var(--dp-border-10)] pt-2">
                        <span className="font-medium text-[color:var(--dp-text-primary)]">Ongoing equivalent</span>
                        <span className="text-lg font-bold text-de-accent-ink">
                          {formatSnapshotMoney(totals.recurringMonthlyEquivalent)}/mo
                        </span>
                      </div>
                    )}
                    <p className="flex items-start gap-1.5 text-xs text-[color:var(--dp-text-45)]">
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
                      className="h-11 w-full border-[color:var(--dp-border-15)] bg-transparent text-[color:var(--dp-text-primary)] hover:bg-[color:var(--dp-hover-bg)]"
                      onClick={goQuote}
                      data-testid="button-save-quote"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Request Formal Quote
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="ghost"
                        className="h-auto min-h-11 whitespace-normal text-center leading-tight text-[color:var(--dp-text-70)] hover:bg-[color:var(--dp-hover-bg)] hover:text-[color:var(--dp-text-hover)]"
                        onClick={closeCart}
                        data-testid="button-continue-shopping"
                      >
                        Continue shopping
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        className="h-auto min-h-11 whitespace-normal text-center leading-tight text-[color:var(--dp-text-70)] hover:bg-de-accent/10 hover:text-[color:var(--dp-text-hover)]"
                        onClick={closeCart}
                        data-testid="button-schedule-from-cart"
                      >
                        <a href="/book" className="inline-flex items-center justify-center whitespace-normal text-center leading-tight">
                          <Calendar className="mr-1 h-4 w-4 shrink-0" />
                          <span className="sm:hidden">{CTA.primaryNavCompact}</span>
                          <span className="hidden sm:inline">{CTA.primaryShort}</span>
                        </a>
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={clearCart}
                      className="h-10 w-full text-[color:var(--dp-text-50)] hover:bg-[color:var(--dp-hover-bg)] hover:text-[color:var(--dp-text-hover)]"
                      data-testid="button-clear-cart"
                    >
                      Clear solution
                    </Button>
                  </div>
                </SolutionDrawerPane>
              </div>
            )}

            {isMinimized && items.length > 0 && (
              <div className="border-t border-[color:var(--dp-border-10)] px-5 py-3 text-sm text-[color:var(--dp-text-60)]">
                {itemsPaneSummary(items.length)}
                {totals.dueToday > 0 ? ` · ${checkoutPaneSummary(totals)}` : ""}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ShoppingCart;
