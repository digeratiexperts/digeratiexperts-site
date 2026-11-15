/**
 * Case studies — publish only DE-approved client stories.
 * Sample shells are labeled "Coming soon / Sample structure" and must not
 * invent customer names or ROI metrics.
 */

export type CaseStudyStatus = "published" | "sample";

export type CaseStudy = {
  slug: string;
  status: CaseStudyStatus;
  industry: string;
  title: string;
  summary: string;
  challenge: string;
  approach: string;
  outcome: string;
  stack: string[];
  /** Only for published stories with client permission */
  clientLabel?: string;
};

/** Real approved case content only. Empty until DE supplies permissioned copy. */
export const publishedCaseStudies: CaseStudy[] = [];

/**
 * Structure templates for the listing/detail UI.
 * Labels make clear these are sample shells, not client endorsements.
 */
export const sampleCaseStudyShells: CaseStudy[] = [
  {
    slug: "healthcare-hipaa-readiness",
    status: "sample",
    industry: "Healthcare",
    title: "Coming soon — HIPAA readiness structure",
    summary:
      "Sample structure for a permissioned healthcare case study. Challenge / approach / outcome / stack ready for approved copy.",
    challenge:
      "[Pending client permission] Describe the practice’s audit, identity, email, and backup gaps without naming the client.",
    approach:
      "[Pending] Assessment-led controls: MFA, encrypted Microsoft 365, endpoint protection, documented policies, staff awareness.",
    outcome:
      "[Pending] Qualitative outcomes only after client approval — no invented fine amounts, downtime %, or ROI.",
    stack: ["Microsoft 365", "Endpoint protection", "Encrypted backup", "Security awareness"],
  },
  {
    slug: "legal-ransomware-recovery",
    status: "sample",
    industry: "Legal",
    title: "Coming soon — ransomware recovery structure",
    summary:
      "Sample structure for a law-firm continuity story once recovery details are approved for publication.",
    challenge:
      "[Pending client permission] File-server impact, backup verification gaps, and billable-hour risk — anonymized.",
    approach:
      "[Pending] Incident response, immutable backups, EDR, privileged access, and awareness training.",
    outcome:
      "[Pending] Publish restore-time and continuity outcomes only with written client approval.",
    stack: ["EDR", "Immutable backup", "SOC monitoring", "Privileged access"],
  },
  {
    slug: "accounting-insurance-controls",
    status: "sample",
    industry: "Accounting",
    title: "Coming soon — cyber-insurance controls structure",
    summary:
      "Sample structure for a CPA-firm insurance-readiness story. Awaiting approved scope and outcomes.",
    challenge:
      "[Pending client permission] Insurer MFA/EDR/IR requirements during tax season — anonymized.",
    approach:
      "[Pending] MFA, managed EDR, documented IR/BCP, phishing simulations, attestation letter support.",
    outcome:
      "[Pending] Coverage or premium outcomes only if the client authorizes publishing them.",
    stack: ["MFA", "Managed EDR", "IR playbook", "Security awareness"],
  },
  {
    slug: "manufacturing-ot-segmentation",
    status: "sample",
    industry: "Manufacturing",
    title: "Coming soon — OT network segmentation structure",
    summary:
      "Sample structure for a production-floor segmentation engagement. No fake downtime savings.",
    challenge:
      "[Pending client permission] Flat office/OT network and malware propagation risk — anonymized.",
    approach:
      "[Pending] VLAN segmentation, firewall policy, monitoring, ERP backup hygiene.",
    outcome:
      "[Pending] Production continuity outcomes only with client-approved wording.",
    stack: ["Network segmentation", "NGFW", "Managed switches", "ERP backup"],
  },
  {
    slug: "real-estate-wire-fraud",
    status: "sample",
    industry: "Real Estate",
    title: "Coming soon — wire-fraud prevention structure",
    summary:
      "Sample structure for a brokerage BEC / wire-fraud prevention story once approved.",
    challenge:
      "[Pending client permission] Spoofed email / out-of-band verification gaps — anonymized.",
    approach:
      "[Pending] Microsoft 365 hardening, DMARC/DKIM/SPF, MFA, mobile enrollment, agent training.",
    outcome:
      "[Pending] Incident-free or insurer recognition claims only with permission.",
    stack: ["Microsoft 365", "DMARC", "Conditional access", "MDM"],
  },
];

/**
 * Public listing: approved stories only. The sample shells above stay in the file as the
 * authoring template, but are never rendered publicly (2026-11-11: the public page showed
 * "[Pending client permission]" text, which reads as unfinished).
 */
export function allCaseStudiesForListing(): CaseStudy[] {
  return [...publishedCaseStudies];
}

/** Detail lookup: approved stories only, so a sample slug resolves to the honest not-found state. */
export function caseStudyBySlug(slug: string): CaseStudy | undefined {
  return publishedCaseStudies.find((c) => c.slug === slug);
}
