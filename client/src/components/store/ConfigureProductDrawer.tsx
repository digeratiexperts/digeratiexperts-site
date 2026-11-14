import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, FileText, Minus, Moon, Phone, Plus, Settings2, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatPrice, type StoreProduct } from "@/data/storeProducts";
import {
  configUnitLabel,
  getIncludedInHint,
  getOutcomeLead,
  getProductBySku,
  getProductRelationships,
  isConfigurableProduct,
} from "@/data/storeMerchandising";
import { ProductMedia } from "@/components/store/ProductMedia";
import { PRIMARY_PHONE, PUBLIC_PHONE_CTA } from "@/data/companyContact";
import { useDockHiddenWhileOpen } from "@/hooks/useDockHiddenWhileOpen";
import { getPanelThemeStyle, useCart } from "@/contexts/CartContext";

export interface ConfigureConfirmPayload {
  product: StoreProduct;
  quantity: number;
  unitPrice: number;
  /** Related checkout-enabled add-ons selected in the drawer */
  addons: StoreProduct[];
  environmentNotes: string;
  /** Display / estimate period — cart line still uses product.pricingType */
  billingPeriod: "monthly" | "yearly" | "one_time";
}

interface ConfigureProductDrawerProps {
  product: StoreProduct | null;
  unitPrice: number;
  open: boolean;
  onClose: () => void;
  /** Resolve list/client price for related add-on SKUs */
  getAddonPrice?: (product: StoreProduct) => number;
  onConfirm: (payload: ConfigureConfirmPayload) => void;
  onRequestQuote?: (payload: ConfigureConfirmPayload) => void;
}

function isRecurringType(pricingType: string): boolean {
  return !["one_time", "per_hour"].includes(pricingType);
}

