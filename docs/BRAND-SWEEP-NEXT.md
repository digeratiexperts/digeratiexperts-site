# Brand sweep — next pass

> **HISTORICAL RECORD (Tier 3 — `design/DESIGN-AUTHORITY.md`).** This document records what was decided, placed or guarded at a point in time. It explains *why* things are the way they are. Its "do not", "unchanged", "leave alone" and "keep" lines were the guardrails of that task; they do not prohibit future maintenance or redesign work unless a Tier 0–2 file promotes the decision.

**Date:** 2026-08-16  
**Settled on:** `cursor/homepage-retire-leftover-purple-chrome-3080` / PR #20  
**Do not start** another full-site rewrite. Start from the named flags below.

The audit (`scripts/brand-audit.mjs`) is a regression detector, not a requirement to force every route to zero flags.

## Already settled — do not re-litigate

- Marketing field stays the charcoal ladder. Primary CTA fill is solid `#D3126A`.
- Page families keep one topical hue: store → electric, support → cyan, resources → amber, everything else inherits magenta.
- **Locked (DE):** Blog/Journal and Store keep the colors they have now. Do not restyle those palettes. Rule: `.cursor/rules/blog-store-color-lock.mdc`.
- Store category pills stay pill-only and use 14 distinct hues. `comanaged_subscriptions`, `comanaged_onboarding`, and `digital_templates` keep their pre-sweep taxonomy colours (violet / purple / indigo). Do not apply the marketing-page “remove purple” rule to those pills. Everything else in the store palette stays as it currently looks. Guard: `client/src/components/store/categoryAccent.test.ts`.
- Portal, login, and signup join the magenta accent system when DE asks (see leftovers).
- Dead `Homepage.tsx` and its unused Figma sections were deleted after DE approval (`cursor/brand-leftovers-3080`). `/` stays `DigeratiHomepage`.
- Intentional exceptions live in `EXCEPTIONS` inside `scripts/brand-audit.mjs`: store category pills, vendor marks, hero lighting, semantic status/charts, official city chips.

## Named leftovers

| Item | Where | Why it is parked | Next move |
|------|--------|------------------|-----------|
| Magenta as text on paper (~3.6:1) | `ComplianceCertifications.tsx` outline buttons; `SecurityUpdates.tsx` source / severity labels | Settled: `--de-magenta-paper-ink` `#A30E52` for magenta text on paper. Dark-field labels use `--de-magenta-ink`. CTA fill stays `#D3126A`. | Done on `cursor/paper-magenta-ink-3080`. |
| Quote wizard 1.14:1 on slate-900 | `/quote-wizard` | Not an audit miss. Labels were `slate-900` on `--de-bg`. | Settled on `cursor/quote-wizard-contrast-3080`: form sits on `de-paper-lift-lg`. |
| `#5034ff` “Sign Up” | Official tools + portal login | DE asked these tools to join the accent system. | Official-tool violet glow retired. Portal Sign Up / fills move to magenta. Login stays `/portal/login`. |
| Yellow star glyphs | `/thank-you-success-page` | Unsourced ★★★★★ is a fabricated rating. | Removed. Badge now links to `/#google-reviews` with no star count. |
| Legacy unused purple | `Homepage.tsx` + unused Figma sections | DE approved deletion. | Deleted. Live homepage is still `DigeratiHomepage`. |
| Portal palette | `/portal/*` | DE asked for the pass. | `#5034ff` / violet fills → magenta. Semantic status purples left alone. |

## Optional later

1. Official-tool hue decision remainder (`#5034ff` vs electric vs magenta) if any glow remains.
