/**
 * Vendor offering profiles for the Digital Warehouse (staff): what a vendor
 * sells to DE as a partner, and where each product stands for DE. Reference
 * only; nothing here is quoteable and no prices belong here (this repository
 * is public).
 *
 * Mirrors Intelligence Hub lib/db/src/utils/vendor-offerings.ts (Hub PR #394),
 * which writes the same profile onto the Hub vendor row. Change both together.
 */

export type OfferingDeStatus = "in_use" | "legacy" | "available";

export interface VendorOffering {
  product: string;
  vendorCategory: string;
  deCapability: string;
  summary: string;
  deStatus: OfferingDeStatus;
  deNote: string;
}

export interface VendorProfile {
  /** vendorLogos slug. */
  slug: string;
  name: string;
  partnerPortal: string;
  agreements: { title: string; url: string; lastModified: string }[];
  offerings: VendorOffering[];
  source: string;
}

export const OFFERING_STATUS_LABEL: Record<OfferingDeStatus, string> = {
  in_use: "In use",
  legacy: "Legacy · migration only",
  available: "Available · not adopted",
};

export const VENDOR_PROFILES: VendorProfile[] = [
  {
    slug: "cytracom",
    name: "Cytracom",
    partnerPortal: "https://unity.cytracom.net/marketplace",
    agreements: [
      {
        title: "Partner Agreement",
        url: "https://unity-globe-prod-agreementdocs.s3.amazonaws.com/Partner_Agreement.pdf",
        lastModified: "2018-02-20",
      },
      {
        title: "Partner Resale Agreement – Security and Connectivity",
        url: "https://unity-globe-prod-agreementdocs.s3.amazonaws.com/Partner_Resale_Agreement_-_Security_and_Connectivity.pdf",
        lastModified: "2022-03-29",
      },
    ],
    source: "Cytracom partner marketplace, captured by Joe 2026-10-09. Agreement copies: docs/vendors/cytracom/agreements/.",
    offerings: [
      {
        product: "UCaaS",
        vendorCategory: "UCaaS",
        deCapability: "Business Phone / UCaaS",
        summary: "Cytracom's hosted voice and unified communications platform.",
        deStatus: "in_use",
        deNote: "Active app on DE's Cytracom partner account; the UCaaS SKUs in this workshop map to Cytracom. Not deprecated by the ControlOne retirement.",
      },
      {
        product: "ControlOne",
        vendorCategory: "Security & Connectivity",
        deCapability: "Secure Access & Zero Trust",
        summary:
          "Software-defined networking and zero trust network access that follows the user rather than the device, with least-privilege policies and hardware plus software components.",
        deStatus: "legacy",
        deNote: "Legacy / migration only. Timus Networks is DE's preferred Secure Access platform (Hub decision 2026-09-09).",
      },
      {
        product: "Telivy Assess",
        vendorCategory: "Security Risk Management",
        deCapability: "Risk assessment / intelligence",
        summary: "External risk scanning and prospect targeting with one-time internal assessments and executive-ready reports for MSP sales.",
        deStatus: "available",
        deNote: "Telivy is DE's preferred risk-intelligence direction and has its own Hub vendor row; buying through Cytracom versus direct is not decided.",
      },
      {
        product: "Telivy Monitor",
        vendorCategory: "Security Risk Management",
        deCapability: "Risk assessment / intelligence",
        summary: "Continuous endpoint-to-cloud security risk management: always-on vulnerability monitoring, risk prioritization and remediation tracking across clients.",
        deStatus: "available",
        deNote: "Same as Telivy Assess; channel not decided.",
      },
      {
        product: "Tentacle",
        vendorCategory: "Governance, Risk and Compliance (GRC)",
        deCapability: "Compliance / GRC",
        summary:
          "GRC platform for MSPs: assess clients against CMMC, NIST, CIS, SOC 2, HIPAA and other cross-walked frameworks, automate evidence collection, track remediation and keep audit readiness.",
        deStatus: "available",
        deNote: "Not adopted. Would need evaluation against DE's compliance stack before any use.",
      },
      {
        product: "Insurance Manager",
        vendorCategory: "Governance, Risk and Compliance (GRC)",
        deCapability: "Cyber insurance readiness",
        summary: "Maps insurer-required controls to each client's actual security posture, verified and documented, so attestation gaps are found before a claim.",
        deStatus: "available",
        deNote: "Not adopted. Would need evaluation before any use.",
      },
    ],
  },
];
