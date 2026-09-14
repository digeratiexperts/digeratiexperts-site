import { useState } from "react";
import { PageTemplate } from "@/components/PageTemplate";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { useSEO } from "@/hooks/useSEO";
import { ServiceJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { pricing } from "@/data/pricing";
import { CTA } from "@/lib/ctaCopy";
import { IconWell } from "@/components/visual/IconWell";
import {
  Shield,
  Users,
  Clock,
  CheckCircle,
  ArrowRight,
  Zap,
  Laptop,
  Mail,
  UserPlus,
  UserMinus,
  Lock,
  Building2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Phone,
  FileText,
  Check,
  X,
  Info,
  ExternalLink
} from "lucide-react";
import { PRIMARY_PHONE } from "@/data/companyContact";

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
    return <Check className="w-5 h-5 text-de-accent-ink mx-auto" />;
  }
  if (value === false) {
    return <X className="w-5 h-5 text-white/55 mx-auto" />;
  }
  return <span className="text-sm text-white/80">{value}</span>;
}

function FAQItem({ question, answer, isOpen, onToggle, index }: { question: string; answer: string; isOpen: boolean; onToggle: () => void; index: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-de-hairline bg-de-raised">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-5 text-left hover:bg-de-bg/60 transition-colors"
        aria-expanded={isOpen}
        data-testid={`faq-toggle-${index}`}
      >
        <span className="font-semibold text-white pr-4">{question}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-de-accent-ink flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-de-accent-ink flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-white/70 leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
}

export default function ManagedWorkplace() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [pricingMode, setPricingMode] = useState<'per_user' | 'monthly'>('per_user');

  useSEO({
    title: "Managed Workplace - Identity, Devices & Apps Management | Digerati Experts",
    description: "We manage identity, devices, email, and app access so your staff stays productive and your business stays protected. New hires ready in 1 day.",
    canonical: "/solutions/managed-workplace"
  });

  const fadeInUp = prefersReducedMotion ? {} : {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5 }
  };

  return (
    <PageTemplate 
      title="Managed Workplace" 
      subtitle="We manage identity, devices, email, and app access so your staff stays productive—and your business stays protected. New hires ready in 1 day, not a week."
      breadcrumbs={[{ label: "Solutions", href: "/solutions" }, { label: "Managed Workplace" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold" data-testid="btn-hero-consultation">
            <a href="/book">
              {CTA.primary}
              <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        </div>
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
      <div className="space-y-20">
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Shield className="h-4 w-4 text-de-accent-ink" />
            <span>Zero-trust access policies</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <UserPlus className="h-4 w-4 text-de-accent-ink" />
            <span>Onboarding automation</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Laptop className="h-4 w-4 text-de-accent-ink" />
            <span>Standardized device baseline</span>
          </div>
        </div>

        {/* Outcomes Section */}
        <motion.section {...fadeInUp}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Measurable Business Outcomes</h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              What you actually get with Managed Workplace—not just features, but results
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {outcomes.map((outcome, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.1 }}
                className="de-interactive-card rounded-xl border border-de-hairline bg-de-raised p-6"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-de-bg border border-de-hairline flex items-center justify-center flex-shrink-0">
                    <outcome.icon className="w-6 h-6 text-de-accent-ink" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{outcome.text}</h3>
                    <p className="text-white/60 text-sm">{outcome.detail}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* How It Works */}
        <motion.section {...fadeInUp}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-white/60">Three simple steps to a managed workplace</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {howItWorks.map((step, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                <div className="h-full rounded-xl border border-de-hairline bg-de-raised p-8 text-center">
                  <div className="w-16 h-16 rounded-full bg-de-raised flex items-center justify-center mx-auto mb-6">
                    <span className="text-2xl font-bold text-white">{step.step}</span>
                  </div>
                  <step.icon className="w-8 h-8 text-de-accent-ink mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-3">{step.title}</h3>
                  <p className="text-white/60">{step.description}</p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="w-8 h-8 text-white/20" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Packages Section */}
        <motion.section {...fadeInUp} id="packages" className="scroll-mt-32">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Choose Your Package</h2>
            <p className="text-white/60 mb-6">Clear pricing, clear inclusions. Pick what fits your team.</p>
            
            <div className="inline-flex items-center gap-2 rounded-xl border border-de-hairline bg-de-bg p-1">
              <button
                onClick={() => setPricingMode('per_user')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  pricingMode === 'per_user' 
                    ? 'bg-[#D3126A] text-white' 
                    : 'text-white/60 hover:text-white'
                }`}
                data-testid="btn-pricing-per-user"
              >
                Per User/Month
              </button>
              <button
                onClick={() => setPricingMode('monthly')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  pricingMode === 'monthly' 
                    ? 'bg-[#D3126A] text-white' 
                    : 'text-white/60 hover:text-white'
                }`}
                data-testid="btn-pricing-monthly"
              >
                Monthly Minimum
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {workplaceData.packages.map((pkg, index) => (
              <motion.div
                key={pkg.sku}
                {...fadeInUp}
                transition={{ delay: index * 0.1 }}
                className="relative overflow-hidden rounded-2xl border border-de-hairline bg-de-raised"
              >
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>
                  <p className="text-white/60 text-sm mb-6">{pkg.best_for}</p>
                  
                  <div className="mb-6">
                    {pkg.starting_price ? (
                      <>
                        <div className="text-4xl font-bold text-white">
                          {pricingMode === 'per_user' 
                            ? `$${pkg.starting_price}` 
                            : `$${pkg.starting_price * 5}`
                          }
                          <span className="text-lg font-normal text-white/60">
                            {pricingMode === 'per_user' ? '/user/mo' : '/mo'}
                          </span>
                        </div>
                        <p className="text-white/50 text-sm mt-1">
                          {pricingMode === 'per_user' 
                            ? `Minimum billing: Office $${pricing.office.siteMin}/mo, Business $${pricing.business.siteMin.toLocaleString()}/mo, Enterprise $${pricing.enterprise.siteMin.toLocaleString()}/mo` 
                            : `Includes base tier access`
                          }
                        </p>
                      </>
                    ) : (
                      <div className="text-3xl font-bold text-white">Custom Pricing</div>
                    )}
                  </div>

                  <div className="space-y-3 mb-6">
                    {pkg.includes.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-de-accent-ink flex-shrink-0 mt-0.5" />
                        <span className="text-white/80 text-sm">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mb-6 rounded-lg border border-de-hairline bg-de-bg p-4">
                    <p className="text-sm text-white/60 mb-2">Key Outcomes:</p>
                    {pkg.outcomes.map((outcome, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-de-accent-ink">
                        <Sparkles className="w-4 h-4" />
                        {outcome}
                      </div>
                    ))}
                  </div>

                  <Button
                    asChild
                    variant="brand"
                    className="w-full font-semibold"
                    data-testid={`btn-package-${pkg.sku}`}
                  >
                    <a href="/book">
                      {pkg.starting_price ? 'Get Started' : 'Contact Sales'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>

                  {pkg.not_included && pkg.not_included.length > 0 && (
                    <p className="text-xs text-white/55 mt-4 text-center">
                      <Info className="w-3 h-3 inline mr-1" />
                      Not included: {pkg.not_included.slice(0, 2).join(', ')}
                      {pkg.not_included.length > 2 && ` +${pkg.not_included.length - 2} more`}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Compare Section */}
        <motion.section {...fadeInUp}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Compare Packages</h2>
            <p className="text-white/60">See exactly what's included at each tier</p>
          </div>
          
          <div className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-de-magenta-ink" tabIndex={0} role="region" aria-label="Managed Workplace comparison table">
            <table className="w-full border-collapse" data-testid="compare-table">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-white/60 font-medium">Feature</th>
                  <th className="text-center py-4 px-4 text-white font-semibold">Essentials</th>
                  <th className="text-center py-4 px-4 text-white font-semibold bg-de-raised">Business</th>
                  <th className="text-center py-4 px-4 text-white font-semibold">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {workplaceData.compareRows.map((row, index) => (
                  <tr key={index} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-4 px-4 text-white/80 text-sm">{row.feature}</td>
                    <td className="py-4 px-4 text-center"><CompareCell value={row.essentials} /></td>
                    <td className="py-4 px-4 text-center bg-de-raised"><CompareCell value={row.business} /></td>
                    <td className="py-4 px-4 text-center"><CompareCell value={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="text-center mt-6">
            <a 
              href="/ecosystem-pricing" 
              className="text-de-accent-ink hover:text-de-accent-ink text-sm inline-flex items-center gap-1"
              data-testid="link-full-matrix"
            >
              View full service matrix
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </motion.section>

        {/* Add-ons Section */}
        <motion.section {...fadeInUp}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Available Add-ons</h2>
            <p className="text-white/60">Extend your Workplace package with these optional services</p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workplaceData.addons.map((addon, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.05 }}
                className="de-interactive-card rounded-xl border border-de-hairline bg-de-raised p-5"
              >
                <h3 className="text-white font-semibold mb-2">{addon.name}</h3>
                <p className="text-white/60 text-sm">{addon.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* FAQs */}
        <motion.section {...fadeInUp}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Frequently Asked Questions</h2>
            <p className="text-white/60">Common questions about Managed Workplace</p>
          </div>
          
          <div className="max-w-3xl mx-auto space-y-3">
            {workplaceData.faqs.map((faq, index) => (
              <FAQItem
                key={index}
                index={index}
                question={faq.question}
                answer={faq.answer}
                isOpen={openFaq === index}
                onToggle={() => setOpenFaq(openFaq === index ? null : index)}
              />
            ))}
          </div>
        </motion.section>

        {/* What Happens After You Book */}
        <motion.section {...fadeInUp}>
          <div className="rounded-2xl border border-de-hairline bg-de-raised p-8 md:p-12">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">What Happens After You Book?</h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-de-raised border border-de-hairline flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-6 h-6 text-de-accent-ink" />
                </div>
                <h3 className="font-semibold text-white mb-2">Discovery Call</h3>
                <p className="text-white/60 text-sm">15–25 min call to understand your tools, team, and goals</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-de-raised border border-de-hairline flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-6 h-6 text-de-accent-ink" />
                </div>
                <h3 className="font-semibold text-white mb-2">Access & Inventory</h3>
                <p className="text-white/60 text-sm">We document your current state and create an action plan</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-de-raised border border-de-hairline flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-6 h-6 text-de-accent-ink" />
                </div>
                <h3 className="font-semibold text-white mb-2">Onboarding Timeline</h3>
                <p className="text-white/60 text-sm">Clear responsibilities and milestones for go-live</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Final CTA */}
        <motion.section {...fadeInUp} className="rounded-2xl border border-de-hairline bg-de-raised p-8 text-center md:p-12">
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
            Ready to Simplify Your Workplace?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/70">
            Book a consultation to discuss your team's needs. Get a quote within 24 hours.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild variant="brand" size="lg" className="h-12 px-8 font-semibold" data-testid="btn-final-consultation">
              <a href="/book">
                {CTA.primary}
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 border-white/20 px-8 font-semibold text-white hover:bg-white/10" data-testid="btn-final-call">
              <a href={PRIMARY_PHONE.telHref}>
                <Phone className="mr-2 h-5 w-5" />
                Call {PRIMARY_PHONE.display}
              </a>
            </Button>
          </div>
        </motion.section>
      </div>
    </PageTemplate>
  );
}
