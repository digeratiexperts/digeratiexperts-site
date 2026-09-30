// FROZEN — homepage version 3, snapshot of client/src/components/EcosystemProgression.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { useState } from "react";
import { Link } from "wouter";
import { Diagram } from "@/diagrams/Diagram";
import { ArrowRight } from "lucide-react";
import { pricingTiers, formatUserPrice, formatPrice, type PricingTierKey } from "@/data/pricing";

const fit: Record<string, string> = {
  it: "Smaller, less complex environments that need essential protection and a documented baseline.",
  office: "Broader managed workplace — more users, devices, and a professionally operated network.",
  business: "Deeper infrastructure, cyber operations, recovery, governance, and strategy.",
  enterprise: "Multi-site, regulated, or security-sensitive environments that need the greatest operating depth.",
};

const highlights: Record<PricingTierKey, string[]> = {
  it: ["Managed IT & help desk", "Baseline identity & endpoint", "Entry cybersecurity"],
  office: ["Everything in IT", "Managed network", "Endpoint backup"],
  business: [
    "Identity · endpoint · email",
    "SOC / MDR",
    "BCDR · strategy reviews",
  ],
  enterprise: ["Advanced governance", "Audit-ready reporting", "Quarterly strategy"],
};

type EcosystemProgressionProps = {
  compact?: boolean;
  /** Homepage: include monthly floors and capability highlights without a second card grid. */
  detailed?: boolean;
};

/** Fit-based IT → Office → Business → Enterprise rail. Not a ranking ladder. */
export function EcosystemProgression({ compact = false, detailed = false }: EcosystemProgressionProps) {
  const [litTier, setLitTier] = useState<number | null>(null);
  const flagshipIndex = pricingTiers.findIndex((t) => t.id === "business");
  const coverageState = (litTier ?? (flagshipIndex >= 0 ? flagshipIndex : 0)) / Math.max(1, pricingTiers.length - 1);
  return (
    <div
      className={
        compact
          ? ""
          : "rounded-2xl border border-[var(--de-hairline)] bg-[var(--de-surface)] p-6 md:p-8 lg:p-10"
      }
    >
      <p className="text-base font-semibold uppercase tracking-[0.2em] text-de-magenta-ink">
        ProActive Ecosystem
      </p>
      <h2 className="mt-2 font-heading text-2xl font-semibold tracking-[-0.03em] text-white md:text-3xl lg:text-4xl">
        Four operating models. One matched to your environment.
      </h2>
      <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/55 md:text-lg">
        We do not start with a package and pile on add-ons. If Office would need heavy modification,
        Business is the correct fit for that environment — not universally “better.” User count is a
        signal, never the sole criterion.
      </p>

      <div className={detailed ? "mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-8" : "mt-8"}>
      {detailed && (
        <div className="xl:col-span-4">
          <Diagram
            id="coverage"
            tone="dark"
            state={coverageState}
            className="h-full rounded-xl border border-white/10 bg-[var(--de-bg)] p-4 md:p-5"
          />
        </div>
      )}
      <ol className={detailed ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:col-span-8" : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"}>
        {pricingTiers.map((tier, index) => {
          const isFlagship = tier.id === "business";
          return (
            <li key={tier.id}>
              <Link
                href={tier.learnMoreUrl}
                data-testid={detailed ? `pricing-summary-${tier.id}` : `ecosystem-model-${tier.id}`}
                onMouseEnter={() => setLitTier(index)}
                onMouseLeave={() => setLitTier(null)}
                onFocus={() => setLitTier(index)}
                onBlur={() => setLitTier(null)}
                className={`de-interactive-tile group relative flex h-full flex-col rounded-xl border p-5 md:p-6 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)] ${
                  isFlagship
                    ? "border-[#D3126A]/60 bg-gradient-to-b from-[#1e1525] via-[#15101c] to-[#0e0c13] shadow-lg shadow-[#D3126A]/15 hover:border-[#D3126A]"
                    : "border-white/10 bg-gradient-to-b from-[#16131b] to-[#0f0d14] hover:border-[#D3126A]/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-mono text-base font-semibold tracking-[0.16em] text-white/50">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  {isFlagship && (
                    <span className="rounded-full bg-[#D3126A] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm shadow-[#D3126A]/40">
                      Flagship Cyber
                    </span>
                  )}
                </div>
                <p className="mt-2 font-heading text-xl font-semibold text-white">{tier.name}</p>
                <p className="mt-1 text-base font-medium text-white/70">{formatUserPrice(tier.id)}</p>
                {detailed && (
                  <p className="mt-1 text-sm text-white/50">
                    {formatPrice(tier.monthlyMin)} monthly minimum
                  </p>
                )}
                <p className="mt-3 flex-1 text-sm leading-relaxed text-white/65">{fit[tier.id]}</p>
                {detailed && (
                  <ul className="mt-4 space-y-1.5 border-t border-white/10 pt-3">
                    {highlights[tier.id].map((item) => (
                      <li key={item} className="flex items-center text-sm text-white/75">
                        <span className="mr-2 text-[#D3126A]" aria-hidden="true">
                          ·
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
                <span className="mt-5 inline-flex min-h-11 items-center gap-1 text-base font-semibold text-de-magenta-ink transition-colors group-hover:text-[#f0187a]">
                  {tier.label}
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      </div>

      <p className="mt-6 text-base leading-relaxed text-white/55">
        Not sure which package fits? We assess your environment — users, devices, locations,
        infrastructure, security, compliance, recovery, and whether you need fully managed or
        co-managed operations — then match the model.
      </p>
    </div>
  );
}

export { fit as ecosystemFitCopy };
