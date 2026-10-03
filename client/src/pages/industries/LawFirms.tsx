import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  CheckList,
  FactStrip,
  FaqChapter,
  HeroActions,
  HeroFacts,
  IndexedList,
  StepRail,
  cardDark,
} from "@/components/site/chapters";
import { ServiceBlocks } from "@/components/site/IndustriesServiceBlocks";
import { Lock, Eye, Briefcase, AlertCircle, Scale, Shield } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

export default function LawFirms() {
  useSEO({
    title: "IT & Cybersecurity for Law Firms",
    description:
      "Secure IT for Arizona law firms — protect client privilege, stop ransomware and wire fraud, and stay aligned with ABA cybersecurity expectations.",
    canonical: "/industries/law-firms",
  });

  const riskFactors = [
    { title: "Privilege Breach", text: "Severity: Critical", icon: Eye },
    { title: "Ransomware", text: "Severity: High", icon: Shield },
    { title: "Wire Fraud", text: "Severity: High", icon: AlertCircle },
    { title: "ABA Non-Compliance", text: "Severity: Critical", icon: Scale },
  ];

  const complianceRisks = [
    "Attorney-client privilege breach = malpractice liability + regulatory action",
    "Ransomware targeting law firms for case files and settlement amounts",
    "Wire transfer fraud targeting client trust accounts",
    "ABA Cybersecurity Requirements (2024) for data security and incident response",
  ];

  const services = [
    {
      icon: Lock,
      title: "Privilege & Encryption",
      desc: "Attorney-client protection",
      features: ["End-to-end encrypted email", "Secure file sharing", "Case file encryption", "Access audit trails"],
    },
    {
      icon: Eye,
      title: "Trust Account Security",
      desc: "Wire fraud prevention",
      features: ["Multi-factor authentication", "Email authentication (DMARC)", "Dual approval workflows", "Out-of-band verification"],
    },
    {
      icon: Briefcase,
      title: "ABA Compliance Framework",
      desc: "2024 ABA Requirements",
      features: ["Incident response plan", "Client data documentation", "Security training", "Annual assessments"],
    },
    {
      icon: Scale,
      title: "Backup & Recovery",
      desc: "Case continuity",
      features: ["Real-time backup", "Ransomware recovery", "Restore testing", "Contract-defined RTO/RPO"],
    },
  ];

  const abaChecklist = [
    "Cybersecurity incident response plan",
    "Client data protection documentation",
    "Regular security training for staff",
    "Annual cybersecurity assessments",
    "Vendor risk management",
    "Encryption for sensitive documents",
  ];

  const steps = [
    { title: "Map the exposure", text: "Map identity, email, DMS/cloud file exposure, and remote access" },
    { title: "Harden the basics", text: "Harden MFA, phishing controls, and privilege-aware access" },
    { title: "One operator", text: "Put monitoring and backup restore testing under one operator" },
    { title: "Show the evidence", text: "Support ABA-oriented checklists and insurer questionnaires with evidence" },
  ];

  const faqs = [
    {
      question: "Will this disrupt billable work?",
      answer:
        "We design around partner workflows — remote-first support, change windows that respect court calendars, and onboarding that doesn’t strand new associates.",
    },
    {
      question: "Do you understand client confidentiality?",
      answer:
        "Yes. Access design, encryption, and incident handling assume privilege and ethical walls — not a generic SMB template pasted onto a firm.",
    },
  ];

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Law firms · Arizona attorneys"
      title="IT Solutions for Law Firms"
      subtitle="Protect client privilege, prevent data breaches, stay compliant—secure IT for Arizona attorneys"
      breadcrumbs={[{ label: "Industries", href: "/industries" }, { label: "Law Firms" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book", testId: "button-hero-law" }}
            secondary={{ label: `Call ${PRIMARY_PHONE.display}`, href: PRIMARY_PHONE.telHref }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Law-firm program"
          rows={[
            { label: "Privilege", value: "Encryption and access audit trails" },
            { label: "Trust accounts", value: "Wire-fraud controls and dual approval" },
            { label: "ABA", value: "2024 requirements, checklist-driven" },
            { label: "Continuity", value: "Restore-tested backup and recovery" },
          ]}
          footnote="Summarized from the services below. Final scope is set after a cyber risk assessment."
        />
      }
    >
      <div data-testid="section-risk-assessment">
        <FactStrip facts={riskFactors} label="Security risk assessment" />
      </div>

      <Chapter tone="well" seam={false} data-testid="section-compliance-risks">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Security risk assessment"
            title="Critical Compliance Risks"
            lede="Four exposures decide whether a firm keeps client trust: privilege, ransomware, trust-account wires, and ABA expectations."
          />
          <IndexedList tone="well" columns={2} items={complianceRisks.map((t) => ({ title: t }))} />
        </Container>
      </Chapter>

      <Chapter tone="paper" data-testid="section-services">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="What we run"
            title="Legal-Focused Security Services"
            lede="Controls built around privilege, trust accounts, and case continuity — not a generic small-business template."
          />
          <ServiceBlocks tone="paper" items={services} />
        </Container>
      </Chapter>

      <Chapter tone="well" data-testid="section-aba-checklist">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <ChapterHeader
                tone="well"
                layout="stack"
                eyebrow="Checklist"
                title="ABA Compliance Checklist"
                lede="The six items we help firms document and keep current."
                className="mb-0"
              />
            </div>
            <div className={`${cardDark} p-6 md:p-8 lg:col-span-8 lg:self-start`}>
              <CheckList tone="well" items={abaChecklist} />
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="surface" data-testid="section-engagement">
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="Arizona law firms"
            title="How engagement works"
            lede="Privilege, client files, and wire instructions are the attack surface. We work with East Valley and Greater Phoenix firms that need security without slowing partners who live in email and document review."
          />
          <StepRail tone="surface" steps={steps} />
        </Container>
      </Chapter>

      <div data-testid="section-faq">
        <FaqChapter faqs={faqs} title="Questions managing partners ask" />
      </div>

      <div data-testid="section-final-cta">
        <ClosingCta
          title="Protect privilege with a clear security plan"
          lede="Schedule a cyber risk assessment focused on law-firm email, access, and client data."
          primary={{ label: CTA.primary, href: "/book", testId: "button-schedule-law" }}
          phoneTestId="button-call-law"
        />
      </div>
    </PageTemplate>
  );
}
