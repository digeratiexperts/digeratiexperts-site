import { useState } from "react";
import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { ServiceJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import {
  Cloud,
  HardDrive,
  AlertTriangle,
  RefreshCw,
  ClipboardCheck,
  Users,
  Server,
  Zap,
  Database,
  MonitorCheck,
  FileText,
  Target,
  Timer,
  Play,
  Settings,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { CTA } from "@/lib/ctaCopy";
import { EvidenceFrame } from "@/components/evidence/EvidenceFrame";
import { IconWell } from "@/components/visual/IconWell";
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
  IndexedList,
  StepRail,
  buttonPrimary,
  cardDark,
} from "@/components/site/chapters";

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

const paperField =
  "min-h-11 w-full rounded-lg border border-[var(--de-paper-hairline)] bg-white px-4 py-2.5 text-[#1A1228] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]";
const paperLabel = "mb-2 block text-sm font-medium text-[#3A3448]";

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
    <div className="rounded-xl border border-[var(--de-paper-hairline)] bg-white p-6 md:p-8">
      <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="picker-systems" className={paperLabel}>Critical Systems</label>
          <select id="picker-systems" value={criticalSystems} onChange={(e) => setCriticalSystems(e.target.value)} className={paperField} data-testid="picker-systems">
            <option value="1-5">1–5 systems</option>
            <option value="6-15">6–15 systems</option>
            <option value="16+">16+ systems</option>
          </select>
        </div>

        <div>
          <label htmlFor="picker-rto" className={paperLabel}>Target RTO</label>
          <select id="picker-rto" value={targetRTO} onChange={(e) => setTargetRTO(e.target.value)} className={paperField} data-testid="picker-rto">
            <option value="72h">72 hours</option>
            <option value="24h">24 hours</option>
            <option value="4h">4 hours</option>
            <option value="1h">1 hour</option>
          </select>
        </div>

        <div>
          <label htmlFor="picker-rpo" className={paperLabel}>Target RPO</label>
          <select id="picker-rpo" value={targetRPO} onChange={(e) => setTargetRPO(e.target.value)} className={paperField} data-testid="picker-rpo">
            <option value="24h">24 hours</option>
            <option value="8h">8 hours</option>
            <option value="1h">1 hour</option>
            <option value="15m">15 minutes</option>
          </select>
        </div>

        <div>
          <label id="picker-warm-standby-label" className={paperLabel}>Warm Standby</label>
          <button
            type="button"
            aria-pressed={warmStandby}
            aria-labelledby="picker-warm-standby-label"
            onClick={() => setWarmStandby(!warmStandby)}
            className={`${paperField} text-left transition-colors ${warmStandby ? "border-[#A30E52] bg-[#D3126A]/10 font-semibold" : ""}`}
            data-testid="picker-standby"
          >
            {warmStandby ? "Yes, Required" : "No, Not Needed"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--de-paper-hairline)] bg-[#F3EEE8] p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="mb-1 text-sm text-[#3A3448]">Recommended tier based on your selections:</p>
            <p className="font-heading text-2xl font-semibold text-[#1A1228]">BCDR {recommendation.tier}</p>
            <p className="mt-2 text-sm text-[#3A3448]">{recommendation.notes}</p>
          </div>
          <a href="/book" className={buttonPrimary("paper")} data-testid="btn-picker-quote">
            Get Exact Scope + Quote
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}

const tierName = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

