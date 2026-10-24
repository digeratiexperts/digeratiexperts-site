/**
 * Homepage CTA system (V8 and homepage v2 at /) — one label per role, one primary and one secondary
 * button style, from docs/plans/opencode/lane-h-homepage.md and
 * docs/plans/opencode/DE-homepage-refinement-prompt.md §2.
 *
 * Deliberately homepage-local: `client/src/lib/ctaCopy.ts` is the site-wide copy
 * source for every other surface (Store, campaigns, solutions, shared chrome) and
 * is outside Lane H's ownership. When the compact labels are aligned in shared
 * chrome (MegaMenu, StickyCTABar) this module and ctaCopy can be reconciled by
 * their owners.
 */
export const HOME_CTA = {
  /** Primary assessment action: every primary surface on the homepage. */
  primary: "Schedule Your Cyber Risk Assessment",
  /** Compact surfaces (nav, floating bar). Shared chrome owns those; kept here for the follow-up. */
  compact: "Schedule Assessment",
  /** Secondary action: an expert conversation, always paired with the phone number. */
  secondary: "Talk to an Expert",
  /** The assessment form's submit button. */
  formSubmit: "Request Assessment",
  /** Same destination the hero and every primary CTA already used. */
  primaryHref: "/book",
} as const;
