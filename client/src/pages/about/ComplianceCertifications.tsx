import { Shield, CheckCircle2, FileCheck, Building2, Heart, CreditCard, Lock, Award, ArrowRight, Clock, Users, FileText } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PageTemplate } from "@/components/PageTemplate";
import { useSEO } from "@/hooks/useSEO";
import { motion } from "framer-motion";
import { CTA } from "@/lib/ctaCopy";

const complianceFrameworks = [
  {
    id: "hipaa",
    name: "HIPAA",
    fullName: "Health Insurance Portability and Accountability Act",
    icon: Heart,
    color: " ",
    description: "Comprehensive protection for healthcare organizations handling Protected Health Information (PHI).",
    industries: ["Healthcare Providers", "Medical Practices", "Dental Offices", "Mental Health", "Home Health", "Pharmacies"],
    keyRequirements: [
      "Administrative Safeguards - Workforce training, access management, contingency planning",
      "Physical Safeguards - Facility access controls, workstation security, device controls",
      "Technical Safeguards - Access controls, audit controls, encryption, integrity controls",
      "Breach Notification - Incident response and notification procedures"
    ],
    ourCapabilities: [
      "HIPAA Security Risk Assessments",
      "Business Associate Agreements (BAAs)",
      "PHI encryption at rest and in transit",
      "Access logging and audit trails",
      "Employee security awareness training",
      "Incident response planning",
      "Secure email and file sharing",
      "HIPAA-aligned cloud infrastructure"
    ]
  },
  {
    id: "cmmc",
    name: "CMMC",
    fullName: "Cybersecurity Maturity Model Certification",
    icon: Shield,
    color: " ",
    description: "Required certification for Department of Defense contractors handling Controlled Unclassified Information (CUI).",
    industries: ["Defense Contractors", "DoD Suppliers", "Aerospace", "Manufacturing", "Engineering Firms", "Research Institutions"],
    keyRequirements: [
      "Level 1 - Basic cyber hygiene (17 practices)",
      "Level 2 - Intermediate cyber hygiene (110 practices aligned with NIST 800-171)",
      "Level 3 - Good cyber hygiene (additional 20 practices)",
      "Third-party assessment and certification"
    ],
    ourCapabilities: [
      "CMMC readiness assessments",
      "Gap analysis and remediation planning",
      "NIST 800-171 control implementation",
      "System Security Plan (SSP) development",
      "Plan of Action & Milestones (POA&M)",
      "Continuous monitoring solutions",
      "Enclave solutions for CUI handling",
      "C3PAO preparation support"
    ]
  },
  {
    id: "pci-dss",
    name: "PCI DSS",
    fullName: "Payment Card Industry Data Security Standard",
    icon: CreditCard,
    color: "",
    description: "Security standards for organizations that handle credit card transactions and cardholder data.",
    industries: ["Retail", "E-commerce", "Restaurants", "Hotels", "Financial Services", "Healthcare with Payment Processing"],
    keyRequirements: [
      "Build and maintain secure network - Firewalls, secure configurations",
      "Protect cardholder data - Encryption, secure storage",
      "Maintain vulnerability management - Anti-malware, secure development",
      "Access control measures - Restrict access, unique IDs, physical access",
      "Network monitoring and testing - Track access, regular testing",
      "Information security policy - Maintain comprehensive policies"
    ],
    ourCapabilities: [
      "PCI DSS gap assessments",
      "Scope reduction strategies",
      "Network segmentation implementation",
      "Cardholder data environment (CDE) security",
      "Quarterly vulnerability scanning",
      "Penetration testing coordination",
      "Security awareness training",
      "SAQ and ROC preparation assistance"
    ]
  },
  {
    id: "soc2",
    name: "SOC 2",
    fullName: "Service Organization Control 2",
    icon: FileCheck,
    color: " ",
    description: "Trust Services Criteria for service organizations demonstrating security, availability, and confidentiality controls.",
    industries: ["SaaS Companies", "Cloud Providers", "Data Centers", "Managed Service Providers", "Financial Tech", "Healthcare Tech"],
    keyRequirements: [
      "Security - Protection against unauthorized access",
      "Availability - System availability for operation",
      "Processing Integrity - Complete and accurate processing",
      "Confidentiality - Protection of confidential information",
      "Privacy - Personal information handling"
    ],
    ourCapabilities: [
      "SOC 2 readiness assessments",
      "Control design and implementation",
      "Evidence collection and documentation",
      "Continuous control monitoring",
      "Policy and procedure development",
      "Vendor risk management",
      "Security awareness programs",
      "Audit preparation and support"
    ]
  },
  {
    id: "ftc-safeguards",
    name: "FTC Safeguards",
    fullName: "FTC Safeguards Rule (GLBA)",
    icon: Building2,
    color: "",
    description: "Required security program for non-banking financial institutions under Gramm-Leach-Bliley Act.",
    industries: ["Tax Preparers", "Accountants", "Financial Advisors", "Mortgage Brokers", "Auto Dealers", "Collection Agencies"],
    keyRequirements: [
      "Qualified Individual - Designated security coordinator",
      "Risk Assessment - Written assessment of risks",
      "Safeguards Implementation - Controls to address identified risks",
      "Service Provider Oversight - Due diligence and contracts",
      "Continuous Evaluation - Regular testing and updates",
      "Incident Response - Written response plan"
    ],
    ourCapabilities: [
      "Qualified Individual as-a-service",
      "Comprehensive risk assessments",
      "Written Information Security Program (WISP)",
      "Multi-factor authentication implementation",
      "Encryption for customer data",
      "Annual penetration testing",
      "Employee training programs",
      "Vendor security assessments"
    ]
  }
];

