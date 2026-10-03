import { PageTemplate } from "@/components/PageTemplate";
import { Shield, Lock, FileCheck, Award, Eye, Server } from "lucide-react";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { EvidenceFrame } from "@/components/evidence/EvidenceFrame";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  CheckList,
  FactStrip,
  FeatureGrid,
  HeroActions,
  Eyebrow,
} from "@/components/site/chapters";

type DefRow = { label: string; value: string };

function DefinitionList({ rows, tone }: { rows: DefRow[]; tone: "well" | "surface" }) {
  return (
    <dl className="border-t border-[var(--de-hairline)]">
      {rows.map((item) => (
        <div key={item.label} className="grid gap-1 border-b border-[var(--de-hairline)] py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
          <dt className={tone === "well" ? "font-semibold text-white" : "font-semibold text-white"}>{item.label}</dt>
          <dd className="leading-relaxed text-white/70">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const infrastructureRows: DefRow[] = [
  { label: "Data Centers", value: "Tier III/IV facilities with physical security, redundant power, climate control" },
  { label: "Network Security", value: "Next-generation firewalls, DDoS protection, network segmentation" },
  { label: "Access Controls", value: "Role-based access control (RBAC), principle of least privilege" },
  { label: "Monitoring", value: "Real-time security information and event management (SIEM)" },
  { label: "Backups", value: "Encrypted, geographically distributed, tested regularly" },
];

const privacyRows: DefRow[] = [
  { label: "Privacy Policy", value: "Comprehensive privacy practices aligned with Arizona data breach laws" },
  { label: "Data Minimization", value: "We collect only data necessary for service delivery" },
  { label: "Data Retention", value: "Clear retention schedules and secure deletion procedures" },
  { label: "Client Rights", value: "Access, correction, deletion, and portability rights" },
  { label: "No Data Selling", value: "We never sell client data to third parties" },
];

export default function TrustCenter() {
  useSEO({
    title: "Trust Center",
    description:
      "Digerati Experts Trust Center: security practices, compliance support, and how to request questionnaires. Framework names describe customer requirements — not Digerati certifications.",
    canonical: "/trust/trust-center",
  });

  const complianceSupport = [
    { icon: FileCheck, title: "HIPAA-aligned security and compliance support", desc: "Business Associate Agreements available for healthcare clients. Framework alignment — not a HIPAA certification." },
    { icon: Award, title: "SOC 2 readiness and control alignment", desc: "Control mapping, evidence support, and readiness work for customer SOC 2 programs. Digerati Experts is not SOC 2 Type II certified." },
    { icon: Lock, title: "Cyber insurance readiness", desc: "Controls and documentation insurers commonly request during underwriting and renewals." },
    { icon: Shield, title: "Security and compliance reporting", desc: "Questionnaires, control evidence, and reporting support for vendor reviews and audits." },
  ];

  const technicalControls = [
    "AES-256 encryption at rest",
    "TLS 1.3 encryption in transit",
    "Multi-factor authentication (MFA)",
    "24/7 Security Operations Center",
    "Intrusion detection/prevention",
    "Regular vulnerability scanning"
  ];

  const adminControls = [
    "Background checks for all staff",
    "Security awareness training",
    "Incident response procedures",
    "Annual penetration testing",
    "Third-party security audits",
    "NIST Cybersecurity Framework alignment"
  ];

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="Trust"
      title="Trust Center"
      subtitle="Security, Compliance, and Privacy Information"
      breadcrumbs={[{ label: "Trust", href: "/trust/trust-center" }, { label: "Trust Center" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: "Request Documentation", href: "mailto:security@digeratiexperts.com?subject=Security Documentation Request" }}
            secondary={{ label: "Vulnerability disclosure", href: "/trust/vulnerability-disclosure" }}
          />
        </div>
      }
    >
      <FactStrip
        label="Trust at a glance"
        facts={[
          { icon: Shield, title: "NIST CSF", text: "Security Framework Alignment" },
          { icon: FileCheck, title: "BAA", text: "HIPAA Compliance Support" },
          { icon: Award, title: "SOC 2", text: "Readiness & Audit Evidence" },
          { icon: Lock, title: "ARIZONA", text: "Local Direct Engineering" },
        ]}
      />

      <Chapter tone="well" seam={false}>
        <Container>
          <p className="mb-14 max-w-3xl text-xl leading-relaxed text-white/80 md:text-2xl">
            Digerati Experts is committed to maintaining high standards of security, compliance, and privacy. Our Trust
            Center provides transparency into our security practices and the frameworks we help customers address.
          </p>
          <ChapterHeader
            tone="well"
            eyebrow="Compliance support"
            title="Security & Compliance Support"
            lede="These names describe frameworks and customer requirements Digerati Experts helps organizations address. They are not certifications DE holds."
          />
          <FeatureGrid
            tone="well"
            columns={2}
            items={complianceSupport.map((c) => ({ icon: c.icon, title: c.title, text: c.desc }))}
          />

          {/* Honest transparent hook — verified attestation reporting */}
          <div className="mt-12">
            <EvidenceFrame
              classification="SANITIZED_REAL"
              title="Verified Certifications & Attestations Disclosure"
              subtitle="Direct transparency on corporate attestations versus customer security framework support."
              status="informational"
              statusLabel="TRANSPARENT DISCLOSURE"
              sourceNote="Digerati Experts Corporate Governance & Legal Compliance Spec"
              variant="dark"
            >
              <div className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-4 font-mono text-xs leading-relaxed text-white/80">
                <p className="text-white/70">
                  No independent SOC 2 Type II report or HIPAA certification is published here. Framework names describe client environments Digerati Experts secures, manages, and supports during third-party audits.
                </p>
                <p className="pt-1 font-semibold text-emerald-400">
                  ✓ Business Associate Agreements (BAAs) provided for covered healthcare entities.
                </p>
              </div>
            </EvidenceFrame>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="paper">
        <Container>
          <ChapterHeader tone="paper" eyebrow="Controls" title="Our Security Practices" />
          <div className="grid gap-12 md:grid-cols-2 md:gap-14">
            <div>
              <h3 className="mb-5 flex items-center gap-2 border-b border-[var(--de-paper-hairline)] pb-4 font-heading text-xl font-semibold text-[#1A1228]">
                <Shield className="h-5 w-5 text-de-magenta-paper-ink" aria-hidden="true" />
                Technical Controls
              </h3>
              <CheckList tone="paper" columns={1} items={technicalControls} />
            </div>
            <div>
              <h3 className="mb-5 flex items-center gap-2 border-b border-[var(--de-paper-hairline)] pb-4 font-heading text-xl font-semibold text-[#1A1228]">
                <FileCheck className="h-5 w-5 text-de-magenta-paper-ink" aria-hidden="true" />
                Administrative Controls
              </h3>
              <CheckList tone="paper" columns={1} items={adminControls} />
            </div>
          </div>
        </Container>
      </Chapter>

      <Chapter tone="surface">
        <Container>
          <div className="grid gap-14 lg:grid-cols-2">
            <div>
              <Eyebrow tone="surface" className="mb-4">Platform</Eyebrow>
              <h2 className="mb-6 flex items-center gap-3 font-heading text-2xl font-semibold text-white md:text-3xl">
                <Server className="h-6 w-6 text-de-magenta-ink" aria-hidden="true" />
                Infrastructure Security
              </h2>
              <DefinitionList rows={infrastructureRows} tone="surface" />
            </div>
            <div>
              <Eyebrow tone="surface" className="mb-4">Data</Eyebrow>
              <h2 className="mb-6 flex items-center gap-3 font-heading text-2xl font-semibold text-white md:text-3xl">
                <Eye className="h-6 w-6 text-de-magenta-ink" aria-hidden="true" />
                Privacy & Data Protection
              </h2>
              <DefinitionList rows={privacyRows} tone="surface" />
            </div>
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        tone="well"
        eyebrow="Documentation"
        title="Need Security Documentation?"
        lede="Request security questionnaires or framework-alignment documentation for vendor onboarding."
        showPhone={false}
        primary={{
          label: "Request Documentation",
          href: "mailto:security@digeratiexperts.com?subject=Security Documentation Request",
          testId: "button-request-docs",
        }}
        secondary={{ label: `Call ${PRIMARY_PHONE.display}`, href: PRIMARY_PHONE.telHref, testId: "button-call-trust" }}
      />
    </PageTemplate>
  );
}
