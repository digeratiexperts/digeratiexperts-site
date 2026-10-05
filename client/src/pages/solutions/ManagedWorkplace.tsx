import { useState } from "react";
import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { ServiceJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { pricing } from "@/data/pricing";
import { CTA } from "@/lib/ctaCopy";
import {
  Shield,
  Users,
  ArrowRight,
  Zap,
  Laptop,
  UserPlus,
  UserMinus,
  Lock,
  Sparkles,
  Phone,
  FileText,
  Check,
  X,
  Info,
  ExternalLink
} from "lucide-react";
import {
  Chapter,
  CheckList,
  Container,
  ChapterHeader,
  ClosingCta,
  FactStrip,
  FaqChapter,
  FeatureGrid,
  HeroActions,
  HeroFacts,
  StepRail,
  buttonPrimary,
  cardDark,
  textLinkClass,
} from "@/components/site/chapters";

const workplaceData = {
  product: "Managed Workplace",
  pricing: { mode: "per_user", minimum_users: 5 },
  packages: [
    {
      sku: "workplace_essentials",
      name: "Workplace Essentials",
      starting_price: 165,
      best_for: "Small teams needing a secure, standardized baseline",
      includes: [
        "DE Identity & SSO",
        "MFA enforcement",
        "Device baseline policies",
        "Email/collab admin",
        "Basic onboarding/offboarding"
      ],
      outcomes: ["New hires ready in 1 day", "Consistent access controls"],
      not_included: ["Privileged access management", "Advanced DLP", "Custom compliance reporting", "Advanced conditional access"]
    },
    {
      sku: "workplace_business",
      name: "Workplace Business",
      starting_price: 195,
      best_for: "Growing teams needing governance and automation",
      featured: true,
      includes: [
        "Advanced conditional access",
        "App/license governance",
        "Workflow automation",
        "Quarterly business reviews",
        "Enhanced device compliance"
      ],
      outcomes: ["Reduced SaaS sprawl", "Offboarding in minutes"],
      not_included: ["PAM/privileged access", "Advanced DLP"]
    },
    {
      sku: "workplace_enterprise",
      name: "Workplace Enterprise",
      starting_price: null,
      best_for: "Regulated teams needing advanced controls + tailored policy",
      includes: [
        "Zero-trust policy set",
        "Continuous access reviews",
        "Advanced reporting cadence",
        "Custom integrations",
        "Optional PAM/DLP add-ons"
      ],
      outcomes: ["Audit-ready posture", "Least-privilege at scale"],
      not_included: []
    }
  ],
  addons: [
    { name: "Managed IT Help Desk", description: "Full support desk with SLA-backed response times" },
    { name: "Privileged Access Management", description: "Secure admin credentials with session recording" },
    { name: "Data Loss Prevention", description: "Prevent sensitive data exfiltration" },
    { name: "Advanced Email Security", description: "Enhanced phishing and malware protection" },
    { name: "vCIO/QBR Upgrades", description: "Strategic IT planning and executive reporting" }
  ],
  compareRows: [
    { feature: "Onboarding automation (HR→Identity→Apps)", essentials: true, business: true, enterprise: true },
    { feature: "Offboarding in minutes (full access revocation)", essentials: "basic", business: true, enterprise: true },
    { feature: "MFA + Conditional Access policies", essentials: "basic", business: "advanced", enterprise: "zero-trust" },
    { feature: "Device baseline + compliance policies", essentials: true, business: "enhanced", enterprise: "custom" },
    { feature: "App access + role mapping", essentials: true, business: true, enterprise: true },
    { feature: "License governance + audits", essentials: false, business: true, enterprise: true },
    { feature: "Email security baseline", essentials: true, business: true, enterprise: "advanced" },
    { feature: "Reporting cadence", essentials: "monthly", business: "quarterly QBR", enterprise: "custom" },
    { feature: "Admin change management / approvals", essentials: false, business: true, enterprise: true },
    { feature: "Integrations (HR/IdP/PSA)", essentials: "limited", business: "standard", enterprise: "custom" }
  ],
  faqs: [
    {
      question: "Do we need to replace our current tools?",
      answer: "Not necessarily. We work with your existing email and productivity platform, and can integrate with most HR systems and identity providers. Our goal is to enhance and standardize what you have, not force a complete overhaul."
    },
    {
      question: "Which email and productivity platforms do you support?",
      answer: "We support all major cloud productivity platforms fully—email administration, collaboration tools, file storage, retention policies, and security settings are all included in Managed Workplace."
    },
    {
      question: "What's the minimum user count?",
      answer: `Pricing starts at $${pricing.office.user}/user/month. Minimum billing applies if the per-user total is below the tier minimum: Office $${pricing.office.monthlyMinimum.toLocaleString()}/mo, Business $${pricing.business.monthlyMinimum.toLocaleString()}/mo, Enterprise $${pricing.enterprise.monthlyMinimum.toLocaleString()}/mo.`
    },
    {
      question: "How fast can you onboard/offboard?",
      answer: "New hires can be fully productive within 1 business day—with email, apps, SSO access, and device baseline configured. Offboarding takes minutes: we revoke all access, disable accounts, and transfer data per your policies."
    },
    {
      question: "What's included vs add-ons?",
      answer: "Core Workplace packages include identity, device baseline, email admin, app access, and onboarding automation. Add-ons include Managed IT Help Desk, Privileged Access Management (PAM), Data Loss Prevention (DLP), and Advanced Email Security."
    },
    {
      question: "Do you provide support, or just management?",
      answer: "Managed Workplace focuses on identity, devices, and app management. For full help desk support with SLAs, add our Managed IT Help Desk service. Many clients bundle both for complete coverage."
    }
  ]
};

const outcomes = [
  { icon: UserPlus, text: "New hires ready in 1 day", detail: "Email, SSO, apps, device baseline—all configured" },
  { icon: UserMinus, text: "Offboarding completed in minutes", detail: "Full access revocation, data transfer, audit trail" },
  { icon: Laptop, text: "Reduce tool sprawl", detail: "License + access governance across all SaaS apps" },
  { icon: Lock, text: "MFA + conditional access everywhere", detail: "Consistent login security for every user" },
  { icon: Zap, text: "Fewer support tickets", detail: "Standard baselines reduce endpoint issues" }
];

const howItWorks = [
  {
    step: 1,
    title: "Discovery Call",
    description: "15–25 minute call to understand your current tools, team size, and security requirements",
    icon: Phone
  },
  {
    step: 2,
    title: "Access & Inventory",
    description: "We assess your identity providers, devices, apps, and document your current state",
    icon: FileText
  },
  {
    step: 3,
    title: "Onboarding & Handoff",
    description: "We configure your environment, train your team, and take over ongoing management",
    icon: Users
  }
];

function CompareCell({ value }: { value: boolean | string }) {
  if (value === true) {
    return <Check className="mx-auto h-5 w-5 text-de-magenta-paper-ink" aria-label="Included" />;
  }
  if (value === false) {
    return <X className="mx-auto h-5 w-5 text-black/45" aria-label="Not included" />;
  }
  return <span className="text-sm text-[#3A3448]">{value}</span>;
}

export default function ManagedWorkplace() {
  const [pricingMode, setPricingMode] = useState<'per_user' | 'monthly'>('per_user');

  useSEO({
    title: "Managed Workplace - Identity, Devices & Apps Management | Digerati Experts",
    description: "We manage identity, devices, email, and app access so your staff stays productive and your business stays protected. New hires ready in 1 day.",
    canonical: "/solutions/managed-workplace"
  });

  const toggleClass = (active: boolean) =>
    `min-h-11 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] ${
      active ? "bg-[#D3126A] text-white" : "text-white/70 hover:text-white"
    }`;

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Solutions · Identity, devices & apps"
      title="Managed Workplace"
      subtitle="We manage identity, devices, email, and app access so your staff stays productive—and your business stays protected. New hires ready in 1 day, not a week."
      breadcrumbs={[{ label: "Solutions", href: "/solutions" }, { label: "Managed Workplace" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book", testId: "btn-hero-consultation" }}
            secondary={{ label: "See packages", href: "#packages" }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Packages at a glance"
          rows={workplaceData.packages.map((pkg) => ({
            label: pkg.name.replace("Workplace ", ""),
            value: pkg.starting_price ? `From $${pkg.starting_price}/user/mo` : "Custom pricing",
          }))}
          footnote="Per-user pricing with a monthly minimum. Final scope is confirmed on a discovery call."
        />
      }
    >
      <ServiceJsonLd
        name="Managed Workplace"
        description="We manage identity, devices, email, and app access so your staff stays productive and your business stays protected. New hires ready in 1 day."
        url="/solutions/managed-workplace"
      />
      <BreadcrumbJsonLd items={[
        { name: "Home", url: "/" },
        { name: "Solutions", url: "/solutions" },
        { name: "Managed Workplace", url: "/solutions/managed-workplace" }
      ]} />

      <FactStrip
        label="Managed Workplace at a glance"
        facts={[
          { icon: Shield, title: "Zero-trust access policies" },
          { icon: UserPlus, title: "Onboarding automation" },
          { icon: Laptop, title: "Standardized device baseline" },
        ]}
      />

      <Chapter tone="well" seam={false}>
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Outcomes"
            title="Measurable Business Outcomes"
            lede="What you actually get with Managed Workplace—not just features, but results"
          />
          <FeatureGrid
            tone="well"
            items={outcomes.map((o) => ({ icon: o.icon, title: o.text, text: o.detail }))}
          />
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Process"
            title="How It Works"
            lede="Three simple steps to a managed workplace"
          />
          <StepRail tone="paper" steps={howItWorks.map((st) => ({ title: st.title, text: st.description }))} />
        </Container>
      </Chapter>

      <Chapter tone="surface" id="packages" className="scroll-mt-32">
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="Packages"
            title="Choose Your Package"
            lede="Clear pricing, clear inclusions. Pick what fits your team."
          />
          <div className="mb-8 inline-flex items-center gap-1 rounded-xl border border-[var(--de-hairline)] bg-de-bg p-1">
            <button
              type="button"
              onClick={() => setPricingMode('per_user')}
              aria-pressed={pricingMode === 'per_user'}
              className={toggleClass(pricingMode === 'per_user')}
              data-testid="btn-pricing-per-user"
            >
              Per User/Month
            </button>
            <button
              type="button"
              onClick={() => setPricingMode('monthly')}
              aria-pressed={pricingMode === 'monthly'}
              className={toggleClass(pricingMode === 'monthly')}
              data-testid="btn-pricing-monthly"
            >
              Monthly Minimum
            </button>
          </div>

          <ul className="grid gap-4 md:grid-cols-3 md:gap-5">
            {workplaceData.packages.map((pkg) => (
              <li key={pkg.sku} className={`${cardDark} flex flex-col p-6 md:p-7`}>
                <h3 className="font-heading text-2xl font-semibold text-white">{pkg.name}</h3>
                <p className="mt-2 text-sm text-white/70">{pkg.best_for}</p>

                <div className="my-6 border-y border-[var(--de-hairline)] py-5">
                  {pkg.starting_price ? (
                    <>
                      <p className="font-heading text-4xl font-semibold text-white">
                        {pricingMode === 'per_user' ? `$${pkg.starting_price}` : `$${pkg.starting_price * 5}`}
                        <span className="text-lg font-normal text-white/65">
                          {pricingMode === 'per_user' ? '/user/mo' : '/mo'}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-white/60">
                        {pricingMode === 'per_user'
                          ? `Minimum billing: Office $${pricing.office.siteMin}/mo, Business $${pricing.business.siteMin.toLocaleString()}/mo, Enterprise $${pricing.enterprise.siteMin.toLocaleString()}/mo`
                          : `Includes base tier access`}
                      </p>
                    </>
                  ) : (
                    <p className="font-heading text-3xl font-semibold text-white">Custom Pricing</p>
                  )}
                </div>

                <CheckList tone="well" columns={1} items={pkg.includes} />

                <div className="mt-6 rounded-lg border border-[var(--de-hairline)] bg-de-bg p-4">
                  <p className="mb-2 text-sm text-white/65">Key Outcomes:</p>
                  {pkg.outcomes.map((outcome, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-de-accent-ink">
                      <Sparkles className="h-4 w-4" aria-hidden="true" />
                      {outcome}
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-6">
                  <a
                    href="/book"
                    className={`${buttonPrimary("surface")} w-full`}
                    data-testid={`btn-package-${pkg.sku}`}
                  >
                    {pkg.starting_price ? 'Get Started' : 'Contact Sales'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                  {pkg.not_included && pkg.not_included.length > 0 && (
                    <p className="mt-4 text-center text-xs text-white/60">
                      <Info className="mr-1 inline h-3 w-3" aria-hidden="true" />
                      Not included: {pkg.not_included.slice(0, 2).join(', ')}
                      {pkg.not_included.length > 2 && ` +${pkg.not_included.length - 2} more`}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Compare"
            title="Compare Packages"
            lede="See exactly what's included at each tier"
          />
          <div
            className="overflow-x-auto rounded-xl border border-[var(--de-paper-hairline)] bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
            tabIndex={0}
            role="region"
            aria-label="Managed Workplace comparison table"
          >
            <table className="w-full min-w-[640px] border-collapse" data-testid="compare-table">
              <thead>
                <tr className="border-b border-[var(--de-paper-hairline)] bg-[#F3EEE8]">
                  <th scope="col" className="px-4 py-4 text-left font-medium text-[#3A3448]">Feature</th>
                  <th scope="col" className="px-4 py-4 text-center font-semibold text-[#1A1228]">Essentials</th>
                  <th scope="col" className="px-4 py-4 text-center font-semibold text-de-magenta-paper-ink">Business</th>
                  <th scope="col" className="px-4 py-4 text-center font-semibold text-[#1A1228]">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {workplaceData.compareRows.map((row, index) => (
                  <tr key={index} className="border-b border-[var(--de-paper-hairline)] last:border-b-0">
                    <th scope="row" className="px-4 py-4 text-left text-sm font-normal text-[#1A1228]">{row.feature}</th>
                    <td className="px-4 py-4 text-center"><CompareCell value={row.essentials} /></td>
                    <td className="bg-[#FBF7F2] px-4 py-4 text-center"><CompareCell value={row.business} /></td>
                    <td className="px-4 py-4 text-center"><CompareCell value={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <a
            href="/ecosystem-pricing"
            className={`${textLinkClass("paper")} mt-6 min-h-11`}
            data-testid="link-full-matrix"
          >
            View full service matrix
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        </Container>
      </Chapter>

      <Chapter plate="field" tone="well">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Add-ons"
            title="Available Add-ons"
            lede="Extend your Workplace package with these optional services"
          />
          <FeatureGrid tone="well" items={workplaceData.addons.map((a) => ({ title: a.name, text: a.description }))} />
        </Container>
      </Chapter>

      <FaqChapter
        faqs={workplaceData.faqs}
        title="Frequently Asked Questions"
        lede="Common questions about Managed Workplace"
      />

      <Chapter tone="well">
        <Container>
          <ChapterHeader tone="well" eyebrow="After you book" title="What Happens After You Book?" />
          <StepRail
            tone="well"
            steps={[
              { title: "Discovery Call", text: "15–25 min call to understand your tools, team, and goals" },
              { title: "Access & Inventory", text: "We document your current state and create an action plan" },
              { title: "Onboarding Timeline", text: "Clear responsibilities and milestones for go-live" },
            ]}
          />
        </Container>
      </Chapter>

      <ClosingCta
        title="Ready to Simplify Your Workplace?"
        lede="Book a consultation to discuss your team's needs. Get a quote within one business day."
        primary={{ label: CTA.primary, href: "/book", testId: "btn-final-consultation" }}
        phoneTestId="btn-final-call"
      />
    </PageTemplate>
  );
}
