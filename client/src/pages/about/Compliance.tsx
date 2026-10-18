import GenericServicePage from "@/pages/GenericServicePage";

export default function Compliance() {
  return (
    <GenericServicePage
      title="Audit-Ready Compliance Documentation"
      subtitle="Enterprise-grade compliance evidence for your business"
      description="Digerati Experts provides comprehensive compliance documentation that helps you pass audits and meet regulatory requirements. Our documented evidence trails, control mapping, and audit packets are ready when you need them."
      canonical="/about/compliance"
      features={[
        { title: "Framework Mapping", description: "Complete mapping of our controls to HIPAA, GDPR, FTC Safeguards, CIS, and SOC 2" },
        { title: "Evidence Retention", description: "Automated collection and archival of training logs, access reviews, baselines, and incident trails" },
        { title: "Audit Packets", description: "Fast-turnaround compliance evidence bundles ready for auditors and insurance carriers" },
        { title: "Monthly Compliance Reports", description: "Executive posture reports showing compliance progress and identified gaps" },
        { title: "Control Documentation", description: "Detailed evidence for each control requirement across all frameworks" },
        { title: "Board-Level Reporting", description: "High-level summaries for board meetings and executive presentations" }
      ]}
      benefits={[
        "Pass audits with confidence and documented evidence",
        "Faster audit cycles with pre-compiled compliance packets",
        "Reduced audit findings and unexpected costs",
        "Better insurance premium justification",
        "Proactive compliance posture, not reactive scrambling",
        "Clear roadmap to compliance certifications"
      ]}
      gradientColors="from-[#050312] via-[#0a0a0a] to-[#050312]"
    />
  );
}
