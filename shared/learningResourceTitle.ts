/**
 * Titles for Hub curriculum documents when the company library has not
 * connected yet. The learning route still builds a mechanical title from the
 * slug (server/routes.ts, owned by open PR #991). This map is the visitor-
 * facing correction for the acronyms that title-case mangles.
 *
 * Only tokens that appear in the curriculum slugs are listed. A connected
 * Hub title is never rewritten.
 */

const TITLE_TOKENS: Record<string, string> = {
  sow: "SOW",
  bdr: "BDR",
  vcio: "vCIO",
  csra: "CSRA",
  it: "IT",
  ucaas: "UCaaS",
  voip: "VoIP",
  mfa: "MFA",
  mdr: "MDR",
  qbr: "QBR",
  de: "DE",
  hipaa: "HIPAA",
  cmmc: "CMMC",
  nist: "NIST",
  proactive: "ProActive",
  m365: "M365",
  sase: "SASE",
};

function titleWord(word: string): string {
  const mapped = TITLE_TOKENS[word.toLowerCase()];
  if (mapped) return mapped;
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Canonical fallback title for a curriculum slug. */
export function learningResourceTitle(slug: string): string {
  const words = slug.split("-").filter(Boolean).map(titleWord);
  return words.join(" ") || slug;
}

/** The mechanical title the learning route emits until routes.ts can call this directly. */
export function naiveLearningResourceTitle(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Show a real Hub title unchanged. Replace only the disconnected fallback
 * that is still the slug run through naive title case.
 */
export function presentLearningResourceTitle(slug: string, title: string, source: string): string {
  if (source === "techsales") return title || learningResourceTitle(slug);
  if (!title) return learningResourceTitle(slug);
  if (title === naiveLearningResourceTitle(slug)) return learningResourceTitle(slug);
  return title;
}
