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
  /** Invoice questions when card checkout is not connected. Already used by the portal pay route. */
  billingEmail: "billing@digeratiexperts.com",
  privacyEmail: "privacy@digeratiexperts.com",
  website: "https://digeratiexperts.com",
  bookingUrl: "https://meet.digerati-experts.com/",
  streetAddress: "3165 S Alma School Rd Suite 29",
  addressLocality: "Chandler",
  addressRegion: "AZ",
  postalCode: "85248",
  addressCountry: "US",
  areaServed: "Arizona and Greater Phoenix (Chandler, Phoenix, Scottsdale, Tempe, Mesa, Gilbert)",
  /** Verified Google Business Profile listing (CID — not a Place ID). */
  mapsUrl: "https://maps.google.com/?cid=1710856351091471339",
} as const;

/** Public social profiles already used on the site. Do not invent new handles. */
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

export function formatAddressOneLine(): string {
  return `${COMPANY.streetAddress}, ${COMPANY.addressLocality}, ${COMPANY.addressRegion} ${COMPANY.postalCode}`;
}
