import { useState, useMemo } from "react";
import { PageTemplate } from "@/components/PageTemplate";
import { Input } from "@/components/ui/input";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  HeroActions,
  HeroFacts,
  buttonSecondary,
  cardDark,
  cardPaper,
} from "@/components/site/chapters";
import {
  Users, Building2, Shield, Server, Bookmark, Briefcase,
  FileCheck, ArrowRight, Check, Database, Info, ChevronDown,
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import { pricing, pricingTiers, estimateMonthly, PRICING_SCOPE_NOTE, NO_BLACK_BOX_TAGLINE, type PricingTierKey } from "@/data/pricing";
import { PricingToolsSection } from "./sections/PricingToolsSection";
import { CTA } from "@/lib/ctaCopy";
import {
  ProActiveCoverageMap,
  type ComplianceLevel,
  type CoverageHours,
} from "@/components/pricing/ProActiveCoverageMap";
import {
  categoryLayer,
  coverageRowIsUniform,
  isTierLit,
  type CoverageTier,
} from "@/lib/proactiveCoverage";
import { cn } from "@/lib/utils";

type CellValue = boolean | string;

interface MatrixService {
  name: string;
  tooltip?: string;
  it: CellValue;
  office: CellValue;
  business: CellValue;
  enterprise: CellValue;
}

interface MatrixCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  isAddon?: boolean;
  ribbon?: string;
  services: MatrixService[];
}

const matrixCategories: MatrixCategory[] = [
  {
    id: "core-it",
    title: "Productivity & Core IT",
    icon: <Server className="w-5 h-5" />,
    services: [
      { name: "Managed IT Support / Service Desk + Ticketing", it: true, office: true, business: true, enterprise: true },
      { name: "Microsoft 365 / Google Workspace / Zoho workspace support", it: true, office: true, business: true, enterprise: true },
      { name: "MFA / SSO / Password Manager", it: "Baseline", office: "Stronger identity", business: "Enhanced", enterprise: "Identity governance" },
      { name: "Endpoint Security", it: "Baseline", office: "Stronger protection", business: "Enhanced EDR", enterprise: "Advanced" },
      { name: "Email Protection", it: "Baseline", office: "Advanced anti-phishing", business: "Enhanced", enterprise: "Advanced" },
      { name: "Basic IT Planning", it: true, office: true, business: true, enterprise: true },
    ],
  },
  {
    id: "workplace-network",
    title: "Workplace & Network",
    icon: <Building2 className="w-5 h-5" />,
    services: [
      { name: "Managed Workplace", tooltip: "Office: User provisioning, workspace setup, and Microsoft 365, Google Workspace, or Zoho SKU/workspace support.", it: "Limited / add-on", office: "Limited included", business: "Enhanced", enterprise: "Advanced / custom" },
      { name: "Managed Network & Connectivity", it: false, office: true, business: true, enterprise: "Multi-site / complex" },
    ],
  },
  {
    id: "backup",
    title: "Backup & Recovery",
    icon: <Database className="w-5 h-5" />,
    services: [
      { name: "Endpoint Backup", it: false, office: true, business: true, enterprise: "Advanced / custom" },
      { name: "Backup & Disaster Recovery (BCDR)", it: false, office: "addon", business: true, enterprise: "Advanced / custom" },
      { name: "User Cloud Storage Backup", it: false, office: false, business: true, enterprise: "Advanced / custom" },
    ],
  },
  {
    id: "security-ops",
    title: "Security Foundation & Operations",
    icon: <Shield className="w-5 h-5" />,
    services: [
      { name: "DE Security Foundation", tooltip: "Managed security is included in every ProActive tier. Higher tiers add deeper monitoring, response, recovery, compliance, and governance.", it: "Included", office: "Included", business: "Included", enterprise: "Included" },
      { name: "Security Awareness Training", it: "Included", office: "Included + phishing simulation", business: "Enhanced", enterprise: "Role-based / advanced" },
      { name: "Threat Detection & Response", tooltip: "Monitoring, detection, triage, containment, and guided recovery signals from endpoint, identity, email, cloud, or other detection systems.", it: "Managed platform baseline", office: "24/7 MDR", business: "24/7 MDR + deeper response", enterprise: "Advanced / custom" },
      { name: "Security Operations / SOC-as-a-Service", tooltip: "Security monitoring, alert triage, tuning, escalation, reporting, and response coordination.", it: "Platform monitoring", office: "24/7 MDR", business: "24/7 security operations", enterprise: "Advanced / custom" },
    ],
  },
  {
    id: "compliance-strategy",
    title: "Compliance & Strategy",
    icon: <FileCheck className="w-5 h-5" />,
    services: [
      { name: "vCIO / Strategy Reviews", it: false, office: "1× combined tech + cyber / yr", business: "Budgeting + 2× tech & security / yr", enterprise: "Quarterly tech & security" },
      { name: "Compliance Evidence & Risk Reporting", it: false, office: "Add-on / custom", business: "Basic included", enterprise: "Advanced / audit-grade" },
      { name: "Unified Security Posture", it: false, office: "Add-on / custom", business: "Partial / scoped", enterprise: "Full" },
    ],
  },
  {
    id: "addons",
    title: "Optional Add-Ons",
    icon: <Bookmark className="w-5 h-5" />,
    isAddon: true,
    ribbon: "Available with any package",
    services: [
      { name: "UCaaS: Voice & Meetings", it: "addon", office: "addon", business: "addon", enterprise: "addon" },
      { name: "Company Spend-Card Controls", it: "addon", office: "addon", business: "Included or available", enterprise: "Included / custom" },
      { name: "Advanced Managed Workplace", it: "addon", office: "addon", business: "addon", enterprise: "Included / custom" },
    ],
  },
  {
    id: "separate-path",
    title: "Separate Service Path",
    icon: <Briefcase className="w-5 h-5" />,
    isAddon: true,
    ribbon: "Not part of the package ladder",
    services: [
      { name: "Co-Managed IT (for clients with internal IT)", it: "Separate path", office: "Separate path", business: "Separate path", enterprise: "Separate path" },
    ],
  },
];

