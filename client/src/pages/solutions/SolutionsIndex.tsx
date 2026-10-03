import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  FactStrip,
  FeatureGrid,
  HeroActions,
  IndexedList,
  buttonSecondary,
  cardDark,
} from "@/components/site/chapters";
import { 
  CheckCircle, ArrowRight, Shield, Headphones, Wifi, Monitor, 
  Activity, RefreshCw, Lock, Users, Cloud, FileCheck, Zap, 
  BarChart3, Clock, Phone, Award, MapPin
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { pricingTiers, getPricingFooterText } from "@/data/pricing";
import { CTA } from "@/lib/ctaCopy";
import { IncidentFlow } from "@/components/evidence/IncidentFlow";

const SolutionsIndex = () => {
  useSEO({
    title: 'Managed IT & Security Solutions',
    description: 'Comprehensive managed IT and cybersecurity solutions. Network security, endpoint protection, cloud security, compliance support, and 24/7 monitoring for Arizona businesses.',
    canonical: '/solutions',
  });

  const plans = pricingTiers.map((tier) => ({
    name: tier.name,
    tier: tier.label,
    price: tier.user,
    monthlyMinimum: tier.monthlyMinimum,
    description: tier.idealBuyer,
    features: [...tier.inclusions],
    learnMoreUrl: tier.learnMoreUrl,
  }));

  const foundationServices = [
    {
      icon: Headphones,
      title: "Service Desk & Support",
      description: "Fast help for day-to-day issues, questions, and requests—plus escalation when it's more complex. Response targets are defined in your service agreement."
    },
    {
      icon: Wifi,
      title: "Managed Network Security",
      description: "We review your router/firewall, Wi-Fi, and switches. Identify risks, provide upgrade timelines, and handle ongoing monitoring, updates, and security settings."
    },
    {
      icon: Monitor,
      title: "Device & User Management",
      description: "We manage users, devices, access, and standard configurations. Onboarding and offboarding handled securely and consistently."
    },
    {
      icon: Activity,
      title: "Monitoring & Maintenance",
      description: "Always-on monitoring and proactive maintenance to reduce downtime. We catch issues before they become problems."
    },
    {
      icon: RefreshCw,
      title: "Updates & Patch Management",
      description: "Operating systems and core apps kept current. Security patches deployed promptly to reduce vulnerability windows."
    },
    {
      icon: Shield,
      title: "Security Settings Management",
      description: "Baseline hardening and secure configuration management. Consistent security posture maintained over time."
    }
  ];

  const securityServices = [
    {
      icon: Lock,
      title: "24/7 SOC Monitoring",
      description: "Security Operations Center with real human analysts watching your environment around the clock.",
      tier: "Business+"
    },
    {
      icon: Zap,
      title: "Threat Detection & Response",
      description: "Advanced EDR with behavioral analysis. We detect, contain, and remediate threats before damage occurs.",
      tier: "Business+"
    },
    {
      icon: Users,
      title: "Security Awareness Training",
      description: "Ongoing phishing simulations and training to turn your staff into your first line of defense.",
      tier: "Business+"
    },
    {
      icon: Cloud,
      title: "Backup & Disaster Recovery",
      description: "Continuity, restore testing, and DR planning. Operating depth increases at Business and Enterprise — Office includes endpoint backup; IT does not include backup by default.",
      tier: "Business+"
    }
  ];

  const complianceServices = [
    {
      icon: FileCheck,
      title: "HIPAA / GDPR Support",
      description: "Compliance and risk reporting support for regulated environments. Not a substitute for your legal or compliance program, and not a claim of full certification.",
      tier: "Enterprise"
    },
    {
      icon: BarChart3,
      title: "vCIO & Strategy",
      description: "Executive IT guidance on demand. Quarterly business reviews, technology roadmaps, and budget planning.",
      tier: "Business+"
    },
    {
      icon: Award,
      title: "Cyber Insurance Readiness",
      description: "Documentation and controls that satisfy carrier requirements. Lower premiums, better coverage.",
      tier: "Business+"
    },
    {
      icon: Shield,
      title: "Scoped Security Assessments",
      description: "Targeted assessments when the engagement requires them — not a complimentary pentest on every plan.",
      tier: "Enterprise"
    }
  ];

  const trustFacts = [
    { icon: Lock, title: "24/7 Human-Led SOC", text: "Real analysts watching the environment" },
    { icon: MapPin, title: "Arizona local engineering team", text: "Chandler / East Valley operator" },
    { icon: Shield, title: "8 blocks", text: "Assessed & protected" },
    { icon: Activity, title: "RTO / RPO defined", text: "SLA commitments set in your agreement" },
  ];

  const whyFacts = [
    { icon: Clock, value: "Assessment-led", label: "Engagement", description: "Prioritize before you buy" },
    { icon: Shield, value: "Client-owned", label: "Access model", description: "Credentials & tenants stay yours" },
    { icon: Phone, value: "Human support", label: "Service desk", description: "Accountable issue ownership" },
    { icon: Award, value: "Security-first", label: "Operating model", description: "IT + cyber together" },
  ];

  const doorLink =
    "group block rounded-xl border border-de-hairline bg-de-raised p-5 transition-colors hover:border-[#D3126A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] md:p-6";

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Complete IT & Security Solutions"
      title="The ProActive Ecosystem"
      subtitle="Everything your business needs to stay secure, productive, and compliant—all in one monthly subscription. No surprise bills. No nickel-and-diming. Just predictable, professional IT."
      showBackButton={false}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book" }}
            secondary={{ label: CTA.secondary, href: CTA.secondaryHref }}
          />
        </div>
      }
      heroAside={
        <div className="space-y-4" data-testid="solutions-two-doors">
          <a href="/solutions/proactive-ecosystem" className={doorLink}>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-de-accent-ink">Door 1</p>
            <h2 className="mt-2 font-heading text-xl font-semibold text-white">Handle Our IT</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              ProActive operating models. Assessment first — not a catalog checkout.
            </p>
          </a>
          <a href="/store" className={doorLink}>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-de-accent-ink">Door 2</p>
            <h2 className="mt-2 font-heading text-xl font-semibold text-white">Solve a Business Need</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Thirteen solution families. Request a scoped recommendation — not a catalog checkout.
            </p>
          </a>
        </div>
      }
    >
      <FactStrip facts={trustFacts} label="Why businesses choose the ProActive Ecosystem" />

      <Chapter tone="well" seam={false} data-testid="solutions-pricing">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Operating models"
            title="Four operating models. One matched to your environment"
            lede="Baseline capabilities are shared. Network, backup, SOC, BCDR, and governance depth increase by fit — not because a higher tier is universally “better.”"
          />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4">
            {plans.map((plan) => (
              <li
                key={plan.name}
                className={`${cardDark} flex flex-col p-6 transition-colors duration-200 hover:border-[#D3126A]/50`}
                data-testid={`plan-${plan.name.toLowerCase()}`}
              >
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-de-magenta-ink">
                  {plan.name}
                </p>
                <h3 className="mt-2 font-heading text-xl font-semibold leading-tight text-white">{plan.tier}</h3>
                <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
                  <span className="font-mono text-4xl font-black tracking-tight text-white">${plan.price}</span>
                  <span className="text-sm text-white/65">/ user / mo</span>
                </p>
                <p className="mt-4 text-sm leading-relaxed text-white/70">{plan.description}</p>
                <ul className="mb-6 mt-5 flex-1 space-y-3 border-t border-[var(--de-hairline)] pt-5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
                      <span className="text-sm text-white/80">{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="/book"
                  className={`${buttonSecondary("well")} w-full`}
                  data-testid={`button-get-${plan.name.toLowerCase()}`}
                >
                  {CTA.primaryShort}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-sm text-white/65">
            {getPricingFooterText().replace(/\.+$/, "")}. Final pricing tailored to your users, sites, and compliance needs.
          </p>
        </Container>
      </Chapter>

      <Chapter tone="surface" data-testid="solutions-foundation">
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="Baseline vs depth"
            title="What every model starts from"
            lede="Service desk, endpoint foundation, identity guidance, and a documented environment are the baseline. Managed network and endpoint backup typically arrive at Office. Security operations, awareness training, and BCDR posture typically arrive at Business. Unified posture reporting and deeper governance typically arrive at Enterprise."
          />
          <FeatureGrid
            tone="surface"
            items={foundationServices.map((s) => ({ icon: s.icon, title: s.title, text: s.description }))}
          />
        </Container>
      </Chapter>

      <Chapter tone="well" data-testid="solutions-security">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Security"
            title="Security & Threat Containment"
            lede="Real human analysts backed by behavioral telemetry watching and neutralizing threat vectors around the clock."
          />
          <div className="mb-12">
            <IncidentFlow />
          </div>
          <FeatureGrid
            tone="well"
            columns={2}
            items={securityServices.map((s) => ({ icon: s.icon, title: s.title, text: s.description, tag: s.tier }))}
          />
        </Container>
      </Chapter>

      <Chapter tone="paper" data-testid="solutions-compliance">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Governance"
            title="Compliance & Strategy"
            lede="Governance, audit readiness, and executive IT guidance for regulated industries."
          />
          <FeatureGrid
            tone="paper"
            columns={2}
            items={complianceServices.map((s) => ({ icon: s.icon, title: s.title, text: s.description, tag: s.tier }))}
          />
        </Container>
      </Chapter>

      <Chapter tone="surface" data-testid="solutions-why">
        <Container>
          <ChapterHeader tone="surface" eyebrow="Why DE" title="Why Arizona Businesses Choose Us" layout="stack" />
          <IndexedList
            tone="surface"
            columns={2}
            items={whyFacts.map((f) => ({ title: f.value, text: `${f.label}. ${f.description}` }))}
          />
        </Container>
      </Chapter>

      <ClosingCta
        tone="well"
        title="Ready to get protected"
        lede="Schedule a Cyber Risk Assessment to discuss your needs. No pressure, no obligation — honest advice about what your business actually needs."
        primary={{ label: CTA.primary, href: "/book", testId: "button-conversion-assessment" }}
      />
    </PageTemplate>
  );
};

export default SolutionsIndex;
