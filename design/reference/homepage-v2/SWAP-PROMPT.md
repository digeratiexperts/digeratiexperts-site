# Prompt for Claude Code: swap in Homepage v2, keep the current homepage at a new URL

Copy everything below the line into Claude Code (the agent with GitHub access). Attach `homepage-v2-reference.html` with it.

---

## Status update (2026-10-22, 22:45)

- **PR #699 is closed.** Reopen it, or open a new **draft** PR from `claude/homepage-v2-20261022`. Step 1 (`/concepts/home-classic`) is already on that branch. Keep the PR a draft: merging to `main` deploys live, and only Joe approves that merge.
- **PR #698 (Lane H refinement) is ON HOLD by Joe's decision. Do not merge it.** v2 is the direction. Reuse these Lane H ideas inside v2 where they fit: one CTA system (`v8/cta.ts` labels), the threat feed moved off the homepage to a Security Updates link (the v2 reference's feed section becomes a short link block), canonical service names, and section-context CTAs. Lane H does **not** carry the offering fixes (assessment required, Ready-to-Work IT, 24/7 = Business+), so v2's content rules win wherever they differ.
- **The reference file is in the repo:** branch `claude/homepage-v2-reference`, folder `design/reference/homepage-v2/`. `sha256sum reference.html` must start with `7d9bbfe4e81d`.

## Goal

1. Move the **current homepage** (what renders at `/` today) to **`/concepts/home-classic`**, unchanged.
2. Make **Homepage v2** (the attached `homepage-v2-reference.html`) the new homepage at **`/`**, rebuilt as real React components in this codebase.

Work on a new branch: `claude/homepage-v2-20261022`. Open a PR into `main`. **Do not merge and do not deploy.** Joe reviews the PR and deploys production himself.

## Step 1: Preserve the current homepage (do this first)

- Find the component/route that renders `/` today. Copy or re-export it so it renders, pixel-identical, at `/concepts/home-classic`.
- Follow the same pattern `/concepts/home-mesh` and `/concepts/mascots` already use (same layout wrapper, same `noindex` handling those concept pages have).
- Add `<meta name="robots" content="noindex">` to `/concepts/home-classic` so Google never sees two homepages.
- Leave `/concepts/home-mesh` and `/concepts/mascots` untouched.
- **Stop and report** after Step 1, with a screenshot of `/concepts/home-classic` next to the current `/`, before you start Step 2.

## Step 2: Build Homepage v2 at `/`

The attached HTML file is the **visual and content source of truth**. Port it to components. Don't paste raw HTML into one component.

### Section order and color treatment (keep exactly)

Each section uses one of four token sets, applied as a class on the section:

| # | Section (id) | Token set |
|---|---|---|
| 1 | Hero (`hero`) | `t-sonoran`: Arizona dusk photo behind, dark overlay |
| 2 | Pillars strip | default (Store) |
| 3 | Why we exist (`why`) | default (Store) |
| 4 | Threat stats (`stats`) | `t-ink` |
| 5 | What we tackle (`challenges`) | `t-signal` (pale blue + fine dot grid) |
| 6 | How to work with us (`services`) | `t-store` |
| 7 | What we protect (`protection`) | `t-ink` |
| 8 | How protection works (`how`) | `t-signal` |
| 9 | Client proof (`proof`) | `t-store` |
| 10 | Why Arizona businesses (`fit`) | `t-sonoran` (light stone) |
| 11 | Team (`team`) | `t-ink` |
| 12 | Industries (`industries`) | `t-store` |
| 13 | Pricing (`pricing`) | `t-ink` |
| 14 | Detection & response (`detect`) | `t-signal` |
| 15 | Security updates (`insights`) | `t-store` |
| 16 | FAQ (`faq`) | `t-sonoran` (light stone) |
| 17 | Assessment + contact (`contact`) | `t-ink` |

Rule behind it: Ink & Gold = proof and decision moments; Sonoran = Arizona/local moments; Signal Blue = how-it-works explanations; Store = everyday reading. Two adjacent sections never share a token set (the pillars strip is the only exception).

