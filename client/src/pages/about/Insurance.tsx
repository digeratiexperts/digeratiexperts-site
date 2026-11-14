import GenericServicePage from "@/pages/GenericServicePage";

export default function Insurance() {
  return (
    <GenericServicePage
      title="Insurance-Aligned Security & Compliance"
      subtitle="Prepare MFA, backups, awareness, and evidence for cyber insurance reviews with Digerati Experts. Assessment-led - not a coverage guarantee."
      description="Prepare MFA, backups, awareness, and evidence for cyber insurance reviews with Digerati Experts. Assessment-led - not a coverage guarantee."
      canonical="/about/insurance"
      features={[
        { title: "Insurance Control Alignment", description: "Security controls mapped to carrier requirements and underwriting criteria" },
        { title: "Documentation for Claims", description: "Comprehensive incident documentation and forensic evidence for claim support" },
        { title: "Risk Assessment Support", description: "Annual risk assessments aligned to insurance carrier questionnaires" },
        { title: "Incident Response Planning", description: "IR procedures that satisfy carrier notification and response requirements" },
        { title: "Evidence of Controls", description: "Documented proof of security controls for insurance underwriting reviews" },
        { title: "Evidence for questionnaires", description: "Data and reports that support insurer questionnaires" }
      ]}
      benefits={[
        "Evidence for insurer questionnaires",
        "Documentation that supports claim files",
        "Incident response planning aligned to carrier notification expectations",
        "Documented proof of controls for underwriting reviews",
        "Annual risk assessments aligned to insurance questionnaires",
        "Assessment-led preparation - not a coverage guarantee"
      ]}
      gradientColors="from-[#050312] via-[#0a0a0a] to-[#050312]"
    />
  );
}
