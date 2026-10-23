import { PRIMARY_PHONE } from "@shared/companyContact";

/**
 * Homepage v2 shared content. The approved reference (design/reference/homepage-v2) is the
 * source of truth for copy; values that more than one section uses live here.
 */

/** Final name for the under-30-user lane (Joe, 2026-10-22). Keep every mention on this constant. */
export const THIRD_LANE_NAME = "Ready-to-Work IT";

/** The phone number comes from the canonical company contact module, never a literal here. */
export const PHONE_DISPLAY = PRIMARY_PHONE.display;
export const PHONE_HREF = PRIMARY_PHONE.telHref;
export const EMAIL_ADDRESS = "info@digeratiexperts.com";

/** Public concept objects (client/public/concepts/objects). */
export function objectIcon(name: string): string {
  return `/concepts/objects/obj-${name}.webp`;
}

/** Contact form "Interested in" options, in the approved reference order. */
export const INTEREST_OPTIONS = [
  "Cyber Risk Assessment (required for managed IT)",
  "Fully managed IT & cybersecurity",
  "Co-managed IT",
  `${THIRD_LANE_NAME} (devices + licenses, under 30 users)`,
  "Managed Security Services",
  "Compliance & Governance",
  "Incident Response",
] as const;
