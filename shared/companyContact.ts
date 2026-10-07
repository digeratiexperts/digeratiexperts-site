/**
 * Canonical public contact identity for Digerati Experts.
 * Import from here instead of hardcoding phone/email literals.
 *
 * Primary public sales/business number: 325-480-9870
 * Additional numbers must be labeled by function (Sales / Client Support / Emergency).
 * Do not invent alternate numbers; confirm with Joseph Petro before changing.
 * Never publish a personal/cell number as the public NAP.
 */

export type PhoneRole = "primary" | "sales" | "client_support" | "emergency";

export interface CompanyPhone {
  role: PhoneRole;
  /** Display form, e.g. 325-480-9870 */
  display: string;
  /** tel: href, e.g. tel:+13254809870 */
  telHref: string;
  /** E.164, e.g. +13254809870 */
  e164: string;
  /** Schema.org telephone, e.g. +1-325-480-9870 */
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

/** Official public NAP — sales / business / click-to-call. */
export const PRIMARY_PHONE: CompanyPhone = {
  role: "primary",
  display: "325-480-9870",
  telHref: "tel:+13254809870",
  e164: "+13254809870",
  schemaTelephone: "+1-325-480-9870",
  label: "Sales & Business",
};

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
