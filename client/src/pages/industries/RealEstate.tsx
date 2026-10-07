import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  CheckList,
  ClosingCta,
  FactStrip,
  HeroActions,
  HeroFacts,
  IndexedList,
  cardDark,
} from "@/components/site/chapters";
import { ServiceBlocks } from "@/components/site/IndustriesServiceBlocks";
import { CheckCircle, AlertCircle, Shield, Lock, DollarSign, TrendingDown } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

export default function RealEstate() {
  useSEO({
    title: "IT & Cybersecurity for Real Estate",
    description:
      "Protect Arizona brokerages from wire fraud and BEC with managed email security, MFA, and accountable IT support.",
    canonical: "/industries/real-estate",
  });

  const focusAreas = [
    { title: "Wire instruction fraud", text: "Verify-before-send workflows and mailbox protection for closings.", icon: Shield },
    { title: "Business email compromise", text: "MFA, email filtering, and staff awareness for brokerages.", icon: AlertCircle },
    { title: "Transaction data", text: "Access control for contracts, IDs, and shared deal rooms.", icon: Lock },
    { title: "Local accountability", text: "Arizona team you can call when a wire looks wrong.", icon: CheckCircle },
  ];

  const threats = [
    "Fake wire instructions sent via email spoofing",
    "Lost client funds (often non-recoverable)",
    "TRID/RESPA violations from inadequate data security",
    "Reputation damage and regulatory action",
  ];

  const services = [
    {
      icon: DollarSign,
      title: "Wire Fraud Prevention",
      desc: "Multi-layer protection",
      features: ["Email authentication (DMARC/SPF)", "Business email compromise detection", "MFA for all systems", "Out-of-band verification", "Staff training on tactics"],
    },
    {
      icon: Lock,
      title: "Document Security",
      desc: "Transaction protection",
      features: ["End-to-end encrypted sharing", "Closing document protection", "Access controls", "Audit trails for access", "TRID compliance tracking"],
    },
    {
      icon: Shield,
      title: "TRID & RESPA Compliance",
      desc: "Federal requirements",
      features: ["Document retention tracking", "Secure eSignature with audit", "APR calculation docs", "Compliance certifications", "Closing disclosure logging"],
    },
    {
      icon: TrendingDown,
      title: "Ransomware Protection",
      desc: "Closing continuity",
      features: ["Real-time backup", "Immutable backups", "Fast recovery", "Contract-defined RTO/RPO", "Incident response"],
    },
  ];

  const checklist = [
    "Do you verify wire instructions via phone?",
    "Are your email systems protected against spoofing?",
    "Is MFA enabled on all systems?",
    "Do agents know fraud warning signs?",
    "Can you recover from ransomware?",
    "Do you have documented security procedures?",
  ];

  const promises = [
    { title: "Verify before you wire", text: "Out-of-band confirmation for instruction changes — not a claimed $0-loss guarantee." },
    { title: "Mailbox defenses", text: "MFA and email protection sized to how brokerages actually work." },
    {
      title: "Someone to call",
      text: (
        <>
          Arizona team when a closing looks off — <span className="whitespace-nowrap">{PRIMARY_PHONE.display}</span>.
        </>
      ),
    },
  ];

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Real estate · Arizona brokerages"
      title="IT Solutions for Real Estate Professionals"
      subtitle="Prevent wire fraud, protect transaction data, stay compliant—secure IT for Arizona real estate"
      breadcrumbs={[{ label: "Industries", href: "/industries" }, { label: "Real Estate" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book", testId: "button-hero-real-estate" }}
            secondary={{ label: `Call ${PRIMARY_PHONE.display}`, href: PRIMARY_PHONE.telHref }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Closing-day focus"
          rows={[
            { label: "Wires", value: "Verify before you send" },
            { label: "Mailboxes", value: "MFA and email filtering" },
            { label: "Documents", value: "Access control and audit trails" },
            { label: "Support", value: "Arizona team, by phone" },
          ]}
          footnote="Out-of-band confirmation is a process control, not a guarantee against loss."
        />
      }
    >
      <div data-testid="section-focus-areas">
        <FactStrip facts={focusAreas} label="Where we focus for brokerages" />
      </div>

      <Chapter tone="well" seam={false} data-testid="section-wire-fraud">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Active threat"
            title="Real Estate Wire Fraud: Active Threat"
            lede="Criminals impersonate title companies, attorneys, and lenders with sophisticated phishing attacks targeting high-value transactions."
          />
          <IndexedList tone="well" columns={2} items={threats.map((t) => ({ title: t }))} />
        </Container>
      </Chapter>

      <Chapter tone="paper" data-testid="section-services">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="What we run"
            title="Transaction Security Services"
            lede="Controls around the wire, the document, and the closing calendar."
          />
          <ServiceBlocks tone="paper" items={services} />
        </Container>
      </Chapter>

      <Chapter tone="surface" data-testid="section-checklist">
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-4">
              <ChapterHeader
                tone="surface"
                layout="stack"
                eyebrow="Self-check"
                title="Wire Fraud Prevention Checklist"
                lede="If any answer is no, that is where an assessment starts."
                className="mb-0"
              />
            </div>
            <div className={`${cardDark} p-6 md:p-8 lg:col-span-8 lg:self-start`}>
              <CheckList tone="surface" items={checklist} />
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter plate="locations" tone="well" data-testid="section-promises">
        <Container>
          <ChapterHeader tone="well" eyebrow="What to expect" title="Practical, not promised" lede="Three commitments, stated without guarantees we cannot back." />
          <IndexedList tone="well" items={promises} />
        </Container>
      </Chapter>

      <div data-testid="section-final-cta">
        <ClosingCta
          tone="paper"
          title="Protect Your Transactions Today"
          lede="Start with a Cyber Risk Assessment for your brokerage."
          primary={{ label: CTA.primary, href: "/book", testId: "button-schedule-real-estate" }}
          phoneTestId="button-call-real-estate"
        />
      </div>
    </PageTemplate>
  );
}
