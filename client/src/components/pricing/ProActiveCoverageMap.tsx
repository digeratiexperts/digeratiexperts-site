import { TIER_ORDER, isTierLit, type CoverageTier } from "@/lib/proactiveCoverage";

const RING_ORDER: { id: CoverageTier; label: string; radius: number; desc: string }[] = [
  { id: "it", label: "IT", radius: 46, desc: "Operating + managed security baseline" },
  { id: "office", label: "Office", radius: 76, desc: "Adds network, endpoint backup + 24×7 MDR" },
  { id: "business", label: "Business", radius: 106, desc: "Adds deeper security ops, BCDR + compliance reporting" },
  { id: "enterprise", label: "Enterprise", radius: 136, desc: "Adds governance, audit-grade compliance" },
];

export type ComplianceLevel = "standard" | "regulated" | "governance";

const COMPLIANCE_LEVELS: { id: ComplianceLevel; label: string; minTier: CoverageTier; desc: string }[] = [
  { id: "standard", label: "Standard", minTier: "it", desc: "No specific regulatory framework" },
  { id: "regulated", label: "Regulated", minTier: "business", desc: "HIPAA, PCI-DSS, GLBA, or similar" },
  { id: "governance", label: "Enterprise Governance", minTier: "enterprise", desc: "SOC 2, multi-framework, audit-grade" },
];

export type CoverageHours = "business" | "extended" | "always-on";

const COVERAGE_HOURS: { id: CoverageHours; label: string; minTier: CoverageTier; desc: string }[] = [
  { id: "business", label: "Business Hours", minTier: "it", desc: "Standard support window" },
  { id: "extended", label: "Extended Hours", minTier: "office", desc: "Early/late coverage, add-on below Business" },
  { id: "always-on", label: "24×7 Monitoring", minTier: "office", desc: "Managed detection and response / security monitoring" },
];

const CX = 178;
const CY = 140;

type ProActiveCoverageMapProps = {
  selected: CoverageTier;
  onSelect: (tier: CoverageTier) => void;
  compliance?: ComplianceLevel;
  onComplianceChange?: (level: ComplianceLevel) => void;
  coverageHours?: CoverageHours;
  onCoverageHoursChange?: (hours: CoverageHours) => void;
};

function tierIndexSafe(tier: CoverageTier): number {
  return TIER_ORDER.indexOf(tier);
}

function higherTier(a: CoverageTier, b: CoverageTier): CoverageTier {
  return tierIndexSafe(a) >= tierIndexSafe(b) ? a : b;
}

/**
 * Concentric coverage rings, IT at the core out to Enterprise at the rim.
 * Magenta marks the selected depth and every ring it includes; a matched
 * legend column carries the labels so nothing overlaps inside the SVG.
 * Compliance level and coverage-hours pickers below feed a minimum-tier
 * recommendation so the diagram stays mapped to what each package
 * actually includes rather than being purely decorative.
 */
