import GenericServicePage from "@/pages/GenericServicePage";

export default function Compliance() {
  return (
    <GenericServicePage
      title="Audit-Ready Compliance Documentation"
      subtitle="Enterprise-grade compliance evidence for your business"
      description="Evidence, control mapping and audit packets that support your audits. Framework names describe your requirements, not DE certifications."
      canonical="/about/compliance"
      features={[
        { title: "Framework Mapping", description: "Control mapping of our services to HIPAA, FTC Safeguards, CIS, and SOC 2" },
        { title: "Evidence Retention", description: "Automated collection and archival of training logs, access reviews, baselines, and incident trails" },
        { title: "Audit Packets", description: "Fast-turnaround compliance evidence bundles ready for auditors and insurance carriers" },
        { title: "Monthly Compliance Reports", description: "Executive posture reports showing compliance progress and identified gaps" },
        { title: "Control Documentation", description: "Detailed evidence for each control requirement across all frameworks" },
        { title: "Board-Level Reporting", description: "High-level summaries for board meetings and executive presentations" }
      ]}
      benefits={[
        "Documented evidence trails for your audits",
        "Control mapping and audit packets",
        "Evidence for insurer questionnaires",
        "Monthly posture reports showing progress and identified gaps",
        "Detailed evidence for control requirements across the frameworks you answer to"
      ]}
      gradientColors="from-[#050312] via-[#0a0a0a] to-[#050312]"
    />
  );
}
