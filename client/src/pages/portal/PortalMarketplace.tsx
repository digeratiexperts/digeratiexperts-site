import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ClipboardCheck, Link2Off, RefreshCw, ShieldCheck, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { MARKETPLACE_ELIGIBILITY } from "@shared/checkoutEligibility";
import { isResolvedPrice } from "@/data/storeProducts";
import {
  TENANT_SCOPE_PRESENTATION,
  canRenderCatalog,
  parseTenantScopeState,
  type TenantScopeState,
} from "@/lib/marketplaceTenantState";
import { cn } from "@/lib/utils";

/**
 * Catalog rows are typed defensively: the contract for items is not settled, so
 * anything without an id and a name is dropped rather than rendered half-empty,
 * and a price only shows when it resolves (ECO-002 — never "$0.00").
 */
type MarketplaceItem = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price?: number | null;
  priceLabel?: string | null;
};

type MarketplaceResponse = {
  eligibility?: typeof MARKETPLACE_ELIGIBILITY;
  tenantState?: string;
  items?: unknown[];
  status?: "unavailable" | "unmapped";
  reason?: string;
};

function toItems(raw: unknown[] | undefined): MarketplaceItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const r = entry as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id : typeof r.sku === "string" ? r.sku : null;
    const name = typeof r.name === "string" ? r.name : typeof r.title === "string" ? r.title : null;
    if (!id || !name) return [];
    return [{
      id,
      name,
      description: typeof r.description === "string" ? r.description : undefined,
      category: typeof r.category === "string" ? r.category : undefined,
      price: typeof r.price === "number" ? r.price : null,
      priceLabel: typeof r.priceLabel === "string" ? r.priceLabel : null,
    }];
  });
}

function priceText(item: MarketplaceItem): string {
  if (item.priceLabel) return item.priceLabel;
  if (isResolvedPrice(item.price)) return `$${item.price.toLocaleString()}`;
  return "Priced on approval";
}

const TONE_STYLES: Record<TenantScopeState, { badge: string; panel: string; Icon: typeof ShieldCheck }> = {
  SCOPED: {
    badge: "border-emerald-700/30 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
    panel: "border-emerald-700/20",
    Icon: ShieldCheck,
  },
  AUTHORIZED_GLOBAL: {
    badge: "border-blue-700/30 bg-blue-50 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
    panel: "border-blue-700/20",
    Icon: ShieldCheck,
  },
  UNMAPPED: {
    badge: "border-amber-700/30 bg-amber-50 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
    panel: "border-amber-700/30 bg-amber-50/40 dark:bg-amber-500/5",
    Icon: Link2Off,
  },
  AUTHORITY_UNAVAILABLE: {
    badge: "border-slate-400/50 bg-slate-100 text-slate-800 dark:bg-slate-500/20 dark:text-slate-200",
    panel: "border-slate-400/40 bg-slate-50 dark:bg-slate-500/5",
    Icon: AlertTriangle,
  },
};

export default function PortalMarketplace() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery<MarketplaceResponse>({
    queryKey: ["/api/portal/marketplace"],
    queryFn: () => portalGet<MarketplaceResponse>("/api/portal/marketplace"),
  });

  // A failed request is indistinguishable from an unreachable authority: fail closed.
  const state: TenantScopeState = isError ? "AUTHORITY_UNAVAILABLE" : parseTenantScopeState(data);
  const presentation = TENANT_SCOPE_PRESENTATION[state];
  const tone = TONE_STYLES[state];
  const items = canRenderCatalog(state) ? toItems(data?.items) : [];
  const StateIcon = tone.Icon;

  return (
    <PortalLayout title="Client Marketplace">
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold">Client Marketplace</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Standardized items for your organization. Purchases here go through DE approval
            before anything is ordered.
          </p>
        </div>

        {/* State panel. The enum stays in data attributes for QA; clients read the
            presentation copy only. */}
        <Card
          className={cn(tone.panel)}
          data-testid="marketplace-state"
          data-tenant-state={state}
          data-eligibility={data?.eligibility || MARKETPLACE_ELIGIBILITY}
          aria-busy={isLoading || undefined}
        >
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <StateIcon className="h-5 w-5 shrink-0 text-[#D3126A]" aria-hidden="true" />
                {isLoading ? "Checking your organization's catalog…" : presentation.title}
              </CardTitle>
              {!isLoading && (
                <span
                  className={cn("inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold", tone.badge)}
                  data-testid="marketplace-state-badge"
                >
                  {presentation.badge}
                </span>
              )}
            </div>
            <CardDescription>
              {isLoading ? "One moment." : presentation.body}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {state === "UNMAPPED" && !isLoading && (
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200" data-testid="marketplace-restricted-note">
                No items are shown for an unlinked account, by design. This is not an error on your side.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-[#D3126A] text-white hover:bg-[#D3126A]/90">
                <Link href={presentation.primary.href} data-testid="marketplace-primary-action">
                  <ClipboardCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                  {presentation.primary.label}
                </Link>
              </Button>
              {presentation.secondary && (
                <Button asChild variant="outline">
                  <Link href={presentation.secondary.href} data-testid="marketplace-secondary-action">
                    {presentation.secondary.label}
                  </Link>
                </Button>
              )}
              {state === "AUTHORITY_UNAVAILABLE" && !isLoading && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  data-testid="marketplace-retry"
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
                  {isFetching ? "Retrying…" : "Try again"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Catalog: only for the two authorized states, and only rows that fully parse. */}
        {canRenderCatalog(state) && !isLoading && (
          <Card data-testid="marketplace-catalog" data-item-count={items.length}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-[#D3126A]" aria-hidden="true" />
                Catalog
              </CardTitle>
              <CardDescription>
                {items.length === 0
                  ? "No items have been published to this catalog yet. Request approval and DE will confirm what fits."
                  : `${items.length} item${items.length === 1 ? "" : "s"} available to request.`}
              </CardDescription>
            </CardHeader>
            {items.length > 0 && (
              <CardContent>
                <ul className="divide-y divide-border" data-testid="marketplace-items">
                  {items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 py-3" data-testid={`marketplace-item-${item.id}`}>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{item.name}</p>
                        {item.category && (
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.category}</p>
                        )}
                        {item.description && (
                          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-medium text-foreground">{priceText(item)}</span>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/portal/forms?item=${encodeURIComponent(item.id)}`}>Request</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    </PortalLayout>
  );
}
