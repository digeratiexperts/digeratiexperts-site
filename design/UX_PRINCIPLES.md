# UX principles

Visual System v2 layers (evidence, HUD, diagrams) sit on this file — they do not replace it. See `VISUAL_SYSTEM_V2.md`. Authority tiers: `DESIGN-AUTHORITY.md` — the accessibility, state, responsiveness, overlap and visual-QA rules here are Tier 0 and apply in every task mode; "Content preservation" is a Maintenance Mode / integration rule.

Act as a senior product designer, UX designer, visual designer, and frontend engineer.

Do not optimize only for code correctness. Optimize for the final rendered experience.

A page can have technically correct code and still be considered a failure if the visual result feels generic, amateur, cluttered, inconsistent, or poorly composed.

## Design first

Before making meaningful UI changes:

1. Inspect the existing page.
2. Inspect related components.
3. Understand the current design system.
4. Identify existing reusable patterns.
5. Consider desktop, tablet, and mobile.
6. Consider hierarchy, spacing, typography, imagery, interaction, and visual rhythm.
7. Then implement.

Do not make isolated changes that create inconsistency elsewhere.

Never judge UI from source code alone. Code → render → screenshot → critique → iterate.

Inspect 390 / 768 / 1440 at minimum.

## Visual quality

Prioritize: clear hierarchy, sophisticated typography, intentional whitespace, strong composition, restrained color, consistent spacing, subtle borders, controlled contrast, meaningful imagery, purposeful interaction, consistent visual language.

Avoid generic AI/SaaS aesthetics: excessive gradients, glow, glassmorphism everywhere, random rounded cards, giant floating blobs, cyberpunk, meaningless particles, excessive animations, generic 3D, stock-looking imagery, arbitrary shadows, decoration without purpose.

## Component consistency

If multiple components perform the same visual/function role: reuse, extend, or create a shared component. Do not create several slightly different implementations of the same UI pattern. Before introducing a new value, check whether an existing design token already exists.

## UX states

Do not design only the happy path. Consider default, hover, focus, active, disabled, loading, empty, error, success. Interactive elements must communicate their state clearly.

Honest empty states over fabricated content (`.cursorrules` §36).

## Accessibility

Maintain sufficient contrast, visible focus states, keyboard accessibility, semantic HTML, accessible labels, usable touch targets (~44×44px), reduced-motion support. Never sacrifice accessibility for aesthetics. Target WCAG 2.2 AA (`.cursorrules` §12).

## Responsiveness

Never simply shrink desktop layouts. Consider whether components should stack, reorder, resize, simplify, change alignment, change navigation behavior, alter imagery, or change interaction patterns for smaller screens.

## Content preservation (Maintenance Mode and production integration)

Preserve existing DE content, CTAs, nav, and stats unless DE explicitly approves removal. Prefer elevate → consolidate → relocate → reuse. In Exploration Mode (`DESIGN-AUTHORITY.md`) a concept may restructure how content is presented, but the content, routes, forms and functionality still survive when the chosen concept is integrated.

Canonical portal login: `https://portal.digeratiexperts.com/portal/login` — never invent `//login`.

## No overlapping layers (hard rule)

Two independently-interactive pieces of fixed/floating chrome must never occupy the same screen space. This is not a style preference — DE has hit this bug repeatedly (sticky CTA over product cards, cookie banner over checkout buttons, and most recently the Ask DE launcher covering the Store's "Your Solution" cart button on `/store` and `/solutions/business-needs`).

- Any `position: fixed` or `position: absolute` element anchored to a screen edge (launcher buttons, carts, sticky bars, banners, toasts, callouts) must position itself using the shared chrome-coordination CSS custom properties (`--de-chrome-inset`, `--de-canvas-gutter`, `--de-unified-bar-h`, `--de-cookie-h`, `--de-sticky-cta-h`, etc. — see `client/src/index.css` and `client/src/lib/stickyCtaVisibility.ts`), not hardcoded `top/right/bottom/left` pixel or Tailwind spacing values. A new floating element publishes its own height as a CSS var (the same pattern `PublicSolutionCart` and `HomepageOnPageNav` use) so anything that needs to stack above it can do so precisely instead of guessing an offset.
- Before adding any new floating/fixed element, check what else already floats on the pages it will appear on and verify — by rendering, not by reading code — that neither element covers the other at 390 / 768 / 1440.
- The one sanctioned exception: a layer may render over other content if that content is deliberately dimmed or blurred to read as "behind" the active layer (a modal scrim, a blurred search bar under an open overlay). Two fully-opaque, independently-clickable elements sitting on top of each other with no visual signal that one is inactive is always a bug, never a valid layout.
- A "flashy" callout/notification bubble anchored to a compact button is itself a floating layer and is subject to this rule — it must clear every other floating element on the page (not just the button it points at), the same way `SiteBottomBar`'s Ask DE callout clears `--de-store-cart-h` instead of only clearing the launcher button's own height.

## Visual QA

For meaningful UI work: run the application, inspect the rendered page, capture at relevant viewports, look for visual problems, fix them, re-inspect. Never assume the UI is correct because the code compiles.

## Definition of done

A UI task is not complete merely because the code compiles, the component renders, or the requested element exists.

It is complete when the rendered experience is visually coherent, responsive, accessible, and consistent with the site's design system.

Use `.cursor/skills/visual-audit/SKILL.md` before implementing UI changes.