The four token sets are CSS custom properties at the top of the reference file (`:root,.t-store`, `.t-sonoran`, `.t-ink`, `.t-signal`). Port them into the site's styling system as scoped tokens. Keep the hex values exactly.

### Content rules (these are corrections, not suggestions)

- **"How to work with us"** must show the **Cyber Risk Assessment as the required first step** for Fully Managed and Co-Managed IT, with the two managed cards below it. A separate third card shows the third lane.
- **Third lane:** small businesses **under 30 users**, in Arizona and beyond. DE buys the devices, sets them up, tests them, ships them ready to use, plus per-user licenses (e.g. Microsoft 365). For business owners and IT departments. No assessment required. **Name: "Ready-to-Work IT" (final, Joe decided 2026-10-22).** Keep it in one constant (e.g. `THIRD_LANE_NAME`) so it stays consistent across the homepage, Store and Standalone page.
- **Never name distributors** (Pax8, Sherweb, Ingram, Griffin-IT) anywhere public.
- **24/7 MDR / SOC is Business and Enterprise only (Joe decided, 2026-10-22).** Keep the reference wording exactly. Office and IT never claim 24/7 MDR or SOC. Never write an unqualified "24/7 monitoring" claim. "24/7/365 emergency incident response" stays (published SLA line).
- The contact form's "Interested in" options must match the reference, including the third lane option.
- Joe's photo appears **only** in the Team section. **Never in the hero.**
- **Section labels are plain text.** Don't use the logo bar glyph as a section marker or background pattern.
- **Dex and Rati:** Dex sits on the hero assessment card, and Rati sits small in the corner of the detection card. **No captions or copy about either.** Use the existing mascot components from `/concepts/mascots`; don't redraw them.
- **Chat launcher:** keep the existing **Ask DE** launcher component (DE Desk speech-bubble icon, gold ring, "We're here to help."). Do not replace it with Dex.

### Assets

Use the assets the repo already has. Import them the way the codebase already does; don't hotlink the hashed `/assets/...` URLs from the reference file:
- logo (reverse version on dark)
- `de-hero-arizona-dusk-1600`
- `joe-petro-studio-blazer-white`
- `de-trust-assessment-desk-960`
- `google-review-qr.svg`
- the five industry images
- `/concepts/objects/obj-*.webp`

## Do NOT change

- Global nav, top bar, footer, routes other than `/` and the new `/concepts/home-classic`
- The Ask DE / DE Desk chat widget and its behavior
- Form submission wiring (keep posting wherever the current homepage forms post: Zoho, etc.). Only the visual layout and the dropdown options change.
- The live threat feed data source (the reference has static items; keep the real feed component)
- Analytics, SEO title/description, schema markup, cookie banner
- Any other page, the Store, the portal, the concept pages
- No new dependencies unless unavoidable. If you need one, ask first.

## Quality bar

- Responsive at 390px, 768px and 1280px, with no horizontal scroll. The "What we protect" tab strip scrolls inside itself on mobile.
- Visible keyboard focus. Protection tabs work with arrow keys (see the reference script).
- `prefers-reduced-motion` respected.
- Lighthouse accessibility ≥ 95 on `/`.

## Approved exceptions and image rule

- **Gold approved (Joe, 2026-10-22):** gold may be used for links, labels and accents **inside `t-ink` sections only**. Update `design/DESIGN-AUTHORITY.md` to record this exception. Everywhere else gold stays reserved for the wordmark and the featured-card accent bar.
- **Images:** use the **existing** assets exactly as listed above. Joe is commissioning a new custom DE visual system; current assets stay until their replacements are reviewed side by side and approved. Don't swap, regenerate or add new illustration styles in this PR.

## Report back with

1. Branch name and PR link
2. Screenshots of `/` at 1280px and 390px, and of `/concepts/home-classic`
3. List of files changed
4. Anything in the reference you couldn't match, and why
