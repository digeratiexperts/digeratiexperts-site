import { TierDetailTemplate, type TierPageConfig } from "@/components/TierDetailTemplate";
import { pricing, formatPrice, formatUserPrice } from "@/data/pricing";
import { CTA } from "@/lib/ctaCopy";

const config: TierPageConfig = {
  id: "enterprise",
  shortName: "Enterprise",
  fullName: "ProActive Enterprise Ecosystem",
  canonicalPath: "/solutions/proactive-enterprise-ecosystem",
  seoTitle: "ProActive Enterprise Ecosystem | Digerati Experts",
  seoDescription:
    `Governance-grade managed security for Arizona organizations. Starts at ${formatUserPrice("enterprise")} with a ${formatPrice(pricing.enterprise.monthlyMin)}/mo minimum. Unified Security Posture, advanced compliance/risk reporting, custom BCDR, and quarterly executive reviews. Custom after assessment.`,
  heroBadge: "Governance & mature security",
  tagline: "Governance-grade managed security — for organizations where risk reports go to the board.",
  positioning:
    "ProActive Enterprise is the package we deploy when an organization has outgrown standard managed security and needs a unified, governed, and reportable security operating model. We extend the Business stack with cross-tool posture correlation, advanced compliance and risk reporting against the frameworks you actually have to defend, custom backup and BCDR architecture, and a quarterly executive review cadence with vCIO and vCISO involvement. Engagements are scoped, documented, and tied to specific outcomes — not packaged feature counts.",
  whoFor: [
    "Organizations with regulated data and active framework exposure (HIPAA, CMMC L2, PCI, SOC 2, NIST CSF, cyber insurance attestation regimes)",
    "Companies with internal IT or compliance staff that need a managed security partner operating at their level",
    "Multi-site, multi-entity, or M&A-active organizations where environments and risk posture are complex",
    "Leadership teams that report cyber risk to a board, an audit committee, a parent company, or a regulator",
  ],
  outcomes: [
    "A unified, executive-ready view of security posture across identity, endpoint, email, network, data, and cloud",
    "Audit-ready evidence libraries mapped to the specific frameworks you defend against",
    "Tested, documented disaster recovery runbooks with leadership-defined RTO and RPO targets",
    "A standing quarterly executive review with vCIO and vCISO participation, tied to roadmap and budget",
  ],
  included: [
    "Everything in ProActive Business Ecosystem",
    "DE Security Foundation at the deepest managed-security tier",
    "Unified Security Posture (cross-tool correlation, custom dashboards, executive reporting)",
    "Advanced / custom compliance & risk reporting (HIPAA, CMMC, PCI, SOC 2, NIST CSF, cyber insurance)",
    "Advanced / custom backup and BCDR architecture",
    "Tested disaster recovery runbooks with defined RTO / RPO",
    "Privileged Access Management (PAM) program",
    "Identity Threat Detection and Response (ITDR)",
    "Vendor & third-party risk reporting",
    "Custom security policy authoring and maintenance",
    "Tabletop exercises and incident response readiness",
    "vCIO and vCISO advisory engagement",
    "Quarterly executive reviews on a fixed cadence",
  ],
  addOnsOrUpgrades: [
    {
      label: "Framework certification support",
      desc: "Hands-on evidence collection, gap remediation, and audit support for CMMC, SOC 2, HITRUST, or PCI engagements.",
    },
    {
      label: "M&A and integration support",
      desc: "Security and IT due diligence, environment integration, and posture normalization for acquisitions and divestitures.",
    },
    {
      label: "Custom incident response retainer",
      desc: "Pre-scoped IR retainer with defined response SLAs, forensic support, and breach communication coordination.",
    },
  ],
  reviewCadence:
    "ProActive Enterprise clients receive monthly operational and security reporting, ongoing posture dashboards, and a fixed quarterly executive review with vCIO and vCISO involvement covering risk posture, framework status, incidents, roadmap, and budget.",
  pricingNote:
    `ProActive Enterprise Ecosystem starts at ${formatUserPrice("enterprise")} with a ${formatPrice(pricing.enterprise.monthlyMin)}/mo minimum and is custom after assessment. Engagements are scoped to your environment, regulatory requirements, security operations maturity, and reporting cadence — and documented in a written statement of work before any change to your environment.`,
  ctaPrimary: { label: CTA.primary, href: "/book" },
};

export default function ProActiveEnterpriseEcosystemPage() {
  return <TierDetailTemplate config={config} />;
}
