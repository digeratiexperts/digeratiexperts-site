# Store (Door 2) — Baseline A critique, 2026-09-27

Captured from the running app at `origin/main` dd6a1f8 (memory-only server), consent pre-seeded,
walking /store → /store/solutions/identity-access → /store/solution → /solutions/request → submit,
at 390 / 768 / 1440. Screenshots and `report.json` sit beside this file. Everything below was
seen in the rendered page, not inferred from source.

## Measured

| Screen | 390 height (vh) | 768 (vh) | 1440 (vh) | Overflow | Controls in `<main>` |
|---|---|---|---|---|---|
| /store index | 9,616px (11.4) | 6,040px (5.9) | 4,177px (4.6) | 0 | 52 |
| family page | 4,769px (5.7) | — | — | 0 | 6 |
| /store/solution | 6,851px (8.1) | — | — | 0 | 24 |
| /solutions/request | 3,236px (3.8) | — | — | 0 | 2 |

Zero horizontal overflow anywhere. No page errors (the four console errors are proxy-blocked
third-party loads, not app errors).

## What a buyer meets, in order

1. **Two promo strips + nav** at 1440 eat 155px before the Store begins; the announcement bar
   sells an assessment on top of a page whose job is to sell a solution.
2. **Hero** "Start with your business. Then solve what hurts." is fine. The subcopy narrates
   internal policy ("without … exposing a vendor catalog") — the buyer never asked about a
   vendor catalog.
3. **Step 0 · Profile**: a six-field form is the first thing asked, before any value is shown.
   The label "Step 0" and the "01–04 how it works" list that follows disagree with the
   "Step 1 / Step 2 / Step 3 preview / Step 4" labels used on later screens.
4. **"Your Solution" floating chip** overlaps the profile card's "Autosaves on this device" pill
   at 390 and shares the corner with the DE Desk launcher. Overlapping chrome (§11 governance).
5. **13 family cards**, each a third card dialect (dark header with electric radial, paper body,
   white action row) with a 13-hue rainbow of icon tints. A flat grid — the five plain-English
   goals exist only as filter pills, so the taxonomy is browsed, not guided.
6. **Family page**: nothing is shown until the buyer makes a commercial choice
   (Standalone / Co-Managed / Help me choose). The package, outcomes and boundaries are hidden
   behind the decision the buyer is least equipped to make first. The primary button is disabled
   until then.
7. **Workspace** (/store/solution): six stacked boxed sections on `#111` — profile again, needs,
   offer again (asked a second time, now global instead of per need), package, delivery, save —
   plus a sticky status rail. Every chapter is a rounded island: the exact pattern
   `design/UI-STYLE-RULES.md` §4 lists as a paid-for mistake.
8. **Raw enum values reach the customer**: the status rail prints `co_managed`; the contact
   summary prints `remote_assist` and `as_needed`.
9. **Toasts** ("Pain / need added", "Added to Your Solution") cover the drawer header, the
   status rail and the confirmation card, and survive three route changes.
10. **Contact** asks the right four fields, but the summary above them is a wall of small grey
    text and the form has no reassurance about what happens after submit.
11. **Confirmation** renders inside the contact page under the same H1 ("Who should DE follow
    up with?"), shows a raw UUID as the reference, and offers one action: "Return to the Store".
    No "what happens next", no email acknowledgement, no phone, no way back to the summary.

## Systemic findings (fix the system, not the screen)

- **P0 — the flow asks the same question twice and hides value behind it.** The relationship
  choice appears on the family page (per need) and on the workspace (global, overwriting), and
  the family page shows no package until it is answered.
- **P0 — no confirmation experience.** Submission ends in an inline card with a UUID.
- **P1 — three card dialects and a rainbow.** Paper/dark/white cards, 13 icon hues, boxed
  chapters. Not one system.
- **P1 — step vocabulary drifts** across screens (Step 0/1/2/3 preview/4/4).
- **P1 — floating chrome overlaps** at 390 (Your Solution chip vs profile pill vs Desk launcher).
- **P1 — raw enums in customer copy.**
- **P2 — copy narrates internal policy** (vendor catalog, managed-services operating model,
  "composed solution request") instead of the buyer's outcome.
- **P2 — length.** 11.4 viewports on a phone for a page whose job is "pick what hurts".

## What is right and must be kept (Preservation Law)

- Profile once, reused for sizing. The four-field contact rule. No payment, no vendor catalog.
- Standalone vs Co-Managed semantics and the "Help me choose" state.
- Customer-readable bill of materials with profile-derived quantities.
- Delivery & setup published per package (shipping / technician / remote support).
- Electric accent, `data-accent="electric"`, the locked Store tokens.
- Existing routes, draft key `de-solution-draft-v2`, `/api/public/solutions/request` contract.
- The Client Marketplace link with `returnTo`, Ask DE, zero horizontal overflow.