export default function BackupDisasterRecovery() {
  useSEO({
    title: "Backup & Disaster Recovery (BCDR) | Digerati Experts",
    description: "Recover in hours, not days. BCDR with documented RPO/RTO targets, scheduled restore testing, and DR runbooks. Your business comes back up on a timeline you define.",
    canonical: "/solutions/backup-disaster-recovery"
  });

  const faqs = bcdrData.faqs;

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Solutions · Business continuity"
      title="Backup & Disaster Recovery"
      subtitle="Documented RPO/RTO targets, scheduled restore testing, and runbooks your team can follow. Your business comes back up on a timeline you define."
      breadcrumbs={[{ label: "Solutions", href: "/solutions" }, { label: "Backup & Disaster Recovery" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book", testId: "btn-hero-assessment" }}
            secondary={{ label: "Get a BCDR Quote", href: "#packages", testId: "btn-hero-quote" }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Recovery targets by tier"
          rows={bcdrData.packages.map((pkg) => ({
            label: pkg.name.replace("BCDR ", ""),
            value: `RPO ${pkg.rpo} · RTO ${pkg.rto}`,
          }))}
          footnote="Targets are documented in your agreement and proven by scheduled restore tests."
        />
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

      <FactStrip
        label="Backup and recovery at a glance"
        facts={[
          { icon: AlertTriangle, title: "$1.53M average ransomware recovery cost", text: "Sophos 2025" },
          { icon: HardDrive, title: "Immutable, air-gapped copies", text: "Protection against ransomware" },
          { icon: RefreshCw, title: "Tested on a verified cadence", text: "Annual, quarterly or monthly by tier" },
          { icon: Users, title: "Arizona recovery team", text: "Local engineers who run your restores" },
        ]}
      />

      <Chapter tone="well" seam={false}>
        <Container>
          <ChapterHeader tone="well" eyebrow="Plain English" title="BCDR in 30 Seconds" />
          <FeatureGrid
            tone="well"
            items={[
              { icon: HardDrive, title: "Backup", text: "Copies of your data, stored securely, with immutable protection against ransomware" },
              { icon: Timer, title: "Recovery Targets", text: "Agreed RPO (data loss limit) and RTO (downtime limit) documented in your agreement" },
              { icon: ClipboardCheck, title: "Tested Recovery", text: "Regular restore tests with documented procedures—proven, not assumed" },
            ]}
          />
          <ul className="mt-12 flex flex-wrap gap-x-10 gap-y-5 border-t border-[var(--de-hairline)] pt-8" aria-label="What we protect">
            {bcdrData.protectedSystems.map((system) => (
              <li key={system.name} className="flex items-center gap-3 text-white/80">
                <IconWell icon={system.icon} surface="dark" size="sm" />
                <span className="font-medium">{system.name}</span>
              </li>
            ))}
          </ul>
        </Container>
      </Chapter>

      <Chapter tone="surface">
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="Example evidence"
            title="What a restore drill looks like"
            lede="An example of the report a quarterly restore verification produces."
          />
          <EvidenceFrame
            classification="EXAMPLE"
            title="Quarterly BCDR Restore Verification Runbook"
            subtitle="How Digerati Experts verifies recovery integrity in isolated sandboxes to guarantee RTO/RPO SLAs."
            status="verified"
            statusLabel="RESTORE DRILL COMPLETE"
            timestamp="Cadence: Quarterly"
            sourceNote="Digerati Experts Continuity Engineering Audit Spec"
            variant="dark"
            className="max-w-4xl"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="font-mono text-[10px] uppercase text-white/50">Tested Target</p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-white">Primary Domain Controller & ERP</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="font-mono text-[10px] uppercase text-white/50">Achieved RTO</p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-emerald-400">2h 14m (SLA: 4h)</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <p className="font-mono text-[10px] uppercase text-white/50">Data Integrity Check</p>
                  <p className="mt-0.5 font-mono text-sm font-bold text-emerald-400">100% Checksum Verified</p>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-white/5 bg-[#0e0b14] p-4 font-mono text-xs text-white/80">
                <p className="border-b border-white/5 pb-1 text-[11px] uppercase tracking-wider text-white/65">
                  EXECUTED RESTORE SEQUENCE
                </p>
                <div className="flex items-center justify-between gap-3 pt-1 text-xs">
                  <span>1. Immutable snapshot mount in isolated hypervisor</span>
                  <span className="shrink-0 font-semibold text-emerald-400">PASS (14m)</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span>2. Database integrity & transaction log consistency verification</span>
                  <span className="shrink-0 font-semibold text-emerald-400">PASS (38m)</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span>3. Application mock login & critical record query validation</span>
                  <span className="shrink-0 font-semibold text-emerald-400">PASS (22m)</span>
                </div>
              </div>
            </div>
          </EvidenceFrame>
        </Container>
      </Chapter>

      <Chapter tone="paper" id="picker" className="scroll-mt-28">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Tier finder"
            title="Find Your Recovery Targets"
            lede="Answer a few questions to get a recommended tier and implementation notes"
          />
          <RPOPickerComponent />
        </Container>
      </Chapter>

      <Chapter tone="well">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Capabilities"
            title="Key BCDR Capabilities"
            lede="What you get with each tier"
          />
          <FeatureGrid
            tone="well"
            items={bcdrData.features.map((f) => ({
              icon: f.icon,
              title: f.title,
              text: (
                <>
                  {f.description}
                  <span className="mt-3 block text-xs text-white/60">
                    Deliverable: {f.deliverable} · Tiers: {f.included_in.map(tierName).join(", ")}
                  </span>
                </>
              ),
            }))}
          />
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Deliverables"
            title="What You Get"
            lede="Concrete deliverables, not vague promises"
          />
          <IndexedList tone="paper" items={bcdrData.deliverables.map((d) => ({ title: d.name, text: d.description }))} />
        </Container>
      </Chapter>

      <Chapter tone="surface" id="packages" className="scroll-mt-32" data-testid="section-packages">
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="Packages"
            title="BCDR Packages"
            lede="Choose the protection level that fits your recovery requirements"
          />
          <ul className="grid gap-4 md:grid-cols-3 md:gap-5">
            {bcdrData.packages.map((pkg) => (
              <li key={pkg.sku} className={`${cardDark} flex flex-col p-6 md:p-7`}>
                <h3 className="font-heading text-2xl font-semibold text-white">{pkg.name}</h3>
                <p className="mt-1 font-mono text-sm font-medium text-de-accent-ink">{pkg.subtitle}</p>
                <p className="mt-3 text-sm text-white/70">{pkg.best_for}</p>

                <dl className="mt-6 grid grid-cols-3 divide-x divide-[var(--de-hairline)] rounded-lg border border-[var(--de-hairline)] bg-de-bg text-center">
                  {[
                    ["RPO", pkg.rpo],
                    ["RTO", pkg.rto],
                    ["Tests", pkg.test_cadence],
                  ].map(([k, v]) => (
                    <div key={k} className="px-2 py-3">
                      <dt className="text-xs text-white/60">{k}</dt>
                      <dd className="mt-1 text-sm font-semibold text-white">{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-6">
                  <CheckList tone="surface" columns={1} items={pkg.includes} />
                </div>

                <div className="mt-auto pt-6">
                  <div className="mb-5 border-t border-[var(--de-hairline)] pt-5">
                    <p className="font-heading text-xl font-semibold text-white">{pkg.starting_price}</p>
                    <p className="text-xs text-white/60">{pkg.price_note}</p>
                  </div>
                  <a href="/book" className={`${buttonPrimary("surface")} w-full`} data-testid={`btn-package-${pkg.sku}`}>
                    Get Started
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-8 max-w-3xl text-sm text-white/65">
            Pricing depends on protected systems, retention period, and recovery targets. Final quote after assessment.
          </p>
        </Container>
      </Chapter>

      <Chapter tone="well">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Testing"
            title="How Testing Works"
            lede="Restore testing is how we prove your backups actually work"
          />
          <StepRail tone="well" steps={testingSteps.map((st) => ({ title: st.title, text: st.description }))} />
        </Container>
      </Chapter>

      <FaqChapter faqs={faqs} title="Frequently Asked Questions" lede="Common questions about BCDR" />

      <Chapter tone="well">
        <Container>
          <ChapterHeader tone="well" eyebrow="After you book" title="What Happens After You Book?" />
          <StepRail
            tone="well"
            steps={[
              { title: "BCDR Assessment", text: "We inventory your systems, current backup state, and recovery requirements" },
              { title: "RPO/RTO Agreement", text: "We define realistic recovery targets and document them in your agreement" },
              { title: "Implementation", text: "We deploy backup agents, configure policies, and schedule your first restore test" },
            ]}
          />
        </Container>
      </Chapter>

      <ClosingCta
        title="Ready to Know You Can Recover?"
        lede="Schedule a BCDR assessment. We'll scope your environment and provide a quote within 24 hours."
        primary={{ label: CTA.primary, href: "/book", testId: "btn-final-assessment" }}
        phoneTestId="btn-final-call"
      />
    </PageTemplate>
  );
}
