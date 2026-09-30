import { useState } from "react";
import { PageTemplate } from "@/components/PageTemplate";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { useSEO } from "@/hooks/useSEO";
import { ServiceJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import {
  Shield,
  Clock,
  CheckCircle,
  ArrowRight,
  Server,
  Cloud,
  HardDrive,
  FileCheck,
  AlertTriangle,
  RefreshCw,
  ClipboardCheck,
  Users,
  Phone,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Zap,
  Database,
  MonitorCheck,
  FileText,
  Target,
  Timer,
  Play,
  Settings,
  BarChart3
} from "lucide-react";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { CTA } from "@/lib/ctaCopy";
import { ProofChip } from "@/components/evidence/ProofChip";
import { EvidenceFrame } from "@/components/evidence/EvidenceFrame";
import { HUDFrame } from "@/components/evidence/HUDFrame";
import { StatusToken } from "@/components/evidence/StatusToken";

const bcdrData = {
  packages: [
    {
      sku: "bcdr_essentials",
      name: "BCDR Essentials",
      subtitle: "Backup",
      best_for: "Teams needing reliable backups + verified restore capability",
      rpo: "24 hours",
      rto: "24–72 hours",
      includes: [
        "Image-based server/VM backups",
        "Endpoint backup coverage",
        "Cloud data backup (email/files)",
        "Immutable backup copies",
        "Backup health monitoring",
        "Annual restore verification"
      ],
      test_cadence: "Annual",
      starting_price: "Custom after assessment",
      price_note: "per protected environment"
    },
    {
      sku: "bcdr_business",
      name: "BCDR Business",
      subtitle: "Backup + Rapid Restore",
      best_for: "Teams needing defined restore priority + regular testing",
      featured: true,
      rpo: "4–8 hours",
      rto: "4–24 hours",
      includes: [
        "Everything in Essentials",
        "Priority restore sequencing",
        "Quarterly restore testing",
        "DR runbook documentation",
        "RPO/RTO SLA commitments",
        "Restore test reports"
      ],
      test_cadence: "Quarterly",
      starting_price: "Custom after assessment",
      price_note: "scoped to protected environments & RTO/RPO"
    },
    {
      sku: "bcdr_enterprise",
      name: "BCDR Enterprise",
      subtitle: "DR + Continuity",
      best_for: "Teams needing warm standby + documented DR program",
      rpo: "15 min–4 hours",
      rto: "1–4 hours",
      includes: [
        "Everything in Business",
        "Warm standby / cloud failover",
        "Tabletop DR exercises",
        "Monthly restore testing",
        "Priority escalation paths",
        "DR program management"
      ],
      test_cadence: "Monthly",
      starting_price: "Custom pricing",
      price_note: "based on continuity requirements"
    }
  ],
  features: [
    {
      title: "Contract-defined RPO/RTO targets",
      description: "Committed recovery time and data-loss objectives documented in your agreement",
      deliverable: "RPO/RTO commitment document",
      included_in: ["business", "enterprise"],
      icon: Target
    },
    {
      title: "Image-Based Backups",
      description: "Full-system restore capability—not file-by-file recovery that takes days",
      deliverable: "Backup architecture diagram",
      included_in: ["essentials", "business", "enterprise"],
      icon: HardDrive
    },
    {
      title: "Scheduled Restore Tests",
      description: "Regular failover drills to confirm your systems can actually be restored",
      deliverable: "Restore test report",
      included_in: ["essentials", "business", "enterprise"],
      icon: RefreshCw
    },
    {
      title: "DR Runbooks & Exercises",
      description: "Documented recovery procedures with periodic team tabletop exercises",
      deliverable: "DR runbook + exercise log",
      included_in: ["business", "enterprise"],
      icon: ClipboardCheck
    },
    {
      title: "Priority Restore Paths",
      description: "Defined restore sequencing so critical systems come back first",
      deliverable: "Priority restore map",
      included_in: ["business", "enterprise"],
      icon: Zap
    },
    {
      title: "Warm Standby Options",
      description: "Cloud failover or secondary site for maximum availability",
      deliverable: "Failover runbook",
      included_in: ["enterprise"],
      icon: Cloud
    }
  ],
  deliverables: [
    { name: "BCDR policy + scope document", description: "What's protected and how" },
    { name: "RPO/RTO targets", description: "Agreed and documented recovery objectives" },
    { name: "Recovery runbook", description: "Step-by-step restore procedures" },
    { name: "Restore test schedule + reports", description: "Proof that recovery works" },
    { name: "Priority restore map", description: "Systems ranked 1→N for recovery order" },
    { name: "Warm standby plan", description: "If applicable, failover architecture" }
  ],
  protectedSystems: [
    { name: "Servers/VMs", icon: Server },
    { name: "Cloud Data", icon: Cloud },
    { name: "SaaS Apps", icon: Database },
    { name: "Endpoints", icon: MonitorCheck }
  ],
  faqs: [
    {
      question: "What's the difference between backup and disaster recovery?",
      answer: "Backup is having copies of your data. Disaster recovery is having a tested plan to restore your entire business within a defined timeframe. We provide both—verified backups plus documented, tested recovery procedures."
    },
    {
      question: "How often do you test restores?",
      answer: "Testing cadence depends on your tier: Essentials includes annual testing, Business includes quarterly testing, and Enterprise includes monthly testing. Every test generates a report documenting what was tested and the results."
    },
    {
      question: "What's RPO and RTO?",
      answer: "RPO (Recovery Point Objective) is how much data you can afford to lose—measured in time. RTO (Recovery Time Objective) is how quickly you need systems back online. We help you define realistic targets and build your BCDR program around them."
    },
    {
      question: "Do you provide warm standby / failover?",
      answer: "Yes, in our Enterprise tier. Warm standby means we maintain a ready-to-activate copy of your critical systems in the cloud. If your primary systems fail, we can failover within your agreed RTO—typically 1-4 hours."
    },
    {
      question: "What happens during a real disaster?",
      answer: "We follow your documented runbook: assess the situation, communicate with stakeholders, restore systems in priority order, verify functionality, and document the incident. You'll have clear contacts and escalation paths."
    },
    {
      question: "Is this just for ransomware?",
      answer: "No. BCDR protects against all business disruptions: ransomware, hardware failure, natural disasters, accidental deletion, and more. The $1.53M average ransomware recovery cost is just one example of why tested recovery matters."
    }
  ]
};

const testingSteps = [
  { step: 1, title: "Plan", description: "Schedule test, define scope, notify stakeholders", icon: FileText },
  { step: 2, title: "Test", description: "Execute restore to isolated environment, verify data integrity", icon: Play },
  { step: 3, title: "Report", description: "Document results, identify gaps, adjust procedures", icon: BarChart3 }
];

function FAQItem({ question, answer, isOpen, onToggle, index }: { 
  question: string; 
  answer: string; 
  isOpen: boolean; 
  onToggle: () => void; 
  index: number 
}) {
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

function RPOPickerComponent() {
  const [criticalSystems, setCriticalSystems] = useState<string>("1-5");
  const [targetRTO, setTargetRTO] = useState<string>("24h");
  const [targetRPO, setTargetRPO] = useState<string>("24h");
  const [warmStandby, setWarmStandby] = useState<boolean>(false);

  const getRecommendation = () => {
    if (warmStandby || targetRTO === "1h" || targetRPO === "15m") {
      return { tier: "Enterprise", notes: "Warm standby required for sub-4-hour RTO. High-frequency snapshots for 15-minute RPO." };
    }
    if (targetRTO === "4h" || targetRPO === "1h" || criticalSystems === "16+") {
      return { tier: "Business", notes: "Quarterly testing and priority restore paths recommended for complex environments." };
    }
    return { tier: "Essentials", notes: "Standard backup architecture with annual restore verification." };
  };

  const recommendation = getRecommendation();

  return (
    <div className="rounded-2xl border border-de-hairline bg-de-raised p-8">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div>
          <label htmlFor="picker-systems" className="block text-white/70 text-sm mb-2">Critical Systems</label>
          <select
            id="picker-systems"
            value={criticalSystems}
            onChange={(e) => setCriticalSystems(e.target.value)}
            className="w-full rounded-lg border border-de-hairline bg-de-bg px-4 py-3 text-white focus:border-[#D3126A] focus:outline-none"
            data-testid="picker-systems"
          >
            <option value="1-5">1–5 systems</option>
            <option value="6-15">6–15 systems</option>
            <option value="16+">16+ systems</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="picker-rto" className="block text-white/70 text-sm mb-2">Target RTO</label>
          <select
            id="picker-rto"
            value={targetRTO}
            onChange={(e) => setTargetRTO(e.target.value)}
            className="w-full rounded-lg border border-de-hairline bg-de-bg px-4 py-3 text-white focus:border-[#D3126A] focus:outline-none"
            data-testid="picker-rto"
          >
            <option value="72h">72 hours</option>
            <option value="24h">24 hours</option>
            <option value="4h">4 hours</option>
            <option value="1h">1 hour</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="picker-rpo" className="block text-white/70 text-sm mb-2">Target RPO</label>
          <select
            id="picker-rpo"
            value={targetRPO}
            onChange={(e) => setTargetRPO(e.target.value)}
            className="w-full rounded-lg border border-de-hairline bg-de-bg px-4 py-3 text-white focus:border-[#D3126A] focus:outline-none"
            data-testid="picker-rpo"
          >
            <option value="24h">24 hours</option>
            <option value="8h">8 hours</option>
            <option value="1h">1 hour</option>
            <option value="15m">15 minutes</option>
          </select>
        </div>
        
        <div>
          <label id="picker-warm-standby-label" className="block text-white/70 text-sm mb-2">Warm Standby</label>
          <button
            type="button"
            aria-pressed={warmStandby}
            aria-labelledby="picker-warm-standby-label"
            onClick={() => setWarmStandby(!warmStandby)}
            className={`w-full px-4 py-3 rounded-lg border transition-colors ${
              warmStandby 
                ? 'bg-de-accent border-de-hairline text-white' 
                : 'border-de-hairline bg-de-bg text-white/80'
            }`}
            data-testid="picker-standby"
          >
            {warmStandby ? 'Yes, Required' : 'No, Not Needed'}
          </button>
        </div>
      </div>

      <div className="bg-de-raised border border-de-hairline rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-white/60 text-sm mb-1">Recommended tier based on your selections:</p>
            <p className="text-2xl font-bold text-white">BCDR {recommendation.tier}</p>
            <p className="text-white/60 text-sm mt-2">{recommendation.notes}</p>
          </div>
          <Button
            asChild
            className="font-semibold"
            variant="brand"
            data-testid="btn-picker-quote"
          >
            <a href="/book">
              Get Exact Scope + Quote
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BackupDisasterRecovery() {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useSEO({
    title: "Backup & Disaster Recovery (BCDR) | Digerati Experts",
    description: "Recover in hours, not days. BCDR with documented RPO/RTO targets, scheduled restore testing, and DR runbooks. Your business comes back up on a timeline you define.",
    canonical: "/solutions/backup-disaster-recovery"
  });

  const fadeInUp = prefersReducedMotion ? {} : {
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.5 }
  };

  return (
    <PageTemplate 
      title="Backup & Disaster Recovery" 
      subtitle="Documented RPO/RTO targets, scheduled restore testing, and runbooks your team can follow. Your business comes back up on a timeline you define."
      breadcrumbs={[{ label: "Solutions", href: "/solutions" }, { label: "Backup & Disaster Recovery" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold" data-testid="btn-hero-assessment">
            <a href="/book">
              {CTA.primary}
              <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 border-white/20 px-6 font-semibold text-white hover:bg-white/10" data-testid="btn-hero-quote">
            <a href="#packages">Get a BCDR Quote</a>
          </Button>
        </div>
      }
    >
      <ServiceJsonLd
        name="Backup & Disaster Recovery (BCDR)"
        description="Recover in hours, not days. BCDR with documented RPO/RTO targets, scheduled restore testing, and DR runbooks."
        url="/solutions/backup-disaster-recovery"
      />
      <BreadcrumbJsonLd items={[
        { name: "Home", url: "/" },
        { name: "Solutions", url: "/solutions" },
        { name: "Backup & Disaster Recovery", url: "/solutions/backup-disaster-recovery" }
      ]} />
      <div className="space-y-20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-de-hairline bg-de-raised px-3 py-1.5 text-sm font-medium text-white/80">
            <AlertTriangle className="h-4 w-4 text-de-accent-ink" />
            $1.53M average ransomware recovery cost (Sophos 2025)
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ProofChip metric="IMMUTABLE" label="Air-Gapped Copies" icon={HardDrive} />
            <ProofChip metric="TESTED" label="Verified Cadence" icon={RefreshCw} />
            <ProofChip metric="ARIZONA" label="Local Recovery Team" icon={Users} />
          </div>
        </div>

        {/* What We Protect */}
        <motion.section {...fadeInUp}>
          <div className="flex flex-wrap justify-center gap-6 md:gap-12">
            {bcdrData.protectedSystems.map((system, index) => (
              <div key={index} className="flex items-center gap-3 text-white/70">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-de-hairline bg-de-raised">
                  <system.icon className="w-6 h-6 text-de-accent-ink" />
                </div>
                <span className="font-medium">{system.name}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* BCDR in Plain English */}
        <motion.section {...fadeInUp}>
          <div className="rounded-2xl border border-de-hairline bg-de-raised p-8 md:p-12">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">BCDR in 30 Seconds</h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-de-raised flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <HardDrive className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-2 font-heading text-lg">Backup</h3>
                <p className="text-white/60 text-sm">Copies of your data, stored securely, with immutable protection against ransomware</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-de-raised flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <Timer className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-2 font-heading text-lg">Recovery Targets</h3>
                <p className="text-white/60 text-sm">Agreed RPO (data loss limit) and RTO (downtime limit) documented in your agreement</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-de-raised flex items-center justify-center mx-auto mb-4 border border-white/10">
                  <ClipboardCheck className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold text-white mb-2 font-heading text-lg">Tested Recovery</h3>
                <p className="text-white/60 text-sm">Regular restore tests with documented procedures—proven, not assumed</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Evidence Artifact: Restore Verification Drill */}
        <motion.section {...fadeInUp}>
          <EvidenceFrame
            classification="EXAMPLE"
            title="Quarterly BCDR Restore Verification Runbook"
            subtitle="How Digerati Experts verifies recovery integrity in isolated sandboxes to guarantee RTO/RPO SLAs."
            status="verified"
            statusLabel="RESTORE DRILL COMPLETE"
            timestamp="Cadence: Quarterly"
            sourceNote="Digerati Experts Continuity Engineering Audit Spec"
            variant="dark"
            className="max-w-4xl mx-auto"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="font-mono text-[10px] text-white/50 uppercase">Tested Target</p>
                  <p className="text-sm font-bold text-white font-mono mt-0.5">Primary Domain Controller & ERP</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="font-mono text-[10px] text-white/50 uppercase">Achieved RTO</p>
                  <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">2h 14m (SLA: 4h)</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="font-mono text-[10px] text-white/50 uppercase">Data Integrity Check</p>
                  <p className="text-sm font-bold text-emerald-400 font-mono mt-0.5">100% Checksum Verified</p>
                </div>
              </div>

              <div className="rounded-lg border border-white/5 bg-[#0e0b14] p-4 font-mono text-xs text-white/80 space-y-2">
                <p className="text-[11px] text-white/65 uppercase tracking-wider pb-1 border-b border-white/5">
                  EXECUTED RESTORE SEQUENCE
                </p>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span>1. Immutable snapshot mount in isolated hypervisor</span>
                  <span className="text-emerald-400 font-semibold">PASS (14m)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>2. Database integrity & transaction log consistency verification</span>
                  <span className="text-emerald-400 font-semibold">PASS (38m)</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>3. Application mock login & critical record query validation</span>
                  <span className="text-emerald-400 font-semibold">PASS (22m)</span>
                </div>
              </div>
            </div>
          </EvidenceFrame>
        </motion.section>

        {/* RPO/RTO Picker */}
        <motion.section {...fadeInUp} id="picker">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Find Your Recovery Targets</h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Answer a few questions to get a recommended tier and implementation notes
            </p>
          </div>
          <RPOPickerComponent />
        </motion.section>

        {/* Key Features */}
        <motion.section {...fadeInUp}>
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Key BCDR Capabilities</h2>
            <p className="text-white/60">What you get with each tier</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bcdrData.features.map((feature, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.1 }}
                className="de-interactive-card rounded-xl border border-de-hairline bg-de-raised p-6"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-de-raised flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-white/60 text-sm">{feature.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex items-center gap-1 text-xs text-white/50">
                    <FileCheck className="w-3 h-3" />
                    {feature.deliverable}
                  </div>
                  <div className="flex gap-1">
                    {feature.included_in.map((tier) => (
                      <span 
                        key={tier} 
                        className={`text-xs px-2 py-0.5 rounded ${
                          tier === 'enterprise' ? 'bg-de-raised text-de-accent-ink' :
                          tier === 'business' ? 'bg-de-raised text-de-accent-ink' :
                          'bg-de-raised text-de-accent-ink'
                        }`}
                      >
                        {tier.charAt(0).toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* What You Get (Deliverables) */}
        <motion.section {...fadeInUp}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">What You Get</h2>
            <p className="text-white/60">Concrete deliverables, not vague promises</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bcdrData.deliverables.map((item, index) => (
              <motion.div
                key={index}
                {...fadeInUp}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 rounded-xl border border-de-hairline bg-de-raised p-5"
              >
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" />
                <div>
                  <h3 className="font-semibold text-white text-sm">{item.name}</h3>
                  <p className="text-white/50 text-xs">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* Packages Section */}
        <motion.section {...fadeInUp} id="packages" className="scroll-mt-32" data-testid="section-packages">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">BCDR Packages</h2>
            <p className="text-white/60">Choose the protection level that fits your recovery requirements</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {bcdrData.packages.map((pkg, index) => (
              <motion.div
                key={pkg.sku}
                {...fadeInUp}
                transition={{ delay: index * 0.1 }}
                className="de-hud-card relative overflow-hidden"
              >
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-white font-heading">{pkg.name}</h3>
                  <p className="text-de-accent-ink text-sm mb-2 font-mono font-medium">{pkg.subtitle}</p>
                  <p className="text-white/60 text-sm mb-6">{pkg.best_for}</p>
                  
                  <div className="flex gap-4 mb-6">
                    <div className="flex-1 rounded-lg border border-de-hairline bg-de-bg px-3 py-2 text-center">
                      <p className="text-xs text-white/50 mb-1">RPO</p>
                      <p className="text-sm font-semibold text-white">{pkg.rpo}</p>
                    </div>
                    <div className="flex-1 rounded-lg border border-de-hairline bg-de-bg px-3 py-2 text-center">
                      <p className="text-xs text-white/50 mb-1">RTO</p>
                      <p className="text-sm font-semibold text-white">{pkg.rto}</p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    {pkg.includes.map((item, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" />
                        <span className="text-white/80 text-sm">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mb-6 rounded-lg border border-de-hairline bg-de-bg p-3 text-center">
                    <p className="text-xs text-white/50">Test Cadence</p>
                    <p className="text-sm font-semibold text-de-accent-ink">{pkg.test_cadence}</p>
                  </div>

                  <div className="mb-6 text-center">
                    <p className="text-2xl font-bold text-white">{pkg.starting_price}</p>
                    <p className="text-white/50 text-xs">{pkg.price_note}</p>
                  </div>

                  <Button
                    asChild
                    variant="brand"
                    className="w-full font-semibold"
                    data-testid={`btn-package-${pkg.sku}`}
                  >
                    <a href="/book">
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
          
          <p className="text-center text-white/50 text-sm mt-6">
            Pricing depends on protected systems, retention period, and recovery targets. Final quote after assessment.
          </p>
        </motion.section>

        {/* How Testing Works */}
        <motion.section {...fadeInUp}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">How Testing Works</h2>
            <p className="text-white/60">Restore testing is how we prove your backups actually work</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testingSteps.map((step, index) => (
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

        {/* FAQs */}
        <motion.section {...fadeInUp}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Frequently Asked Questions</h2>
            <p className="text-white/60">Common questions about BCDR</p>
          </div>
          
          <div className="max-w-3xl mx-auto space-y-3">
            {bcdrData.faqs.map((faq, index) => (
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

        {/* What Happens Next */}
        <motion.section {...fadeInUp}>
          <div className="rounded-2xl border border-de-hairline bg-de-raised p-8 md:p-12">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">What Happens After You Book?</h2>
            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-de-raised border border-de-hairline flex items-center justify-center mx-auto mb-4">
                  <Users className="w-6 h-6 text-de-accent-ink" />
                </div>
                <h3 className="font-semibold text-white mb-2">BCDR Assessment</h3>
                <p className="text-white/60 text-sm">We inventory your systems, current backup state, and recovery requirements</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-de-raised border border-de-hairline flex items-center justify-center mx-auto mb-4">
                  <Target className="w-6 h-6 text-de-accent-ink" />
                </div>
                <h3 className="font-semibold text-white mb-2">RPO/RTO Agreement</h3>
                <p className="text-white/60 text-sm">We define realistic recovery targets and document them in your agreement</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-de-raised border border-de-hairline flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-6 h-6 text-de-accent-ink" />
                </div>
                <h3 className="font-semibold text-white mb-2">Implementation</h3>
                <p className="text-white/60 text-sm">We deploy backup agents, configure policies, and schedule your first restore test</p>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Final CTA */}
        <motion.section {...fadeInUp} className="rounded-2xl border border-de-hairline bg-de-raised p-8 text-center md:p-12">
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
            Ready to Know You Can Recover?
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/70">
            Schedule a BCDR assessment. We'll scope your environment and provide a quote within 24 hours.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button asChild variant="brand" size="lg" className="h-12 px-8 font-semibold" data-testid="btn-final-assessment">
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
