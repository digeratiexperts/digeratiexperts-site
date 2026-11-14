import { TIER_ORDER, type CoverageTier } from "@/lib/proactiveCoverage";

const TIER_SUMMARIES: Record<
  CoverageTier,
  { label: string; eyebrow: string; summary: string }
> = {
  it: {
    label: "IT",
    eyebrow: "Operate",
    summary: "Core support, identity, endpoint, and email foundations.",
  },
  office: {
    label: "Office",
    eyebrow: "Standardize",
    summary: "Adds workplace, network, endpoint backup, and annual review.",
  },
  business: {
    label: "Business",
    eyebrow: "Protect",
    summary: "Adds SOC, recovery, compliance reporting, and planning.",
  },
  enterprise: {
    label: "Enterprise",
    eyebrow: "Govern",
    summary: "Adds advanced governance, audit readiness, and multi-site depth.",
  },
};

type ProActiveCoverageMapProps = {
  selected: CoverageTier;
  onSelect: (tier: CoverageTier) => void;
};

export function ProActiveCoverageMap({ selected, onSelect }: ProActiveCoverageMapProps) {
  const selectedIndex = TIER_ORDER.indexOf(selected);
  const includedLabels = TIER_ORDER.slice(0, selectedIndex + 1).map(
    (tier) => TIER_SUMMARIES[tier].label,
  );

  return (
    <div className="de-style-box p-5 md:p-6" data-testid="proactive-coverage-map">
      <div className="mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#F04C97]">
            ProActive Coverage
          </p>
          <h2 className="mt-1.5 text-xl font-bold text-white md:text-2xl">
            Choose your operating depth<span className="text-[#D3126A]">:</span>
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm text-white/55">
            Each package includes the layers before it, so the difference is easy to see.
          </p>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-2 lg:grid-cols-4"
        role="tablist"
        aria-label="ProActive package depth"
      >
        {TIER_ORDER.map((tier, index) => {
          const active = selected === tier;
          const included = index <= selectedIndex;
          const copy = TIER_SUMMARIES[tier];
          return (
            <button
              key={tier}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(tier)}
              className={`min-h-[84px] rounded-xl border p-3 text-left transition-colors ${
                active
                  ? "border-[#D3126A] bg-[#D3126A]/15 text-white"
                  : included
                    ? "border-white/20 bg-white/[0.045] text-white"
                    : "border-de-hairline bg-de-raised text-white/65 hover:border-white/25 hover:text-white"
              }`}
              data-testid={`coverage-select-${tier}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
                  {index + 1}. {copy.eyebrow}
                </span>
                {active ? (
                  <span className="rounded-full bg-[#D3126A] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Selected
                  </span>
                ) : null}
              </span>
              <span className="mt-2 block text-base font-semibold">{copy.label}</span>
            </button>
          );
        })}
      </div>

      <div
        className="mt-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
        aria-live="polite"
        data-testid="coverage-selection-summary"
      >
        <p className="text-sm font-semibold text-white">
          {TIER_SUMMARIES[selected].label}: {TIER_SUMMARIES[selected].summary}
        </p>
        <p className="mt-1 text-xs text-white/50">
          Included layers: {includedLabels.join(" + ")}
        </p>
      </div>
    </div>
  );
}
