import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  CheckList,
  FactStrip,
  FaqChapter,
  FeatureGrid,
  HeroActions,
  HeroFacts,
  IndexedList,
  StepRail,
  buttonPrimary,
  cardDark,
  cardPaper,
  textLinkClass,
} from "@/components/site/chapters";
import { Shield, Lock, FileCheck, ArrowRight, Users, ClipboardList, MapPin } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { pageNarratives } from "@/pages/routes/pageNarratives";
import { CTA } from "@/lib/ctaCopy";

const narrative = pageNarratives.healthcare;

export default function Healthcare() {
  useSEO({
    title: "Healthcare IT & HIPAA Security | Arizona Practices",
    description:
      "Keep patient data protected without becoming a HIPAA expert. Arizona-based IT, cybersecurity, and compliance support for medical and dental practices — start with a free risk assessment.",
    canonical: "/industries/healthcare",
  });

  const trustStrip = [
    { title: "Arizona-based", text: "Chandler / East Valley operator", icon: MapPin },
    { title: "HIPAA-focused security", text: "Safeguards run day to day, not filed", icon: Shield },
    { title: "Real human support", text: "Engineers who know your practice", icon: Users },
    { title: "Assessment-led", text: "Recommendations before tools", icon: ClipboardList },
  ];

  const painQuestions = [
    "Could ransomware lock scheduling, imaging, or billing mid-day?",
    "Who can actually reach PHI across EHR, email, and shared drives?",
    "Are former employees and vendors fully removed from every system?",
    "Have backups been restore-tested — or only assumed to work?",
    "Can you answer cyber-insurance questionnaires with evidence?",
    "Is your current IT doing security — or only tickets and resets?",
  ];

  const commonProblems = [
    {
      icon: Shield,
      title: "HIPAA as a binder, not an operating model",
      text: "Policies exist, but access reviews, offboarding, and technical safeguards are inconsistent day to day.",
    },
    {
      icon: Lock,
      title: "Patient data scattered across tools",
      text: "PHI and clinical workflows span EHR, email, imaging, billing, and personal devices with uneven controls.",
    },
    {
      icon: FileCheck,
      title: "Audit and insurance evidence gaps",
      text: "When questionnaires or auditors ask for proof, the practice scrambles instead of pulling a known packet.",
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
      tag: "Pillar 1",
      text: "Identity, endpoints, email, and day-to-day support that keep the practice running.",
    },
    {
      title: "Cybersecurity",
      tag: "Pillar 2",
      text: "MFA, monitoring posture, phishing resistance, and incident-ready response paths.",
    },
    {
      title: "Compliance evidence",
      tag: "Pillar 3",
      text: "BAAs where appropriate, documentation, and audit/insurance packet support — not theater.",
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

  const engagementSteps = (narrative?.process ?? []).map((s) => ({ title: s.title, text: s.description }));
  const faqs = (narrative?.faqs ?? []).map((f) => ({ question: f.q, answer: f.a }));

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Healthcare IT · Arizona practices"
      title="Keep Patient Data Protected Without Becoming a HIPAA Expert"
      subtitle="Digerati Experts manages security, backups, access controls, documentation, and ongoing IT behind Arizona practices so owners can focus on patients."
      breadcrumbs={[{ label: "Industries", href: "/industries" }, { label: "Healthcare" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book", testId: "button-hero-assessment" }}
            secondary={{ label: "See What We Check", href: "#assessment", testId: "button-hero-see-checks" }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Program focus"
          rows={[
            { label: "Framework", value: "HIPAA-aware operations" },
            { label: "Encryption", value: "AES-256 where applicable" },
            { label: "Priority", value: "PHI access and audit trails" },
            { label: "Outcome", value: "Audit- and insurer-ready evidence" },
          ]}
          footnote="No vendor certifies a practice as HIPAA compliant. We run the safeguards and keep the evidence."
        />
      }
    >
      <div data-testid="section-trust-strip">
        <FactStrip facts={trustStrip} label="Why practices choose Digerati Experts" />
      </div>

      <Chapter tone="well" seam={false} data-testid="section-pain">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Exposure check"
            title={
              <>
                Is your practice exposed<span className="text-de-accent-ink" aria-hidden="true">:</span>
              </>
            }
            lede="Healthcare practices are high-value targets because downtime hits patients and PHI creates regulatory and trust risk. These are the questions owners usually postpone until after something breaks."
          />
          <IndexedList tone="well" items={painQuestions.map((q) => ({ title: q }))} />
        </Container>
      </Chapter>

      <Chapter tone="paper" data-testid="section-common-problems">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="What we see"
            title="Common healthcare IT & security problems"
            lede="Not a shortage of tools — a shortage of ownership, evidence, and follow-through."
          />
          <FeatureGrid tone="paper" items={commonProblems} />

          <div className="mt-14 grid gap-8 border-t border-[var(--de-paper-hairline)] pt-10 lg:grid-cols-12 lg:gap-14" data-testid="section-consequences">
            <div className="lg:col-span-4">
              <h2 className="font-heading text-2xl font-semibold leading-tight text-[#1A1228] md:text-3xl">
                What exposure costs a practice
              </h2>
              <p className="mt-3 text-base leading-relaxed text-[#3A3448]">
                Operational and financial pressure — without invented statistics.
              </p>
            </div>
            <div className="lg:col-span-8">
              <CheckList tone="paper" items={consequences} />
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="surface" data-testid="section-how-we-solve">
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="How we solve it"
            title="How Digerati Experts solves them"
            lede="IT, cybersecurity, and compliance as one operating program — so security is not bolted onto break/fix support after the fact."
          />
          <FeatureGrid tone="surface" items={howWeSolve} />

          <div className="mt-14 grid gap-8 border-t border-[var(--de-hairline)] pt-10 lg:grid-cols-12 lg:gap-14" data-testid="section-differentiation">
            <h2 className="font-heading text-2xl font-semibold leading-tight text-white md:text-3xl lg:col-span-4">
              Why Digerati Experts instead of ordinary IT support
            </h2>
            <div className="lg:col-span-8">
              <CheckList tone="surface" items={differentiation} columns={1} />
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="well" data-testid="section-security-stack">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <ChapterHeader
                tone="well"
                layout="stack"
                eyebrow="Controls"
                title="Healthcare security stack & outcomes"
                lede="Technical and administrative controls that support HIPAA-aware operations. These are the building blocks behind the program — not the headline promise."
                className="mb-0"
              />
            </div>
            <div className={`${cardDark} p-6 md:p-8 lg:col-span-8`}>
              <CheckList tone="well" items={securityStack} />
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="paper" data-testid="section-proof">
        <Container>
          <div className="grid gap-5 md:grid-cols-2">
            <div className={`${cardPaper} p-7 md:p-8`}>
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-de-magenta-paper-ink">
                Arizona practices
              </p>
              <p className="text-lg leading-relaxed text-[#1A1228]">
                {narrative?.arizonaNote ??
                  "East Valley clinics, dental offices, and specialty practices need HIPAA-aware IT without a hospital-sized IT department."}
              </p>
            </div>
            <div className={`${cardPaper} border-[#D3126A]/35 p-7 md:p-8`}>
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-de-magenta-paper-ink">
                What proof looks like today
              </p>
              <p className="leading-relaxed text-[#3A3448]">
                We do not publish named healthcare testimonials here yet. Instead of inventing quotes or
                outcome percentages, we show you the assessment deliverable: a clear prioritized risk
                summary, control gaps, and recommended next steps you can act on with us or your current
                provider.
              </p>
              <a href="#assessment" className={`${textLinkClass("paper")} mt-3`}>
                Jump to what we check
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="surface" id="assessment" className="scroll-mt-28" data-testid="section-assessment">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <ChapterHeader
                tone="surface"
                layout="stack"
                eyebrow="The assessment"
                title="What the Cyber Risk Assessment includes"
                lede="A prioritized risk summary — not a sales pitch. You leave knowing what is urgent, what can wait, and what evidence you are missing."
                className="mb-8"
              />
              <a href="/book" className={buttonPrimary("surface")} data-testid="button-assessment-module-cta">
                {CTA.primary}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
            <div className="lg:col-span-7">
              <IndexedList tone="surface" columns={2} items={assessmentIncludes.map((t) => ({ title: t }))} />
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="well" data-testid="section-process">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Engagement"
            title="How engagement works"
            lede="Three clear steps — not a black box of tickets."
          />
          <StepRail tone="well" steps={engagementSteps} />

          <div className={`${cardDark} mt-14 p-7 md:p-9`} data-testid="section-fit">
            <div className="grid gap-6 lg:grid-cols-12 lg:gap-14">
              <h2 className="font-heading text-2xl font-semibold text-white md:text-3xl lg:col-span-4">Engagement fit</h2>
              <div className="space-y-4 lg:col-span-8">
                <p className="leading-relaxed text-white/80">
                  Best fit for growing Arizona practices — typically clinics and specialty offices in the
                  roughly <span className="font-medium text-white">10–75 employee</span> range — that need
                  more than break/fix IT without building hospital-scale infrastructure.
                </p>
                <p className="leading-relaxed text-white/65">
                  We do not list package prices on this page. Final scope and investment are confirmed after
                  the assessment based on users, systems, risk profile, and whether you want us to collaborate
                  with an existing provider or take full ownership.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </Chapter>

      {faqs.length > 0 && (
        <div data-testid="section-faq">
          <FaqChapter faqs={faqs} title="Questions practice owners ask" />
        </div>
      )}

      <div data-testid="section-final-cta">
        <ClosingCta
          title={narrative?.ctaHeadline ?? "Protect patient data with a clear plan"}
          lede={
            narrative?.ctaBody ?? "Schedule a free HIPAA-focused cyber risk assessment for your Arizona practice."
          }
          primary={{ label: CTA.primary, href: "/book", testId: "button-get-assessment" }}
        />
      </div>
    </PageTemplate>
  );
}
