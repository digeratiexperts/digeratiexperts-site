import { CTA } from "@/lib/ctaCopy";

/**
 * Homepage CTA system (homepage v2 at `/`). Primary and compact labels are sourced from
 * `client/src/lib/ctaCopy.ts`, the site-wide source of truth (Joe, 2026-10-26: "Keep
 * 'Get My Cyber Risk Assessment' as the canonical primary CTA. Maintain ctaCopy.ts as the
 * source of truth"). So the homepage, shared chrome (MegaMenu, StickyCTABar), Store,
 * campaigns and solutions all read the same primary label.
 *
 * The secondary and form-submit labels stay homepage-specific: a short "Talk to an Expert"
 * always paired with the phone number, and the assessment form's button. `compact` is used
 * by shared chrome (nav / floating bar), not on the homepage itself, and now shares the
 * ctaCopy source so those surfaces stay in step.
 */
export const HOME_CTA = {
  /** Primary assessment action: every primary surface on the homepage. From ctaCopy. */
  primary: CTA.primary,
  /** Compact surfaces (nav, floating bar) — same source as shared chrome. From ctaCopy. */
  compact: CTA.primaryNavCompact,
  /** Secondary action: an expert conversation, always paired with the phone number. */
  secondary: "Talk to an Expert",
  /** The assessment form's submit button. */
  formSubmit: "Request Assessment",
  /** Same destination the hero and every primary CTA already used. */
  primaryHref: "/book",
} as const;