interface PlanCard {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  pricePerUser: number | null;
  priceLabel: string;
  priceNote?: string;
  minUsers?: number;
  siteMin?: number;
  bullets: string[];
  learnMoreUrl: string;
}

const plans: PlanCard[] = [
  {
    id: "it",
    name: "ProActive IT Ecosystem",
    shortName: "IT",
    tagline: "Managed IT + included security foundation",
    pricePerUser: pricing.it.user,
    priceLabel: `Starting at $${pricing.it.user}/user/mo`,
    minUsers: 5,
    siteMin: pricing.it.monthlyMin,
    bullets: [
      "Managed IT Support + Service Desk",
      "Microsoft 365 / Google Workspace / Zoho workspace support",
      "MFA / SSO / Password Manager (baseline)",
      "Endpoint security (managed baseline)",
      "Email protection (managed baseline)",
      "Security awareness & phishing resilience",
      "Managed security monitoring baseline",
      "Basic IT planning",
      "Managed Workplace: limited / add-on",
      "No backup included by default",
    ],
    learnMoreUrl: pricing.it.learnMoreUrl,
  },
  {
    id: "office",
    name: "ProActive Office Ecosystem",
    shortName: "Office",
    tagline: "Small office operating package",
    pricePerUser: pricing.office.user,
    priceLabel: `Starting at $${pricing.office.user}/user/mo`,
    minUsers: 5,
    siteMin: pricing.office.monthlyMin,
    bullets: [
      "Everything in IT, plus:",
      "Managed Network & Connectivity",
      "Limited Managed Workplace",
      "Endpoint Backup",
      "Annual combined technology + cyber review",
      "Security Awareness Training + phishing simulation",
      "24/7 Managed Detection & Response",
      "BCDR, cloud backup, compliance reports (add-ons)",
    ],
    learnMoreUrl: pricing.office.learnMoreUrl,
  },
  {
    id: "business",
    name: "ProActive Business Ecosystem",
    shortName: "Business",
    tagline: "Security-first business package",
    pricePerUser: pricing.business.user,
    priceLabel: `Starting at $${pricing.business.user}/user/mo`,
    priceNote: "Final scope confirmed after Cyber Risk Assessment — users, sites, backup, SOC, and compliance can change the total.",
    siteMin: pricing.business.monthlyMin,
    bullets: [
      "Everything in Office, plus:",
      "Enhanced Managed Workplace",
      "Deeper security operations / response",
      "Security Awareness Training included",
      "24/7 MDR included",
      "BCDR + user cloud storage backup included",
      "Compliance & Risk Reporting included",
      "Budgeting / planning + 2× tech & security business reviews per year",
      "Spend-card controls included or available",
    ],
    learnMoreUrl: pricing.business.learnMoreUrl,
  },
  {
    id: "enterprise",
    name: "ProActive Enterprise Ecosystem",
    shortName: "Enterprise",
    tagline: "Governance, compliance, mature security",
    pricePerUser: pricing.enterprise.user,
    priceLabel: `Starting at $${pricing.enterprise.user}/user/mo`,
    priceNote: "Custom after assessment for governance, multi-site, and advanced compliance — published floor applies as the starting point.",
    siteMin: pricing.enterprise.monthlyMin,
    bullets: [
      "Everything in Business, plus:",
      "Advanced / custom Managed Workplace",
      "Advanced SOC / security operations",
      "Unified Security Posture (full)",
      "Advanced Compliance & Risk Reports (audit-grade)",
      "Quarterly technology + security business reviews",
      "Advanced / custom backup, BCDR, data protection strategy",
      "Multi-site / complex network support, executive reporting",
    ],
    learnMoreUrl: pricing.enterprise.learnMoreUrl,
  },
];

