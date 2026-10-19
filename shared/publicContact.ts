/**
 * The four public contact fields (Company name, Name, Email, Phone) and the
 * one set of checks the Store's contact step and the public solution route
 * share, so a buyer is never told "invalid" by one side and "fine" by the
 * other. Messages are in buyer words; the server returns the same text.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PublicContactFields = {
  organizationName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

/** Account type for the solution profile. */
export type AccountType = "individual" | "business" | "";

export type PublicContactField = keyof PublicContactFields;

export const PUBLIC_CONTACT_MESSAGES: Record<PublicContactField, string> = {
  organizationName: "Enter your company name.",
  contactName: "Enter the name DE should ask for.",
  contactEmail: "Enter an email DE can reply to, for example you@company.com.",
  contactPhone: "Enter a phone number DE can call, for example 480-555-0100.",
};

export function isValidPublicEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPublicPhone(value: string): boolean {
  return value.replace(/\D/g, "").length >= 7;
}

/** Placeholders that should never be accepted as a real name. */
const NAME_PLACEHOLDERS = new Set([
  "test",
  "testing",
  "asdf",
  "qwerty",
  "n/a",
  "na",
  "none",
  "unknown",
  "anonymous",
  "xxx",
  "foo",
  "bar",
]);

/**
 * A reasonable quality check for a person's name. Allows Unicode letters,
 * spaces, apostrophes, hyphens, and a small set of name punctuation. Rejects
 * empty values, numbers-only entries, obvious placeholders, and runs of the
 * same character. Does not require a minimum length or exactly two words, and
 * does not claim to verify legal identity.
 */
export function isValidName(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed === "") return false;
  // Must contain at least one letter.
  if (!/\p{L}/u.test(trimmed)) return false;
  // Reject numbers-only entries.
  if (/^\d+$/.test(trimmed)) return false;
  // Reject placeholders (case-insensitive, ignoring punctuation).
  const normalized = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (NAME_PLACEHOLDERS.has(normalized)) return false;
  // Allow letters, spaces, apostrophes, hyphens, periods, commas.
  if (!/^[\p{L}\s'\-.,]+$/u.test(trimmed)) return false;
  // Reject runs of the same character (4+).
  if (/(.)\1{3,}/.test(trimmed)) return false;
  // Reject obvious placeholder runs like "aaaa" already covered; reject 3+ identical tokens.
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length >= 3 && new Set(tokens).size === 1) return false;
  return true;
}

/** Problem message for a name field, or null when acceptable. */
export function nameProblem(value: string, label = "name"): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return `Enter your ${label}.`;
  if (!isValidName(trimmed)) return `Enter a real ${label}.`;
  return null;
}

/** Per-field problems, in form order. Empty means all four are usable. */
export function publicContactProblems(fields: Partial<PublicContactFields>): Partial<Record<PublicContactField, string>> {
  const problems: Partial<Record<PublicContactField, string>> = {};
  if ((fields.organizationName ?? "").trim().length < 2) problems.organizationName = PUBLIC_CONTACT_MESSAGES.organizationName;
  if (!isValidName(fields.contactName ?? "")) problems.contactName = PUBLIC_CONTACT_MESSAGES.contactName;
  if (!isValidPublicEmail(fields.contactEmail ?? "")) problems.contactEmail = PUBLIC_CONTACT_MESSAGES.contactEmail;
  if (!isValidPublicPhone(fields.contactPhone ?? "")) problems.contactPhone = PUBLIC_CONTACT_MESSAGES.contactPhone;
  return problems;
}

/** Masks for the confirmation: "j***@acme.com", "···-4567". Never the full value from a reference alone. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 1)}***@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "";
  return `···-${digits.slice(-4)}`;
}
