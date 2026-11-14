import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { LayoutDashboard, Package, ShieldCheck, type LucideIcon } from "lucide-react";
import { IconWell } from "@/components/visual/IconWell";
import { termLabel } from "@shared/deStoreContract";
import { refurbishedGradeTitle } from "@shared/deStoreLegalCopy";
import { DeStoreShell } from "@/components/store/DeStoreShell";
import { loadDeStoreCatalog, type DeStoreCatalogItem, type DeStoreStatus } from "@/lib/deStoreApi";

const OFFERING_ACCENT = {
  proactive_ecosystem: "magenta",
  refurbished_kits: "electric",
  standalone_services: "cyan",
} as const;

const OFFERING_ICON: Record<string, LucideIcon> = {
  proactive_ecosystem: ShieldCheck,
  refurbished_kits: Package,
  standalone_services: LayoutDashboard,
};

function CatalogGrid({ items }: { items: DeStoreCatalogItem[] }) {
  if (!items.length) {
    return (
      <p className="mt-10 max-w-2xl text-lg leading-relaxed text-zinc-300">
        Listings will appear here once they are published. Kit listings stay hidden until required software disclosures are complete. No prices are shown until Joseph confirms them.
      </p>
    );
  }
  return (
    <ul className="mt-10 grid gap-6 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.sku} className="rounded-3xl border border-white/15 bg-black/55 p-7 backdrop-blur-sm">
          <p className="text-sm uppercase tracking-[0.18em] text-[rgb(var(--de-accent-ink-rgb))]">
            {item.previewOnly ? "Preview listing - not for sale" : "Published"}
          </p>
          <h3 className="mt-3 text-2xl font-semibold text-white">{item.name}</h3>
          {item.refurbishedGrade && (
            <p className="mt-2 text-base font-medium text-zinc-100">{refurbishedGradeTitle(item.refurbishedGrade)}</p>
          )}
          <p className="mt-3 text-base leading-relaxed text-zinc-300">{item.description}</p>
          {item.termMonths ? (
            <p className="mt-4 text-sm text-zinc-400">Term: {termLabel(item.termMonths)}</p>
          ) : null}
          {item.fccCoveredListCheckRequired && (
            <p className="mt-3 text-sm text-zinc-300">FCC Covered List check required before this router can be sold.</p>
          )}
        </li>
      ))}
    </ul>
  );
}

function OfferingsBody({ status }: { status: DeStoreStatus }) {
  const params = useParams<{ offering?: string }>();
  const selected = status.offerings.find((item) => item.id === params.offering) ?? null;
  const [items, setItems] = useState<DeStoreCatalogItem[]>([]);

  useEffect(() => {
    loadDeStoreCatalog(selected?.id).then(setItems).catch(() => setItems([]));
  }, [selected?.id]);

  return (
    <div>
      <p className="text-sm uppercase tracking-[0.22em] text-[rgb(var(--de-accent-ink-rgb))]">Digerati Experts Store</p>
      <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-6xl">
        {selected ? selected.label : "Three ways to buy"}
      </h1>
      <p className="mt-6 max-w-3xl text-lg leading-relaxed text-zinc-300 sm:text-xl">
        {selected
          ? selected.summary
          : "Order the ProActive Ecosystem, refurbished preconfigured kits, or standalone services and dashboards for IT departments. Agreements are accepted before anything is released."}
      </p>
      <p className="mt-5 max-w-3xl text-base leading-relaxed text-zinc-400">{status.whereWeSellShort}</p>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400">{status.shippingPromise}</p>

      {!selected && (
        <ul className="mt-14 grid gap-6 lg:grid-cols-3">
          {status.offerings.map((offering, index) => {
            const accent = OFFERING_ACCENT[offering.id as keyof typeof OFFERING_ACCENT] ?? "electric";
            return (
              <li key={offering.id}>
                <Link
                  href={`/store/offerings/${offering.id}`}
                  data-accent={accent}
                  data-testid={`store-offering-${offering.id}`}
                  className="group relative block h-full overflow-hidden rounded-3xl border border-white/12 bg-black/60 p-8 transition hover:border-[rgb(var(--de-accent-ink-rgb))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgb(var(--de-accent-ink-rgb))]"
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-80"
                    style={{
                      background:
                        "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(var(--de-accent-rgb), 0.22) 0%, transparent 62%)",
                    }}
                  />
                  <div className="relative">
                    <IconWell icon={OFFERING_ICON[offering.id] ?? ShieldCheck} size="md" surface="dark" className="mb-5" />
                    <p className="font-mono text-sm uppercase tracking-[0.22em] text-[rgb(var(--de-accent-ink-rgb))]">
                      {String(index + 1).padStart(2, "0")}
                    </p>
                    <h2 className="mt-5 text-3xl font-semibold leading-tight text-white">{offering.label}</h2>
                    <p className="mt-4 text-base leading-relaxed text-zinc-300">{offering.summary}</p>
                    <span className="mt-8 inline-flex items-center text-sm font-semibold text-[rgb(var(--de-accent-ink-rgb))]">
                      View this offering
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <div className="mt-12">
          <Link href="/store/offerings" className="text-sm font-medium text-[rgb(var(--de-accent-ink-rgb))] underline underline-offset-4">
            All offerings
          </Link>
          <CatalogGrid items={items} />
          <p className="mt-12">
            <Link
              href="/store/order"
              className="inline-flex items-center rounded-full bg-de-magenta px-7 py-3.5 text-base font-semibold text-black hover:bg-de-magenta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Continue to checkout
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

export default function DeStoreOfferings() {
  return (
    <DeStoreShell
      title="Store offerings"
      description="The Digerati Experts store for the ProActive Ecosystem, refurbished kits, and standalone IT department services."
      canonical="/store/offerings"
    >
      {(status) => <OfferingsBody status={status} />}
    </DeStoreShell>
  );
}