export function ProActiveCoverageMap({
  selected,
  onSelect,
  compliance = "standard",
  onComplianceChange,
  coverageHours = "business",
  onCoverageHoursChange,
}: ProActiveCoverageMapProps) {
  const complianceMeta = COMPLIANCE_LEVELS.find((c) => c.id === compliance) ?? COMPLIANCE_LEVELS[0];
  const coverageMeta = COVERAGE_HOURS.find((c) => c.id === coverageHours) ?? COVERAGE_HOURS[0];
  const recommendedTier = higherTier(complianceMeta.minTier, coverageMeta.minTier);
  const belowRecommended = tierIndexSafe(selected) < tierIndexSafe(recommendedTier);

  return (
    <div className="de-style-box p-6 md:p-8" data-testid="proactive-coverage-map">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F04C97]">
            ProActive Coverage
          </p>
          <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            Select a package depth<span className="text-[#D3126A]">:</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm text-white/55">
            Rings light from the core outward. Every tier includes the DE Security Foundation; higher tiers add
            deeper detection, response, recovery, compliance, and governance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="ProActive package depth">
          {TIER_ORDER.map((tier) => {
            const active = selected === tier;
            return (
              <button
                key={tier}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onSelect(tier)}
                className={`h-11 rounded-full border px-4 text-sm font-medium capitalize ${
                  active
                    ? "border-[#D3126A] bg-[#D3126A] text-white"
                    : "border-de-hairline bg-de-raised text-white/75 hover:border-white/25 hover:text-white"
                }`}
                data-testid={`coverage-select-${tier}`}
              >
                {tier}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
        <svg
          viewBox="0 0 360 280"
          className="mx-auto h-auto w-full max-w-md"
          role="img"
          aria-label={`Coverage depth selected: ${selected}`}
        >
          <defs>
            <radialGradient id="coverage-core-glow" cx="50%" cy="50%" r="65%">
              <stop offset="0%" stopColor="#D3126A" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#D3126A" stopOpacity="0" />
            </radialGradient>
          </defs>
          {[...RING_ORDER].reverse().map((ring) => {
            const lit = isTierLit(selected, ring.id);
            const active = selected === ring.id;
            const nextUnlit = !lit && tierIndexSafe(ring.id) === tierIndexSafe(selected) + 1;
            const stroke = active ? "#D3126A" : lit ? "#B9B9B9" : nextUnlit ? "#2DD4BF" : "#333333";
            const fill = active ? "#1c0f16" : lit ? "#161219" : "#0a0810";
            return (
              <circle
                key={ring.id}
                cx={CX}
                cy={CY}
                r={ring.radius}
                fill={fill}
                stroke={stroke}
                strokeWidth={active ? 3 : 1.5}
                className="cursor-pointer transition-[stroke,fill] duration-200"
                onClick={() => onSelect(ring.id)}
              />
            );
          })}
          <circle cx={CX} cy={CY} r={RING_ORDER[0].radius - 4} fill="url(#coverage-core-glow)" className="pointer-events-none" />
          <circle
            cx={CX}
            cy={CY}
            r={8}
            fill="#D3126A"
            className="pointer-events-none"
          />
        </svg>

        <div className="flex flex-col gap-2" role="list" aria-label="Coverage ring legend">
          {[...RING_ORDER].reverse().map((ring) => {
            const lit = isTierLit(selected, ring.id);
            const active = selected === ring.id;
            return (
              <button
                key={ring.id}
                type="button"
                role="listitem"
                onClick={() => onSelect(ring.id)}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? "border-[#D3126A]/60 bg-[#D3126A]/10"
                    : "border-transparent hover:border-white/10 hover:bg-white/5"
                }`}
                data-testid={`coverage-legend-${ring.id}`}
              >
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: active ? "#D3126A" : lit ? "#B9B9B9" : "#333333" }}
                  aria-hidden="true"
                />
                <span>
                  <span className={`block text-sm font-semibold ${active ? "text-[#F7A8C8]" : lit ? "text-white" : "text-white/55"}`}>
                    {ring.label}
                  </span>
                  <span className="block text-xs text-white/55">{ring.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-medium text-white/70">Compliance level</p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Compliance level">
            {COMPLIANCE_LEVELS.map((level) => {
              const active = compliance === level.id;
              return (
                <button
                  key={level.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onComplianceChange?.(level.id)}
                  className={`h-9 rounded-full border px-3 text-xs font-medium ${
                    active
                      ? "border-[#D3126A] bg-[#D3126A] text-white"
                      : "border-de-hairline bg-de-raised text-white/70 hover:border-white/25 hover:text-white"
                  }`}
                  data-testid={`compliance-select-${level.id}`}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-white/55">{complianceMeta.desc}</p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-white/70">Coverage hours</p>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Coverage hours">
            {COVERAGE_HOURS.map((hours) => {
              const active = coverageHours === hours.id;
              return (
                <button
                  key={hours.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onCoverageHoursChange?.(hours.id)}
                  className={`h-9 rounded-full border px-3 text-xs font-medium ${
                    active
                      ? "border-[#D3126A] bg-[#D3126A] text-white"
                      : "border-de-hairline bg-de-raised text-white/70 hover:border-white/25 hover:text-white"
                  }`}
                  data-testid={`coverage-hours-select-${hours.id}`}
                >
                  {hours.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-white/55">{coverageMeta.desc}</p>
        </div>
      </div>

      {belowRecommended && (
        <div
          className="mt-6 flex flex-col gap-3 rounded-xl border border-[#2DD4BF]/40 bg-[#2DD4BF]/10 p-4 sm:flex-row sm:items-center sm:justify-between"
          data-testid="coverage-recommendation-note"
        >
          <p className="text-sm text-white/80">
            <span className="font-semibold text-[#2DD4BF]">Heads up: </span>
            {complianceMeta.id !== "standard" && coverageMeta.id === "always-on"
              ? `${complianceMeta.label} compliance and ${coverageMeta.label.toLowerCase()} typically require the `
              : complianceMeta.id !== "standard"
                ? `${complianceMeta.label} compliance typically requires the `
                : `${coverageMeta.label} typically requires the `}
            <span className="font-semibold capitalize">{recommendedTier}</span> package or higher.
          </p>
          <button
            type="button"
            onClick={() => onSelect(recommendedTier)}
            className="h-9 shrink-0 rounded-full border border-[#2DD4BF]/60 bg-[#2DD4BF]/15 px-4 text-xs font-semibold text-[#2DD4BF] hover:bg-[#2DD4BF]/25"
            data-testid="coverage-recommendation-jump"
          >
            Use {recommendedTier} instead
          </button>
        </div>
      )}
    </div>
  );
}