const PREVIEW_BULLETS = 5;

const MatrixCell = ({ value }: { value: CellValue }) => {
  if (value === true) {
    return (
      <div
        className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-[var(--de-paper-hairline)] bg-white"
        role="img"
        aria-label="Included"
      >
        <Check className="h-3.5 w-3.5 text-de-magenta-paper-ink" aria-hidden="true" />
      </div>
    );
  }
  if (value === false) {
    return <div className="mx-auto h-0.5 w-2.5 rounded bg-black/30" role="img" aria-label="Not included" />;
  }
  if (value === "addon") {
    return <span className="text-sm font-semibold text-[#8A4B00]">Add-On</span>;
  }
  return <span className="text-sm font-medium text-[#1A1228]">{value}</span>;
};

export default function ProActiveEcosystemPricing() {
  const [userCount, setUserCount] = useState<number | "">(10);
  const [siteCount, setSiteCount] = useState<number | "">(1);
  const [selectedTier, setSelectedTier] = useState<CoverageTier>("business");
  const [compliance, setCompliance] = useState<ComplianceLevel>("standard");
  const [coverageHours, setCoverageHours] = useState<CoverageHours>("business");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);

  useSEO({
    title: "ProActive Ecosystem Pricing — Managed IT & Cybersecurity Packages",
    description:
      "Estimate your ProActive Ecosystem starting point across IT, Office, Business, and Enterprise packages. Final pricing is confirmed after assessment.",
    canonical: "/proactive-ecosystem-pricing",
  });

  const effectiveUsers = typeof userCount === "number" ? Math.max(userCount, 1) : 1;
  const effectiveSites = typeof siteCount === "number" ? Math.max(siteCount, 1) : 1;

  const estimates = useMemo(
    () =>
      plans.map((plan) => {
        if (plan.pricePerUser == null) {
          return { ...plan, monthlyEstimate: null as number | null };
        }
        const key = plan.id as PricingTierKey;
        const users = Math.max(effectiveUsers, plan.minUsers ?? 1);
        return {
          ...plan,
          monthlyEstimate: estimateMonthly(key, users, effectiveSites) as number | null,
        };
      }),
    [effectiveUsers, effectiveSites],
  );

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Pricing"
      title="ProActive Ecosystem Pricing"
      subtitle="Estimate your ProActive Ecosystem starting point. Final pricing is confirmed after assessment."
      showBackButton={false}
      actions={
        <div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <HeroActions
              primary={{ label: CTA.primary, href: "/book" }}
              secondary={{ label: "Compare coverage", href: "#matrix-heading" }}
            />
          </div>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-white/60">
            Pricing depends on users, endpoints, sites, network requirements, backup scope, infrastructure needs,
            compliance requirements, and selected add-ons.
          </p>
        </div>
      }
      heroAside={
        <HeroFacts
          title="Published starting rates"
          rows={pricingTiers.map((t) => ({
            label: t.name,
            value: `$${t.user}/user/mo · $${t.monthlyMinimum.toLocaleString()}/mo min`,
          }))}
          footnote="Fit-based, not universally better: depth increases by operating model. Estimates only."
        />
      }
    >
      <Chapter tone="well" seam={false}>
        <Container>
          <ProActiveCoverageMap
            selected={selectedTier}
            onSelect={setSelectedTier}
            compliance={compliance}
            onComplianceChange={setCompliance}
            coverageHours={coverageHours}
            onCoverageHoursChange={setCoverageHours}
          />
        </Container>
      </Chapter>

      <Chapter tone="surface" aria-labelledby="estimator-heading">
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="Estimator"
            title="Estimate Your Starting Point"
            titleId="estimator-heading"
            lede="Estimates only — exact pricing confirmed after assessment."
          />
          <div className="mb-10 grid max-w-xl gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm text-white/75">
                <Users className="h-4 w-4" aria-hidden="true" /> Number of users
              </span>
              <Input
                type="number"
                min={1}
                value={userCount}
                onChange={(e) => setUserCount(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                className="h-11 border-de-hairline bg-de-bg text-white"
                data-testid="input-user-count"
              />
            </label>
            <label className="block">
              <span className="mb-2 flex items-center gap-2 text-sm text-white/75">
                <Building2 className="h-4 w-4" aria-hidden="true" /> Number of sites
              </span>
              <Input
                type="number"
                min={1}
                value={siteCount}
                onChange={(e) => setSiteCount(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                className="h-11 border-de-hairline bg-de-bg text-white"
                data-testid="input-site-count"
              />
            </label>
          </div>

          <section className="grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-4" aria-label="ProActive Ecosystem packages">
            {estimates.map((plan) => {
              const expanded = !!expandedCards[plan.id];
              const selected = selectedTier === plan.id;
              return (
                <article
                  key={plan.id}
                  className={cn(
                    cardDark,
                    "de-interactive-card relative flex flex-col p-6",
                    selected && "!border-[#D3126A]",
                  )}
                  data-testid={`plan-card-${plan.id}`}
                >
                  <button
                    type="button"
                    className="mb-4 inline-flex min-h-11 items-center self-start rounded-full border border-de-hairline bg-de-bg px-5 text-sm font-semibold text-white hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                    aria-pressed={selected}
                    onClick={() => setSelectedTier(plan.id as CoverageTier)}
                  >
                    {plan.shortName}
                  </button>
                  <h3 className="mb-1 font-heading text-lg font-semibold text-white">{plan.name}</h3>
                  <p className="mb-4 text-sm text-white/65">{plan.tagline}</p>
                  <div className="mb-4 border-b border-[var(--de-hairline)] pb-4">
                    <p className="font-semibold text-de-magenta-ink">{plan.priceLabel}</p>
                    {plan.siteMin ? (
                      <p className="mt-1 text-xs text-white/60">${plan.siteMin.toLocaleString()}/site/mo minimum</p>
                    ) : null}
                    {plan.minUsers ? <p className="mt-1 text-xs text-white/60">Minimum {plan.minUsers} users</p> : null}
                    {plan.monthlyEstimate != null && (
                      <p className="mt-3 font-mono text-3xl font-bold text-white" data-testid={`estimate-${plan.id}`}>
                        ~${plan.monthlyEstimate.toLocaleString()}
                        <span className="font-sans text-sm font-normal text-white/60">/mo</span>
                      </p>
                    )}
                    {plan.priceNote && <p className="mt-2 text-xs leading-relaxed text-white/60">{plan.priceNote}</p>}
                  </div>
                  <ul className="mb-4 flex-1 space-y-2.5">
                    {plan.bullets.map((bullet, index) => (
                      <li
                        key={bullet}
                        className={cn(
                          "flex items-start gap-2 text-sm text-white/75",
                          !expanded && index >= PREVIEW_BULLETS && "hidden",
                        )}
                      >
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-de-accent-ink" aria-hidden="true" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.bullets.length > PREVIEW_BULLETS && (
                    <button
                      type="button"
                      className="mb-4 inline-flex min-h-11 items-center gap-1 self-start rounded-sm text-sm font-semibold text-[#F04C97] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                      aria-expanded={expanded}
                      onClick={() => setExpandedCards((current) => ({ ...current, [plan.id]: !current[plan.id] }))}
                      data-testid={`plan-expand-${plan.id}`}
                    >
                      {expanded ? "Show less" : `Show all ${plan.bullets.length} outcomes`}
                      <ChevronDown className={cn("h-4 w-4", expanded && "rotate-180")} aria-hidden="true" />
                    </button>
                  )}
                  <Link href={plan.learnMoreUrl} className={cn(buttonSecondary("surface"), "w-full")}>
                    Explore {plan.shortName}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </section>

          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-white/65">
            All numbers shown are estimated starting points, not exact totals. Final pricing is confirmed after a brief
            assessment of your environment, security needs, and selected add-ons.
          </p>
        </Container>
      </Chapter>

      {/* Coverage Explorer — same matrix facts, progressive reveal */}
      <Chapter tone="paper" aria-labelledby="matrix-heading">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Coverage"
            title="Coverage Explorer"
            titleId="matrix-heading"
            lede="What's included, enhanced, or available as an add-on across each ProActive Ecosystem package."
            className="mb-6 md:mb-6"
          />
          <label className="mb-8 inline-flex min-h-11 items-center gap-3 text-base text-[#1A1228]">
            <input
              type="checkbox"
              checked={showDifferencesOnly}
              onChange={(event) => setShowDifferencesOnly(event.target.checked)}
              className="h-5 w-5 accent-[#A30E52]"
              data-testid="coverage-show-differences"
            />
            Show differences only
          </label>

          <div className="space-y-8">
            {matrixCategories.map((category) => {
              const layer = categoryLayer(category.id);
              const dimmed = layer !== "always" && !isTierLit(selectedTier, layer);
              const services = showDifferencesOnly
                ? category.services.filter(
                    (service) =>
                      !coverageRowIsUniform([service.it, service.office, service.business, service.enterprise]),
                  )
                : category.services;
              if (services.length === 0) return null;
              return (
                <div
                  key={category.id}
                  className={cn(cardPaper, "overflow-hidden", dimmed && "border-dashed")}
                  data-tier-state={dimmed ? "outside-tier" : "in-tier"}
                >
                  <div className="flex flex-wrap items-center gap-3 border-b border-[var(--de-paper-hairline)] px-5 py-4">
                    <span className={dimmed ? "text-black/55" : "text-de-magenta-paper-ink"}>{category.icon}</span>
                    <h3 className="font-heading text-lg font-semibold text-[#1A1228]">{category.title}</h3>
                    {dimmed && (
                      <span className="rounded-full border border-black/25 px-3 py-1 text-xs font-medium text-[#3A3448]">
                        Not in {plans.find((plan) => plan.id === selectedTier)?.shortName ?? selectedTier}
                      </span>
                    )}
                    {category.ribbon && (
                      <span className="ml-auto rounded-full border border-[#8A4B00]/40 px-3 py-1 text-xs font-medium text-[#8A4B00]">
                        {category.ribbon}
                      </span>
                    )}
                  </div>
                  <div
                    className="max-h-[70vh] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                    tabIndex={0}
                    role="region"
                    aria-label={`${category.title} coverage table`}
                  >
                    <table className="w-full min-w-[720px] table-fixed text-left">
                      <thead className="sticky top-0 z-10 bg-white">
                        <tr className="text-xs uppercase tracking-wide text-black/60">
                          <th className="w-[34%] px-5 py-3 font-semibold">Service</th>
                          {(["it", "office", "business", "enterprise"] as CoverageTier[]).map((tier) => (
                            <th
                              key={tier}
                              className={cn(
                                "px-3 py-3 text-center font-semibold capitalize",
                                selectedTier === tier && "text-de-magenta-paper-ink",
                              )}
                            >
                              {tier === "it" ? "IT" : tier}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((service) => (
                          <tr key={service.name} className="border-t border-[var(--de-paper-hairline)]">
                            <td className="px-5 py-3.5 text-sm text-[#1A1228]">
                              <span className="inline-flex items-center gap-1.5">
                                {service.name}
                                {service.tooltip && (
                                  <span title={service.tooltip}>
                                    <Info className="h-3.5 w-3.5 text-black/55" aria-label={service.tooltip} />
                                  </span>
                                )}
                              </span>
                            </td>
                            {(["it", "office", "business", "enterprise"] as CoverageTier[]).map((tier) => (
                              <td
                                key={tier}
                                className={cn("px-3 py-3.5 text-center", selectedTier === tier && "bg-[#D3126A]/[0.07]")}
                              >
                                <MatrixCell value={service[tier]} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[#3A3448]">
            Digerati Experts provides audit readiness, evidence support, framework mapping, and risk reporting. We do
            not provide legal compliance signoff or certification.
          </p>
        </Container>
      </Chapter>

      {/* Relocated from homepage — keep tools, deepen pricing page */}
      <Chapter tone="well" aria-label="Pricing calculators">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Pricing tools"
            title="Calculate investment & downtime risk"
            lede={
              <>
                {PRICING_SCOPE_NOTE}
                <span className="mt-3 block">{NO_BLACK_BOX_TAGLINE}</span>
              </>
            }
          />
          <PricingToolsSection />
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        title="Ready to confirm your pricing?"
        lede="Schedule a brief assessment so we can scope users, devices, sites, backup, network, and compliance needs — then confirm your exact ProActive Ecosystem investment."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
}
