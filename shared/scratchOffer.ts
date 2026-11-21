/**
 * Scratch-card offer shared by the site and the intake route. Every card
 * reveals the same offer; there is no draw and no chance element.
 */
export const SCRATCH_OFFER_TAG = "security-snapshot-scratch" as const;

/**
 * All offer wording and terms in one place. The fee waiver terms are pending
 * sign-off; change them here only.
 */
export const SCRATCH_OFFER_TERMS = {
  status: "pending" as "pending" | "approved",
  eyebrow: "Security offer",
  headline: "Your IT security offer is",
  headlineAccent: "under here",
  subhead: "Scratch the card to reveal it. Every business gets the same offer.",
  revealedHeadline: "Here's your offer.",
  revealKicker: "Your offer",
  revealTitle: "Free Security Snapshot",
  revealTag: "For qualified businesses",
  summary: "A plain-English look at what's solid, what's missing, and what matters.",
  claimCta: "Claim my free Snapshot",
  detailsBand: "Request your free Security Snapshot",
  detailsQuestion: "Where should we send your Snapshot details?",
  codeBand: "Free Security Snapshot",
  codeIntro: "Use this claim code when you book:",
  codeNote: "*For qualified businesses. Fee waiver confirmed in writing by DE after review. One per business.",
  bookCta: "Book my free Snapshot",
  finePrint: "For qualified businesses. Fee waiver confirmed in writing by DE after review. One per business.",
  /** Shown only when a fee is charged; a waived Snapshot has nothing to credit. */
  creditTerms:
    "Any fee paid (excluding tax) is credited once toward the first MSA Order Form signed within 30 days after the readout. No cash value. Void if the MSA is cancelled under Section 6.5.",
  showCreditTerms: false,
  excludedStates: ["CA", "NY", "MA", "HI"] as readonly string[],
  excludedStateMessage: "This offer isn't available in your state yet.",
} as const;

export const US_STATES: ReadonlyArray<readonly [string, string]> = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"],
  ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];

const STATE_CODES = new Set(US_STATES.map(([code]) => code));

export function normalizeState(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return STATE_CODES.has(code) ? code : null;
}

export function isExcludedState(code: string | null | undefined): boolean {
  return !!code && SCRATCH_OFFER_TERMS.excludedStates.includes(code);
}

/** No 0/O/Q, 1/I/L, 2/Z, 5/S, 8/B or U/V, so a code read aloud or retyped survives. */
export const CLAIM_CODE_ALPHABET = "ACDEFGHJKMNPRTWXY34679";
export const CLAIM_CODE_PREFIX = "SNAP";
export const CLAIM_CODE_GROUPS = 2;
export const CLAIM_CODE_GROUP_LENGTH = 4;

const CLAIM_CODE_RE = new RegExp(
  `^${CLAIM_CODE_PREFIX}(?:-[${CLAIM_CODE_ALPHABET}]{${CLAIM_CODE_GROUP_LENGTH}}){${CLAIM_CODE_GROUPS}}$`,
);

/** Build a code from a source of uniform integers in [0, max). */
export function buildClaimCode(randomIndex: (max: number) => number): string {
  const groups: string[] = [];
  for (let g = 0; g < CLAIM_CODE_GROUPS; g += 1) {
    let group = "";
    for (let i = 0; i < CLAIM_CODE_GROUP_LENGTH; i += 1) {
      group += CLAIM_CODE_ALPHABET[randomIndex(CLAIM_CODE_ALPHABET.length)];
    }
    groups.push(group);
  }
  return [CLAIM_CODE_PREFIX, ...groups].join("-");
}

export function normalizeClaimCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return CLAIM_CODE_RE.test(code) ? code : null;
}

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const BUSINESS_NAME_MAX = 120;

export type ClaimFields = { email: string; company: string; state: string };
export type ClaimFieldErrors = Partial<Record<keyof ClaimFields, string>>;

export function validateClaimFields(input: { email?: unknown; company?: unknown; state?: unknown }): ClaimFieldErrors {
  const errors: ClaimFieldErrors = {};
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const company = typeof input.company === "string" ? input.company.trim() : "";

  if (!email) errors.email = "Enter your work email.";
  else if (email.length > 254 || !EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  else if (PUBLIC_EMAIL_DOMAINS.has(email.split("@")[1]!.toLowerCase())) {
    errors.email = "Use your work email. Personal inboxes aren't accepted.";
  }

  if (!company) errors.company = "Enter your business name.";
  else if (company.length > BUSINESS_NAME_MAX) errors.company = `Keep it under ${BUSINESS_NAME_MAX} characters.`;

  const state = normalizeState(input.state);
  if (!state) errors.state = "Choose your business's state.";
  else if (isExcludedState(state)) errors.state = SCRATCH_OFFER_TERMS.excludedStateMessage;

  return errors;
}
