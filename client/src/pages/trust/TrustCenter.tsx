import { PageTemplate } from "@/components/PageTemplate";
import { Shield, Lock, FileCheck, Award, Eye, Server, CheckCircle, Mail, Phone, Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useSEO } from "@/hooks/useSEO";
import { Button } from "@/components/ui/button";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { ProofChip } from "@/components/evidence/ProofChip";
import { EvidenceFrame } from "@/components/evidence/EvidenceFrame";
import { HUDFrame } from "@/components/evidence/HUDFrame";
import { StatusToken } from "@/components/evidence/StatusToken";

const cardClass = "de-hud-card p-6 transition-all duration-200 hover:border-[#D3126A]/40";

export default function TrustCenter() {
  const prefersReducedMotion = useReducedMotion() ?? false;

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
      title="Trust Center"
      subtitle="Security, Compliance, and Privacy Information"
      icon={<Shield className="w-10 h-10" />}
      breadcrumbs={[{ label: "Trust", href: "/trust/trust-center" }, { label: "Trust Center" }]}
    >
      <div className="space-y-16">
        {/* Contextual Sourced Proof Chips */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <ProofChip metric="NIST CSF" label="Security Framework Alignment" icon={Shield} />
          <ProofChip metric="BAA" label="HIPAA Compliance Support" icon={FileCheck} />
          <ProofChip metric="SOC 2" label="Readiness & Audit Evidence" icon={Award} />
          <ProofChip metric="ARIZONA" label="Local Direct Engineering" icon={Lock} />
        </div>

        {/* Intro */}
        <motion.p 
          className="text-xl text-gray-300 text-center max-w-3xl mx-auto leading-relaxed"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Digerati Experts is committed to maintaining high standards of security, compliance, 
          and privacy. Our Trust Center provides transparency into our security practices and the frameworks we help customers address.
        </motion.p>

        {/* Security & Compliance Support — capability language, not company certifications */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Security & Compliance Support</h2>
          <p className="text-gray-400 text-center max-w-2xl mx-auto mb-8">
            These names describe frameworks and customer requirements Digerati Experts helps organizations address. They are not certifications DE holds.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {complianceSupport.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.title}
                  initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                >
                  <div className={`de-interactive-card relative h-full overflow-hidden p-6 ${cardClass}`}>
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-de-hairline bg-de-bg">
                      <Icon className="h-7 w-7 text-de-accent-ink" />
                    </div>
                    <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                    <p className="mt-3 leading-relaxed text-white/65">{item.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Honest transparent hook — verified attestation reporting */}
        <EvidenceFrame
          classification="SANITIZED_REAL"
          title="Verified Certifications & Attestations Disclosure"
          subtitle="Direct transparency on corporate attestations versus customer security framework support."
          status="informational"
          statusLabel="TRANSPARENT DISCLOSURE"
          sourceNote="Digerati Experts Corporate Governance & Legal Compliance Spec"
          variant="dark"
        >
          <div className="rounded-lg border border-white/10 bg-black/40 p-4 font-mono text-xs text-white/80 leading-relaxed space-y-2">
            <p className="text-white/70">
              No independent SOC 2 Type II report or HIPAA certification is published here. Framework names describe client environments Digerati Experts secures, manages, and supports during third-party audits.
            </p>
            <p className="text-emerald-400 font-semibold pt-1">
              ✓ Business Associate Agreements (BAAs) provided for covered healthcare entities.
            </p>
          </div>
        </EvidenceFrame>

        {/* Security Practices */}
        <motion.div 
          className={`relative overflow-hidden p-8 md:p-12 ${cardClass}`}
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-lg bg-de-raised border border-de-hairline flex items-center justify-center">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white">Our Security Practices</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-de-magenta-ink" />
                  Technical Controls
                </h3>
                <div className="space-y-3">
                  {technicalControls.map((control, idx) => (
                    <motion.div 
                      key={idx}
                      className="flex items-center gap-3 rounded-lg border border-de-hairline bg-de-bg p-3"
                      initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                    >
                      <CheckCircle className="w-5 h-5 text-de-accent-ink flex-shrink-0" />
                      <span className="text-gray-300">{control}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-de-magenta-ink" />
                  Administrative Controls
                </h3>
                <div className="space-y-3">
                  {adminControls.map((control, idx) => (
                    <motion.div 
                      key={idx}
                      className="flex items-center gap-3 rounded-lg border border-de-hairline bg-de-bg p-3"
                      initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                    >
                      <CheckCircle className="w-5 h-5 text-de-accent-ink flex-shrink-0" />
                      <span className="text-gray-300">{control}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Infrastructure Security */}
        <motion.div 
          className="rounded-xl border border-de-hairline border-l-4 border-l-[#D3126A] bg-de-raised p-8"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-de-raised border border-de-hairline flex items-center justify-center">
              <Server className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Infrastructure Security</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: "Data Centers", value: "Tier III/IV facilities with physical security, redundant power, climate control" },
              { label: "Network Security", value: "Next-generation firewalls, DDoS protection, network segmentation" },
              { label: "Access Controls", value: "Role-based access control (RBAC), principle of least privilege" },
              { label: "Monitoring", value: "Real-time security information and event management (SIEM)" },
              { label: "Backups", value: "Encrypted, geographically distributed, tested regularly" }
            ].map((item, idx) => (
              <div key={idx} className="rounded-lg border border-de-hairline bg-de-bg p-4">
                <span className="font-semibold text-white">{item.label}:</span>{" "}
                <span className="text-gray-300">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Privacy & Data Protection */}
        <motion.div 
          className="rounded-xl border border-de-hairline border-l-4 border-l-[#D3126A] bg-de-raised p-8"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-de-raised border border-de-hairline flex items-center justify-center">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white">Privacy & Data Protection</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: "Privacy Policy", value: "Comprehensive privacy practices aligned with Arizona data breach laws" },
              { label: "Data Minimization", value: "We collect only data necessary for service delivery" },
              { label: "Data Retention", value: "Clear retention schedules and secure deletion procedures" },
              { label: "Client Rights", value: "Access, correction, deletion, and portability rights" },
              { label: "No Data Selling", value: "We never sell client data to third parties" }
            ].map((item, idx) => (
              <div key={idx} className="rounded-lg border border-de-hairline bg-de-bg p-4">
                <span className="font-semibold text-white">{item.label}:</span>{" "}
                <span className="text-gray-300">{item.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="rounded-2xl border border-[#D3126A]/40 bg-[#D3126A] px-8 py-10 text-center md:px-12 md:py-12"
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="mb-4 text-3xl font-bold text-white md:text-4xl">Need Security Documentation?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white md:text-xl">
            Request security questionnaires or framework-alignment documentation for vendor onboarding.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="h-12 bg-white px-8 font-semibold text-[#D3126A] hover:bg-white/95">
              <a href="mailto:security@digeratiexperts.com?subject=Security Documentation Request" data-testid="button-request-docs">
                <Mail className="mr-2 h-5 w-5" />
                Request Documentation
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/70 bg-transparent px-8 font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <a href={PRIMARY_PHONE.telHref} data-testid="button-call-trust">
                <Phone className="mr-2 h-5 w-5" />
                Call {PRIMARY_PHONE.display}
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </PageTemplate>
  );
}
