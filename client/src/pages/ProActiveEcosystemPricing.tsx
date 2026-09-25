import { useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "./sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Building2, Shield, Server, Layers, Bookmark, Briefcase,
  FileCheck, ArrowRight, Check, Calculator, Database, Info, ChevronDown,
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { Link } from "wouter";
import { pricing, estimateMonthly, PRICING_SCOPE_NOTE, NO_BLACK_BOX_TAGLINE, type PricingTierKey } from "@/data/pricing";
import { PricingToolsSection } from "./sections/PricingToolsSection";
import { CTA } from "@/lib/ctaCopy";
import { ConversionPathBar } from "@/components/ConversionPathBar";
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
    title: "Security Operations",
    icon: <Shield className="w-5 h-5" />,
    services: [
      { name: "Security Awareness Training", it: false, office: "Basic / add-on", business: true, enterprise: true },
      { name: "Threat Detection & Response", tooltip: "Monitoring, detection, triage, containment, and guided recovery signals from endpoint, identity, email, cloud, or other detection systems.", it: false, office: "addon", business: true, enterprise: "Advanced / custom" },
      { name: "Security Operations / SOC-as-a-Service", tooltip: "Security monitoring, alert triage, tuning, escalation, reporting, and response coordination.", it: false, office: "addon", business: true, enterprise: "Advanced / custom" },
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
    tagline: "Entry managed IT + baseline security",
    pricePerUser: pricing.it.user,
    priceLabel: `Starting at $${pricing.it.user}/user/mo`,
    minUsers: 5,
    siteMin: pricing.it.monthlyMin,
    bullets: [
      "Managed IT Support + Service Desk",
      "Microsoft 365 / Google Workspace / Zoho workspace support",
      "MFA / SSO / Password Manager (baseline)",
      "Endpoint security (basic)",
      "Email protection (basic)",
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
      "Security Awareness Training (add-on)",
      "Threat Detection / SOC (add-on)",
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
      "Security Awareness Training included",
      "Threat Detection / SOC included",
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
      <div className="w-5 h-5 rounded-full bg-de-bg border border-de-hairline flex items-center justify-center mx-auto">
        <Check className="w-3 h-3 text-de-accent-ink" />
      </div>
    );
  }
  if (value === false) {
    return <div className="w-2 h-0.5 bg-white/20 rounded mx-auto" />;
  }
  if (value === "addon") {
    return <span className="text-xs text-amber-400 font-medium">Add-On</span>;
  }
  return <span className="text-xs text-white/80 font-medium">{value}</span>;
};

