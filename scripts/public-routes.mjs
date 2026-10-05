/**
 * Indexable public marketing routes, shared by the public-route smoke
 * (HTTP + render checks) and the accessibility smoke (axe). Add a new public
 * page here and both checks cover it.
 */
export const PUBLIC_ROUTES = [
  "/",
  "/solutions",
  "/solutions/proactive-it-ecosystem",
  "/solutions/proactive-office-ecosystem",
  "/solutions/proactive-business-ecosystem",
  "/solutions/proactive-enterprise-ecosystem",
  "/solutions/co-managed-it",
  "/solutions/standalone-services",
  "/solutions/managed-it-support",
  "/proactive-ecosystem-pricing",
  "/pricing",
  "/book",
  "/industries/healthcare",
  "/industries/law-firms",
  "/resources",
  "/resources/case-studies",
  "/resources/case-studies/healthcare-hipaa-readiness",
  "/resources/blog",
  "/resources/security-updates",
  "/about/client-bill-of-rights",
  "/trust",
  "/trust/trust-center",
  "/contact",
  "/store",
  "/about/press",
];

/** App surfaces beyond the marketing pages that the accessibility smoke also scans. */
export const APP_ENTRY_ROUTES = [
  "/store/solution",
  "/quote-wizard",
  "/portal/login",
  "/portal/signup",
  "/portal/forgot-password",
];
