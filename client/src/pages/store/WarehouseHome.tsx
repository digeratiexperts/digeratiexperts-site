import { Link } from "wouter";
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  CreditCard,
  Network,
  Package,
  Radio,
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { storeProducts, getCheckoutEnabledProducts, getContractOnlyProducts } from "@/data/storeProducts";
import { listVendorsForProducts } from "@/data/storeMerchandising";
import { warehousePath } from "@/lib/warehousePaths";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";
import { WarehouseStockPanel } from "@/pages/store/WarehouseStockPanel";

const CARDS = [
  {
    href: warehousePath("co-managed"),
    title: "SKU catalog",
    body: "Workshop catalog with category pills and vendor marks. Temporary local feed until Hub projection is authoritative.",
    icon: Boxes,
    testId: "warehouse-card-catalog",
  },
  {
    href: warehousePath("managed"),
    title: "Managed packages",
    body: "ProActive / contract packages for staff quoting and Pay Now eligibility checks.",
    icon: Package,
    testId: "warehouse-card-managed",
  },
  {
    href: warehousePath("hub-catalog"),
    title: "Hub catalog feed",
    body: "Staff-safe projection from Intelligence Hub (tiers + SKUs). Shows CONNECTED / STALE / FAILED — never invents healthy.",
    icon: Radio,
    testId: "warehouse-card-hub",
  },
  {
    href: warehousePath("vendors"),
    title: "Vendors & connectors",
    body: "Vendor rails from the workshop map, plus Hub connector health (Pax8 and later distributors).",
    icon: Network,
    testId: "warehouse-card-vendors",
  },
  {
    href: warehousePath("quote-request"),
    title: "Quotes",
    body: "Staff quote path for high-touch or hardware lines that are not charged online.",
    icon: ClipboardList,
    testId: "warehouse-card-quotes",
  },
  {
    href: warehousePath("checkout"),
    title: "Staff checkout",
    body: "Pay Now is staff-only (`pay_now`). Not a public Store default.",
    icon: CreditCard,
    testId: "warehouse-card-checkout",
  },
] as const;

/**
 * Staff ops home — replaces the old client-store guided landing inside the warehouse.
 */
export default function WarehouseHome() {
  useSEO({
    noIndex: true,
    title: "Digital Warehouse (staff) | Digerati Experts",
    description:
      "DE staff Digital Warehouse — SKU workshop, Hub catalog feed, quotes, and vendor connector status. Not the public Store.",
    canonical: "/internal/warehouse",
  });

  const checkoutCount = getCheckoutEnabledProducts().length;
  const contractCount = getContractOnlyProducts().length;
  const vendorCount = listVendorsForProducts(storeProducts).length;

  return (
    <div className="relative pb-24">
      <StorePageAtmosphere intensity={0.28} />
      <main id="main-content" tabIndex={-1} className="relative z-10 mx-auto max-w-[var(--de-canvas)] px-3 py-8 sm:px-4 lg:px-6">
        <header className="mb-10 max-w-3xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-de-accent-ink">
            Internal ops console
          </p>
          <h2 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-tight text-white">
            Build, quote, and source — not a client storefront
          </h2>
          <p className="mt-3 text-base text-white/65">
            This surface is the DE Digital Warehouse. The public buyer path is Door 2 at{" "}
            <Link href="/store" className="text-de-accent-ink underline-offset-4 hover:underline">
              /store
            </Link>
            . Catalog dollars still come from the local workshop until the Hub feed is verified;
            vendor APIs live in Hub <span className="font-mono text-sm text-white/80">de-sync</span>, not here.
          </p>
        </header>

        <section
          aria-label="Workshop inventory snapshot"
          className="mb-10 grid gap-3 sm:grid-cols-3"
          data-testid="warehouse-stats"
        >
          {[
            { label: "Workshop SKUs", value: storeProducts.length },
            { label: "Pay Now eligible", value: checkoutCount },
            { label: "Vendor marks mapped", value: vendorCount },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-de-hairline bg-de-raised px-4 py-4"
            >
              <p className="font-mono text-2xl font-semibold text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-white/55">{stat.label}</p>
            </div>
          ))}
        </section>
        <p className="mb-8 text-sm text-white/45">
          Contract-only lines in workshop: {contractCount}. Coverage scoring on cart panels remains an{" "}
          <strong className="font-medium text-white/70">experimental heuristic</strong>.
        </p>

        <WarehouseStockPanel />

        <section aria-label="Warehouse workspaces" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                href={card.href}
                data-testid={card.testId}
                className="group flex flex-col rounded-2xl border border-de-hairline bg-de-raised p-5 transition-colors hover:border-de-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
              >
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-de-hairline bg-[#0a0a0a] text-de-accent-ink transition-colors group-hover:border-de-accent">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="flex items-center gap-2 text-lg font-semibold text-white">
                  {card.title}
                  <ArrowRight className="h-4 w-4 translate-x-0 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-de-accent-ink" />
                </span>
                <span className="mt-2 text-sm leading-relaxed text-white/60">{card.body}</span>
              </Link>
            );
          })}
        </section>
      </main>
    </div>
  );
}
