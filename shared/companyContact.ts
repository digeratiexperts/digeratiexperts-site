/**
 * Canonical public contact identity for Digerati Experts.
 * Import from here instead of hardcoding phone/email literals.
 *
 * The public phone number is set in one place: PUBLIC_PHONE_NUMBER below.
 * Until DE has a dedicated public line it holds PUBLIC_PHONE_PLACEHOLDER, and
 * every call link, phone button and schema telephone stays hidden.
 * Additional numbers must be labeled by function (Sales / Client Support / Emergency).
 * Do not invent alternate numbers; confirm with Joseph Petro before changing.
 * Never publish a personal/cell number as the public NAP.
 */

export type PhoneRole = "primary" | "sales" | "client_support" | "emergency";

export interface CompanyPhone {
  role: PhoneRole;
  /** Display form, e.g. 480-555-0100 (the placeholder while unset) */
  display: string;
  /** tel: href, e.g. tel:+14805550100 (empty while unset) */
  telHref: string;
  /** E.164, e.g. +14805550100 (empty while unset) */
  e164: string;
  /** Schema.org telephone, e.g. +1-480-555-0100 (omitted while unset) */
  schemaTelephone?: string;
  /** Short label when multiple numbers appear */
  label: string;
}

export const COMPANY = {
  legalName: "Digerati Experts",
  email: "info@digeratiexperts.com",
  supportEmail: "support@digeratiexperts.com",
  /** Sales department inbox (confirmed by DE, 2026-10-03; note the hyphenated domain). */
  salesEmail: "sales@digerati-experts.com",
  /** Invoice questions when card checkout is not connected. Already used by the portal pay route. */
  billingEmail: "billing@digeratiexperts.com",
  privacyEmail: "privacy@digeratiexperts.com",
  website: "https://digeratiexperts.com",
  bookingUrl: "https://meet.digerati-experts.com/",
  /** Public NAP is city only (Joe, 2026-10-07): no street or ZIP anywhere on the site. */
  addressLocality: "Chandler",
  addressRegion: "AZ",
  addressCountry: "US",
  areaServed: "Arizona and Greater Phoenix (Chandler, Phoenix, Scottsdale, Tempe, Mesa, Gilbert)",
  /** Verified Google Business Profile listing (CID — not a Place ID). */
  mapsUrl: "https://maps.google.com/?cid=1710856351091471339",
  /** Map pin for schema.org GeoCoordinates (city level, as already published). */
  geo: { latitude: 33.3062, longitude: -111.8413 },
} as const;

/**
 * Social profiles. Do not invent new handles.
 * Only PUBLIC_SOCIAL_LINKS are rendered or put in schema `sameAs`.
 * 2026-10-07 check: facebook.com/digeratiexperts shows "content isn't available"
 * and x.com/digerati_experts is "profile not found"; both stay out until DE
 * confirms the real URLs.
 */
export const COMPANY_SOCIAL = {
  linkedin: {
    name: "LinkedIn",
    href: "https://www.linkedin.com/company/digerati-experts",
  },
  facebook: {
    name: "Facebook",
    href: "https://www.facebook.com/digeratiexperts",
  },
  twitter: {
    name: "Twitter",
    href: "https://twitter.com/digerati_experts",
  },
  instagram: {
    name: "Instagram",
    href: "https://www.instagram.com/digerati.experts",
  },
} as const;

/** The social profiles that are live and published (site links + schema sameAs). */
export const PUBLIC_SOCIAL_LINKS = [
  { key: "linkedin", ...COMPANY_SOCIAL.linkedin },
  { key: "instagram", ...COMPANY_SOCIAL.instagram },
] as const;

/**
 * Literal token used wherever the public number is not set yet. Legal pages,
 * document templates and email templates may print it as plain text so a
 * single find-and-replace can fill them in later.
 */
export const PUBLIC_PHONE_PLACEHOLDER = "[DE_PUBLIC_PHONE]";

/**
 * The public business number. Set this to the real line in 480-555-0100 form
 * to turn phone links, buttons and schema telephone back on everywhere.
 */
export const PUBLIC_PHONE_NUMBER: string = PUBLIC_PHONE_PLACEHOLDER;

function nanpDigits(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

function buildPrimaryPhone(value: string): CompanyPhone {
  const digits = nanpDigits(value);
  if (!digits) {
    return { role: "primary", display: PUBLIC_PHONE_PLACEHOLDER, telHref: "", e164: "", label: "Sales & Business" };
  }
  const display = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return {
    role: "primary",
    display,
    telHref: `tel:+1${digits}`,
    e164: `+1${digits}`,
    schemaTelephone: `+1-${display}`,
    label: "Sales & Business",
  };
}

/** Official public NAP - sales / business / click-to-call. */
export const PRIMARY_PHONE: CompanyPhone = buildPrimaryPhone(PUBLIC_PHONE_NUMBER);

/** True once a real public number is configured. Gate every tel: link and phone button on this. */
export function hasPublicPhone(): boolean {
  return PRIMARY_PHONE.telHref !== "";
}

/**
 * Sentence fragment for "how to reach us" copy: "call us at 480-555-0100"
 * when a number is set, otherwise "email us at info@digeratiexperts.com".
 */
export function reachUsPhrase(): string {
  return hasPublicPhone() ? `call us at ${PRIMARY_PHONE.display}` : `email us at ${COMPANY.email}`;
}

/**
 * `{ label, href }` call-to-action for the public number, or undefined while
 * it is unset so optional CTA slots simply drop the call button.
 */
export function phoneAction(label: string, testId?: string): { label: string; href: string; testId?: string } | undefined {
  if (!hasPublicPhone()) return undefined;
  return testId ? { label, href: PRIMARY_PHONE.telHref, testId } : { label, href: PRIMARY_PHONE.telHref };
}

/** Schema.org `telephone` property, or nothing while the number is unset. */
export function schemaTelephoneProps(): { telephone?: string } {
  return hasPublicPhone() ? { telephone: PRIMARY_PHONE.schemaTelephone || PRIMARY_PHONE.e164 } : {};
}

/**
 * Known phone identities. Only `primary` is public.
 * Do not add a second unlabeled public number.
 */
export const PHONE_REGISTRY = {
  primary: PRIMARY_PHONE,
} as const;

/** Public address line: city only (service-area business). */
export function formatAddressOneLine(): string {
  return `${COMPANY.addressLocality}, ${COMPANY.addressRegion}`;
}
