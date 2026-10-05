import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  FactStrip,
  HeroActions,
  HeroFacts,
  IndexedList,
} from "@/components/site/chapters";
import { ServiceBlocks } from "@/components/site/IndustriesServiceBlocks";
import { Shield, Lock, FileText, DollarSign, Activity } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

export default function Accounting() {
  useSEO({
    title: "IT & Cybersecurity for Accounting Firms",
    description:
      "Managed IT and security for Arizona accounting and finance firms — stop BEC, protect tax season systems, and meet cyber-insurance expectations.",
    canonical: "/industries/accounting-finance",
  });

  const capabilities = [
    { title: "Tax-season systems", text: "Identity, email, and backup owned through busy season", icon: Activity },
    { title: "Client data", text: "Access control and encryption for workpapers and portals", icon: Lock },
    { title: "Insurance reviews", text: "Evidence and control mapping carriers typically ask for", icon: FileText },
    { title: "BEC / wire fraud", text: "MFA, email protection, and verification workflows", icon: Shield },
  ];

  const riskProfile = [
    "PCI DSS compliance required for credit card processing",
    "IRS data security requirements (NIST compliance)",
    "Client confidentiality and privilege concerns",
    "Wire fraud and business email compromise targeting financial transfers",
  ];

  const services = [
    {
      icon: Lock,
      title: "PCI DSS Compliance",
      desc: "Full PCI DSS compliance framework",
      features: ["Secure payment gateways", "Tokenization & encryption", "Quarterly security assessments", "Audit-grade documentation"],
    },
    {
      icon: FileText,
      title: "Tax Data Protection",
      desc: "IRS and NIST compliance",
      features: ["NIST framework alignment", "Encryption for tax returns", "Secure document retention", "Access controls & audit logging"],
    },
    {
      icon: DollarSign,
      title: "Wire Fraud Prevention",
      desc: "Multi-layer transfer security",
      features: ["Email authentication (DMARC)", "Business email compromise detection", "MFA enforcement", "Wire instruction verification"],
    },
    {
      icon: Shield,
      title: "Backup & Disaster Recovery",
      desc: "Zero downtime during tax season",
      features: ["Real-time cloud backup", "Monthly restore testing", "DR runbooks", "Ransomware recovery"],
    },
  ];

  const support = [
    { title: "HIPAA-aligned support", text: "Security and compliance support for practices handling PHI" },
    { title: "SOC 2 readiness", text: "Control mapping and evidence — not a DE certification" },
    { title: "Cyber insurance readiness", text: "Documentation carriers typically request in underwriting" },
    { title: "Security reporting", text: "Repeatable evidence for audits and client questionnaires" },
  ];

  const honest = [
    { title: "Audit readiness", text: "Control mapping and evidence for reviews — not a claim that findings disappear." },
    { title: "Insurance questions", text: "Documentation carriers typically request. Premium outcomes vary by underwriter." },
    { title: "Repeatable reporting", text: "Security and compliance reporting as an operating practice, not a one-time binder." },
  ];

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Accounting & finance · Arizona CPAs"
      title="IT Solutions for Accounting & Finance"
      subtitle="PCI DSS-aligned security and financial data protection for Arizona CPAs and accounting firms"
      breadcrumbs={[{ label: "Industries", href: "/industries" }, { label: "Accounting & Finance" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book", testId: "button-hero-accounting" }}
            secondary={{ label: `Call ${PRIMARY_PHONE.display}`, href: PRIMARY_PHONE.telHref }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Requirements we help you meet"
          rows={[
            { label: "Card data", value: "PCI DSS" },
            { label: "Tax data", value: "IRS / NIST alignment" },
            { label: "Assurance", value: "SOC 2 readiness" },
            { label: "Fraud", value: "BEC and wire verification" },
          ]}
          footnote="Framework names describe customer requirements we help organizations address — not certifications DE holds."
        />
      }
    >
      <div data-testid="section-capabilities">
        <FactStrip facts={capabilities} label="What we own for accounting firms" />
      </div>

      <Chapter tone="well" seam={false} data-testid="section-risk-profile">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Risk profile"
            title="Financial Services Risk Profile"
            lede="Accounting firms need IT partners who understand compliance, deadline pressure, and the reality of financial data handling."
          />
          <IndexedList tone="well" columns={2} items={riskProfile.map((t) => ({ title: t }))} />
        </Container>
      </Chapter>

      <Chapter tone="paper" data-testid="section-services">
        <Container>
          <ChapterHeader
            tone="paper"
            eyebrow="Why firms choose us"
            title="Why Accounting Firms Choose Digerati Experts"
            lede="Four programs, one accountable operator, tuned to deadline pressure and the way financial data actually moves."
          />
          <ServiceBlocks tone="paper" items={services} />
        </Container>
      </Chapter>

      <Chapter tone="surface" data-testid="section-support">
        <Container>
          <ChapterHeader
            tone="surface"
            eyebrow="Compliance"
            title="Security & Compliance Support"
            lede="Framework names describe customer requirements we help organizations address — not certifications DE holds."
          />
          <IndexedList tone="surface" columns={2} items={support} />
        </Container>
      </Chapter>

      <Chapter plate="ring" tone="well" data-testid="section-expectations">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="What to expect"
            title="Evidence, not promises"
            lede="What the work produces, and what we will not claim."
          />
          <IndexedList tone="well" items={honest} />
        </Container>
      </Chapter>

      <div data-testid="section-final-cta">
        <ClosingCta
          tone="paper"
          title="Ready to Protect Your Firm?"
          lede="Start with a Cyber Risk Assessment from Arizona MSP experts."
          primary={{ label: CTA.primary, href: "/book", testId: "button-schedule-accounting" }}
          phoneTestId="button-call-accounting"
        />
      </div>
    </PageTemplate>
  );
}
