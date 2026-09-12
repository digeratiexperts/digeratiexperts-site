import type { MouseEvent } from "react";
import { Link } from "wouter";
import { ShoppingCart, LogIn, Tag, Eye, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  categoryLabels,
  formatPrice,
  isResolvedPrice,
  type ProductCategory,
  type StoreProduct,
} from "@/data/storeProducts";
import {
  getBestForLabel,
  getIncludedInHint,
  getOutcomeLead,
  getProductBySku,
  getProductRelationships,
  getProductTags,
  isConfigurableProduct,
} from "@/data/storeMerchandising";
import { getProductVisual } from "@/data/productImages";
import { ProductMedia } from "@/components/store/ProductMedia";
import { useCart } from "@/contexts/CartContext";
import { getSolutionChips } from "@/lib/storeSolutionIntelligence";

/**
 * Soft accent colors — pills only, not whole-card rainbow.
 *
 * This is wayfinding, not decoration: every category has to stay tellable from
 * every other one, so no two entries may share a hue. The pill also prints its
 * category label, which keeps colour as reinforcement rather than the only
 * channel.
 *
 * Store taxonomy colours are exceptions to the marketing-page accent cleanup.
 * Do not collapse them onto one hue, and do not strip violet / purple / indigo
 * from these pills just because those tokens are retired on marketing chrome.
 * See the store entry in scripts/brand-audit.mjs and blog-store-color-lock.mdc.
 */
export const categoryAccent: Record<ProductCategory, string> = {
  contract_services: "text-amber-300",
  comanaged_subscriptions: "text-violet-300",
  comanaged_onboarding: "text-purple-300",
  networking_managed: "text-cyan-300",
  networking_projects: "text-sky-300",
  ucaas_subscriptions: "text-green-300",
  ucaas_setup: "text-emerald-300",
  hardware_provisioning: "text-orange-300",
  hardware_physical: "text-rose-300",
  hardware_handling: "text-red-300",
  digital_assessments: "text-blue-300",
  digital_templates: "text-indigo-300",
  digital_training: "text-fuchsia-300",
  professional_services: "text-pink-300",
};

export interface StoreProductCardProps {
  product: StoreProduct;
  price: number;
  hasDiscount?: boolean;
  discountPercent?: number;
  isLoggedIn?: boolean;
  compact?: boolean;
  compareSelected?: boolean;
  onCompareToggle?: (product: StoreProduct) => void;
  compareDisabled?: boolean;
  onAddToCart: (product: StoreProduct, e: MouseEvent) => void;
  onConfigure?: (product: StoreProduct) => void;
  onLoginRequired?: () => void;
}

