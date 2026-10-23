# Lane H — Homepage refinement (Wave 1)

Read `docs/plans/opencode/LANE-RULES.md` first, then `docs/plans/opencode/DE-homepage-refinement-prompt.md`.
Also read: `docs/VERSION-4-HOMEPAGE-SOURCE-OF-TRUTH.md`, `docs/HOMEPAGE-REFERENCE-REDESIGN-HANDOFF.md`, `docs/CLAIMS-REGISTER.md`, `docs/SITE-VISUAL-TASKS.md`.

**Mode:** Maintenance Mode. This is a refinement of the canonical homepage, not a redesign.
**You own:** homepage components and homepage-only styles. Nothing in the portal.

## Joe's decisions (already made)
- Refine the canonical homepage. Never replace it with a new concept.
- **"/" is the base.** If `/` and `/version-3` differ, bring these onto `/` if missing:
  - the eight cybersecurity blocks, with Risk & Exposure as #8
  - the corrected hero and the original Cyber Risk Assessment card
  - the "Your Arizona business" line, kept on one line
  - the earlier accessibility and Ask DE fixes

  List everything you brought over.
- **One CTA system:**
  - primary: "Schedule Your Cyber Risk Assessment"
  - compact surfaces: "Schedule Assessment"
  - secondary: "Talk to an Expert" plus the phone number
  - form button: "Request Assessment"
- **Assessment price:** leave a TODO for Joe in the FAQ. Don't state free or paid.
- **Client testimonial:** leave the slot unpublished with a TODO. Never invent one. Check `docs/CLAIMS-REGISTER.md` before keeping any claim.
- Rewrite internal/dev copy visitors can see. Apply canonical service names everywhere on the homepage.
- Move the threat feed off the homepage to a "Security Updates" link. Nothing is deleted outright; list every moved piece and where it went.

## Steps
1. Check `docs/SITE-VISUAL-TASKS.md` and open PRs. If another owner has a homepage task IN PROGRESS, stop and report it.
2. Write the Phase 0 report from the plan to `docs/lanes/lane-h-phase0.md`, then do Phase 1.
3. Render and verify at 390 / 768 / 1024 / 1280 / 1440. Check floating layers (Ask DE, cookie banner, cart, assessment CTA) don't overlap.
4. **PR must include:**
   - before/after screenshots at every width
   - the section map before → after
   - the moved-content list
   - the CTA replacement list
   - the concurrency report
