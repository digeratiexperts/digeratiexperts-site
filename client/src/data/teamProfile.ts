import type { VerifiedCredential } from "./credentials";

/**
 * The Team page's owner details and certifications, in one place for DE to
 * fill in. Nothing here is invented: an empty value renders nothing.
 *
 * - `title`: DE's formal title for the owner (for example as it appears on a
 *   signature). An empty value shows `role` alone.
 * - OWNER_CERTIFICATIONS: each entry needs the issuer's own verification link
 *   and the date someone at DE opened it (docs/CLAIMS-REGISTER.md, rule 3).
 *   They join VERIFIED_CREDENTIALS in credentials.ts, so the Team page's
 *   "Credentials you can check" list and every other credentials list show them.
 */
export const TEAM_OWNER = {
  name: "Joseph Petro",
  /** The label the page has always shown above the name. */
  role: "Founder",
  /**
   * Joe, 2026-10-14 ("do my items for me"): the title the live homepage
   * already publishes in its team section, "Founder & Chief Technology
   * Strategist" (client/src/pages/versions/v8/sections/09-team.tsx; Published
   * in docs/CLAIMS-REGISTER.md), so the Team page stops showing less than `/`.
   * "Founder" is `role` above; change both places together.
   */
  title: "Chief Technology Strategist",
} as const;

/**
 * DE to supply, one entry per certification, for example:
 * { kind: "certification", name: "<as the issuer names it>", holder: TEAM_OWNER.name,
 *   issuer: "<issuing body>", verifyUrl: "https://<issuer's record>", checkedOn: "YYYY-MM-DD" }
 */
export const OWNER_CERTIFICATIONS: VerifiedCredential[] = [];
