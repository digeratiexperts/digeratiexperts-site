import { motion, useReducedMotion } from "framer-motion";
import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiEnhancedFooterSection } from "../sections/DigeratiEnhancedFooterSection";
import { Button } from "@/components/ui/button";
import { 
  CheckCircle, ArrowRight, Shield, Headphones, Wifi, Monitor, 
  Activity, RefreshCw, Lock, Users, Cloud, FileCheck, Zap, 
  BarChart3, Clock, Phone, Award
} from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { pricingTiers, getPricingFooterText } from "@/data/pricing";
import { IconWell } from "@/components/visual/IconWell";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { CTA } from "@/lib/ctaCopy";
import { StatementHeading } from "@/components/visual/StatementHeading";
import { ConversionPathBar } from "@/components/ConversionPathBar";
import { revealInView, revealInitial, revealTransition, revealViewport } from "@/lib/animations";
import { ProofChip } from "@/components/evidence/ProofChip";
import { IncidentFlow } from "@/components/evidence/IncidentFlow";
import { HUDFrame } from "@/components/evidence/HUDFrame";
import { StatusToken } from "@/components/evidence/StatusToken";

const SolutionsIndex = () => {
  const prefersReducedMotion = useReducedMotion();

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

  const containerVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVariants = prefersReducedMotion ? undefined : {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="min-h-screen bg-de-bg">
      <MegaMenu />
      
      <main className="de-nav-clear pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <motion.div 
            className="mb-16 text-center"
            initial={prefersReducedMotion ? false : revealInitial}
            animate={prefersReducedMotion ? undefined : revealInView}
            transition={revealTransition}
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-de-hairline bg-de-raised px-4 py-2">
              <Shield className="h-4 w-4 text-de-accent-ink" />
              <span className="text-sm text-de-accent-ink">Complete IT & Security Solutions</span>
            </div>
            <StatementHeading as="h1" className="mb-6 text-4xl md:text-5xl lg:text-6xl">
              The ProActive Ecosystem
            </StatementHeading>
            <p className="mx-auto max-w-3xl text-xl leading-relaxed text-white/70">
              Everything your business needs to stay secure, productive, and compliant—all in one monthly subscription. 
              No surprise bills. No nickel-and-diming. Just predictable, professional IT.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild variant="brand" size="lg" className="h-12">
                <a href="/book">{CTA.primary}<ArrowRight className="ml-2 h-4 w-4" /></a>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 border-de-hairline bg-de-raised text-white hover:text-white">
                <a href={CTA.secondaryHref}>{CTA.secondary}</a>
              </Button>
            </div>

            <div className="mx-auto mt-10 grid max-w-4xl gap-4 text-left sm:grid-cols-2" data-testid="solutions-two-doors">
              <a
                href="/solutions/proactive-ecosystem"
                className="rounded-2xl border border-de-hairline bg-de-raised p-6 transition-colors hover:border-[#D3126A]"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-de-accent-ink">Door 1</p>
                <h2 className="mt-2 font-heading text-xl text-white">Handle Our IT</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  ProActive operating models. Assessment first — not a catalog checkout.
                </p>
              </a>
              <a
                href="/store"
                className="rounded-2xl border border-de-hairline bg-de-raised p-6 transition-colors hover:border-[#D3126A]"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-de-accent-ink">Door 2</p>
                <h2 className="mt-2 font-heading text-xl text-white">Solve a Business Need</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/65">
                  Thirteen solution families. Request a scoped recommendation — not a catalog checkout.
                </p>
              </a>
            </div>

            {/* Factual Proof Chips */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <ProofChip metric="24/7" label="Human-Led SOC" icon={Lock} />
              <ProofChip metric="ARIZONA" label="Local Engineering Team" icon={Users} />
              <ProofChip metric="8 BLOCKS" label="Assessed & Protected" icon={Shield} />
              <ProofChip metric="RTO/RPO" label="Defined SLA Commitments" icon={Activity} />
            </div>
          </motion.div>

          {/* Pricing Tiers */}
          <motion.section 
            className="mb-20"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            <div className="mb-10 text-center">
              <StatementHeading as="h2" className="mb-3 text-2xl md:text-3xl">
                Four operating models. One matched to your environment
              </StatementHeading>
              <p className="text-white/60">Baseline capabilities are shared. Network, backup, SOC, BCDR, and governance depth increase by fit — not because a higher tier is universally “better.”</p>
            </div>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.name}
                  variants={itemVariants}
                  className="de-hud-card relative p-6 transition-all duration-200 hover:border-[#D3126A]/40"
                  data-testid={`plan-${plan.name.toLowerCase()}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-bold text-white font-heading">{plan.name}</span>
                    <span className="px-2 py-0.5 text-xs font-mono font-semibold bg-white/10 text-white/80 rounded border border-white/10">
                      {plan.tier}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <span className="text-4xl font-black text-white font-mono tracking-tight">${plan.price}</span>
                    <span className="text-white/50 text-sm ml-2">/ user / mo</span>
                  </div>
                  
                  <p className="text-white/60 text-sm mb-6 leading-relaxed">
                    {plan.description}
                  </p>
                  
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-de-accent-ink mt-0.5 flex-shrink-0" />
                        <span className="text-white/80 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button asChild variant="outline" className="w-full border-white/15 bg-black/40 text-white hover:text-white hover:border-[#D3126A]/50" data-testid={`button-get-${plan.name.toLowerCase()}`}>
                    <a href="/book">
                      {CTA.primaryShort}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </motion.div>
              ))}
            </div>
            
            <p className="text-center text-white/55 text-sm mt-6">
              {getPricingFooterText()}. Final pricing tailored to your users, sites, and compliance needs.
            </p>
          </motion.section>

          {/* Foundation Services - What's Included in ALL Plans */}
          <motion.section 
            className="mb-20 rounded-2xl border border-de-hairline bg-de-raised p-8"
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <div className="mb-10 text-center">
              <span className="mb-4 inline-flex items-center rounded-full border border-de-hairline bg-de-bg px-3 py-1 text-xs font-medium text-white/70 font-mono uppercase tracking-wider">
                Baseline vs depth
              </span>
              <StatementHeading as="h2" className="mb-3 text-2xl md:text-3xl">
                What every model starts from
              </StatementHeading>
              <p className="text-white/60 max-w-2xl mx-auto">
                Service desk, endpoint foundation, identity guidance, and a documented environment are the baseline.
                Managed network and endpoint backup typically arrive at Office. Security operations, awareness training,
                and BCDR posture typically arrive at Business. Unified posture reporting and deeper governance typically
                arrive at Enterprise.
              </p>
            </div>
            
            <motion.div 
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-5"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {foundationServices.map((service, index) => {
                return (
                <motion.div
                  key={service.title}
                  variants={itemVariants}
                  className="de-interactive-card rounded-2xl border border-de-hairline bg-de-bg p-5"
                  data-testid={`foundation-${index}`}
                >
                  <div className="mb-4">
                    <IconWell icon={service.icon} size="md" surface="dark" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">{service.title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{service.description}</p>
                </motion.div>
                );
              })}
            </motion.div>
          </motion.section>

          {/* Security Services & Evidence Scenario */}
          <motion.section 
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-10 text-center">
              <StatementHeading as="h2" className="mb-3 text-2xl md:text-3xl">
                Security & Threat Containment
              </StatementHeading>
              <p className="text-white/60 max-w-2xl mx-auto">
                Real human analysts backed by behavioral telemetry watching and neutralizing threat vectors around the clock.
              </p>
            </div>
            
            {/* Operational Incident Flow Evidence Module */}
            <div className="mb-10">
              <IncidentFlow />
            </div>

            <motion.div 
              className="grid md:grid-cols-2 gap-5"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {securityServices.map((service, index) => {
                return (
                <motion.div
                  key={service.title}
                  variants={itemVariants}
                  className="de-interactive-card flex gap-4 rounded-2xl border border-de-hairline bg-de-raised p-5"
                  data-testid={`security-${index}`}
                >
                  <IconWell icon={service.icon} size="md" surface="dark" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-white font-semibold">{service.title}</h3>
                      <span className="px-2 py-0.5 text-xs bg-de-raised text-de-magenta-ink rounded font-mono font-medium">
                        {service.tier}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm leading-relaxed">{service.description}</p>
                  </div>
                </motion.div>
                );
              })}
            </motion.div>
          </motion.section>

          {/* Compliance & Strategy Services */}
          <motion.section 
            className="mb-20"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-10 text-center">
              <StatementHeading as="h2" className="mb-3 text-2xl md:text-3xl">
                Compliance & Strategy
              </StatementHeading>
              <p className="text-white/60">Governance, audit readiness, and executive IT guidance for regulated industries.</p>
            </div>
            
            <motion.div 
              className="grid md:grid-cols-2 gap-5"
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {complianceServices.map((service, index) => (
                <motion.div
                  key={service.title}
                  variants={itemVariants}
                  className="de-interactive-card flex gap-4 rounded-2xl border border-de-hairline bg-de-raised p-5"
                  data-testid={`compliance-${index}`}
                >
                  <IconWell icon={service.icon} size="md" surface="dark" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-white font-semibold">{service.title}</h3>
                      <span className="px-2 py-0.5 text-xs bg-de-raised text-de-magenta-ink rounded">
                        {service.tier}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm leading-relaxed">{service.description}</p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>

          {/* Why Choose Us */}
          <motion.section 
            className="mb-20 rounded-2xl p-8 bg-de-raised border border-de-hairline"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="mb-10 text-center">
              <StatementHeading as="h2" className="text-2xl md:text-3xl">
                Why Arizona Businesses Choose Us
              </StatementHeading>
            </div>
            
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { icon: Clock, value: "Assessment-led", label: "Engagement", description: "Prioritize before you buy" },
                { icon: Shield, value: "Client-owned", label: "Access model", description: "Credentials & tenants stay yours" },
                { icon: Phone, value: "Human support", label: "Service desk", description: "Accountable issue ownership" },
                { icon: Award, value: "Security-first", label: "Operating model", description: "IT + cyber together" }
              ].map((stat, index) => (
                <div key={index} className="text-center p-4">
                  <div className="w-12 h-12 rounded-full bg-de-raised flex items-center justify-center mx-auto mb-3">
                    <stat.icon className="w-6 h-6 text-de-magenta-ink" />
                  </div>
                  <div className="text-2xl font-bold text-white mb-1">{stat.value}</div>
                  <div className="text-white/80 font-medium text-sm">{stat.label}</div>
                  <div className="text-white/50 text-xs">{stat.description}</div>
                </div>
              ))}
            </div>
          </motion.section>

          <ConversionPathBar
            headline="Ready to get protected"
            body="Schedule a Cyber Risk Assessment to discuss your needs. No pressure, no obligation — honest advice about what your business actually needs."
          />

        </div>
      </main>

      <DigeratiEnhancedFooterSection />
    </div>
  );
};

export default SolutionsIndex;
