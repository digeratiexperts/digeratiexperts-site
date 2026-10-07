import { Shield, FileCheck, Building2, Heart, CreditCard, Lock, Award, Clock, Users } from "lucide-react";
import { PageTemplate } from "@/components/PageTemplate";
import {
  Chapter,
  Container,
  ChapterHeader,
  ClosingCta,
  CheckList,
  HeroActions,
  HeroFacts,
  Eyebrow,
  bodyClass,
  inkClass,
  type ChapterTone,
} from "@/components/site/chapters";
import { IconWell } from "@/components/visual/IconWell";
import { VerifiedCredentials } from "@/components/site/VerifiedCredentials";
import { useSEO } from "@/hooks/useSEO";
import { CTA } from "@/lib/ctaCopy";

const complianceFrameworks = [
  {
    id: "hipaa",
    name: "HIPAA",
    fullName: "Health Insurance Portability and Accountability Act",
    icon: Heart,
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


const whyCompliance = [
  { icon: Lock, title: "Avoid Fines", desc: "HIPAA fines up to $1.9M per violation", id: "avoid-fines" },
  { icon: Users, title: "Win Contracts", desc: "CMMC required for DoD contracts", id: "win-contracts" },
  { icon: Award, title: "Build Trust", desc: "Demonstrate security to customers", id: "build-trust" },
  { icon: Clock, title: "Save Time", desc: "Streamlined audit preparation", id: "save-time" },
];

export default function ComplianceCertifications() {
  useSEO({
    title: "Compliance Frameworks We Support",
    description:
      "HIPAA, CMMC, PCI DSS, SOC 2, and FTC Safeguards support from Digerati Experts. Framework names describe customer requirements — not DE certifications.",
    canonical: "/about/compliance-certifications",
  });

  return (
    <PageTemplate
      layout="chapters"
      eyebrow="About · Compliance"
      title="Navigate Compliance with Confidence"
      subtitle="From HIPAA to CMMC to PCI-DSS, we help Arizona businesses map controls, gather evidence, and prepare for audits and cyber-insurance reviews. Framework names describe customer requirements — Digerati Experts is not SOC 2 Type II certified and does not certify your organization."
      breadcrumbs={[{ label: "About" }, { label: "Compliance" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: CTA.primary, href: "/book", testId: "button-compliance-assessment" }}
            secondary={{ label: "Download Compliance Guide", href: "/resources/security-checklist", testId: "button-download-guide" }}
          />
        </div>
      }
      heroAside={
        <HeroFacts
          title="Frameworks we support"
          rows={complianceFrameworks.map((f) => ({
            label: f.name,
            value: <a href={`#${f.id}`} className="underline-offset-4 hover:underline">{f.fullName}</a>,
          }))}
          footnote="Framework names describe customer requirements, not Digerati Experts certifications."
        />
      }
    >
      <section
        className="de-paper-chapter border-b border-[var(--de-paper-hairline)] text-[#1A1228]"
        aria-label="Why compliance matters"
        data-testid="section-why-compliance"
      >
        <Container>
          <ul className="grid divide-y divide-[var(--de-paper-hairline)] sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
            {whyCompliance.map((item, i) => (
              <li
                key={item.id}
                className={`flex items-start gap-4 py-6 sm:px-6 sm:py-8 sm:border-l sm:border-[var(--de-paper-hairline)] ${
                  i === 0 ? "sm:border-l-0 sm:pl-0" : ""
                } ${i === 2 ? "sm:border-l-0 sm:pl-0 lg:border-l lg:pl-6" : ""}`}
                data-testid={`card-why-compliance-${item.id}`}
              >
                <item.icon className="mt-0.5 h-5 w-5 shrink-0 text-de-magenta-paper-ink" aria-hidden="true" />
                <div>
                  <h3 className="font-heading text-base font-semibold leading-snug" data-testid={`heading-${item.id}`}>
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#3A3448]">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Chapter tone="well" seam={false} data-testid="section-frameworks">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Frameworks"
            title={<span data-testid="heading-frameworks">Compliance Frameworks We Support</span>}
            lede={
              <span data-testid="text-frameworks-description">
                Deep expertise across major regulatory frameworks with proven methodologies for achieving and maintaining compliance.
              </span>
            }
          />
          <nav aria-label="Frameworks">
            <ul className="flex flex-wrap gap-2">
              {complianceFrameworks.map((f) => (
                <li key={f.id}>
                  <a
                    href={`#${f.id}`}
                    className="inline-flex min-h-11 items-center rounded-md border border-[var(--de-hairline)] px-4 text-sm font-medium text-white/85 transition-colors hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                  >
                    {f.name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </Chapter>

      {complianceFrameworks.map((framework, index) => {
        const tone: ChapterTone = index % 2 === 0 ? "paper" : "surface";
        const paper = tone === "paper";
        const seam = paper ? "border-[var(--de-paper-hairline)]" : "border-[var(--de-hairline)]";
        const muted = paper ? "text-black/55" : "text-white/55";
        return (
          <Chapter key={framework.id} tone={tone} id={framework.id} className="scroll-mt-24" data-testid={`section-compliance-${framework.id}`}>
            <Container>
              <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
                <div className="lg:col-span-5" data-testid={`header-${framework.id}`}>
                  <IconWell icon={framework.icon} size="md" surface={paper ? "light" : "dark"} className="mb-5" />
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className={`font-heading text-3xl font-semibold tracking-[-0.02em] ${inkClass(tone)}`} data-testid={`heading-${framework.id}`}>
                      {framework.name}
                    </h2>
                    <span className={`font-mono text-xs font-semibold uppercase tracking-[0.14em] ${muted}`} data-testid={`badge-industries-count-${framework.id}`}>
                      {framework.industries.length} Industries
                    </span>
                  </div>
                  <p className={`mt-2 font-medium ${inkClass(tone)}`} data-testid={`text-fullname-${framework.id}`}>{framework.fullName}</p>
                  <p className={`mt-3 text-base leading-relaxed ${bodyClass(tone)}`} data-testid={`text-description-${framework.id}`}>{framework.description}</p>

                  <div className={`mt-8 border-t pt-5 ${seam}`} data-testid={`list-industries-${framework.id}`}>
                    <p className={`font-mono text-xs font-semibold uppercase tracking-[0.16em] ${muted}`}>Industries We Serve</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {framework.industries.map((industry, i) => (
                        <li
                          key={i}
                          className={`rounded-md border px-3 py-1.5 text-sm ${
                            paper ? "border-[var(--de-paper-hairline)] bg-white text-[#1A1228]" : "border-[var(--de-hairline)] bg-de-raised text-white/85"
                          }`}
                          data-testid={`badge-industry-${framework.id}-${i}`}
                        >
                          {industry}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="grid gap-10 lg:col-span-7">
                  <div data-testid={`list-requirements-${framework.id}`}>
                    <Eyebrow tone={tone} className="mb-4">Key Requirements</Eyebrow>
                    <ol className={`border-t ${seam}`}>
                      {framework.keyRequirements.map((req, i) => (
                        <li
                          key={i}
                          className={`flex gap-4 border-b py-3.5 text-[0.95rem] leading-relaxed ${seam} ${bodyClass(tone)}`}
                          data-testid={`item-requirement-${framework.id}-${i}`}
                        >
                          <span className={`font-mono text-xs font-semibold leading-relaxed ${muted}`}>{String(i + 1).padStart(2, "0")}</span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div data-testid={`list-capabilities-${framework.id}`}>
                    <Eyebrow tone={tone} className="mb-4">Our Capabilities</Eyebrow>
                    <CheckList
                      tone={tone}
                      items={framework.ourCapabilities.map((cap, i) => (
                        <span key={i} data-testid={`item-capability-${framework.id}-${i}`}>{cap}</span>
                      ))}
                    />
                  </div>
                </div>
              </div>
            </Container>
          </Chapter>
        );
      })}

      <Chapter tone="well" data-testid="section-team-certifications">
        <Container>
          <ChapterHeader
            tone="well"
            eyebrow="Credentials"
            title={<span data-testid="heading-certifications">Team credentials</span>}
            lede="Each credential links to the issuer's own record. None of them replaces a customer’s own audit."
          />
          <VerifiedCredentials testId="list-certifications" />
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        title="Map your compliance gaps"
        lede="Start with a Cyber Risk Assessment to understand current posture, identify gaps, and decide what to run with your current IT or with us."
        primary={{ label: CTA.primary, href: "/book", testId: "button-schedule-assessment" }}
        secondary={{ label: "Contact Us", href: "/contact", testId: "button-contact-us" }}
      />
    </PageTemplate>
  );
}
