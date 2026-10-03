import { PageTemplate } from "@/components/PageTemplate";
import { IconWell } from "@/components/visual/IconWell";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Lock,
  FileCheck,
  CheckCircle,
  Phone,
  Heart,
  Activity,
  Stethoscope,
  AlertTriangle,
  ArrowRight,
  Users,
  ClipboardList,
  Ban,
  UserX,
  HardDrive,
  HelpCircle,
  Layers,
  MapPin,
  ListChecks,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useSEO } from "@/hooks/useSEO";
import { pageNarratives } from "@/pages/routes/pageNarratives";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

const narrative = pageNarratives.healthcare;

const cardClass = "rounded-2xl border border-de-hairline bg-de-raised";
const insetClass = "rounded-xl border border-de-hairline bg-de-bg";

export default function Healthcare() {
  const prefersReducedMotion = useReducedMotion() ?? false;

  useSEO({
    title: "Healthcare IT & HIPAA Security | Arizona Practices",
    description:
      "Keep patient data protected without becoming a HIPAA expert. Arizona-based IT, cybersecurity, and compliance support for medical and dental practices — start with a free risk assessment.",
    canonical: "/industries/healthcare",
  });

  const trustStrip = [
    { label: "Arizona-based", icon: MapPin },
    { label: "HIPAA-focused security", icon: Shield },
    { label: "Real human support", icon: Users },
    { label: "Assessment-led recommendations", icon: ClipboardList },
  ];

  const painQuestions = [
    { icon: Ban, text: "Could ransomware lock scheduling, imaging, or billing mid-day?" },
    { icon: Lock, text: "Who can actually reach PHI across EHR, email, and shared drives?" },
    { icon: UserX, text: "Are former employees and vendors fully removed from every system?" },
    { icon: HardDrive, text: "Have backups been restore-tested — or only assumed to work?" },
    { icon: FileCheck, text: "Can you answer cyber-insurance questionnaires with evidence?" },
    { icon: HelpCircle, text: "Is your current IT doing security — or only tickets and resets?" },
  ];

  const commonProblems = [
    {
      icon: Shield,
      title: "HIPAA as a binder, not an operating model",
      description:
        "Policies exist, but access reviews, offboarding, and technical safeguards are inconsistent day to day.",
    },
    {
      icon: Lock,
      title: "Patient data scattered across tools",
      description:
        "PHI and clinical workflows span EHR, email, imaging, billing, and personal devices with uneven controls.",
    },
    {
      icon: FileCheck,
      title: "Audit and insurance evidence gaps",
      description:
        "When questionnaires or auditors ask for proof, the practice scrambles instead of pulling a known packet.",
    },
  ];

  const consequences = [
    "Canceled or delayed appointments when systems are unavailable",
    "Inaccessible charts, imaging, or billing during a ransomware or outage event",
    "Staff operating from personal workarounds that increase exposure",
    "Insurance friction when controls cannot be evidenced",
    "Owner time pulled into IT fire drills instead of patient care",
  ];

  const howWeSolve = [
    {
      title: "Managed IT",
      description: "Identity, endpoints, email, and day-to-day support that keep the practice running.",
    },
    {
      title: "Cybersecurity",
      description: "MFA, monitoring posture, phishing resistance, and incident-ready response paths.",
    },
    {
      title: "Compliance evidence",
      description: "BAAs where appropriate, documentation, and audit/insurance packet support — not theater.",
    },
  ];

  const differentiation = [
    "One program for IT + cybersecurity + compliance — not three vendors pointing at each other",
    "Assessment-led recommendations before tool pushes",
    "Arizona operator (Chandler / East Valley) who understands clinic staffing realities",
    "Independent assessment — collaboration with your current provider is welcome; switching is optional",
    "Evidence and restore readiness treated as first-class outcomes, not afterthoughts",
  ];

  const securityStack = [
    "Business Associate Agreements (BAA)",
    "AES-256 encryption where applicable",
    "PHI access controls & audit logs",
    "Encrypted email solutions",
    "Secure file sharing",
    "MFA and identity hygiene",
    "Backup & disaster recovery with restore verification paths",
    "Risk assessment & analysis",
    "Security awareness training",
    "Incident response planning",
    "Regular security updates",
    "Compliance documentation",
  ];

  const assessmentIncludes = [
    "Access control and account hygiene review (including former-employee risk)",
    "MFA posture across email, remote access, and admin paths",
    "Email and phishing exposure that touches PHI workflows",
    "Endpoint hygiene for clinical and front-desk devices",
    "Backup existence vs restore readiness",
    "Documentation gaps insurers and auditors commonly ask about",
    "A prioritized risk summary — urgent vs later — not a product dump",
  ];

  const engagementSteps = narrative?.process ?? [];

  return (
    <PageTemplate
      title="Keep Patient Data Protected Without Becoming a HIPAA Expert"
      subtitle="Digerati Experts manages security, backups, access controls, documentation, and ongoing IT behind Arizona practices so owners can focus on patients."
      icon={<Stethoscope className="w-10 h-10 text-de-accent-ink" />}
      breadcrumbs={[{ label: "Industries", href: "/industries" }, { label: "Healthcare" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="brand" size="lg" className="h-12 px-6 font-semibold" data-testid="button-hero-assessment">
            <a href="/book">
              {CTA.primary}
              <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 border-white/20 px-6 font-semibold text-white hover:bg-white/10"
            data-testid="button-hero-see-checks"
          >
            <a href="#assessment">See What We Check</a>
          </Button>
        </div>
      }
    >
      <div className="space-y-16">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="section-trust-strip">
          {trustStrip.map((item, idx) => (
            <motion.div
              key={item.label}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.06, duration: 0.4 }}
              className={`flex items-center gap-3 p-4 ${cardClass}`}
            >
              <IconWell icon={item.icon} size="sm" surface="dark" />
              <p className="text-sm font-medium leading-snug text-white/90">{item.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Focus", value: "HIPAA", icon: Shield },
            { label: "Encryption", value: "AES-256", icon: Lock },
            { label: "Priority", value: "PHI", icon: Activity },
            { label: "Outcome", value: "Audit-ready evidence", icon: Heart },
          ].map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.label}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08, duration: 0.45 }}
                className={`de-interactive-card p-6 ${cardClass}`}
              >
                <Icon className="mb-3 h-5 w-5 text-de-accent-ink" aria-hidden="true" />
                <p className="text-2xl font-bold text-white">{metric.value}</p>
                <p className="mt-1 text-sm text-white/55">{metric.label}</p>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className={`p-8 ${cardClass}`}
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          data-testid="section-pain"
        >
          <div className="flex gap-4">
            <IconWell icon={AlertTriangle} size="md" surface="dark" />
            <div className="w-full">
              <h2 className="mb-3 font-heading text-2xl font-semibold text-white md:text-3xl">
                Is your practice exposed<span className="text-de-accent-ink" aria-hidden="true">:</span>
              </h2>
              <p className="mb-6 max-w-3xl text-white/70">
                Healthcare practices are high-value targets because downtime hits patients and PHI
                creates regulatory and trust risk. Ask yourself the questions owners usually postpone
                until after something breaks.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {painQuestions.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.text} className={`flex items-start gap-3 p-3 ${insetClass}`}>
                      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" />
                      <span className="text-white/80">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>

        <div data-testid="section-common-problems">
          <motion.h2
            className="mb-8 flex items-center gap-3 text-3xl font-bold text-white"
            initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <IconWell icon={Shield} size="sm" surface="dark" />
            Common healthcare IT &amp; security problems
          </motion.h2>
          <div className="grid gap-6 md:grid-cols-3">
            {commonProblems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  className={`de-interactive-card h-full p-6 ${cardClass}`}
                >
                  <Icon className="mb-4 h-7 w-7 text-de-accent-ink" aria-hidden="true" />
                  <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-3 leading-relaxed text-white/65">{item.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>

        <section data-testid="section-consequences">
          <div className="mb-6 flex items-center gap-3">
            <IconWell icon={AlertTriangle} size="sm" surface="dark" />
            <div>
              <h2 className="text-3xl font-bold text-white">What exposure costs a practice</h2>
              <p className="text-sm text-white/55">Operational and financial pressure — without invented statistics.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {consequences.map((item, idx) => (
              <motion.div
                key={item}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05, duration: 0.35 }}
                className={`flex items-start gap-3 p-4 ${insetClass}`}
              >
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" aria-hidden="true" />
                <p className="text-white/80">{item}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section data-testid="section-how-we-solve">
          <div className="mb-3 flex items-center gap-3">
            <IconWell icon={Layers} size="sm" surface="dark" />
            <h2 className="text-3xl font-bold text-white">How Digerati Experts solves them</h2>
          </div>
          <p className="mb-8 max-w-3xl text-white/70">
            IT, cybersecurity, and compliance as one operating program — so security is not bolted onto
            break/fix support after the fact.
          </p>
          <div className="grid gap-5 md:grid-cols-3">
            {howWeSolve.map((item, idx) => (
              <motion.div
                key={item.title}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08, duration: 0.4 }}
                className={`p-6 ${cardClass}`}
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#F04C97]">
                  Pillar {idx + 1}
                </p>
                <h3 className="mb-2 text-xl font-semibold text-white">{item.title}</h3>
                <p className="leading-relaxed text-white/70">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section data-testid="section-differentiation">
          <h2 className="mb-6 text-3xl font-bold text-white">Why Digerati Experts instead of ordinary IT support</h2>
          <div className="max-w-4xl space-y-3">
            {differentiation.map((item, idx) => (
              <motion.div
                key={item}
                initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className={`flex items-start gap-3 p-4 ${insetClass}`}
              >
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" aria-hidden="true" />
                <span className="font-medium text-white/80">{item}</span>
              </motion.div>
            ))}
          </div>
        </section>

        <motion.div
          className={`p-8 md:p-12 ${cardClass}`}
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          data-testid="section-security-stack"
        >
          <div className="mb-3 flex items-center gap-3">
            <IconWell icon={FileCheck} size="sm" surface="dark" />
            <h2 className="text-3xl font-bold text-white">Healthcare security stack &amp; outcomes</h2>
          </div>
          <p className="mb-8 max-w-3xl text-white/65">
            Technical and administrative controls that support HIPAA-aware operations. These are the
            building blocks behind the program — not the headline promise.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {securityStack.map((item, index) => (
              <motion.div
                key={item}
                className={`flex items-center gap-3 p-4 ${insetClass}`}
                initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
              >
                <CheckCircle className="h-5 w-5 shrink-0 text-de-accent-ink" aria-hidden="true" />
                <span className="font-medium text-white/80">{item}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <section className="grid gap-6 md:grid-cols-2" data-testid="section-proof">
          <motion.div
            className={`p-6 ${cardClass}`}
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F04C97]">
              Arizona practices
            </p>
            <p className="leading-relaxed text-white/85">
              {narrative?.arizonaNote ??
                "East Valley clinics, dental offices, and specialty practices need HIPAA-aware IT without a hospital-sized IT department."}
            </p>
          </motion.div>
          <motion.div
            className="rounded-2xl border border-[#D3126A]/35 bg-de-raised p-6"
            initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#F04C97]">
              What proof looks like today
            </p>
            <p className="mb-3 leading-relaxed text-white/85">
              We do not publish named healthcare testimonials here yet. Instead of inventing quotes or
              outcome percentages, we show you the assessment deliverable: a clear prioritized risk
              summary, control gaps, and recommended next steps you can act on with us or your current
              provider.
            </p>
            <a href="#assessment" className="inline-flex items-center font-medium text-[#F04C97] hover:text-white">
              Jump to what we check
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </a>
          </motion.div>
        </section>

        <motion.section
          id="assessment"
          className={`scroll-mt-28 p-8 md:p-12 ${cardClass}`}
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          data-testid="section-assessment"
        >
          <div className="mb-3 flex items-center gap-3">
            <IconWell icon={ListChecks} size="sm" surface="dark" />
            <h2 className="text-3xl font-bold text-white">What the Cyber Risk Assessment includes</h2>
          </div>
          <p className="mb-8 max-w-3xl text-lg text-white/75">
            A prioritized risk summary — not a sales pitch. You leave knowing what is urgent, what can
            wait, and what evidence you are missing.
          </p>
          <div className="mb-8 grid gap-3 md:grid-cols-2">
            {assessmentIncludes.map((item) => (
              <div key={item} className={`flex items-start gap-3 p-4 ${insetClass}`}>
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" aria-hidden="true" />
                <span className="text-white/90">{item}</span>
              </div>
            ))}
          </div>
          <Button asChild variant="brand" size="lg" className="h-12 px-8 font-semibold" data-testid="button-assessment-module-cta">
            <a href="/book">
              {CTA.primary}
              <ArrowRight className="ml-1 h-4 w-4" />
            </a>
          </Button>
        </motion.section>

        <section data-testid="section-process">
          <div className="mb-8 flex items-center gap-3">
            <IconWell icon={ArrowRight} size="sm" surface="dark" />
            <div>
              <h2 className="text-3xl font-bold text-white">How engagement works</h2>
              <p className="text-sm text-white/55">Three clear steps — not a black box of tickets.</p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {engagementSteps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08, duration: 0.4 }}
                className={`p-5 ${cardClass}`}
              >
                <div className="mb-2 text-xs font-semibold tracking-wide text-[#F04C97]">
                  Step {index + 1}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-white/70">{step.description}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className={`p-8 ${cardClass}`} data-testid="section-fit">
          <h2 className="mb-4 text-3xl font-bold text-white">Engagement fit</h2>
          <p className="mb-4 max-w-3xl leading-relaxed text-white/80">
            Best fit for growing Arizona practices — typically clinics and specialty offices in the
            roughly <span className="font-medium text-white">10–75 employee</span> range — that need
            more than break/fix IT without building hospital-scale infrastructure.
          </p>
          <p className="max-w-3xl leading-relaxed text-white/65">
            We do not list package prices on this page. Final scope and investment are confirmed after
            the assessment based on users, systems, risk profile, and whether you want us to collaborate
            with an existing provider or take full ownership.
          </p>
        </section>

        <section className="max-w-4xl space-y-4" data-testid="section-faq">
          <h2 className="mb-2 text-3xl font-bold text-white">Questions practice owners ask</h2>
          {(narrative?.faqs ?? []).map((faq) => (
            <div key={faq.q} className={`p-5 ${cardClass}`}>
              <h3 className="mb-2 text-lg font-semibold text-white">{faq.q}</h3>
              <p className="leading-relaxed text-white/70">{faq.a}</p>
            </div>
          ))}
        </section>

        <motion.div
          className={`p-8 text-center md:p-12 ${cardClass}`}
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          data-testid="section-final-cta"
        >
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">
            {narrative?.ctaHeadline ?? "Protect patient data with a clear plan"}
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/70 md:text-xl">
            {narrative?.ctaBody ??
              "Schedule a free HIPAA-focused cyber risk assessment for your Arizona practice."}
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild variant="brand" size="lg" className="h-12 px-8 font-semibold" data-testid="button-get-assessment">
              <a href="/book">
                {CTA.primary}
                <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="h-12 border-white/20 px-8 font-semibold text-white hover:bg-white/10"
              data-testid="button-call-now"
            >
              <a href={PRIMARY_PHONE.telHref}>
                <Phone className="mr-1 h-5 w-5" />
                Call {PRIMARY_PHONE.display}
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </PageTemplate>
  );
}
