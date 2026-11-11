import { CTA } from "@/lib/ctaCopy";

/**
 * Homepage CTA system (homepage v2 at `/`). Primary and compact labels are sourced from
 * `client/src/lib/ctaCopy.ts`, the site-wide source of truth (Joe, 2026-10-26: "Keep
 * 'Get My Cyber Risk Assessment' as the canonical primary CTA. Maintain ctaCopy.ts as the
 * source of truth"). So the homepage, shared chrome (MegaMenu, StickyCTABar), Store,
 * campaigns and solutions all read the same primary label.
 *
 * Homepage restructure (2026-11-11, pending Joe's approval in the PR): the homepage leads
 * with a short fit call (`fitCall`) and keeps the assessment as the step after it. ctaCopy.ts
 * is unchanged, so every other surface still leads with the assessment.
 *
 * The secondary and form-submit labels stay homepage-specific: a short "Talk to an Expert"
 * always paired with the phone number, and the assessment form's button. `compact` is used
 * by shared chrome (nav / floating bar), not on the homepage itself, and now shares the
 * ctaCopy source so those surfaces stay in step.
 */

/**
 * Length of the fit call, in minutes, once the matching Zoho Bookings service exists.
 * The booking embed on /book is a 30-minute call today, so the label names no length
 * until a 15-minute service is set up. Then set this to 15.
 */
export const FIT_CALL_MINUTES: number | null = null;

export const HOME_CTA = {
  /** Primary assessment action: the closing chapter's assessment form. From ctaCopy. */
  primary: CTA.primary,
  /** Compact surfaces (nav, floating bar) — same source as shared chrome. From ctaCopy. */
  compact: CTA.primaryNavCompact,
  /** The homepage's first action: a short call to see if we're a fit. */
  fitCall: FIT_CALL_MINUTES ? `Book a ${FIT_CALL_MINUTES}-Min Fit Call` : "Book a Fit Call",
  /** The existing Zoho Bookings page. */
  fitCallHref: "/book",
  /** Secondary action: an expert conversation, always paired with the phone number. */
  secondary: "Talk to an Expert",
  /** The assessment form's submit button. */
  formSubmit: "Request Assessment",
  /** Same destination the hero and every primary CTA already used. */
  primaryHref: "/book",
} as const;