export default function ProActiveEcosystemPricing() {
  const prefersReducedMotion = useReducedMotion();
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

  const fadeIn = prefersReducedMotion
    ? undefined
    : { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

  return (
    <div className="relative min-h-screen overflow-hidden bg-de-bg">
      <div className="fixed inset-0 bg-de-surface" aria-hidden="true" />
      <div className="relative z-10">
        <MegaMenu />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 de-nav-clear pb-20">
          {/* Hero */}
          <motion.header
            className="text-center max-w-3xl mx-auto mb-14"
            initial={prefersReducedMotion ? undefined : "hidden"}
            animate={prefersReducedMotion ? undefined : "visible"}
            variants={fadeIn}
          >
            <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">
              ProActive Ecosystem Pricing<span className="text-de-accent-ink" aria-hidden="true">:</span>
            </h1>
            <p className="text-lg text-white/70 mb-3">
              Estimate your ProActive Ecosystem starting point. Final pricing is confirmed after assessment.
            </p>
            <p className="text-sm text-white/50">
              Pricing depends on users, endpoints, sites, network requirements, backup scope, infrastructure needs,
              compliance requirements, and selected add-ons.
            </p>
          </motion.header>

          <section className="mb-14">
            <ProActiveCoverageMap
    selected={selectedTier}
    onSelect={setSelectedTier}
    compliance={compliance}
    onComplianceChange={setCompliance}
    coverageHours={coverageHours}
    onCoverageHoursChange={setCoverageHours}
  />
          </section>

          {/* Estimator */}
          <section className="mb-14" aria-labelledby="estimator-heading">
            <div className="de-style-box p-6 md:p-8">
              <h2 id="estimator-heading" className="flex items-center gap-3 text-xl font-semibold text-white mb-2">
                <Calculator className="w-5 h-5 text-de-magenta-ink" />
                Estimate Your Starting Point
              </h2>
              <p className="text-sm text-white/50 mb-6">Estimates only — exact pricing confirmed after assessment.</p>
              <div className="grid sm:grid-cols-2 gap-6 max-w-xl">
                <label className="block">
                  <span className="flex items-center gap-2 text-sm text-white/70 mb-2">
                    <Users className="w-4 h-4" /> Number of users
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={userCount}
                    onChange={(e) => setUserCount(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                    className="border-de-hairline bg-de-bg text-white"
                    data-testid="input-user-count"
                  />
                </label>
                <label className="block">
                  <span className="flex items-center gap-2 text-sm text-white/70 mb-2">
                    <Building2 className="w-4 h-4" /> Number of sites
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={siteCount}
                    onChange={(e) => setSiteCount(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
                    className="border-de-hairline bg-de-bg text-white"
                    data-testid="input-site-count"
                  />
                </label>
              </div>
            </div>
          </section>

          {/* Plan cards */}
          <section className="mb-6 grid gap-6 md:grid-cols-2 xl:grid-cols-4" aria-label="ProActive Ecosystem packages">
            {estimates.map((plan) => {
              const expanded = !!expandedCards[plan.id];
              const selected = selectedTier === plan.id;
              return (
              <motion.article
                key={plan.id}
                className={cn(
                  "de-interactive-card relative flex flex-col rounded-2xl border bg-de-raised p-6",
                  selected ? "border-[#D3126A]" : "border-de-hairline",
                )}
                initial={prefersReducedMotion ? undefined : "hidden"}
                whileInView={prefersReducedMotion ? undefined : "visible"}
                viewport={{ once: true }}
                variants={fadeIn}
                data-testid={`plan-card-${plan.id}`}
              >
                <button
                  type="button"
                  className="mb-4 inline-flex self-start rounded-full border border-de-hairline bg-de-bg px-3 py-1 text-xs font-semibold text-white"
                  onClick={() => setSelectedTier(plan.id as CoverageTier)}
                >
                  {plan.shortName}
                </button>
                <h3 className="mb-1 text-lg font-bold text-white">{plan.name}</h3>
                <p className="mb-4 text-sm text-white/50">{plan.tagline}</p>
                <div className="mb-4">
                  <p className="font-semibold text-de-magenta-ink">{plan.priceLabel}</p>
                  {plan.siteMin ? (
                    <p className="mt-1 text-xs text-white/50">${plan.siteMin.toLocaleString()}/site/mo minimum</p>
                  ) : null}
                  {plan.minUsers ? (
                    <p className="mt-1 text-xs text-white/50">Minimum {plan.minUsers} users</p>
                  ) : null}
                  {plan.monthlyEstimate != null && (
                    <p className="mt-2 text-2xl font-bold text-white" data-testid={`estimate-${plan.id}`}>
                      ~${plan.monthlyEstimate.toLocaleString()}<span className="text-sm font-normal text-white/50">/mo</span>
                    </p>
                  )}
                  {plan.priceNote && <p className="mt-2 text-xs text-white/50">{plan.priceNote}</p>}
                </div>
                <ul className="mb-4 flex-1 space-y-2">
                  {plan.bullets.map((bullet, index) => (
                    <li
                      key={bullet}
                      className={cn(
                        "flex items-start gap-2 text-sm text-white/70",
                        !expanded && index >= PREVIEW_BULLETS && "hidden",
                      )}
                    >
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-de-accent-ink" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
                {plan.bullets.length > PREVIEW_BULLETS && (
                  <button
                    type="button"
                    className="mb-4 inline-flex items-center gap-1 text-sm text-[#F04C97] hover:text-white"
                    onClick={() =>
                      setExpandedCards((current) => ({ ...current, [plan.id]: !current[plan.id] }))
                    }
                    data-testid={`plan-expand-${plan.id}`}
                  >
                    {expanded ? "Show less" : `Show all ${plan.bullets.length} outcomes`}
                    <ChevronDown className={cn("h-4 w-4", expanded && "rotate-180")} />
                  </button>
                )}
                <Link href={plan.learnMoreUrl}>
                  <Button
                    variant="outline"
                    className="w-full border-de-hairline bg-de-bg text-white hover:border-[#D3126A] hover:bg-de-raised hover:text-white"
                  >
                    Explore {plan.shortName}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </motion.article>
              );
            })}
          </section>

          <p className="text-center text-sm text-white/55 mb-16 max-w-2xl mx-auto">
            All numbers shown are estimated starting points, not exact totals. Final pricing is confirmed after a brief
            assessment of your environment, security needs, and selected add-ons.
          </p>

          {/* Coverage Explorer — same matrix facts, progressive reveal */}
          <section className="mb-16" aria-labelledby="matrix-heading">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 id="matrix-heading" className="mb-2 text-3xl font-bold text-white">
                  Coverage Explorer
                </h2>
                <p className="text-white/60">
                  What's included, enhanced, or available as an add-on across each ProActive Ecosystem package.
                </p>
              </div>
              <label className="inline-flex h-11 items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={showDifferencesOnly}
                  onChange={(event) => setShowDifferencesOnly(event.target.checked)}
                  className="h-4 w-4 accent-[#D3126A]"
                  data-testid="coverage-show-differences"
                />
                Show differences only
              </label>
            </div>

            <div className="space-y-8">
              {matrixCategories.map((category) => {
                const layer = categoryLayer(category.id);
                const dimmed = layer !== "always" && !isTierLit(selectedTier, layer);
                const services = showDifferencesOnly
                  ? category.services.filter(
                      (service) =>
                        !coverageRowIsUniform([
                          service.it,
                          service.office,
                          service.business,
                          service.enterprise,
                        ]),
                    )
                  : category.services;
                if (services.length === 0) return null;
                return (
                <div
                  key={category.id}
                  className={cn(
                    "overflow-hidden rounded-2xl border bg-de-raised",
                    // Dimming used to fade the whole card to 55% opacity, which pushed every
                    // row below 4.5:1. Out-of-tier categories now keep readable text and
                    // signal state through the border, icon and an explicit chip instead
                    // (a11y sweep 2026-09-12).
                    dimmed ? "border-white/5" : "border-de-hairline",
                  )}
                  data-tier-state={dimmed ? "outside-tier" : "in-tier"}
                >
                  <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-5 py-4">
                    <span className={dimmed ? "text-white/60" : "text-de-magenta-ink"}>{category.icon}</span>
                    <h3 className="font-semibold text-white">{category.title}</h3>
                    {dimmed && (
                      <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-white/80">
                        Not in {plans.find((plan) => plan.id === selectedTier)?.shortName ?? selectedTier}
                      </span>
                    )}
                    {category.ribbon && (
                      <span className="ml-auto rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-400/90">
                        {category.ribbon}
                      </span>
                    )}
                  </div>
                  <div
                    className="max-h-[70vh] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink"
                    tabIndex={0}
                    role="region"
                    aria-label={`${category.title} coverage table`}
                  >
                    <table className="w-full text-left">
                      <thead className="sticky top-0 z-10 bg-de-raised">
                        <tr className="text-xs uppercase tracking-wide text-white/55">
                          <th className="min-w-[220px] px-5 py-3 font-medium">Service</th>
                          {(["it", "office", "business", "enterprise"] as CoverageTier[]).map((tier) => (
                            <th
                              key={tier}
                              className={cn(
                                "px-3 py-3 text-center font-medium capitalize",
                                selectedTier === tier && "text-[#F04C97]",
                              )}
                            >
                              {tier}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {services.map((service) => (
                          <tr key={service.name} className="border-t border-white/5">
                            <td className="px-5 py-3 text-sm text-white/80">
                              <span className="inline-flex items-center gap-1.5">
                                {service.name}
                                {service.tooltip && (
                                  <span title={service.tooltip}>
                                    <Info className="h-3.5 w-3.5 text-white/55" aria-label={service.tooltip} />
                                  </span>
                                )}
                              </span>
                            </td>
                            {(["it", "office", "business", "enterprise"] as CoverageTier[]).map((tier) => (
                              <td
                                key={tier}
                                className={cn(
                                  "px-3 py-3 text-center",
                                  selectedTier === tier && "bg-[#D3126A]/10",
                                )}
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

            <p className="text-center text-xs text-white/55 mt-6 max-w-3xl mx-auto">
              Digerati Experts provides audit readiness, evidence support, framework mapping, and risk reporting. We do
              not provide legal compliance signoff or certification.
            </p>
          </section>

          {/* Relocated from homepage — keep tools, deepen pricing page */}
          <section className="mb-16" aria-label="Pricing calculators">
            <div className="mb-6 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#F04C97]">Pricing tools</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Calculate investment &amp; downtime risk</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-white/55">{PRICING_SCOPE_NOTE}</p>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-white/55">{NO_BLACK_BOX_TAGLINE}</p>
            </div>
            <PricingToolsSection />
          </section>

          {/* CTA */}
          <ConversionPathBar
            headline="Ready to confirm your pricing?"
            body="Schedule a brief assessment so we can scope users, devices, sites, backup, network, and compliance needs — then confirm your exact ProActive Ecosystem investment."
          />
        </main>

        <DigeratiEnhancedFooterSection />
      </div>
    </div>
  );
}
