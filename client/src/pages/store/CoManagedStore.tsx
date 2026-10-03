import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "../sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { Link, useSearch, useLocation } from "wouter";
import {
  ArrowRight,
  Users,
  ShoppingCart,
  Lock,
  Phone,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import {
  storeProducts,
  categoryLabels,
  categoryDescriptions,
  getCheckoutEnabledProducts,
  type ProductCategory,
  type PricingType,
  type StoreProduct,
} from "@/data/storeProducts";
import {
  productMatchesOutcome,
  productMatchesVendor,
  productMatchesCompliance,
  productMatchesSize,
  productMatchesPriceBand,
  productMatchesPurchasePath,
  productMatchesCoverage,
  listVendorsForProducts,
  searchProducts,
  sortProducts,
  isConfigurableProduct,
  storeOutcomes,
  resolveStoreOutcomeId,
  storeComplianceFilters,
  storeSizeFilters,
  storePriceBandFilters,
  storePurchasePathFilters,
  billingTypeLabels,
  coverageDimensions,
  type StoreOutcomeId,
  type StoreComplianceId,
  type StoreSizeId,
  type StorePriceBandId,
  type StorePurchasePathId,
  type StoreSortOption,
  type CoverageDimension,
} from "@/data/storeMerchandising";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { portalMarketplaceLoginUrl } from "@/lib/portalUrls";
import { openMspAdvisor } from "@/lib/openMspAdvisor";
import {
  isGuidedFullCatalog,
  markGuidedSkipped,
  recommendationFromSession,
} from "@/lib/storeGuidedSession";
import { StoreTrustStrip } from "@/components/store/StoreTrustStrip";
import { ShopByOutcome } from "@/components/store/ShopByOutcome";
import { MerchandisingRails } from "@/components/store/MerchandisingRails";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { StoreCatalogToolbar } from "@/components/store/StoreCatalogToolbar";
import { StoreAssessmentPanel } from "@/components/store/StoreAssessmentPanel";
import { StoreBundlesSection } from "@/components/store/StoreBundlesSection";
import {
  ConfigureProductDrawer,
  type ConfigureConfirmPayload,
} from "@/components/store/ConfigureProductDrawer";
import { GuidedBuyingWizard } from "@/components/store/GuidedBuyingWizard";
import {
  ProductCompareBar,
  ProductCompareDrawer,
  canAddToCompare,
  MAX_COMPARE,
} from "@/components/store/ProductCompare";
import { CoverageScorePanel } from "@/components/store/CoverageScorePanel";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";
import { StoreClientBar } from "@/components/store/StoreClientBar";

const SORT_OPTIONS: StoreSortOption[] = ["recommended", "popular", "price_asc", "price_desc"];
const PRICE_BAND_IDS = new Set(storePriceBandFilters.map((b) => b.id));
const PURCHASE_PATH_IDS = new Set(storePurchasePathFilters.map((p) => p.id));
const COVERAGE_IDS = new Set(coverageDimensions.map((d) => d.id));
const COMPLIANCE_IDS = new Set(storeComplianceFilters.map((c) => c.id));
const SIZE_IDS = new Set(storeSizeFilters.map((s) => s.id));
function parseCatalogSearch(searchString: string) {
  const urlParams = new URLSearchParams(searchString);
  const category = urlParams.get("category") as ProductCategory | null;
  const outcome = resolveStoreOutcomeId(urlParams.get("outcome"));
  const vendor = urlParams.get("vendor") || "";
  const compliance = urlParams.get("compliance") as StoreComplianceId | null;
  const size = urlParams.get("size") as StoreSizeId | null;
  const q = urlParams.get("q") || "";
  const billing = (urlParams.get("billing") || urlParams.get("billingType")) as PricingType | null;
  const sortRaw = urlParams.get("sort") as StoreSortOption | null;
  const priceBand = urlParams.get("price") as StorePriceBandId | null;
  const purchasePath = urlParams.get("path") as StorePurchasePathId | null;
  const coverage = urlParams.get("coverage") as CoverageDimension | null;

  return {
    category: category && categoryLabels[category] ? category : ("all" as const),
    outcome,
    vendor: vendor || "all",
    compliance: compliance && COMPLIANCE_IDS.has(compliance) ? compliance : ("all" as const),
    size: size && SIZE_IDS.has(size) ? size : ("all" as const),
    q,
    billing: billing || ("all" as const),
    sort: sortRaw && SORT_OPTIONS.includes(sortRaw) ? sortRaw : ("recommended" as const),
    priceBand: priceBand && PRICE_BAND_IDS.has(priceBand) ? priceBand : ("all" as const),
    purchasePath:
      purchasePath && PURCHASE_PATH_IDS.has(purchasePath) ? purchasePath : ("all" as const),
    coverage: coverage && COVERAGE_IDS.has(coverage) ? coverage : ("all" as const),
  };
}

/** True when the catalog URL already names a filter — used to scroll past the hero. */
export function catalogSearchHasDeepLink(searchString: string): boolean {
  const parsed = parseCatalogSearch(searchString);
  return (
    parsed.outcome !== null ||
    parsed.category !== "all" ||
    parsed.vendor !== "all" ||
    parsed.compliance !== "all" ||
    parsed.size !== "all" ||
    parsed.q.trim().length > 0 ||
    parsed.billing !== "all" ||
    parsed.priceBand !== "all" ||
    parsed.purchasePath !== "all" ||
    parsed.coverage !== "all"
  );
}

const CoManagedStore = () => {
  const prefersReducedMotion = useReducedMotion();
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { addToCart, openCart, setClientPricing, items } = useCart();
  const {
    isLoggedIn,
    clientPricing,
    getProductPrice,
    loginRedirect,
  } = useStoreAuth();

  const catalogRef = useRef<HTMLDivElement>(null);
  const initial = parseCatalogSearch(searchString);
  const urlSyncSkip = useRef(true);

  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">(
    initial.category
  );
  const [selectedOutcome, setSelectedOutcome] = useState<StoreOutcomeId | null>(initial.outcome);
  const [selectedVendor, setSelectedVendor] = useState<string | "all">(initial.vendor);
  const [selectedCompliance, setSelectedCompliance] = useState<StoreComplianceId | "all">(
    initial.compliance
  );
  const [selectedSize, setSelectedSize] = useState<StoreSizeId | "all">(initial.size);
  const [searchQuery, setSearchQuery] = useState(initial.q);
  const [billingType, setBillingType] = useState<PricingType | "all">(
    initial.billing === "all" ? "all" : initial.billing
  );
  const [sort, setSort] = useState<StoreSortOption>(initial.sort);
  const [selectedPriceBand, setSelectedPriceBand] = useState<StorePriceBandId | "all">(
    initial.priceBand
  );
  const [selectedPurchasePath, setSelectedPurchasePath] = useState<StorePurchasePathId | "all">(
    initial.purchasePath
  );
  const [selectedCoverage, setSelectedCoverage] = useState<CoverageDimension | "all">(
    initial.coverage
  );
  const [compareList, setCompareList] = useState<StoreProduct[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [configureProduct, setConfigureProduct] = useState<StoreProduct | null>(null);
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [guidanceTick, setGuidanceTick] = useState(0);

  useEffect(() => {
    if (clientPricing.length > 0) {
      setClientPricing(clientPricing);
    }
  }, [clientPricing, setClientPricing]);

  /** Bidirectional URL sync — shareable filtered views */
  useEffect(() => {
    if (urlSyncSkip.current) {
      urlSyncSkip.current = false;
      return;
    }
    const params = new URLSearchParams();
    if (selectedCategory !== "all") params.set("category", selectedCategory);
    if (selectedOutcome) params.set("outcome", selectedOutcome);
    if (selectedVendor !== "all") params.set("vendor", selectedVendor);
    if (selectedCompliance !== "all") params.set("compliance", selectedCompliance);
    if (selectedSize !== "all") params.set("size", selectedSize);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (billingType !== "all") params.set("billing", billingType);
    if (sort !== "recommended") params.set("sort", sort);
    if (selectedPriceBand !== "all") params.set("price", selectedPriceBand);
    if (selectedPurchasePath !== "all") params.set("path", selectedPurchasePath);
    if (selectedCoverage !== "all") params.set("coverage", selectedCoverage);
    const qs = params.toString();
    const next = qs ? `/internal/warehouse/co-managed?${qs}` : "/internal/warehouse/co-managed";
    const current = `/internal/warehouse/co-managed${searchString ? `?${searchString}` : ""}`;
    if (next !== current) {
      setLocation(next, { replace: true });
    }
  }, [
    selectedCategory,
    selectedOutcome,
    selectedVendor,
    selectedCompliance,
    selectedSize,
    searchQuery,
    billingType,
    sort,
    selectedPriceBand,
    selectedPurchasePath,
    selectedCoverage,
    searchString,
    setLocation,
  ]);

  useSEO({
    noIndex: true,
    title: "IT Store Catalog | Digerati Experts",
    description:
      "Guided IT storefront: shop by outcome, browse curated rails, and purchase co-managed products — endpoint, security, UCaaS, hardware, and professional services.",
    canonical: "/internal/warehouse/co-managed",
  });

  const checkoutProducts = useMemo(() => getCheckoutEnabledProducts(), []);
  const guidedRecommendation = useMemo(() => recommendationFromSession(), [searchString, guidanceTick]);
  const showFullCatalog = isGuidedFullCatalog(searchString) || catalogSearchHasDeepLink(searchString);

  const visibleBase = useMemo(() => {
    const base = isLoggedIn ? checkoutProducts : checkoutProducts.filter((p) => !p.isClientOnly);
    if (showFullCatalog || !guidedRecommendation) return base;
    const allowed = new Set(guidedRecommendation.recommendedSkus);
    return base.filter((product) => allowed.has(product.sku));
  }, [checkoutProducts, isLoggedIn, showFullCatalog, guidedRecommendation]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(visibleBase.map((p) => p.category))) as ProductCategory[];
    return cats.sort((a, b) => {
      const orderA = storeProducts.find((p) => p.category === a)?.sortOrder || 999;
      const orderB = storeProducts.find((p) => p.category === b)?.sortOrder || 999;
      return orderA - orderB;
    });
  }, [visibleBase]);

  const billingTypes = useMemo(() => {
    return Array.from(new Set(visibleBase.map((p) => p.pricingType))) as PricingType[];
  }, [visibleBase]);

  const vendors = useMemo(() => listVendorsForProducts(visibleBase), [visibleBase]);

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory("all");
    setBillingType("all");
    setSelectedOutcome(null);
    setSelectedVendor("all");
    setSelectedCompliance("all");
    setSelectedSize("all");
    setSelectedPriceBand("all");
    setSelectedPurchasePath("all");
    setSelectedCoverage("all");
    setSort("recommended");
  }, []);

  const filteredProducts = useMemo(() => {
    let products = visibleBase;

    if (selectedCategory !== "all") {
      products = products.filter((p) => p.category === selectedCategory);
    }
    if (billingType !== "all") {
      products = products.filter((p) => p.pricingType === billingType);
    }
    if (selectedOutcome) {
      products = products.filter((p) => productMatchesOutcome(p, selectedOutcome));
    }
    if (selectedVendor !== "all") {
      products = products.filter((p) => productMatchesVendor(p, selectedVendor));
    }
    if (selectedCompliance !== "all") {
      products = products.filter((p) => productMatchesCompliance(p, selectedCompliance));
    }
    if (selectedSize !== "all") {
      products = products.filter((p) => productMatchesSize(p, selectedSize));
    }
    if (selectedPriceBand !== "all") {
      products = products.filter((p) => productMatchesPriceBand(p, selectedPriceBand));
    }
    if (selectedPurchasePath !== "all") {
      products = products.filter((p) => productMatchesPurchasePath(p, selectedPurchasePath));
    }
    if (selectedCoverage !== "all") {
      products = products.filter((p) => productMatchesCoverage(p, selectedCoverage));
    }
    products = searchProducts(products, searchQuery);
    return sortProducts(products, sort);
  }, [
    visibleBase,
    selectedCategory,
    billingType,
    selectedOutcome,
    selectedVendor,
    selectedCompliance,
    selectedSize,
    selectedPriceBand,
    selectedPurchasePath,
    selectedCoverage,
    searchQuery,
    sort,
  ]);

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onClear: () => void }[] = [];
    if (searchQuery.trim()) {
      chips.push({
        key: "q",
        label: `Search: ${searchQuery.trim()}`,
        onClear: () => setSearchQuery(""),
      });
    }
    if (selectedCategory !== "all") {
      chips.push({
        key: "category",
        label: categoryLabels[selectedCategory],
        onClear: () => setSelectedCategory("all"),
      });
    }
    if (selectedOutcome) {
      chips.push({
        key: "outcome",
        label: storeOutcomes.find((o) => o.id === selectedOutcome)?.label || selectedOutcome,
        onClear: () => setSelectedOutcome(null),
      });
    }
    if (billingType !== "all") {
      chips.push({
        key: "billing",
        label: billingTypeLabels[billingType] ?? billingType,
        onClear: () => setBillingType("all"),
      });
    }
    if (selectedVendor !== "all") {
      chips.push({
        key: "vendor",
        label: vendors.find((v) => v.slug === selectedVendor)?.name || selectedVendor,
        onClear: () => setSelectedVendor("all"),
      });
    }
    if (selectedCompliance !== "all") {
      chips.push({
        key: "compliance",
        label:
          storeComplianceFilters.find((c) => c.id === selectedCompliance)?.label ||
          selectedCompliance,
        onClear: () => setSelectedCompliance("all"),
      });
    }
    if (selectedSize !== "all") {
      chips.push({
        key: "size",
        label: storeSizeFilters.find((s) => s.id === selectedSize)?.label || selectedSize,
        onClear: () => setSelectedSize("all"),
      });
    }
    if (selectedPriceBand !== "all") {
      chips.push({
        key: "price",
        label:
          storePriceBandFilters.find((b) => b.id === selectedPriceBand)?.label ||
          selectedPriceBand,
        onClear: () => setSelectedPriceBand("all"),
      });
    }
    if (selectedPurchasePath !== "all") {
      chips.push({
        key: "path",
        label:
          storePurchasePathFilters.find((p) => p.id === selectedPurchasePath)?.label ||
          selectedPurchasePath,
        onClear: () => setSelectedPurchasePath("all"),
      });
    }
    if (selectedCoverage !== "all") {
      chips.push({
        key: "coverage",
        label:
          coverageDimensions.find((d) => d.id === selectedCoverage)?.label || selectedCoverage,
        onClear: () => setSelectedCoverage("all"),
      });
    }
    return chips;
  }, [
    searchQuery,
    selectedCategory,
    selectedOutcome,
    billingType,
    selectedVendor,
    vendors,
    selectedCompliance,
    selectedSize,
    selectedPriceBand,
    selectedPurchasePath,
    selectedCoverage,
  ]);

  const handleAddToCart = (product: StoreProduct, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.isCheckoutEnabled || product.isContractOnly) return;
    if (isConfigurableProduct(product)) {
      setConfigureProduct(product);
      return;
    }
    const { price } = getProductPrice(product.id, product.basePrice);
    addToCart(product, 1, price);
    toast({
      title: "Added to your solution",
      description: `${product.name} has been added.`,
    });
    openCart();
  };

  const handleConfigureConfirm = (payload: ConfigureConfirmPayload) => {
    const { product, quantity, unitPrice, addons, environmentNotes } = payload;
    addToCart(product, quantity, unitPrice);
    addons.forEach((addon) => {
      const { price } = getProductPrice(addon.id, addon.basePrice);
      const addonQty = isConfigurableProduct(addon) ? quantity : 1;
      addToCart(addon, addonQty, price);
    });
    setConfigureProduct(null);
    toast({
      title: "Configured service added",
      description: environmentNotes
        ? `${quantity} × ${product.name}${addons.length ? ` + ${addons.length} add-on(s)` : ""}. Notes saved for your team.`
        : `${quantity} × ${product.name}${addons.length ? ` + ${addons.length} add-on(s)` : ""}`,
    });
    openCart();
  };

  const handleConfigureQuote = (payload: ConfigureConfirmPayload) => {
    const { product, quantity, unitPrice, addons, environmentNotes } = payload;
    addToCart(product, quantity, unitPrice);
    addons.forEach((addon) => {
      const { price } = getProductPrice(addon.id, addon.basePrice);
      const addonQty = isConfigurableProduct(addon) ? quantity : 1;
      addToCart(addon, addonQty, price);
    });
    setConfigureProduct(null);
    if (environmentNotes && typeof sessionStorage !== "undefined") {
      try {
        sessionStorage.setItem(
          "digerati-configure-notes",
          JSON.stringify({
            sku: product.sku,
            notes: environmentNotes,
            at: Date.now(),
          })
        );
      } catch {
        /* ignore */
      }
    }
    toast({
      title: "Ready for quote",
      description: "Items added to Your Solution — continue to request a quote.",
    });
    openCart();
    setLocation("/internal/warehouse/checkout");
  };

  const toggleCompare = (product: StoreProduct) => {
    setCompareList((prev) => {
      if (prev.some((p) => p.id === product.id)) {
        return prev.filter((p) => p.id !== product.id);
      }
      if (!canAddToCompare(prev, product)) {
        toast({
          title: "Compare limit",
          description: `Select up to ${MAX_COMPARE} products.`,
        });
        return prev;
      }
      return [...prev, product];
    });
  };

  const handleAddBundle = (products: StoreProduct[]) => {
    products.forEach((product) => {
      const { price } = getProductPrice(product.id, product.basePrice);
      addToCart(product, 1, price);
    });
    toast({
      title: "Bundle items added",
      description: `${products.length} products added to your solution.`,
    });
    openCart();
  };

  const scrollToCatalog = () => {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    catalogRef.current?.scrollIntoView({ behavior, block: "start" });
  };

  // Deep links like /store/co-managed?outcome=protect used to land on the hero
  // (~6k px above the filtered grid). Scroll once after mount so clicking an
  // outcome actually shows the matching products.
  useEffect(() => {
    if (!catalogSearchHasDeepLink(searchString)) return;

    let timeout = 0;
    const frame = window.requestAnimationFrame(() => {
      timeout = window.setTimeout(scrollToCatalog, 80);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
    // Intentionally mount-only: later filter changes already call scrollToCatalog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOutcomeSelect = (id: StoreOutcomeId | null) => {
    setSelectedOutcome(id);
    if (id) {
      setSelectedCategory("all");
      scrollToCatalog();
    }
  };

  const containerVariants = prefersReducedMotion
    ? undefined
    : {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
      };

  const itemVariants = prefersReducedMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
      };

  return (
    <div className="relative min-h-screen bg-[#0a0a0a]">
      <StorePageAtmosphere />
      <MegaMenu />

      <main className="relative z-10 pb-20 de-nav-clear">
        <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
          <StoreClientBar />

          <div className="mb-8 flex items-center gap-2 text-base text-white/50">
            <Link href="/internal/warehouse" className="transition-colors hover:text-white">
              Store
            </Link>
            <span>/</span>
            <span className="text-white">Catalog</span>
          </div>

          {/* Hero — guided selling first */}
          <motion.div
            className="mb-8 max-w-4xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-de-accent/25 bg-de-accent/10 px-4 py-2">
              <Users className="h-4 w-4 text-de-accent-ink" />
              <span className="text-sm text-de-accent-ink">Guided IT Storefront</span>
            </div>
            <h1 className="mb-4 text-[clamp(2rem,6vw,3.25rem)] font-bold leading-[1.12] tracking-[-0.03em] text-white">
              Tell us what you&apos;re trying to{" "}
              <span className="text-de-accent-ink">accomplish.</span>
            </h1>
            <p className="text-lg leading-relaxed text-white/70 md:text-xl">
              Shop by outcome, build a recommended stack with Ask DE, then buy from the live
              catalog when you know what you need.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                className="h-12 w-full bg-de-accent px-6 text-base text-white hover:bg-[#6548ff] sm:w-auto"
                onClick={() => setGuidedOpen(true)}
                data-testid="button-build-solution"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Build my solution
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full border-white/20 bg-transparent px-6 text-base text-white hover:bg-white/5 sm:w-auto"
                onClick={() => openMspAdvisor({ context: "store" })}
                data-testid="button-ask-digerati"
              >
                <MessageCircle className="mr-2 h-5 w-5" />
                Ask DE
              </Button>
              <Button
                variant="ghost"
                className="h-12 w-full text-base text-white/70 hover:bg-white/5 hover:text-white sm:w-auto"
                onClick={() => {
                  markGuidedSkipped();
                  setGuidanceTick((n) => n + 1);
                  setLocation("/internal/warehouse/co-managed?catalog=full", { replace: true });
                  scrollToCatalog();
                }}
                data-testid="button-browse-everything"
              >
                Browse the full catalog
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            {guidedRecommendation && !showFullCatalog && (
              <p className="mt-4 text-sm text-white/50" data-testid="catalog-guided-filter">
                Showing the {guidedRecommendation.familyLabel.toLowerCase()} recommended set
                {guidedRecommendation.workEmail ? ` for ${guidedRecommendation.workEmail}` : ""}.{" "}
                <button
                  type="button"
                  className="underline-offset-4 hover:text-white hover:underline"
                  onClick={() => {
                    markGuidedSkipped();
                    setGuidanceTick((n) => n + 1);
                    setLocation("/internal/warehouse/co-managed?catalog=full", { replace: true });
                  }}
                >
                  Browse the full catalog
                </button>
              </p>
            )}
          </motion.div>

          <StoreTrustStrip />

          <ShopByOutcome selected={selectedOutcome} onSelect={handleOutcomeSelect} />

          {/* Inline assessment entry (relocated — not mid-grid banner) */}
          <div className="mb-10 lg:hidden">
            <StoreAssessmentPanel
              variant="inline"
              onBuildSolution={() => setGuidedOpen(true)}
              onFilterAssessments={() => {
                setSelectedCategory("digital_assessments");
                setSelectedOutcome(null);
                scrollToCatalog();
              }}
            />
          </div>

          <MerchandisingRails
            isLoggedIn={isLoggedIn}
            getPrice={getProductPrice}
            onAddToCart={handleAddToCart}
            onConfigure={(p) => setConfigureProduct(p)}
            onLoginRequired={loginRedirect}
          />

          <StoreBundlesSection isLoggedIn={isLoggedIn} onAddBundle={handleAddBundle} />

          {/* Catalog + sticky assessment */}
          <div ref={catalogRef} id="store-catalog" className="scroll-mt-28">
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-bold text-white md:text-4xl">Full catalog</h2>
                <p className="mt-2 text-base text-white/60">
                  Every service and product we sell — filter by category, outcome, vendor, or
                  budget to find what fits.
                </p>
              </div>
              {selectedOutcome && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 border-white/15 bg-transparent text-base text-white hover:bg-white/5"
                  onClick={() => setSelectedOutcome(null)}
                  data-testid="button-clear-outcome"
                >
                  Clear outcome filter
                </Button>
              )}
            </div>

            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div>
                <StoreCatalogToolbar
                  search={searchQuery}
                  onSearchChange={setSearchQuery}
                  category={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                  categories={categories}
                  billingType={billingType}
                  onBillingTypeChange={setBillingType}
                  billingTypes={billingTypes}
                  outcome={selectedOutcome || "all"}
                  onOutcomeChange={(v) => setSelectedOutcome(v === "all" ? null : v)}
                  vendor={selectedVendor}
                  onVendorChange={setSelectedVendor}
                  vendors={vendors}
                  compliance={selectedCompliance}
                  onComplianceChange={setSelectedCompliance}
                  size={selectedSize}
                  onSizeChange={setSelectedSize}
                  priceBand={selectedPriceBand}
                  onPriceBandChange={setSelectedPriceBand}
                  purchasePath={selectedPurchasePath}
                  onPurchasePathChange={setSelectedPurchasePath}
                  coverage={selectedCoverage}
                  onCoverageChange={setSelectedCoverage}
                  sort={sort}
                  onSortChange={setSort}
                  resultCount={filteredProducts.length}
                  totalCount={visibleBase.length}
                  activeChips={activeChips}
                  onClearAll={clearAllFilters}
                />

                {/* Category chips — restored for scannability (toolbar Select remains) */}
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={selectedCategory === "all" ? "default" : "outline"}
                    className={
                      selectedCategory === "all"
                        ? "bg-de-accent text-white hover:bg-[#6548ff]"
                        : "border-white/15 bg-transparent text-white/80 hover:bg-white/5"
                    }
                    onClick={() => setSelectedCategory("all")}
                    data-testid="filter-all"
                  >
                    All ({visibleBase.length})
                  </Button>
                  {categories.map((category) => {
                    const count = visibleBase.filter((p) => p.category === category).length;
                    return (
                      <Button
                        key={category}
                        type="button"
                        size="sm"
                        variant={selectedCategory === category ? "default" : "outline"}
                        className={
                          selectedCategory === category
                            ? "bg-de-accent text-white hover:bg-[#6548ff]"
                            : "border-white/15 bg-transparent text-white/80 hover:bg-white/5"
                        }
                        onClick={() => setSelectedCategory(category)}
                        data-testid={`filter-${category}`}
                      >
                        {categoryLabels[category]} ({count})
                      </Button>
                    );
                  })}
                </div>

                {selectedCategory !== "all" && (
                  <div className="mb-6 rounded-xl border border-de-accent/20 bg-de-accent/10 p-4">
                    <h3 className="mb-1 font-semibold text-white">
                      {categoryLabels[selectedCategory]}
                    </h3>
                    <p className="text-sm text-white/60">
                      {categoryDescriptions[selectedCategory]}
                    </p>
                  </div>
                )}

                <motion.div
                  className="mb-10 grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  key={`${selectedCategory}-${selectedOutcome}-${selectedVendor}-${selectedCompliance}-${selectedSize}-${selectedPriceBand}-${selectedPurchasePath}-${selectedCoverage}-${searchQuery}-${billingType}-${sort}`}
                >
                  {filteredProducts.map((product) => {
                    const pricing = getProductPrice(product.id, product.basePrice);
                    return (
                      <motion.div key={product.id} variants={itemVariants}>
                        <StoreProductCard
                          product={product}
                          price={pricing.price}
                          hasDiscount={pricing.hasDiscount}
                          discountPercent={pricing.discountPercent}
                          isLoggedIn={isLoggedIn}
                          onAddToCart={handleAddToCart}
                          onConfigure={(p) => setConfigureProduct(p)}
                          onLoginRequired={loginRedirect}
                          compareSelected={compareList.some((p) => p.id === product.id)}
                          compareDisabled={
                            compareList.length >= MAX_COMPARE &&
                            !compareList.some((p) => p.id === product.id)
                          }
                          onCompareToggle={toggleCompare}
                        />
                      </motion.div>
                    );
                  })}
                </motion.div>

                {filteredProducts.length === 0 && (
                  <div
                    className="mb-10 rounded-xl border border-white/10 bg-[#121212] py-16 text-center"
                    data-testid="catalog-empty-state"
                  >
                    <p className="text-lg text-white/50">No products match these filters.</p>
                    <p className="mt-2 text-sm text-white/55">
                      Showing 0 of {visibleBase.length} products
                    </p>
                    <Button
                      className="mt-4 bg-de-accent text-white hover:bg-[#6548ff]"
                      onClick={clearAllFilters}
                      data-testid="button-empty-clear-filters"
                    >
                      Clear filters
                    </Button>
                  </div>
                )}
              </div>
              <div className="hidden lg:block">
                <StoreAssessmentPanel
                  variant="sticky"
                  onBuildSolution={() => setGuidedOpen(true)}
                  onFilterAssessments={() => {
                    setSelectedCategory("digital_assessments");
                    setSelectedOutcome(null);
                    scrollToCatalog();
                  }}
                />
              </div>
            </div>
          </div>

          {/* Info — elevated, not deleted */}
          <motion.section
            className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#141414] p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-de-accent/25 bg-de-accent/15">
                    <ShoppingCart className="h-5 w-5 text-de-accent-ink" />
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold text-white">Checkout enabled</h3>
                    <p className="text-sm text-white/60">
                      Catalog products can be purchased directly. Configure unit counts where needed,
                      then checkout or save a quote from Your Solution.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#141414] p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-de-accent/25 bg-de-accent/15">
                    <Lock className="h-5 w-5 text-de-accent-ink" />
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold text-white">Client-only products</h3>
                    <p className="text-sm text-white/60">
                      Some products require an existing client relationship.{" "}
                      <a
                        href={portalMarketplaceLoginUrl()}
                        className="text-de-accent-ink hover:text-de-accent-ink"
                      >
                        Log in to the Client Marketplace
                      </a>{" "}
                      for exclusive pricing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <CoverageScorePanel
              products={items.map((i) => i.product)}
              onAddSuggestion={(product) => {
                if (isConfigurableProduct(product)) {
                  setConfigureProduct(product);
                  return;
                }
                const { price } = getProductPrice(product.id, product.basePrice);
                addToCart(product, 1, price);
                openCart();
              }}
            />
          </motion.section>

          <motion.section
            className="rounded-2xl border border-white/10 bg-[#141414] p-8 text-center md:p-12"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45 }}
          >
            <h2 className="mb-4 text-2xl font-bold text-white md:text-3xl">
              Need a complete solution?
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-white/60">
              Looking for full-service managed IT instead of à la carte products? Explore ProActive
              Ecosystem plans for all-inclusive support — or ask DE to recommend a stack.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Link href="/internal/warehouse/managed">
                <Button
                  size="lg"
                  className="h-12 bg-de-accent px-6 text-white hover:bg-[#6548ff]"
                  data-testid="button-view-managed"
                >
                  View Managed IT Packages
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button
                size="lg"
                className="h-12 border-2 border-white/25 bg-transparent px-6 text-white hover:bg-white/10"
                onClick={() => openMspAdvisor({ context: "store" })}
                data-testid="button-advisor-cta"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Ask DE
              </Button>
              <Button asChild
                  size="lg"
                  className="h-12 border-2 border-white/25 bg-transparent px-6 text-white hover:bg-white/10"
                  data-testid="button-schedule-consult"
                >
                  <a href="/book">
                    <Phone className="mr-2 h-4 w-4" />
                  Schedule Consultation
                  </a>
                </Button>
            </div>
          </motion.section>
        </div>
      </main>

      <ProductCompareBar
        selected={compareList}
        onClear={() => setCompareList([])}
        onOpen={() => setCompareOpen(true)}
      />
      <ProductCompareDrawer
        selected={compareList}
        open={compareOpen}
        onOpenChange={setCompareOpen}
      />
      <ConfigureProductDrawer
        product={configureProduct}
        unitPrice={
          configureProduct
            ? getProductPrice(configureProduct.id, configureProduct.basePrice).price
            : 0
        }
        open={!!configureProduct}
        onClose={() => setConfigureProduct(null)}
        getAddonPrice={(p) => getProductPrice(p.id, p.basePrice).price}
        onConfirm={handleConfigureConfirm}
        onRequestQuote={handleConfigureQuote}
      />

      <GuidedBuyingWizard
        open={guidedOpen}
        onClose={() => setGuidedOpen(false)}
        onSkipCatalog={() => {
          markGuidedSkipped();
          setGuidanceTick((n) => n + 1);
          setLocation("/internal/warehouse/co-managed?catalog=full", { replace: true });
        }}
        onComplete={(next) => {
          setGuidanceTick((n) => n + 1);
          if (next.outcomeId) {
            setSelectedOutcome(next.outcomeId);
          }
          toast({
            title: "Recommended set ready",
            description: `${next.familyLabel} filtered to ${next.recommendedSkus.length} catalog items.`,
          });
        }}
      />

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export default CoManagedStore;
