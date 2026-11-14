import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { termLabel } from "@shared/deStoreContract";
import { refurbishedGradeTitle } from "@shared/deStoreLegalCopy";
import { DeStoreShell } from "@/components/store/DeStoreShell";
import { loadDeStoreCatalog, type DeStoreCatalogItem, type DeStoreStatus } from "@/lib/deStoreApi";

function CatalogGrid({ items }: { items: DeStoreCatalogItem[] }) {
  if (!items.length) {
    return (
      <p className="mt-8 max-w-2xl text-lg leading-relaxed text-zinc-300">
        Listings will appear here once they are published. Kit listings stay hidden until required software disclosures are complete. No prices are shown until Joseph confirms them.
      </p>
    );
  }
  return (
    <ul className="mt-8 grid gap-6 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.sku} className="rounded-2xl border border-white/15 bg-de-surface p-6">
          <p className="text-sm uppercase tracking-[0.18em] text-de-magenta">
            {item.previewOnly ? "Preview listing — not for sale" : "Published"}
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
      <p className="text-sm uppercase tracking-[0.22em] text-de-magenta">Digerati Experts Store</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        {selected ? selected.label : "Three ways to buy"}
      </h1>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-zinc-300">
        {selected
          ? selected.summary
          : "Order the ProActive Ecosystem, refurbished preconfigured kits, or standalone services and dashboards for IT departments. Agreements are accepted before anything is released."}
      </p>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400">{status.whereWeSellShort}</p>
      <p className="mt-4 max-w-3xl text-base leading-relaxed text-zinc-400">{status.shippingPromise}</p>

      {!selected && (
        <ul className="mt-12 grid gap-6 lg:grid-cols-3">
          {status.offerings.map((offering) => (
            <li key={offering.id}>
              <Link
                href={`/store/offerings/${offering.id}`}
                className="block h-full rounded-2xl border border-white/15 bg-de-surface p-6 transition hover:border-de-magenta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-de-magenta"
              >
                <h2 className="text-2xl font-semibold text-white">{offering.label}</h2>
                <p className="mt-3 text-base leading-relaxed text-zinc-300">{offering.summary}</p>
                <span className="mt-6 inline-block text-sm font-medium text-de-magenta">View this offering</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="mt-10">
          <Link href="/store/offerings" className="text-sm text-de-magenta underline underline-offset-4">
            All offerings
          </Link>
          <CatalogGrid items={items} />
          <p className="mt-10">
            <Link
              href="/store/order"
              className="inline-flex items-center rounded-full bg-de-magenta px-6 py-3 text-base font-semibold text-black hover:bg-de-magenta-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
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
