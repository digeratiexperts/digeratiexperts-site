import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "../sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { Link, useLocation, useSearch } from "wouter";
import {
  ArrowRight,
  Shield,
  Users,
  Building,
  Phone,
  Monitor,
  Wifi,
  Headphones,
  Cloud,
  Lock,
  FileCheck,
  GraduationCap,
  Wrench,
  Package,
  Settings,
  Server,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import {
  storeProducts,
  categoryLabels,
  getContractOnlyProducts,
  getCheckoutEnabledProducts,
  type ProductCategory,
  type StoreProduct,
} from "@/data/storeProducts";
import {
  isConfigurableProduct,
  type GuidedRecommendation,
  type StoreOutcomeId,
} from "@/data/storeMerchandising";
import { useStoreAuth } from "@/hooks/useStoreAuth";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { openMspAdvisor } from "@/lib/openMspAdvisor";
import {
  isGuidedFullCatalog,
  markGuidedSkipped,
  readGuidedSession,
  recommendationFromSession,
} from "@/lib/storeGuidedSession";
import { StoreTrustStrip } from "@/components/store/StoreTrustStrip";
import { ShopByOutcome } from "@/components/store/ShopByOutcome";
import { MerchandisingRails } from "@/components/store/MerchandisingRails";
import { StoreAssessmentPanel } from "@/components/store/StoreAssessmentPanel";
import { StoreBundlesSection } from "@/components/store/StoreBundlesSection";
import { StoreProductCard } from "@/components/store/StoreProductCard";
import { ConfigureProductDrawer } from "@/components/store/ConfigureProductDrawer";
import { GuidedBuyingWizard } from "@/components/store/GuidedBuyingWizard";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";
import { StoreClientBar } from "@/components/store/StoreClientBar";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

const categoryIcons: Record<ProductCategory, typeof Shield> = {
  contract_services: Building,
  comanaged_subscriptions: Users,
  comanaged_onboarding: Settings,
  networking_managed: Wifi,
  networking_projects: Server,
  ucaas_subscriptions: Phone,
  ucaas_setup: Headphones,
  hardware_provisioning: Monitor,
  hardware_physical: Package,
  hardware_handling: Wrench,
  digital_assessments: Shield,
  digital_templates: FileCheck,
  digital_training: GraduationCap,
  professional_services: Cloud,
};

type LandingMode = "guide" | "recommended" | "catalog";

function initialLandingMode(search: string): LandingMode {
  if (isGuidedFullCatalog(search)) return "catalog";
  if (readGuidedSession()?.completed) return "recommended";
  return "guide";
}

const StoreLanding = () => {
  const prefersReducedMotion = useReducedMotion();
  const { isLoggedIn, user, getProductPrice, loginRedirect } = useStoreAuth();
  const { addToCart, openCart } = useCart();
  const { toast } = useToast();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<LandingMode>(() => initialLandingMode(search));
  const [recommendation, setRecommendation] = useState<GuidedRecommendation | null>(
    () => recommendationFromSession(),
  );
  const [outcomeHighlight, setOutcomeHighlight] = useState<StoreOutcomeId | null>(
    () => recommendationFromSession()?.outcomeId ?? null,
  );
  const [configureProduct, setConfigureProduct] = useState<StoreProduct | null>(null);
  const showFullCatalog = mode === "catalog";

  useSEO({
    noIndex: true,
    title: "IT Services Store | Digerati Experts",
    description:
      "Guided IT storefront from Digerati Experts — shop by outcome, curated merchandising rails, managed packages, and co-managed products with live catalog pricing.",
    canonical: "/internal/warehouse",
  });

  const contractOnlyProducts = getContractOnlyProducts();
  const checkoutProducts = getCheckoutEnabledProducts();

  const featuredProducts = storeProducts
    .filter((p) => p.isCheckoutEnabled && !p.isClientOnly)
    .slice(0, 6);

  const categories = Object.keys(categoryLabels) as ProductCategory[];

  const containerVariants = prefersReducedMotion
    ? undefined
    : {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
      };

  const itemVariants = prefersReducedMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
      };

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

  const handleOutcomeSelect = (id: StoreOutcomeId | null) => {
    setOutcomeHighlight(id);
    if (id) {
      setLocation(`/internal/warehouse/co-managed?outcome=${id}#store-catalog`);
    }
  };

  const revealFullCatalog = () => {
    markGuidedSkipped();
    setMode("catalog");
    setLocation("/store?catalog=full", { replace: true });
  };

  const addRecommendedStack = (products: StoreProduct[], seatHint: number) => {
    products.forEach((product) => {
      const { price } = getProductPrice(product.id, product.basePrice);
      const qty =
        product.pricingType === "per_endpoint" ||
        product.pricingType === "per_user" ||
        product.pricingType === "per_seat" ||
        product.pricingType === "per_device"
          ? seatHint
          : 1;
      addToCart(product, qty, price);
    });
    toast({
      title: "Recommended set added",
      description: `${products.length} catalog items added to Your Solution.`,
    });
    openCart();
  };

  const recommendedProducts = useMemo(() => recommendation?.products ?? [], [recommendation]);

  return (
    <div className="relative min-h-screen bg-[#0a0a0a]">
      <StorePageAtmosphere />
      <MegaMenu />

      <main className="relative z-10 pb-20 de-nav-clear">
        <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
          <StoreClientBar />

          <div className={showFullCatalog ? "grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]" : undefined}>
            <div>
              <motion.div
                className="mb-10"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.45 }}
              >
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-de-accent/25 bg-de-accent/10 px-4 py-2">
                  <Package className="h-4 w-4 text-de-accent-ink" />
                  <span className="text-sm text-de-accent-ink">IT Services & Solutions</span>
                </div>
                <h1 className="mb-4 text-[clamp(2rem,6vw,3.5rem)] font-bold leading-[1.12] tracking-[-0.03em] text-white break-words">
                  {mode === "recommended" ? (
                    <>
                      A recommended set — not the{" "}
                      <span className="text-de-accent-ink">whole catalog</span>
                    </>
                  ) : (
                    <>
                      Tell us what you&apos;re trying to{" "}
                      <span className="text-de-accent-ink">accomplish</span>
                    </>
                  )}
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-white/70 md:text-xl">
                  {mode === "recommended"
                    ? recommendation?.summary
                    : "Three short questions. We start identity from your work email in the background, then show Solutions or the Client Marketplace — not every SKU at once."}
                </p>
                {mode !== "guide" && (
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                    <Button
                      className="h-12 w-full bg-de-accent px-6 text-base text-white hover:bg-[#6548ff] sm:w-auto"
                      onClick={() => {
                        setMode("guide");
                      }}
                      data-testid="button-build-solution"
                    >
                      <Sparkles className="mr-2 h-5 w-5" />
                      Retake the three questions
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
                    {showFullCatalog && (
                      <Link href="/internal/warehouse/co-managed?catalog=full">
                        <Button
                          variant="ghost"
                          className="h-12 w-full px-6 text-base text-white/70 hover:bg-white/5 hover:text-white sm:w-auto"
                          data-testid="button-browse-catalog"
                        >
                          Browse full catalog
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                )}
              </motion.div>

              {mode === "guide" && (
                <div className="mb-12" data-testid="store-guided-entry">
                  <GuidedBuyingWizard
                    variant="inline"
                    signedInEmail={user?.email}
                    onSkipCatalog={revealFullCatalog}
                    onComplete={(next) => {
                      setRecommendation(next);
                      setOutcomeHighlight(next.outcomeId);
                      setMode("recommended");
                    }}
                  />
                </div>
              )}

              {mode === "recommended" && recommendation && (
                <section className="mb-14" data-testid="store-recommended-set">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-de-accent-ink">
                    {recommendation.familyLabel}
                  </p>
                  <h2 className="text-3xl font-bold text-white md:text-4xl">{recommendation.headline}</h2>
                  {recommendation.workEmail && (
                    <p className="mt-2 text-sm text-white/50" data-testid="store-captured-email">
                      Work email captured: {recommendation.workEmail}
                    </p>
                  )}

                  {recommendation.proactiveTier && (
                    <div className="mt-6 rounded-2xl border border-white/10 bg-[#141414] p-6">
                      <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/55">
                        One ProActive tier
                      </p>
                      <h3 className="mt-2 text-2xl font-semibold text-white">
                        {recommendation.proactiveTier.name}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
                        {recommendation.proactiveTier.shortDescription}. Packages are mutually exclusive —
                        we are not stacking another tier, and CSRA is not a credit against this plan.
                      </p>
                      <div className="mt-4">
                        <Button asChild className="h-11 bg-de-accent text-white hover:bg-[#6548ff]">
                          <Link href="/internal/warehouse/managed">See this plan</Link>
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="mt-8 grid gap-6 md:grid-cols-2">
                    {recommendedProducts.map((product) => {
                      const pricing = getProductPrice(product.id, product.basePrice);
                      return (
                        <StoreProductCard
                          key={product.id}
                          product={product}
                          price={pricing.price}
                          hasDiscount={pricing.hasDiscount}
                          discountPercent={pricing.discountPercent}
                          isLoggedIn={isLoggedIn}
                          onAddToCart={handleAddToCart}
                          onConfigure={(item) => setConfigureProduct(item)}
                          onLoginRequired={loginRedirect}
                        />
                      );
                    })}
                  </div>

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button
                      className="h-12 bg-de-accent px-6 text-white hover:bg-[#6548ff]"
                      disabled={!recommendedProducts.length}
                      onClick={() => addRecommendedStack(recommendedProducts, recommendation.seatHint)}
                      data-testid="button-add-recommended-stack"
                    >
                      Add recommended set
                    </Button>
                    <button
                      type="button"
                      onClick={revealFullCatalog}
                      className="text-sm text-white/55 underline-offset-4 hover:text-white/70 hover:underline"
                      data-testid="button-browse-catalog"
                    >
                      Browse the full catalog
                    </button>
                  </div>
                </section>
              )}

              {mode !== "guide" && (
                <>
                  <StoreTrustStrip />
                  <ShopByOutcome
                    selected={outcomeHighlight}
                    onSelect={handleOutcomeSelect}
                  />
                </>
              )}
            </div>

            {showFullCatalog && (
              <div className="hidden lg:block">
                <StoreAssessmentPanel variant="sticky" onBuildSolution={() => setMode("guide")} />
              </div>
            )}
          </div>

          {showFullCatalog && (
            <div className="mb-10 lg:hidden">
              <StoreAssessmentPanel variant="inline" onBuildSolution={() => setMode("guide")} />
            </div>
          )}

          {showFullCatalog && (
            <>
          {/* Two Client Type Cards — elevated, not deleted */}
          <motion.section
            className="mb-16"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-white md:text-4xl">How do you buy?</h2>
              <p className="mt-2 text-base text-white/60 md:text-lg">
                Full-service packages or flexible co-managed products — same store, clearer paths.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2">
              <motion.div
                variants={itemVariants}
                className="group relative overflow-hidden rounded-2xl border border-de-accent/30 bg-[#141414] p-9 transition-all duration-300 hover:-translate-y-1"
                data-testid="card-managed-clients"
              >
                <div className="relative z-10">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-de-accent/30 bg-de-accent/15">
                    <Building className="h-8 w-8 text-de-accent-ink" />
                  </div>
                  <h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">Managed Clients</h2>
                  <p className="mb-4 text-base leading-relaxed text-white/65 md:text-lg">
                    Full-service managed IT packages for businesses seeking comprehensive support.
                    ProActive Ecosystem plans include everything you need in one predictable monthly
                    subscription.
                  </p>
                  <div className="mb-6 flex items-center gap-2 text-base text-de-accent-ink">
                    <Lock className="h-4 w-4" />
                    <span>Contract-based services · Schedule a consultation</span>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-base text-white/50">
                      {contractOnlyProducts.length} packages available
                    </span>
                    <Link href="/internal/warehouse/managed">
                      <Button
                        className="h-11 w-full bg-de-accent px-5 text-base text-white hover:bg-[#6548ff] sm:w-auto"
                        data-testid="button-view-managed"
                      >
                        View Packages
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>

              <motion.div
                variants={itemVariants}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#141414] p-9 transition-all duration-300 hover:-translate-y-1 hover:border-de-accent/30"
                data-testid="card-comanaged-clients"
              >
                <div className="relative z-10">
                  <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-xl border border-de-accent/30 bg-de-accent/15">
                    <Users className="h-8 w-8 text-de-accent-ink" />
                  </div>
                  <h2 className="mb-3 text-2xl font-bold text-white md:text-3xl">Co-Managed Clients</h2>
                  <p className="mb-4 text-base leading-relaxed text-white/65 md:text-lg">
                    Flexible solutions for IT teams needing extra support. Add endpoint management,
                    security tools, UCaaS, hardware provisioning, or professional services as needed.
                  </p>
                  <div className="mb-6 flex items-center gap-2 text-base text-emerald-300">
                    <Shield className="h-4 w-4" />
                    <span>Checkout enabled · Purchase directly</span>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-base text-white/50">
                      {checkoutProducts.length} products available
                    </span>
                    <Link href="/internal/warehouse/co-managed">
                      <Button
                        className="h-11 w-full border-none bg-de-accent px-5 text-base text-white hover:bg-[#6548ff] sm:w-auto"
                        data-testid="button-view-comanaged"
                      >
                        Browse Products
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.section>

          <MerchandisingRails
            isLoggedIn={isLoggedIn}
            getPrice={getProductPrice}
            onAddToCart={handleAddToCart}
            onConfigure={(p) => setConfigureProduct(p)}
            onLoginRequired={loginRedirect}
            railIds={["popular", "microsoft365", "cyber_insurance", "best_value"]}
          />

          <StoreBundlesSection
            isLoggedIn={isLoggedIn}
            onAddBundle={(products) => {
              products.forEach((product) => {
                const { price } = getProductPrice(product.id, product.basePrice);
                addToCart(product, 1, price);
              });
              toast({
                title: "Bundle items added",
                description: `${products.length} products added to your solution.`,
              });
              openCart();
            }}
          />

          {/* Category Grid — elevated */}
          <motion.section
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-8">
              <h2 className="mb-2 text-2xl font-bold text-white md:text-3xl">Browse by Category</h2>
              <p className="text-white/60">Explore our complete catalog of IT services and products.</p>
            </div>

            <motion.div
              className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {categories.map((category) => {
                const Icon = categoryIcons[category];
                const productCount = storeProducts.filter((p) => p.category === category).length;
                return (
                  <motion.div key={category} variants={itemVariants}>
                    <Link href={`/internal/warehouse/co-managed?category=${category}`}>
                      <div
                        className="group flex h-full cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-[#141414] px-3.5 py-3 text-left transition-colors duration-200 hover:border-de-accent/30 hover:bg-[#171717]"
                        data-testid={`category-${category}`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] transition-colors group-hover:border-de-accent/30 group-hover:bg-de-accent/15">
                          <Icon className="h-5 w-5 text-de-accent-ink" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-medium text-white">
                            {categoryLabels[category]}
                          </h3>
                          <p className="text-xs text-white/55">{productCount} items</p>
                        </div>
                        <ArrowRight className="h-4 w-4 shrink-0 text-white/30 group-hover:text-de-accent-ink" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.section>

          {/* Featured Products — elevated */}
          <motion.section
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="mb-2 text-2xl font-bold text-white md:text-3xl">Available for checkout</h2>
                <p className="text-white/60">Configure or add these catalog items now.</p>
              </div>
              <Link href="/internal/warehouse/co-managed">
                <Button
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10 sm:w-auto"
                  data-testid="button-view-all-products"
                >
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <motion.div
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {featuredProducts.map((product) => {
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
                    />
                  </motion.div>
                );
              })}
            </motion.div>
          </motion.section>
            </>
          )}

          {mode !== "guide" && (
          <motion.section
            className="rounded-2xl border border-white/10 bg-[#141414] p-8 text-center md:p-12"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="mb-4 text-2xl font-bold text-white md:text-3xl">Need a recommendation, not a catalog?</h2>
            <p className="mx-auto mb-8 max-w-xl text-white/60">
              Start with a cyber risk assessment or compare ProActive plans. We map gaps to real
              SKUs — no obligation to buy from the storefront.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                variant="brand"
                className="h-12 px-6"
                data-testid="button-schedule-consult"
              >
                <a href="/book">
                  {CTA.primary}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 border-white/30 bg-transparent px-6 text-white hover:bg-white/10"
                data-testid="button-see-plans"
              >
                <Link href={CTA.secondaryHref}>{CTA.secondary}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="h-12 border-2 border-white/30 bg-transparent px-6 text-white hover:bg-white/10"
                data-testid="button-call-us"
              >
                <a href={PRIMARY_PHONE.telHref}>
                  <Phone className="mr-2 h-4 w-4" />
                  {PRIMARY_PHONE.display}
                </a>
              </Button>
            </div>
          </motion.section>
          )}
        </div>
      </main>

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
        onConfirm={(payload) => {
          const { product, quantity, unitPrice, addons } = payload;
          addToCart(product, quantity, unitPrice);
          addons.forEach((addon) => {
            const { price } = getProductPrice(addon.id, addon.basePrice);
            addToCart(addon, isConfigurableProduct(addon) ? quantity : 1, price);
          });
          setConfigureProduct(null);
          toast({
            title: "Configured service added",
            description: `${quantity} × ${product.name}`,
          });
          openCart();
        }}
        onRequestQuote={(payload) => {
          const { product, quantity, unitPrice, addons } = payload;
          addToCart(product, quantity, unitPrice);
          addons.forEach((addon) => {
            const { price } = getProductPrice(addon.id, addon.basePrice);
            addToCart(addon, isConfigurableProduct(addon) ? quantity : 1, price);
          });
          setConfigureProduct(null);
          toast({
            title: "Ready for quote",
            description: "Items added — open Your Solution to request a quote.",
          });
          openCart();
        }}
      />

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export default StoreLanding;
