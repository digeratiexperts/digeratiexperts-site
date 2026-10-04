/**
 * Plan match for the /quote-wizard flow.
 *
 * Moved verbatim out of LeadQuoteWizard.tsx when the wizard became a
 * one-question-per-screen room (issue 419). The rules and reasons are a
 * business decision, not a design one: quoteMatch.test.ts pins every branch,
 * so a restyle can never quietly move a lead to a different plan. Three plans
 * only (Office, Business, Enterprise); never add one here.
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

export const getPlanMatch = (data: QuoteMatchInput): QuoteMatch => {
  if (data.enterpriseToggle || data.seats > ENTERPRISE_SEAT_THRESHOLD) {
    return {
      plan: 'Enterprise',
      reasons: [
        'Full compliance modules (HIPAA, GDPR, FTC Safeguards)',
        'Penetration testing, DR runbooks, and privileged access controls',
        'AI & Cloud Automation + vCIO strategic guidance'
      ]
    };
  }

  if (data.connectivity === 'yes' && data.devices === 'yes') {
    return {
      plan: 'Business',
      reasons: [
        'Deeper security operations + 24/7 managed threat response',
        'BCDR + compliance/risk reporting + Security Awareness Training',
        'Technology + security business reviews + Cyber Insurance Readiness'
      ]
    };
  }

  if (data.connectivity === 'yes') {
    return {
      plan: 'Business',
      reasons: [
        '24/7 managed threat response with deeper security operations',
        'Advanced identity controls + BCDR / risk reporting depth',
        'Cyber insurance readiness and recurring security reviews'
      ]
    };
  }

  if (data.devices === 'yes') {
    return {
      plan: 'Office',
      reasons: [
        'Email + Calendar + Team Chat with MFA + SSO',
        'Endpoint Security + Email Protection + 24/7 MDR',
        'Managed Network + Service Desk + Endpoint Backup'
      ]
    };
  }

  return {
    plan: 'Office',
    reasons: [
      'Security-first IT with MFA, SSO, and Password Manager',
      'Endpoint Security + Email Protection + 24/7 MDR',
      'Service Desk + Managed Network + Endpoint Backup'
    ]
  };
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
