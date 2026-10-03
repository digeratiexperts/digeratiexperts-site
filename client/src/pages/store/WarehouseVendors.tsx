import { useEffect, useMemo, useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { storeProducts } from "@/data/storeProducts";
import { listVendorsForProducts } from "@/data/storeMerchandising";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";
import { VENDOR_LOGO_BASE } from "@/data/vendorLogos";

type ConnectorHealth = {
  connector: string;
  status: "CONNECTED" | "AUTH_REQUIRED" | "FAILED" | "UNKNOWN" | "STALE";
  message?: string;
  checkedAt?: string;
};

/**
 * Staff vendor map + Hub connector health. External vendors do not log in here.
 */
export default function WarehouseVendors() {
  useSEO({
    noIndex: true,
    title: "Vendors (staff) | Digital Warehouse",
    description: "Vendor marks and Hub connector health for DE staff.",
    canonical: "/internal/warehouse/vendors",
  });

  const vendors = useMemo(() => listVendorsForProducts(storeProducts), []);
  const [connectors, setConnectors] = useState<ConnectorHealth[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/internal/warehouse/connectors", { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Connectors ${res.status}`);
        return (await res.json()) as { connectors: ConnectorHealth[] };
      })
      .then((json) => {
        if (!cancelled) setConnectors(json.connectors ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Connector status unavailable");
          setConnectors([
            {
              connector: "pax8",
              status: "UNKNOWN",
              message: "Could not reach Hub connector health from this site.",
            },
          ]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative pb-24">
      <StorePageAtmosphere intensity={0.22} />
      <main id="main-content" tabIndex={-1} className="relative z-10 mx-auto max-w-[var(--de-canvas)] px-3 py-8 sm:px-4 lg:px-6">
        <header className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-de-accent-ink">Staff · vendors</p>
          <h2 className="mt-2 text-2xl font-bold text-white sm:text-3xl">Vendors & connectors</h2>
          <p className="mt-3 text-white/60">
            Marks below come from the workshop catalog map. Live distributor/API sync is owned by Hub{" "}
            <span className="font-mono text-sm">de-sync</span>. Connector done means health + scoped access — not
            merely a login screen.
          </p>
        </header>

        <section className="mb-12" aria-label="Hub connectors">
          <h3 className="mb-3 text-lg font-semibold text-white">Hub connectors</h3>
          {loadError ? (
            <p className="mb-3 text-sm text-amber-200/90" data-testid="warehouse-connectors-error">
              {loadError}
            </p>
          ) : null}
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="warehouse-connectors">
            {connectors.map((row) => (
              <li
                key={row.connector}
                className="rounded-2xl border border-de-hairline bg-de-raised px-4 py-4"
                data-testid={`connector-${row.connector}`}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold capitalize text-white">{row.connector}</p>
                  <p className="font-mono text-xs text-de-accent-ink">{row.status}</p>
                </div>
                {row.message ? <p className="mt-2 text-sm text-white/55">{row.message}</p> : null}
                {row.checkedAt ? (
                  <p className="mt-2 font-mono text-[11px] text-white/35">{row.checkedAt}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Workshop vendor marks">
          <h3 className="mb-3 text-lg font-semibold text-white">Workshop vendor marks</h3>
          <p className="mb-4 text-sm text-white/50">
            {vendors.length} vendors linked from local SKUs (not a live stock feed).
          </p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="warehouse-vendor-marks">
            {vendors.map((v) => (
              <li
                key={v.slug}
                className="flex items-center gap-3 rounded-xl border border-de-hairline bg-de-raised px-3 py-3"
              >
                <img
                  src={`${VENDOR_LOGO_BASE}/${v.slug}.png`}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-md bg-white/5 object-contain"
                  loading="lazy"
                />
                <div>
                  <p className="text-sm font-medium text-white">{v.name}</p>
                  <p className="font-mono text-[11px] text-white/40">{v.slug}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
