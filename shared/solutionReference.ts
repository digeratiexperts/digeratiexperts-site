/**
 * The public Store's short reference: `DE-` + six Crockford base32 characters
 * (no I, L, O or U). Minted on the server from the submit's correlation id
 * (server/publicSolutionRequestStore.ts); read back by the confirmation page
 * and by `/book?ref=`. One pattern, one normalizer, for both sides.
 */
export const REFERENCE_PATTERN = /^DE-[0-9A-HJKMNP-TV-Z]{6}$/;

/** Accepts what a buyer types or reads back: lower case, missing hyphen, I/L for 1, O for 0. */
export function normalizeSolutionReference(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let cleaned = value.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!cleaned.startsWith("DE")) return null;
  cleaned = `DE-${cleaned.slice(2).replace(/[IL]/g, "1").replace(/O/g, "0")}`;
  return REFERENCE_PATTERN.test(cleaned) ? cleaned : null;
}
