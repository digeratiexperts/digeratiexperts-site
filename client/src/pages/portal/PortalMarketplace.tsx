import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ClipboardCheck, Link2Off, RefreshCw, ShieldCheck, ShoppingCart, Warehouse } from "lucide-react";
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
import { warehousePath } from "@/lib/warehousePaths";
import { cn } from "@/lib/utils";
import { Panel, Token, type TokenTone } from "@/components/portal/ui";

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
  /**
   * Contract enum (Cursor 26b8c609) — or the pre-contract lowercase status.
   * `"staff"` is outside the tenant enum: the server sends it for a live DE
   * admin, who is not a client and gets no Request Approval flow here.
   */
  status?: string;
  reason?: string;
  /** Only with `status: "staff"` — where the staff catalog actually lives. */
  warehouseUrl?: string;
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

/** State colour carries the tenant scope; the presentation copy carries the words. */
const TONE_STYLES: Record<TenantScopeState, { tone: TokenTone; Icon: typeof ShieldCheck }> = {
  SCOPED: { tone: "ok", Icon: ShieldCheck },
  AUTHORIZED_GLOBAL: { tone: "info", Icon: ShieldCheck },
  UNMAPPED: { tone: "warn", Icon: Link2Off },
  AUTHORITY_UNAVAILABLE: { tone: "neutral", Icon: AlertTriangle },
};

export default function PortalMarketplace() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery<MarketplaceResponse>({
    queryKey: ["/api/portal/marketplace"],
    queryFn: () => portalGet<MarketplaceResponse>("/api/portal/marketplace"),
  });

  // DE staff are decided server-side from the live portal record (never the JWT
  // claim). They are not clients: no Request Approval flow and no catalog on this
  // surface — they are pointed at the Digital Warehouse instead.
  const isStaff = !isError && data?.status === "staff";
  // A failed request is indistinguishable from an unreachable authority: fail closed.
  const state: TenantScopeState = isError ? "AUTHORITY_UNAVAILABLE" : parseTenantScopeState(data);
  const presentation = TENANT_SCOPE_PRESENTATION[state];
  const tone = TONE_STYLES[state];
  const items = canRenderCatalog(state) ? toItems(data?.items) : [];
  const StateIcon = tone.Icon;

  const marketplaceDescription =
    "Standardized items for your organization. Purchases here go through DE approval before anything is ordered.";

  if (isStaff) {
    return (
      <PortalLayout title="Client Marketplace" description={marketplaceDescription}>
        <div className="space-y-4">
          <div
            data-testid="marketplace-staff"
            data-eligibility={data?.eligibility || MARKETPLACE_ELIGIBILITY}
          >
            <Panel
              id="marketplace-staff-panel"
              title={
                <span className="flex items-center gap-2">
                  <Warehouse className="pt-link h-4 w-4 shrink-0" aria-hidden="true" />
                  DE Staff — Digital Warehouse
                </span>
              }
              description="You are signed in as DE staff. This page is the client view — no approval request is needed for your account."
            >
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The full catalog with vendors, costs, and Pay Now lives in the staff-only
                  Digital Warehouse.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="brand">
                    <Link href={data?.warehouseUrl || warehousePath()} data-testid="marketplace-primary-action">
                      <Warehouse aria-hidden="true" />
                      Open Digital Warehouse
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
                    <Link href="/portal/procurement" data-testid="marketplace-secondary-action">
                      Open procurement
                    </Link>
                  </Button>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout title="Client Marketplace" description={marketplaceDescription}>
      <div className="space-y-4">
        {/* State panel. The enum stays in data attributes for QA; clients read the
            presentation copy only. */}
        <div
          data-testid="marketplace-state"
          data-tenant-state={state}
          data-eligibility={data?.eligibility || MARKETPLACE_ELIGIBILITY}
          aria-busy={isLoading || undefined}
        >
          <Panel
            id="marketplace-state-panel"
            title={
              <span className="flex items-center gap-2">
                <StateIcon className="pt-link h-4 w-4 shrink-0" aria-hidden="true" />
                {isLoading ? "Checking your organization's catalog…" : presentation.title}
              </span>
            }
            description={isLoading ? "One moment." : presentation.body}
            actions={
              !isLoading ? (
                <span data-testid="marketplace-state-badge">
                  <Token label={presentation.badge} tone={tone.tone} dot />
                </span>
              ) : undefined
            }
          >
            <div className="space-y-4">
              {state === "UNMAPPED" && !isLoading && (
                <p className="pt-ink pt-tone-warn text-sm font-medium" data-testid="marketplace-restricted-note">
                  No items are shown for an unlinked account, by design. This is not an error on your side.
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="brand">
                  <Link href={presentation.primary.href} data-testid="marketplace-primary-action">
                    <ClipboardCheck aria-hidden="true" />
                    {presentation.primary.label}
                  </Link>
                </Button>
                {presentation.secondary && (
                  <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
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
                    <RefreshCw className={cn(isFetching && "animate-spin")} aria-hidden="true" />
                    {isFetching ? "Retrying…" : "Try again"}
                  </Button>
                )}
              </div>
            </div>
          </Panel>
        </div>

        {/* Catalog: only for the two authorized states, and only rows that fully parse. */}
        {canRenderCatalog(state) && !isLoading && (
          <div data-testid="marketplace-catalog" data-item-count={items.length}>
            <Panel
              id="marketplace-catalog-panel"
              title={
                <span className="flex items-center gap-2">
                  <ShoppingCart className="pt-link h-4 w-4 shrink-0" aria-hidden="true" />
                  Catalog
                </span>
              }
              description={
                items.length === 0
                  ? "No items have been published to this catalog yet. Request approval and DE will confirm what fits."
                  : `${items.length} item${items.length === 1 ? "" : "s"} available to request.`
              }
              flush
            >
              {items.length > 0 ? (
                <ul className="divide-y divide-border" data-testid="marketplace-items">
                  {items.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 md:px-5" data-testid={`marketplace-item-${item.id}`}>
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
                        <span className="pt-num text-sm font-medium text-foreground">{priceText(item)}</span>
                        <Button asChild size="sm" variant="outline" className="border-border bg-card hover:bg-accent">
                          <Link href={`/portal/forms?item=${encodeURIComponent(item.id)}`}>Request</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Panel>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