export function ConfigureProductDrawer({
  product,
  unitPrice,
  open,
  onClose,
  getAddonPrice,
  onConfirm,
  onRequestQuote,
}: ConfigureProductDrawerProps) {
  const [qty, setQty] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [environmentNotes, setEnvironmentNotes] = useState("");
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const { panelTheme, togglePanelTheme } = useCart();
  useDockHiddenWhileOpen(open);

  useEffect(() => {
    if (product) {
      setQty(Math.max(product.minimumQuantity || 1, 1));
      setSelectedAddons(new Set());
      setEnvironmentNotes("");
      setBillingPeriod(product.pricingType === "yearly" ? "yearly" : "monthly");
    }
  }, [product]);

  const unit = product ? configUnitLabel(product) : "units";
  const recurring = product ? isRecurringType(product.pricingType) : false;
  const includedHint = product ? getIncludedInHint(product.sku) : undefined;
  const relationships = product ? getProductRelationships(product.sku) : undefined;
  const upgradeName = relationships?.upgradeTo?.[0]
    ? getProductBySku(relationships.upgradeTo[0])?.name
    : undefined;

  const addonProducts = useMemo(() => {
    if (!product) return [] as StoreProduct[];
    const skus = [
      ...(relationships?.worksWith || []),
      ...(relationships?.upgradeTo || []),
      ...(relationships?.required || []),
    ];
    const seen = new Set<string>();
    const out: StoreProduct[] = [];
    for (const sku of skus) {
      const p = getProductBySku(sku);
      if (!p || seen.has(p.id) || p.id === product.id) continue;
      if (!p.isCheckoutEnabled || p.isContractOnly) continue;
      seen.add(p.id);
      out.push(p);
      if (out.length >= 4) break;
    }
    return out;
  }, [product, relationships]);

  if (!product) return null;

  const periodMultiplier = recurring && billingPeriod === "yearly" ? 12 : 1;
  const primaryLine = unitPrice * qty * periodMultiplier;
  const addonLines = addonProducts
    .filter((p) => selectedAddons.has(p.id))
    .map((p) => {
      const price = getAddonPrice?.(p) ?? p.basePrice;
      const addonQty = isConfigurableProduct(p) ? qty : 1;
      const addonRecurring = isRecurringType(p.pricingType);
      const mult = addonRecurring && billingPeriod === "yearly" ? 12 : 1;
      return { product: p, qty: addonQty, unitPrice: price, line: price * addonQty * mult };
    });
  const addonsTotal = addonLines.reduce((sum, a) => sum + a.line, 0);
  const lineTotal = primaryLine + addonsTotal;
  const periodSuffix =
    recurring && billingPeriod === "yearly"
      ? "/yr est."
      : recurring
        ? "/mo"
        : "";

  const buildPayload = (): ConfigureConfirmPayload => ({
    product,
    quantity: qty,
    unitPrice,
    addons: addonLines.map((a) => a.product),
    environmentNotes: environmentNotes.trim(),
    billingPeriod: recurring ? billingPeriod : "one_time",
  });

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            data-testid="configure-drawer-overlay"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="de-panel fixed right-0 top-0 z-[61] flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden border-l border-[color:var(--dp-border-10)] bg-[color:var(--dp-panel-bg)]"
            data-theme={panelTheme}
            style={getPanelThemeStyle(panelTheme)}
            data-testid="configure-product-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="configure-drawer-title"
          >
            <div className="flex items-center justify-between border-b border-[color:var(--dp-border-10)] px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-de-accent/30 bg-de-accent/15">
                  <Settings2 className="h-5 w-5 text-de-accent-ink" />
                </div>
                <div>
                  <h2 id="configure-drawer-title" className="text-lg font-semibold text-[color:var(--dp-text-primary)]">
                    Configure
                  </h2>
                  <p className="text-sm text-[color:var(--dp-text-50)]">
                    Set {unit}, add-ons, notes — then cart or quote
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={togglePanelTheme}
                  className="de-panel-theme-toggle text-[color:var(--dp-text-60)] hover:bg-[color:var(--dp-hover-bg)] hover:text-[color:var(--dp-text-hover)]"
                  data-testid="button-toggle-configure-theme"
                  title={panelTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  aria-label={panelTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {panelTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-[color:var(--dp-text-60)] hover:bg-[color:var(--dp-hover-bg)] hover:text-[color:var(--dp-text-hover)]"
                  data-testid="button-close-configure"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 pb-8">
              <div className="flex gap-4">
                <ProductMedia
                  product={product}
                  variant="thumb"
                  className="h-20 w-20 flex-shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="text-xl font-semibold text-[color:var(--dp-text-primary)]">{product.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--dp-text-65)]">
                    {getOutcomeLead(product)}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--dp-text-55)]">{formatPrice(product)}</p>
                </div>
              </div>

              <div className="rounded-xl border border-[color:var(--dp-border-10)] bg-[color:var(--dp-card-bg)] p-5">
                <label
                  htmlFor="configure-qty"
                  className="mb-3 block text-sm font-medium text-[color:var(--dp-text-70)]"
                >
                  Number of {unit}
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 border-[color:var(--dp-border-15)] bg-transparent text-[color:var(--dp-text-primary)]"
                    onClick={() => setQty((q) => Math.max(product.minimumQuantity || 1, q - 1))}
                    disabled={qty <= (product.minimumQuantity || 1)}
                    data-testid="button-configure-decrease"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="configure-qty"
                    type="number"
                    min={product.minimumQuantity || 1}
                    value={qty}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isFinite(n)) return;
                      setQty(Math.max(product.minimumQuantity || 1, n));
                    }}
                    className="h-11 border-[color:var(--dp-border-15)] bg-[color:var(--dp-panel-bg)] text-center text-lg text-[color:var(--dp-text-primary)]"
                    data-testid="input-configure-qty"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-11 w-11 border-[color:var(--dp-border-15)] bg-transparent text-[color:var(--dp-text-primary)]"
                    onClick={() => setQty((q) => q + 1)}
                    data-testid="button-configure-increase"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-3 text-sm text-[color:var(--dp-text-55)]">
                  Minimum {product.minimumQuantity || 1} {unit}
                </p>
              </div>

              {product.features.length > 0 && (
                <div className="rounded-xl border border-[color:var(--dp-border-10)] bg-[color:var(--dp-card-bg)] p-4">
                  <p className="mb-3 text-sm font-medium text-[color:var(--dp-text-70)]">What you get</p>
                  <ul className="space-y-2">
                    {product.features.slice(0, 4).map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-[color:var(--dp-text-60)]">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-de-accent-ink" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(includedHint || upgradeName) && (
                <div className="space-y-1.5 text-sm text-[color:var(--dp-text-50)]">
                  {includedHint && (
                    <p className="text-de-accent-ink/90" data-testid="configure-included-hint">
                      {includedHint}
                    </p>
                  )}
                  {upgradeName && <p>Upgrade path: {upgradeName}</p>}
                </div>
              )}

              {recurring && product.pricingType !== "yearly" && (
                <div className="rounded-xl border border-[color:var(--dp-border-10)] bg-[color:var(--dp-card-bg)] p-5">
                  <p className="mb-3 text-sm font-medium text-[color:var(--dp-text-70)]">Billing period</p>
                  <div className="flex gap-2" role="group" aria-label="Billing period">
                    <Button
                      type="button"
                      variant="outline"
                      className={
                        billingPeriod === "monthly"
                          ? "h-10 flex-1 border-de-accent/40 bg-de-accent/20 text-[color:var(--dp-text-primary)] hover:text-[color:var(--dp-text-hover)]"
                          : "h-10 flex-1 border-[color:var(--dp-border-15)] bg-transparent text-[color:var(--dp-text-70)] hover:text-[color:var(--dp-text-hover)]"
                      }
                      onClick={() => setBillingPeriod("monthly")}
                      data-testid="button-billing-monthly"
                    >
                      Monthly
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className={
                        billingPeriod === "yearly"
                          ? "h-10 flex-1 border-de-accent/40 bg-de-accent/20 text-[color:var(--dp-text-primary)] hover:text-[color:var(--dp-text-hover)]"
                          : "h-10 flex-1 border-[color:var(--dp-border-15)] bg-transparent text-[color:var(--dp-text-70)] hover:text-[color:var(--dp-text-hover)]"
                      }
                      onClick={() => setBillingPeriod("yearly")}
                      data-testid="button-billing-yearly"
                    >
                      Annual estimate
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--dp-text-55)]">
                    Cart keeps the catalog billing type; annual is an estimate (×12).
                  </p>
                </div>
              )}

              {addonProducts.length > 0 && (
                <div className="rounded-xl border border-[color:var(--dp-border-10)] bg-[color:var(--dp-card-bg)] p-5">
                  <p className="mb-1 text-sm font-medium text-[color:var(--dp-text-70)]">Recommended add-ons</p>
                  <p className="mb-3 text-xs text-[color:var(--dp-text-55)]">
                    From catalog relationships — not a hardware quiz.
                  </p>
                  <ul className="space-y-2">
                    {addonProducts.map((addon) => {
                      const checked = selectedAddons.has(addon.id);
                      const price = getAddonPrice?.(addon) ?? addon.basePrice;
                      return (
                        <li key={addon.id}>
                          <button
                            type="button"
                            onClick={() => toggleAddon(addon.id)}
                            className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                              checked
                                ? "border-de-accent/40 bg-de-accent/15"
                                : "border-[color:var(--dp-border-10)] bg-[color:var(--dp-panel-bg)] hover:border-[color:var(--dp-border-20)]"
                            }`}
                            data-testid={`toggle-addon-${addon.sku}`}
                            aria-pressed={checked}
                          >
                            <span
                              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                                checked
                                  ? "border-de-accent bg-de-accent text-white"
                                  : "border-[color:var(--dp-border-25)]"
                              }`}
                            >
                              {checked ? <Check className="h-3.5 w-3.5" /> : null}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-[color:var(--dp-text-primary)]">
                                {addon.name}
                              </span>
                              <span className="mt-0.5 block text-xs text-[color:var(--dp-text-50)]">
                                {formatPrice(addon)}
                                {isConfigurableProduct(addon) ? ` · scales with ${unit}` : ""}
                              </span>
                            </span>
                            <span className="text-sm text-[color:var(--dp-text-60)]">${price.toFixed(2)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <div className="rounded-xl border border-[color:var(--dp-border-10)] bg-[color:var(--dp-card-bg)] p-5">
                <label
                  htmlFor="configure-env-notes"
                  className="mb-2 flex items-center gap-2 text-sm font-medium text-[color:var(--dp-text-70)]"
                >
                  <FileText className="h-4 w-4 text-de-accent-ink" />
                  Environment notes
                </label>
                <Textarea
                  id="configure-env-notes"
                  value={environmentNotes}
                  onChange={(e) => setEnvironmentNotes(e.target.value)}
                  placeholder="Sites, identity stack, backup targets, constraints — optional context for quote or onboarding."
                  className="min-h-[88px] border-[color:var(--dp-border-15)] bg-[color:var(--dp-panel-bg)] text-sm text-[color:var(--dp-text-primary)] placeholder:text-[color:var(--dp-text-55)]"
                  data-testid="input-configure-notes"
                />
              </div>

              <div className="rounded-xl border border-de-accent/25 bg-de-accent/10 p-5">
                <p className="text-sm text-[color:var(--dp-text-60)]">
                  {qty} × ${unitPrice.toFixed(2)}
                  {recurring ? (billingPeriod === "yearly" ? " × 12" : " / mo") : ""}
                  {addonLines.length > 0
                    ? ` + ${addonLines.length} add-on${addonLines.length > 1 ? "s" : ""}`
                    : ""}
                </p>
                <p className="mt-1 text-3xl font-bold text-[color:var(--dp-text-primary)]" data-testid="text-configure-total">
                  ${lineTotal.toFixed(2)}
                  {periodSuffix ? (
                    <span className="text-lg font-medium text-[color:var(--dp-text-50)]">{periodSuffix}</span>
                  ) : null}
                </p>
                <p className="mt-2 text-xs text-[color:var(--dp-text-55)]">
                  {recurring
                    ? billingPeriod === "yearly"
                      ? "Adds to Annual in Your Solution."
                      : "Adds to Monthly in Your Solution."
                    : "Adds to Due Today in Your Solution."}
                </p>
              </div>
            </div>

            <div className="space-y-3 border-t border-[color:var(--dp-border-10)] p-6">
              <Button
                className="h-12 w-full bg-de-accent text-base text-white hover:bg-[#6548ff]"
                onClick={() => onConfirm(buildPayload())}
                data-testid="button-add-configured"
              >
                Add to Solution
              </Button>
              {onRequestQuote && (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full border-[color:var(--dp-border-15)] bg-transparent text-[color:var(--dp-text-primary)] hover:bg-[color:var(--dp-hover-bg)]"
                  onClick={() => onRequestQuote(buildPayload())}
                  data-testid="button-configure-quote"
                >
                  Request quote
                </Button>
              )}
              <a
                href={PUBLIC_PHONE_CTA.href}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[color:var(--dp-border-15)] text-sm text-[color:var(--dp-text-75)] transition-colors hover:bg-[color:var(--dp-hover-bg)] hover:text-[color:var(--dp-text-hover)]"
                data-testid="link-configure-call"
              >
                <Phone className="h-4 w-4" />
                Need help sizing? {PUBLIC_PHONE_CTA.numberLabel}
              </a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
