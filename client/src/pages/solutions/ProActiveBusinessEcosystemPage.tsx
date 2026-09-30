import { TierDetailTemplate, type TierPageConfig } from "@/components/TierDetailTemplate";
import { pricing, formatPrice, formatUserPrice } from "@/data/pricing";

const config: TierPageConfig = {
  id: "business",
  shortName: "Business",
  fullName: "ProActive Business Ecosystem",
  canonicalPath: "/solutions/proactive-business-ecosystem",
  seoTitle: "ProActive Business Ecosystem | Digerati Experts",
  seoDescription:
    `Security-first managed IT for Arizona SMBs. Starts at ${formatUserPrice("business")} with a ${formatPrice(pricing.business.monthlyMin)}/mo minimum. Includes 24/7 SOC, MDR, Security Awareness Training, full backup and BCDR, compliance/risk reporting, and semi-annual technology + security reviews.`,
  heroBadge: "Security-first business package",
  tagline: "Security-first managed IT — built for businesses that cannot afford a quiet breach.",
  positioning:
    "ProActive Business is our most-deployed package and the level at which we stop describing ourselves as an IT provider and start operating as a managed security partner. Every endpoint is monitored 24/7 by a Security Operations Center, every user goes through ongoing Security Awareness Training, every mailbox and workstation is backed up, and twice a year we sit down with leadership for a documented technology and security review. This is the level Arizona SMBs typically land on when leadership has decided that downtime, ransomware, or a regulatory event would be material to the business.",
  whoFor: [
    "Established SMBs (typically 15–100+ users) where downtime or a breach would be a board-level event",
    "Professional services, healthcare, legal, financial, and manufacturing firms with sensitive client data",
    "Organizations with light or moderate compliance pressure (HIPAA, PCI, basic CMMC, cyber insurance attestations)",
    "Companies that already have IT in place and are stepping up to a true security-first operating posture",
  ],
  outcomes: [
    "A 24/7 monitored, defended, and documented environment — no blind spots between business hours",
    "Demonstrable security posture for cyber insurance applications and client security questionnaires",
    "Recoverable in hours, not days, when something does go wrong (ransomware, hardware failure, accidental deletion)",
    "A standing semi-annual review where leadership sees risk, spend, and roadmap in plain English",
  ],
  included: [
    "Everything in ProActive Office Ecosystem",
    "DE Security Foundation with 24/7 Managed Detection & Response",
    "24/7 Security Operations Center (SOC)",
    "Managed Detection & Response (MDR)",
    "Threat Detection & response across endpoints, identity, and email",
    "Endpoint Backup",
    "Backup & Disaster Recovery (BCDR)",
    "User Cloud Storage Backup (M365 / OneDrive / SharePoint / Teams)",
    "Security Awareness Training & phishing simulation",
    "Advanced email security & anti-phishing",
    "Compliance & risk reporting (mapping, evidence, posture)",
    "Vulnerability management & patch verification",
    "Incident response coordination",
    "Budgeting & technology planning",
    "Semi-annual technology + security reviews",
  ],
  notIncluded: [
    "Unified Security Posture program (cross-tool correlation, custom dashboards) — Enterprise",
    "Advanced / custom compliance and risk reporting for regulated frameworks (e.g. CMMC L2, SOC 2) — Enterprise",
    "Custom backup architecture and tested DR runbooks beyond standard BCDR — Enterprise",
    "Quarterly executive reviews on a strict cadence with vCIO and vCISO involvement — Enterprise",
  ],
  addOnsOrUpgrades: [
    {
      label: "Compliance accelerators",
      desc: "Add framework-specific evidence packages and gap remediation for HIPAA, PCI, SOC 2, or CMMC engagements.",
    },
    {
      label: "Co-Managed IT integration",
      desc: "We slot alongside an internal IT team or admin and own the security operations layer while they own day-to-day requests.",
    },
    {
      label: "Step up to ProActive Enterprise",
      desc: "Adds Unified Security Posture, advanced compliance/risk reporting, custom BCDR, and a quarterly executive review cadence.",
    },
  ],
  reviewCadence:
    "ProActive Business clients receive a monthly health and security report, plus a semi-annual technology + security review with leadership covering risk posture, incidents, roadmap, and budget. Quarterly executive reviews are standard at the Enterprise level.",
  pricingNote:
    `ProActive Business Ecosystem starts at ${formatUserPrice("business")} with a ${formatPrice(pricing.business.monthlyMin)}/mo minimum. Final pricing is confirmed after a Cyber Risk Assessment that scopes user count, environment complexity, compliance exposure, and any required accelerators.`,
  ctaPrimary: { label: "View Pricing & Matrix", href: "/proactive-ecosystem-pricing" },
};

export default function ProActiveBusinessEcosystemPage() {
  return <TierDetailTemplate config={config} />;
}
