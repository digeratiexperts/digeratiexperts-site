import { TierDetailTemplate, type TierPageConfig } from "@/components/TierDetailTemplate";
import { pricing, formatPrice, formatUserPrice } from "@/data/pricing";

const config: TierPageConfig = {
  id: "it",
  shortName: "IT",
  fullName: "ProActive IT Ecosystem",
  canonicalPath: "/solutions/proactive-it-ecosystem",
  seoTitle: "ProActive IT Ecosystem | Digerati Experts",
  seoDescription:
    `Entry managed IT package from Digerati Experts. Starts at ${formatUserPrice("it")} with a ${formatPrice(pricing.it.monthlyMin)}/mo minimum. Includes the DE Security Foundation across identity, endpoint, email, awareness, and managed security monitoring. Backup is not included by default.`,
  heroBadge: "Entry managed IT",
  tagline: "Foundational managed IT with managed cybersecurity included from day one.",
  positioning:
    "ProActive IT Ecosystem is the operating floor for DE, and that floor includes managed cybersecurity. It is built for Arizona SMBs that need dependable identity, endpoint, email, security awareness, monitoring, network, and help-desk coverage with predictable per-user pricing. Higher tiers deepen detection, response, backup, compliance, and governance; security itself is never something we wait to add later.",
  whoFor: [
    "Small teams (typically 5–25 users) replacing a break-fix or in-house IT person",
    "Companies that have not yet been through a Cyber Risk Assessment and want a clean baseline first",
    "Organizations without regulated data (no HIPAA, CMMC, PCI scope) that still want a managed security baseline",
    "Buyers who want a transparent per-user price with cybersecurity included rather than bolted on later",
  ],
  outcomes: [
    "A documented, professionally managed Microsoft 365 and endpoint environment",
    "A single accountable help desk with response-time commitments — no more guessing who to call",
    "Clear visibility into user lifecycle, licensing, and device health",
    "A managed security foundation that can step up cleanly into 24/7 MDR, deeper recovery, compliance, and governance",
  ],
  included: [
    "Microsoft 365 / Entra ID tenant management",
    "Multi-Factor Authentication (MFA) enforcement",
    "Endpoint management & patching (Intune / RMM)",
    "Managed endpoint protection",
    "Managed email security / anti-phishing baseline",
    "Security Awareness Training & phishing resilience",
    "Managed security monitoring baseline",
    "Network monitoring & basic firewall management",
    "DNS filtering / web security",
    "User onboarding & offboarding",
    "Unlimited remote help desk during business hours",
    "Asset & license inventory",
    "Vendor management for core IT systems",
    "Monthly health & ticket reporting",
  ],
  notIncluded: [
    "Endpoint Backup, BCDR, and User Cloud Storage Backup (add-on or step up to Business)",
    "24/7 Security Operations Center (SOC) and Managed Detection & Response (MDR)",
    "Compliance and risk reporting (HIPAA, CMMC, PCI, SOC 2 mapping)",
    "Semi-annual technology + security reviews (vCIO / QBR cadence)",
  ],
  addOnsOrUpgrades: [
    {
      label: "Microsoft 365 Backup",
      desc: "Independent backup of Exchange, SharePoint, OneDrive, and Teams data — recommended for any business that lives in M365.",
    },
    {
      label: "Endpoint Backup",
      desc: "Image-level backup for laptops and workstations to protect against ransomware, theft, and hardware failure.",
    },
    {
      label: "Step up to ProActive Office or Business",
      desc: "Office adds 24/7 managed detection and response plus managed network and endpoint backup; Business adds deeper security operations, BCDR, compliance/risk reporting, and semi-annual reviews.",
    },
  ],
  reviewCadence:
    "ProActive IT clients receive a monthly operational report and an annual technology check-in. Strategic vCIO planning, QBRs, and security posture reviews are part of ProActive Business and Enterprise.",
  pricingNote:
    `ProActive IT Ecosystem starts at ${formatUserPrice("it")} with a ${formatPrice(pricing.it.monthlyMin)}/mo minimum. Final pricing is confirmed after a short assessment of your environment, user count, and add-on selections.`,
  ctaPrimary: { label: "View Pricing & Matrix", href: "/proactive-ecosystem-pricing" },
};

export default function ProActiveITEcosystemPage() {
  return <TierDetailTemplate config={config} />;
}
