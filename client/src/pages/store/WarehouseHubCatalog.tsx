import { useEffect, useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";
import { storeProducts } from "@/data/storeProducts";
import { Link } from "wouter";
import { warehousePath } from "@/lib/warehousePaths";

type FeedStatus = "CONNECTED" | "STALE" | "FAILED" | "UNKNOWN" | "LOCAL_WORKSHOP";

type StaffCatalogResponse = {
  status: FeedStatus;
  source: string;
  publishedAt?: string | null;
  message?: string;
  tiers?: Array<{ key: string; label: string; perUserMonthly: number; minUsers?: number }>;
  skus?: Array<{
    sku: string;
    name: string;
    category: string;
    billingModel: string;
    defaultUnitPrice?: number | null;
    defaultUnitCost?: number | null;
    clientVisible: boolean;
  }>;
};

/**
 * Staff view of the Hub catalog projection. Failures stay honest — no fake healthy.
 */
export default function WarehouseHubCatalog() {
  useSEO({
    noIndex: true,
    title: "Hub catalog feed (staff) | Digital Warehouse",
    description: "Staff-safe Intelligence Hub catalog projection for the Digital Warehouse.",
    canonical: "/internal/warehouse/hub-catalog",
  });

  const [data, setData] = useState<StaffCatalogResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/warehouse/catalog", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Catalog feed ${res.status}`);
        return (await res.json()) as StaffCatalogResponse;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Catalog feed failed");
          setData({
            status: "LOCAL_WORKSHOP",
            source: "local_workshop_fallback",
            message: "Hub feed unreachable; showing workshop SKU count only.",
            tiers: [],
            skus: [],
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const status = data?.status ?? "UNKNOWN";

  return (
    <div className="relative pb-24">
      <StorePageAtmosphere intensity={0.22} />
      <main id="main-content" tabIndex={-1} className="relative z-10 mx-auto max-w-[var(--de-canvas)] px-3 py-8 sm:px-4 lg:px-6">
        <header className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-de-accent-ink">Hub projection</p>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Staff catalog feed</h2>
          <p className="mt-3 text-white/60">
            Authority is Intelligence Hub. This page never invents margins for Door 2. Workshop SKUs remain at{" "}
            <Link href={warehousePath("co-managed")} className="text-de-accent-ink underline-offset-4 hover:underline">
              SKU catalog
            </Link>{" "}
            until this feed is verified live.
          </p>
        </header>

        <div
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-de-hairline bg-de-raised px-4 py-2 font-mono text-sm text-white"
          data-testid="warehouse-hub-feed-status"
          role="status"
        >
          <span className="text-white/45">Status</span>
          <span className="text-de-accent-ink">{status}</span>
          {data?.source ? <span className="text-white/40">· {data.source}</span> : null}
        </div>

        {error ? (
          <p className="mb-6 text-sm text-amber-200/90" data-testid="warehouse-hub-feed-error">
            {error}
          </p>
        ) : null}
        {data?.message ? <p className="mb-6 text-sm text-white/55">{data.message}</p> : null}

        <section className="mb-10">
          <h3 className="mb-3 text-lg font-semibold text-white">Canonical tiers</h3>
          {(data?.tiers?.length ?? 0) === 0 ? (
            <p className="text-sm text-white/50">No Hub tiers in this response.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data!.tiers!.map((tier) => (
                <li
                  key={tier.key}
                  className="rounded-xl border border-de-hairline bg-de-raised px-4 py-3"
                  data-testid={`hub-tier-${tier.key}`}
                >
                  <p className="font-medium text-white">{tier.label}</p>
                  <p className="mt-1 font-mono text-sm text-white/55">
                    ${tier.perUserMonthly}/user
                    {tier.minUsers != null ? ` · min ${tier.minUsers}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-lg font-semibold text-white">Hub SKUs (staff)</h3>
          {(data?.skus?.length ?? 0) === 0 ? (
            <p className="text-sm text-white/50">
              No Hub SKU rows yet. Local workshop still has {storeProducts.length} SKUs for quoting.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-de-hairline">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-de-raised text-white/55">
                  <tr>
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Billing</th>
                    <th className="px-3 py-2 font-medium">Sell</th>
                    <th className="px-3 py-2 font-medium">Cost</th>
                    <th className="px-3 py-2 font-medium">Client</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.skus!.slice(0, 80).map((row) => (
                    <tr key={row.sku} className="border-t border-de-hairline text-white/85">
                      <td className="px-3 py-2 font-mono text-xs">{row.sku}</td>
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-white/55">{row.billingModel}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.defaultUnitPrice != null ? `$${row.defaultUnitPrice}` : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-amber-200/80">
                        {row.defaultUnitCost != null ? `$${row.defaultUnitCost}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">{row.clientVisible ? "visible" : "internal"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
