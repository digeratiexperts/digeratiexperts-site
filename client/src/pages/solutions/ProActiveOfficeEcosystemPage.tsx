import { TierDetailTemplate, type TierPageConfig } from "@/components/TierDetailTemplate";
import { pricing, formatPrice, formatUserPrice } from "@/data/pricing";

const config: TierPageConfig = {
  id: "office",
  shortName: "Office",
  fullName: "ProActive Office Ecosystem",
  canonicalPath: "/solutions/proactive-office-ecosystem",
  seoTitle: "ProActive Office Ecosystem | Digerati Experts",
  seoDescription:
    `Small office operating package from Digerati Experts. Starts at ${formatUserPrice("office")} with a ${formatPrice(pricing.office.monthlyMin)}/mo minimum. Includes the DE Security Foundation with 24/7 managed detection and response, managed network & connectivity, endpoint backup, and an annual combined technology + cyber review.`,
  heroBadge: "Small office operating package",
  tagline: "Managed IT, network, backup, and 24/7 managed threat response under one accountable partner.",
  positioning:
    "ProActive Office Ecosystem takes the DE Security Foundation from the IT tier and adds 24/7 managed detection and response, managed network & connectivity, a limited Managed Workplace layer, endpoint backup, and an annual combined technology + cyber review. Business still adds deeper security operations, BCDR, compliance/risk reporting, and a more frequent review cadence, but Office is already a managed-security plan rather than an IT plan waiting for security later.",
  whoFor: [
    "Small offices (typically 5–30 users) that need dependable IT plus a professionally managed network",
    "Teams that want endpoint backup included rather than bolted on later",
    "Organizations that want 24/7 managed threat response without the deeper BCDR, compliance, and governance scope of Business",
    "Buyers who want transparent per-user pricing with a predictable monthly minimum",
  ],
  outcomes: [
    "One accountable partner for help desk, endpoints, and the office network",
    "Laptops and workstations protected by managed endpoint backup",
    "An annual combined technology + cyber review with leadership",
    "A documented environment that steps cleanly up into ProActive Business",
  ],
  included: [
    "Everything in ProActive IT Ecosystem",
    "Managed Network & Connectivity",
    "Limited Managed Workplace (user provisioning, workspace setup, M365 / Google Workspace / Zoho support)",
    "Endpoint Backup",
    "Stronger identity protection (MFA / SSO / Password Manager)",
    "Advanced email anti-phishing protection",
    "Security Awareness Training & phishing simulation",
    "24/7 Managed Detection & Response (MDR)",
    "Annual combined technology + cyber review",
  ],
  notIncluded: [
    "Backup & Disaster Recovery (BCDR) and User Cloud Storage Backup (add-on or step up to Business)",
    "Compliance & risk reporting (add-on / custom, included in Business)",
    "Semi-annual technology + security reviews (Business) or quarterly executive reviews (Enterprise)",
  ],
  addOnsOrUpgrades: [
    {
      label: "Backup & Disaster Recovery (BCDR)",
      desc: "Add server/workload continuity and recovery depth when endpoint backup alone is not enough.",
    },
    {
      label: "Compliance & risk reporting",
      desc: "Add scoped framework mapping and evidence support before stepping up to the broader Business operating model.",
    },
    {
      label: "Step up to ProActive Business",
      desc: "Adds deeper security operations, BCDR, user cloud backup, compliance/risk reporting, and semi-annual technology + security reviews.",
    },
  ],
  reviewCadence:
    "ProActive Office clients receive a monthly operational report and an annual combined technology + cyber review. Semi-annual reviews are part of ProActive Business; quarterly executive reviews are part of Enterprise.",
  pricingNote:
    `ProActive Office Ecosystem starts at ${formatUserPrice("office")} with a ${formatPrice(pricing.office.monthlyMin)}/mo minimum. Final pricing is confirmed after a short assessment of your environment, user count, and add-on selections.`,
  ctaPrimary: { label: "View Pricing & Matrix", href: "/proactive-ecosystem-pricing" },
};

export default function ProActiveOfficeEcosystemPage() {
  return <TierDetailTemplate config={config} />;
}