const teamCredentials = [
  { name: "Microsoft Partner", icon: Award },
  { name: "CompTIA Security+", icon: FileCheck },
  { name: "Certified Ethical Hacker", icon: FileCheck },
  { name: "CISSP", icon: Award },
  { name: "AWS Certified", icon: Building2 },
  { name: "Azure Certified", icon: Building2 }
];

export default function ComplianceCertifications() {
  useSEO({
    title: "Compliance Frameworks We Support",
    description:
      "HIPAA, CMMC, PCI DSS, SOC 2, and FTC Safeguards support from Digerati Experts. Framework names describe customer requirements — not Digerati certifications.",
    canonical: "/about/compliance-certifications",
  });

  return (
    <PageTemplate
      title="Navigate Compliance with Confidence"
      subtitle="From HIPAA to CMMC to PCI-DSS, we help Arizona businesses map controls, gather evidence, and prepare for audits and cyber-insurance reviews. Framework names describe customer requirements — Digerati Experts is not SOC 2 Type II certified and does not certify your organization."
      breadcrumbs={[{ label: "About" }, { label: "Compliance" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" variant="brand" className="h-12 px-8 font-semibold" data-testid="button-compliance-assessment">
            <a href="/book">
              {CTA.primary}
              <ArrowRight className="ml-2 h-5 w-5" />
            </a>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 border-white/20 px-6 font-semibold text-white hover:bg-white/10" data-testid="button-download-guide">
            <Link href="/resources/security-checklist">Download Compliance Guide</Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-16">
        <section className="py-16 border-t border-white/10" data-testid="section-why-compliance">
          <div className="container mx-auto px-6">
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { icon: Lock, title: "Avoid Fines", desc: "HIPAA fines up to $1.9M per violation", id: "avoid-fines" },
                { icon: Users, title: "Win Contracts", desc: "CMMC required for DoD contracts", id: "win-contracts" },
                { icon: Award, title: "Build Trust", desc: "Demonstrate security to customers", id: "build-trust" },
                { icon: Clock, title: "Save Time", desc: "Streamlined audit preparation", id: "save-time" }
              ].map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  viewport={{ once: true }}
                  className="rounded-xl border border-de-hairline bg-de-raised p-6 text-center"
                  data-testid={`card-why-compliance-${item.id}`}
                >
                  <div className="w-12 h-12 rounded-lg bg-de-raised flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-de-magenta-ink" />
                  </div>
                  <h3 className="text-white font-semibold mb-2" data-testid={`heading-${item.id}`}>{item.title}</h3>
                  <p className="text-white/60 text-sm">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Framework Details */}
        <section className="py-20" data-testid="section-frameworks">
          <div className="container mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4" data-testid="heading-frameworks">
                Compliance Frameworks We Support
              </h2>
              <p className="text-white/60 max-w-2xl mx-auto" data-testid="text-frameworks-description">
                Deep expertise across major regulatory frameworks with proven methodologies for achieving and maintaining compliance.
              </p>
            </div>

            <div className="space-y-12">
              {complianceFrameworks.map((framework, index) => (
                <motion.div
                  key={framework.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                  id={framework.id}
                  className="overflow-hidden rounded-2xl border border-de-hairline bg-de-raised"
                  data-testid={`section-compliance-${framework.id}`}
                >
                  {/* Header */}
                  <div className={`p-6 bg-de-raised`} data-testid={`header-${framework.id}`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-14 h-14 rounded-xl border border-de-hairline bg-de-bg flex items-center justify-center flex-shrink-0`}>
                        <framework.icon className="w-7 h-7 text-de-magenta" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-2xl font-bold text-white" data-testid={`heading-${framework.id}`}>{framework.name}</h3>
                          <span className="px-3 py-1 rounded-full bg-white/10 text-white/70 text-xs font-medium" data-testid={`badge-industries-count-${framework.id}`}>
                            {framework.industries.length} Industries
                          </span>
                        </div>
                        <p className="text-white/80 font-medium" data-testid={`text-fullname-${framework.id}`}>{framework.fullName}</p>
                        <p className="text-white/60 mt-2" data-testid={`text-description-${framework.id}`}>{framework.description}</p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 grid md:grid-cols-2 gap-8">
                    {/* Key Requirements */}
                    <div data-testid={`list-requirements-${framework.id}`}>
                      <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-de-magenta-ink" />
                        Key Requirements
                      </h4>
                      <ul className="space-y-3">
                        {framework.keyRequirements.map((req, i) => (
                          <li key={i} className="flex items-start gap-3" data-testid={`item-requirement-${framework.id}-${i}`}>
                            <CheckCircle2 className="w-5 h-5 text-de-accent-ink flex-shrink-0 mt-0.5" />
                            <span className="text-white/70 text-sm">{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Our Capabilities */}
                    <div data-testid={`list-capabilities-${framework.id}`}>
                      <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-de-magenta-ink" />
                        Our Capabilities
                      </h4>
                      <ul className="space-y-2">
                        {framework.ourCapabilities.map((cap, i) => (
                          <li key={i} className="flex items-center gap-2" data-testid={`item-capability-${framework.id}-${i}`}>
                            <div className="w-1.5 h-1.5 rounded-full bg-de-magenta" />
                            <span className="text-white/70 text-sm">{cap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Industries */}
                  <div className="px-6 pb-6">
                    <div className="rounded-lg border border-de-hairline bg-de-bg p-4" data-testid={`list-industries-${framework.id}`}>
                      <span className="text-white/50 text-xs uppercase tracking-wider">Industries We Serve:</span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {framework.industries.map((industry, i) => (
                          <span key={i} className="px-3 py-1 rounded-full bg-de-raised text-de-magenta-ink text-xs" data-testid={`badge-industry-${framework.id}-${i}`}>
                            {industry}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Our Certifications */}
        <section className="py-16 border-t border-white/10" data-testid="section-team-certifications">
          <div className="container mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold text-white mb-2" data-testid="heading-certifications">Team credentials</h2>
              <p className="text-white/60">Industry credentials held across the practice — not a substitute for a customer’s own audit.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-6" data-testid="list-certifications">
              {teamCredentials.map((cert, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl border border-de-hairline bg-de-raised px-6 py-3" data-testid={`badge-certification-${i}`}>
                  <cert.icon className="h-5 w-5 text-de-accent-ink" aria-hidden="true" />
                  <span className="text-white/80 font-medium">{cert.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#D3126A]/40 bg-[#D3126A] px-8 py-10 text-center md:px-12 md:py-12">
          <h2 className="mb-6 text-3xl font-bold text-white md:text-4xl">
            Map your compliance gaps
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-white">
            Start with a Cyber Risk Assessment to understand current posture, identify gaps,
            and decide what to run with your current IT or with us.
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="h-12 bg-white px-8 font-semibold text-[#D3126A] hover:bg-white/95"
              data-testid="button-schedule-assessment"
            >
              <a href="/book">
                {CTA.primary}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/70 bg-transparent px-8 font-semibold text-white hover:bg-white/10 hover:text-white"
              data-testid="button-contact-us"
            >
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </section>
      </div>
    </PageTemplate>
  );
}
