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

/** Per-field problems, in form order. Empty means all four are usable. */
export function publicContactProblems(fields: Partial<PublicContactFields>): Partial<Record<PublicContactField, string>> {
  const problems: Partial<Record<PublicContactField, string>> = {};
  if ((fields.organizationName ?? "").trim().length < 2) problems.organizationName = PUBLIC_CONTACT_MESSAGES.organizationName;
  if ((fields.contactName ?? "").trim().length < 2) problems.contactName = PUBLIC_CONTACT_MESSAGES.contactName;
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