export function StoreProductCard({
  product,
  price,
  hasDiscount = false,
  discountPercent = 0,
  isLoggedIn = false,
  compact = false,
  compareSelected = false,
  onCompareToggle,
  compareDisabled = false,
  onAddToCart,
  onConfigure,
  onLoginRequired,
}: StoreProductCardProps) {
  const accent = categoryAccent[product.category];
  const includedHint = getIncludedInHint(product.sku);
  const isContract = product.isContractOnly || !product.isCheckoutEnabled;
  const configurable = isConfigurableProduct(product) && !!onConfigure;
  const tags = getProductTags(product);
  const relationships = getProductRelationships(product.sku);
  const worksWithNames = (relationships?.worksWith || [])
    .map((sku) => getProductBySku(sku)?.name)
    .filter(Boolean)
    .slice(0, 2) as string[];
  const visual = getProductVisual(product);
  const vendor = visual.vendor;
  const { items } = useCart();
  const solutionChips = getSolutionChips(
    product,
    items.map((item) => item.product),
  );
  const bestFor = getBestForLabel(product);

  return (
    <article
      className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-[#FAF9F6] text-[#1A1228] transition-all duration-300 hover:border-de-accent/50 hover:bg-white hover:shadow-[0_20px_50px_rgba(0,0,0,0.25)] hover:-translate-y-1.5 group"
      data-testid={`product-${product.id}`}
    >
      {onCompareToggle && !isContract && (
        <label className="absolute right-2.5 top-2.5 z-20 flex cursor-pointer items-center gap-1.5 rounded-full border border-black/10 bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-[#1A1228] shadow-sm backdrop-blur-md hover:bg-white transition-colors">
          <input
            type="checkbox"
            checked={compareSelected}
            disabled={!compareSelected && compareDisabled}
            onChange={() => onCompareToggle(product)}
            className="h-3.5 w-3.5 rounded border-black/30 bg-transparent accent-de-accent"
            data-testid={`compare-check-${product.id}`}
          />
          Compare
        </label>
      )}

      <Link href={`/internal/warehouse/product/${product.sku}`} className="relative block">
        <ProductMedia
          product={product}
          variant="card"
          className="rounded-none border-0 border-b border-black/10"
        />
        <span
          className={`absolute left-2.5 top-2.5 z-10 rounded-full bg-[#181520]/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm ${accent}`}
        >
          {categoryLabels[product.category]}
        </span>
      </Link>

      <div className={`flex flex-1 flex-col ${compact ? "p-3.5" : "p-4 sm:p-5"}`}>
        <div className="mb-2">
          {vendor && (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#8A8496]">
              {vendor.name}
            </p>
          )}
          <div className="mb-1.5 flex flex-wrap items-center gap-1 empty:hidden">
            {product.isClientOnly && (
              <span className="rounded-full border border-de-accent/30 bg-de-accent/10 px-2 py-0.5 text-[10px] font-bold text-de-accent">
                Client pricing
              </span>
            )}
            {isContract && (
              <span className="rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                Consult
              </span>
            )}
          </div>
          <h3
            className="text-base font-bold leading-snug text-[#1A1228] transition-colors group-hover:text-de-accent line-clamp-2"
          >
            <Link href={`/internal/warehouse/product/${product.sku}`}>
              <span title={product.name}>
                {product.name}
              </span>
            </Link>
          </h3>
        </div>

        <p
          className="mb-3 text-xs leading-relaxed text-[#4A4556] line-clamp-2 sm:text-sm font-medium"
        >
          {getOutcomeLead(product)}
        </p>

        {includedHint && (
          <div className="mb-3 text-xs font-semibold text-de-accent">
            <p className="line-clamp-1" data-testid={`included-hint-${product.id}`}>{includedHint}</p>
          </div>
        )}

        {solutionChips.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Solution status">
            {solutionChips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center rounded-full border border-black/10 bg-black/[0.04] px-2 py-0.5 text-xs font-medium text-[#2A2438]"
                data-testid={`solution-chip-${product.id}`}
              >
                {chip.label}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto border-t border-black/10 pt-3.5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            {hasDiscount && isResolvedPrice(price) && isResolvedPrice(product.basePrice) ? (
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg sm:text-xl font-bold text-[#1A1228]" data-testid={`price-${product.id}`}>
                    ${price.toFixed(2)}
                  </span>
                  <span className="text-xs text-black/40 line-through">
                    ${product.basePrice.toFixed(2)}
                  </span>
                </div>
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-de-accent">
                  <Tag className="h-3 w-3" />
                  {discountPercent}% off
                </span>
              </div>
            ) : (
              <span className="text-lg sm:text-xl font-bold text-[#1A1228]" data-testid={`price-${product.id}`}>
                {isContract && !isResolvedPrice(product.basePrice) ? "Custom quote" : formatPrice(product)}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <Link href={`/internal/warehouse/product/${product.sku}`} className="flex-1">
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full border border-black/15 bg-white text-xs font-semibold text-[#1A1228] hover:bg-black/5 hover:border-black/30 transition-colors shadow-sm"
                data-testid={`button-details-${product.id}`}
              >
                <Eye className="mr-1 h-3.5 w-3.5" />
                Details
              </Button>
            </Link>

            {isContract ? (
              <a href="/book" className="flex-1">
                <Button
                  size="sm"
                  className="h-9 w-full bg-de-accent text-xs font-bold text-white hover:bg-[#6548ff] shadow-md shadow-de-accent/25 transition-all"
                  data-testid={`button-consult-${product.id}`}
                >
                  Schedule
                </Button>
              </a>
            ) : product.isClientOnly && !isLoggedIn ? (
              <Button
                size="sm"
                className="h-9 flex-1 bg-de-accent text-xs font-bold text-white hover:bg-[#6548ff] shadow-md shadow-de-accent/25 transition-all"
                onClick={(e) => {
                  e.preventDefault();
                  onLoginRequired?.();
                }}
                data-testid={`button-login-${product.id}`}
              >
                <LogIn className="mr-1 h-3.5 w-3.5" />
                Login
              </Button>
            ) : configurable ? (
              <Button
                size="sm"
                className="h-9 flex-1 bg-de-accent text-xs font-bold text-white hover:bg-[#6548ff] shadow-md shadow-de-accent/25 transition-all"
                onClick={(e) => {
                  e.preventDefault();
                  onConfigure?.(product);
                }}
                data-testid={`button-configure-${product.id}`}
              >
                <Settings2 className="mr-1 h-3.5 w-3.5" />
                Configure
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-9 flex-1 bg-de-accent text-xs font-bold text-white hover:bg-[#6548ff] shadow-md shadow-de-accent/25 transition-all"
                onClick={(e) => onAddToCart(product, e)}
                data-testid={`button-add-${product.id}`}
              >
                <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
