/**
 * DE offering names and rules shared by every marketing page (Joe, 2026-10-22).
 *
 * - The Cyber Risk Assessment is REQUIRED before Fully Managed and Co-Managed IT.
 * - The third lane serves businesses under 30 users, in Arizona and beyond: DE buys,
 *   sets up, tests and ships the devices, and provides per-user licenses. No assessment
 *   required. Distributors are never named publicly.
 * - Alert monitoring (ALERT_MONITORING_CLAIM) is included on ALERT_MONITORING_TIERS only.
 */

export {
  ALERT_MONITORING_CLAIM,
  ALERT_MONITORING_CLAIM_PHRASE,
  MDR_ADDON_CLAIM,
  ENTERPRISE_MDR_CLAIM,
  ENTERPRISE_MDR_PHRASE,
} from "@shared/publicSecurityClaims";

/** Final name for the under-30-user lane. Keep every mention on this constant. */
export const THIRD_LANE_NAME = "Ready-to-Work IT";

/** One sentence for pages that must state the assessment rule. */
export const ASSESSMENT_REQUIRED_LINE =
  "Fully managed and co-managed plans start with a required Cyber Risk Assessment.";

/** Tiers that include ALERT_MONITORING_CLAIM. */
export const ALERT_MONITORING_TIERS = "ProActive Business and Enterprise";

export {
  PAID_STABILIZATION_PRICE,
  SECURITY_SNAPSHOT_PRICE,
  ASSESSMENT_CREDIT_LINE,
} from "@shared/assessmentOffers";
