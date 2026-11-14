/**
 * Public 30-day money-back guarantee wording, from Legal.
 * Edit only this file when Legal updates the terms.
 *
 * If Joseph excludes onboarding fees:
 * - set GUARANTEE_ONBOARDING_FEE_CLAUSE to ""
 * - set GUARANTEE_SHORT_FEE_LABEL to "monthly managed-service fees"
 */

/** Drop this clause (set to "") if onboarding or setup fees are excluded. */
export const GUARANTEE_ONBOARDING_FEE_CLAUSE =
  ", including our onboarding or setup fees for those services,";

/** If onboarding fees are excluded, use "monthly managed-service fees". */
export const GUARANTEE_SHORT_FEE_LABEL = "managed-service fees";

export const GUARANTEE_MENU_LABEL = "30-Day Guarantee";

export const GUARANTEE_TITLE = "Our 30-Day Money-Back Guarantee";

/** Menu description (where shown), thank-you page, and Client Bill of Rights. */
export const GUARANTEE_SHORT = `30-day money-back guarantee on managed services: if you're not satisfied, tell us in writing within 30 days of your start date and we'll refund 100% of your ${GUARANTEE_SHORT_FEE_LABEL} for that period, no questions asked. Hardware, kits, and third-party licenses are not covered.`;

export const GUARANTEE_INTRO =
  "We want you to be confident in Digerati Experts managed services. If you're not satisfied with your first 30 days, you can cancel and get your managed-service fees back.";

export const GUARANTEE_HOW_IT_WORKS = `Within 30 days after your managed services start, email admin@digeratiexperts.com or use your client portal to tell us you want to cancel. You don't need to give a reason. We'll refund 100% of the managed-service fees you paid for that first 30 days${GUARANTEE_ONBOARDING_FEE_CLAUSE} to your original payment method within 14 days. Your managed services end that day with no early-termination fee, and we'll remove our agents and return your credentials and data.`;

export const GUARANTEE_WHATS_COVERED =
  "your first managed-services agreement with DE (ProActive IT, Office, or Business, and other recurring managed services), once per business.";

export const GUARANTEE_WHATS_NOT_COVERED =
  "hardware, kits, and other DE Store purchases (see our Return and Refund Policy); third-party software licenses and subscriptions we bought for you that the vendor won't refund (we pass along any refund we receive); assessment fees; completed project, professional-services, or incident-response work; and telecom usage, taxes, and government fees except where the law requires a refund.";

/** Public MSA page (/legal/msa) is a request summary and has no section anchors, so this is the page path only. */
export const GUARANTEE_MSA_HREF = "/legal/msa";

export const GUARANTEE_MSA_LINK_TEXT = "Master Services Agreement, Section 6.5";

export const GUARANTEE_AGREEMENT_CONTROLS_BEFORE = "The full terms are in our ";

export const GUARANTEE_AGREEMENT_CONTROLS_AFTER =
  ". If this page and your signed agreement differ, your signed agreement governs.";

/** Full closing sentence, with the MSA reference in the form used on /about/guarantee. */
export const GUARANTEE_AGREEMENT_CONTROLS =
  GUARANTEE_AGREEMENT_CONTROLS_BEFORE + GUARANTEE_MSA_LINK_TEXT + GUARANTEE_AGREEMENT_CONTROLS_AFTER;
