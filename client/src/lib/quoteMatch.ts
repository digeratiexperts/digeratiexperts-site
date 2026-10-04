/**
 * Plan match for the /quote-wizard flow.
 *
 * Rules are a business decision, not a design one: quoteMatch.test.ts pins
 * every branch so a restyle can never quietly move a lead to a different plan.
 *
 * Joe-approved (2026-10-03) — aligns with ProActive IT as the 1–10 entry depth:
 * - enterpriseToggle or seats > 30 → Enterprise
 * - seats ≤ 10 → IT (remote / devices do not upgrade past IT)
 * - seats 11–30 + connectivity === "yes" → Business
 * - otherwise → Office
 * - devices alone never upgrades the tier
 */
export type TriState = "yes" | "no" | "not-sure";

export interface QuoteMatchInput {
  seats: number;
  enterpriseToggle: boolean;
  connectivity: string;
  devices: string;
}

export interface QuoteMatch {
  plan: string;
  reasons: string[];
}

/** Above this many seats the match is Enterprise. */
export const ENTERPRISE_SEAT_THRESHOLD = 30;

/** At or below this many seats the match stays ProActive IT. */
export const IT_SEAT_MAX = 10;

const IT_REASONS = [
  "Service desk & issue ownership with a documented baseline",
  "DE Security Foundation — endpoint, identity, email, and security monitoring",
  "Security awareness and a clear upgrade path into Office when the environment grows",
];

const ENTERPRISE_REASONS = [
  "Full compliance modules (HIPAA, GDPR, FTC Safeguards)",
  "Penetration testing, DR runbooks, and privileged access controls",
  "AI & Cloud Automation + vCIO strategic guidance",
];

const BUSINESS_BOTH_REASONS = [
  "Deeper security operations + 24/7 managed threat response",
  "BCDR + compliance/risk reporting + Security Awareness Training",
  "Technology + security business reviews + Cyber Insurance Readiness",
];

const BUSINESS_CONNECTIVITY_REASONS = [
  "24/7 managed threat response with deeper security operations",
  "Advanced identity controls + BCDR / risk reporting depth",
  "Cyber insurance readiness and recurring security reviews",
];

const OFFICE_DEVICES_REASONS = [
  "Email + Calendar + Team Chat with MFA + SSO",
  "Endpoint Security + Email Protection + 24/7 MDR",
  "Managed Network + Service Desk + Endpoint Backup",
];

const OFFICE_BASE_REASONS = [
  "Security-first IT with MFA, SSO, and Password Manager",
  "Endpoint Security + Email Protection + 24/7 MDR",
  "Service Desk + Managed Network + Endpoint Backup",
];

export const getPlanMatch = (data: QuoteMatchInput): QuoteMatch => {
  if (data.enterpriseToggle || data.seats > ENTERPRISE_SEAT_THRESHOLD) {
    return { plan: "Enterprise", reasons: ENTERPRISE_REASONS };
  }

  // Entry depth: 1–10 people stay on ProActive IT even with remote / devices.
  if (data.seats <= IT_SEAT_MAX) {
    return { plan: "IT", reasons: IT_REASONS };
  }

  if (data.connectivity === "yes" && data.devices === "yes") {
    return { plan: "Business", reasons: BUSINESS_BOTH_REASONS };
  }

  if (data.connectivity === "yes") {
    return { plan: "Business", reasons: BUSINESS_CONNECTIVITY_REASONS };
  }

  if (data.devices === "yes") {
    return { plan: "Office", reasons: OFFICE_DEVICES_REASONS };
  }

  return { plan: "Office", reasons: OFFICE_BASE_REASONS };
};

/** "Based on …" line for the quiz's match screen, from the answers that shaped the match. */
export function describeMatchBasis(answers: {
  seats: number;
  enterpriseToggle: boolean;
  connectivity?: string;
  devices?: string;
}): string {
  const parts = [
    answers.enterpriseToggle ? "more than 100 people" : `${answers.seats} ${answers.seats === 1 ? "person" : "people"}`,
  ];
  if (answers.connectivity === "yes") parts.push("remote or cloud work");
  if (answers.connectivity === "no") parts.push("one office with files on site");
  if (answers.devices === "yes") parts.push("managed laptops and desktops");
  if (answers.devices === "no") parts.push("devices already covered");
  if (parts.length === 1) return `Based on ${parts[0]}.`;
  if (parts.length === 2) return `Based on ${parts[0]} and ${parts[1]}.`;
  return `Based on ${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}.`;
}
