import { useEffect, useMemo, useState } from "react";
import { useSEO } from "@/hooks/useSEO";
import { storeProducts } from "@/data/storeProducts";
import { listVendorsForProducts } from "@/data/storeMerchandising";
import { StorePageAtmosphere } from "@/components/store/StorePageAtmosphere";
import { VENDOR_LOGO_BASE } from "@/data/vendorLogos";
import { OFFERING_STATUS_LABEL, VENDOR_PROFILES, type OfferingDeStatus } from "@/data/vendorOfferings";
import { useSalesTaxReadiness } from "@/hooks/useSalesTaxReadiness";

const TAX_CHECK_ROWS = [
  ["connection", "Zoho Books connection on the server"],
  ["taxRegistration", "Sales tax registration in Books"],
  ["serviceItem", "Service tax item"],
  ["taxContact", "Tax-check contact"],
] as const;

const STATUS_CLASS: Record<OfferingDeStatus, string> = {
  in_use: "border-emerald-400/40 text-emerald-200",
  legacy: "border-amber-300/40 text-amber-200",
  available: "border-white/20 text-white/60",
};

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
  const taxReadiness = useSalesTaxReadiness();

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

        <section className="mb-12" aria-label="Site integrations">
          <h3 className="mb-3 text-lg font-semibold text-white">Site integrations</h3>
          <ul className="grid gap-3 sm:grid-cols-2" data-testid="warehouse-site-integrations">
            <li
              className="rounded-2xl border border-de-hairline bg-de-raised px-4 py-4"
              data-testid="integration-sales-tax"
              data-status={taxReadiness?.status ?? "LOADING"}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-semibold text-white">Zoho Books (Pay Now sales tax)</p>
                <p className="font-mono text-xs text-de-accent-ink">{taxReadiness?.status ?? "CHECKING"}</p>
              </div>
              {taxReadiness ? (
                <>
                  <p className="mt-2 text-sm text-white/55">{taxReadiness.message}</p>
                  <dl className="mt-3 grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 text-sm">
                    {TAX_CHECK_ROWS.map(([field, label]) => (
                      <div key={field} className="contents">
                        <dt className="text-white/60">{label}</dt>
                        <dd className="font-mono text-xs text-white/80" data-testid={`tax-check-${field}`}>
                          {taxReadiness.checks[field]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {taxReadiness.missingSettings?.length ? (
                    <p className="mt-3 text-xs text-white/45" data-testid="tax-missing-settings">
                      Not set on the server yet:{" "}
                      <span className="font-mono break-words">{taxReadiness.missingSettings.join(", ")}</span>
                    </p>
                  ) : null}
                  {taxReadiness.quoteOnlyCategories.length ? (
                    <p className="mt-3 text-xs text-white/45">
                      Quote-only until a Books tax item is confirmed:{" "}
                      <span className="font-mono">{taxReadiness.quoteOnlyCategories.join(", ")}</span>
                    </p>
                  ) : null}
                  <p className="mt-2 font-mono text-[11px] text-white/35">{taxReadiness.checkedAt}</p>
                </>
              ) : null}
            </li>
          </ul>
        </section>

        <section className="mb-12" aria-label="Vendor profiles">
          <h3 className="mb-3 text-lg font-semibold text-white">Vendor profiles</h3>
          <p className="mb-4 max-w-3xl text-sm text-white/50">
            What each partner offers DE and where every product stands for us. Reference only: nothing here is quoteable, and
            partner prices live in Hub, never in this repository. Mirrors the Hub vendor row.
          </p>
          <div className="grid gap-4" data-testid="warehouse-vendor-profiles">
            {VENDOR_PROFILES.map((p) => (
              <article
                key={p.slug}
                className="rounded-2xl border border-de-hairline bg-de-raised p-4 sm:p-5"
                aria-labelledby={`vendor-profile-${p.slug}`}
                data-testid={`vendor-profile-${p.slug}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <img src={`${VENDOR_LOGO_BASE}/${p.slug}.png`} alt="" width={40} height={40} className="h-10 w-10 rounded-md bg-white/5 object-contain" loading="lazy" />
                  <h4 id={`vendor-profile-${p.slug}`} className="text-lg font-semibold text-white">
                    {p.name}
                  </h4>
                  <a href={p.partnerPortal} target="_blank" rel="noopener noreferrer" className="ml-auto text-sm text-de-accent-ink underline-offset-2 hover:underline">
                    Partner portal<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </div>
                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                  {p.offerings.map((o) => (
                    <li key={o.product} className="rounded-xl border border-de-hairline px-3 py-3" data-testid={`offering-${p.slug}-${o.product.toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-semibold text-white">{o.product}</p>
                        <span className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${STATUS_CLASS[o.deStatus]}`}>{OFFERING_STATUS_LABEL[o.deStatus]}</span>
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-white/40">
                        {o.vendorCategory} · DE: {o.deCapability}
                      </p>
                      <p className="mt-2 text-sm text-white/70">{o.summary}</p>
                      <p className="mt-2 text-xs text-white/45">{o.deNote}</p>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-de-hairline pt-3 text-sm">
                  <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">Agreements</p>
                  <ul className="mt-2 space-y-1">
                    {p.agreements.map((a) => (
                      <li key={a.url}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-white/80 underline-offset-2 hover:underline">
                          {a.title}
                        </a>{" "}
                        <span className="font-mono text-[11px] text-white/40">last modified {a.lastModified}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-white/40">{p.source}</p>
                </div>
              </article>
            ))}
          </div>
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
