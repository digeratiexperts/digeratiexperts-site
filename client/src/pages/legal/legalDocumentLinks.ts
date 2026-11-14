/** In-page links for names used in the published legal drafts. Visible text is unchanged. */

export const LEGAL_DOCUMENT_HREFS: Array<{ phrase: string; href: string }> = [
  { phrase: "Cookie and Tracking Notice", href: "/legal/cookie-notice" },
  { phrase: "AI Use Disclosure", href: "/legal/ai-use" },
  { phrase: "Vulnerability Disclosure Policy", href: "/trust/vulnerability-disclosure" },
  { phrase: "Acceptable Use Policy", href: "/legal/aup" },
  { phrase: "DE Acceptable Use Policy", href: "/legal/aup" },
  { phrase: "Subprocessor List", href: "/legal/subprocessors" },
  { phrase: "Privacy Policy", href: "/legal/privacy-policy" },
  { phrase: "Data Processing Addendum", href: "/legal/dpa" },
  { phrase: "Terms of Use", href: "/legal/terms-of-use" },
  { phrase: "Website and Portal Terms of Use", href: "/legal/terms-of-use" },
];

/**
 * Preferred routes for the public legal set (P-01..P-08).
 * Accessibility and the vulnerability policy stay on their existing /trust URLs.
 * A /legal/vulnerability-disclosure path redirects there so in-policy links resolve.
 */
export const LEGAL_FOOTER_LINKS = [
  { label: "Privacy Policy", href: "/legal/privacy-policy" },
  { label: "Terms of Use", href: "/legal/terms-of-use" },
  { label: "Cookie Notice", href: "/legal/cookie-notice" },
  { label: "AI Use", href: "/legal/ai-use" },
  { label: "Acceptable Use Policy", href: "/legal/aup" },
  { label: "Subprocessors", href: "/legal/subprocessors" },
  { label: "Accessibility", href: "/trust/accessibility" },
  { label: "Vulnerability Disclosure", href: "/trust/vulnerability-disclosure" },
] as const;

export const LEGAL_NAV_DOCS = [
  { label: "Privacy Policy", href: "/legal/privacy-policy" },
  { label: "Terms of Use", href: "/legal/terms-of-use" },
  { label: "Cookie and Tracking Notice", href: "/legal/cookie-notice" },
  { label: "How Digerati Experts Uses AI", href: "/legal/ai-use" },
  { label: "Acceptable Use Policy", href: "/legal/aup" },
  { label: "Subprocessor List", href: "/legal/subprocessors" },
  { label: "Data Processing Addendum", href: "/legal/dpa" },
  { label: "Master Service Agreement", href: "/legal/msa" },
  { label: "Sample Statement of Work", href: "/legal/sample-sow" },
  { label: "Service levels", href: "/legal/sla" },
  { label: "Accessibility Statement", href: "/trust/accessibility" },
  { label: "Vulnerability Disclosure", href: "/trust/vulnerability-disclosure" },
] as const;
