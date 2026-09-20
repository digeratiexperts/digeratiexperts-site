---
name: de-desk-ui
description: >-
  Designs and restyles the DE Desk support widget (Ask DE / Get Support /
  Client Tools) as one graphite application surface that matches the website —
  not a paper theme, not a cream card in a purple shell. Use when editing
  ZohoASAPWidget, DE Desk, Ask DE, ASAP widget, support modal tabs, or Desk UI.
---

# DE Desk UI

DE Desk is a **premium DE application surface** integrated into the website. It uses the same graphite/charcoal field, white type, and magenta actions as the rest of digeratiexperts.com.

Primary file: `client/src/components/ZohoASAPWidget.tsx`

Rejected by Joe (Tier 3 record — a concept that revisits one of these must answer why it failed):

- Paper / cream whole-widget theme
- Cream Ask DE well floating in a purple/magenta gradient shell
- Giant purple glow, lavender border bloom, nested rounded cards, double chrome
- Screenshots named `desk-*-target.png` that show that cream-in-purple look

## Before you edit

1. Read this skill, then [tokens-and-structure.md](tokens-and-structure.md).
2. Restyle from DE tokens (`--de-surface`, `--de-raised`, `--de-hairline`, `#D3126A`) — not from rejected PNGs.
3. Screenshot after changes at 390 / 768 / 1440.
4. Count Desk dialogs: exactly **one** `.de-desk-shell` / `role="dialog"` labeled “DE Desk help”.

## Non-negotiables (Tier 0 — every task mode; `design/DESIGN-AUTHORITY.md`)

- **Client Tools** is a front door, not a portal. Unauthenticated: sign-in + two “need help now” shortcuts. Authenticated: compact launcher groups only. No devices, RMM, vendor names, or fake service health.
- **Get Support** puts a possible security incident first, before the ordinary issue list — incident routing is functional, not styling.
- **Function labels**, not vendor names (`Start remote support` not `Zoho Assist`). Keep hrefs.
- Do **not** remove the three tabs, ticket-chip routing, unread/heads-up, drag/resize/expand, or the lock disclaimer without asking DE.
- Canonical portal login: `https://portal.digeratiexperts.com/portal/login` via `PORTAL_LOGIN`. Never invent `//login`.
- Do **not** add Pay Invoice / Billing as a Desk choice. Billing lives in Client Portal.
- Preserve advisor chat, poll, agent live, ticket API (fail-closed / real Desk result / visitor name), analytics, ASAP bootstrap.
- Do not say “online” unless a human has joined.

## Current shell direction (Tier 2, JOE-DECIDED 2026-09-14 — Desk shell = graphite, release target)

Maintenance Mode: mandatory. Exploration Mode: a concept may propose a different Desk presentation, shell structure, colors or interaction model, must name this decision explicitly, and ships only when Joe picks it.

- **One shell.** Near-black/graphite field, hairline border, restrained shadow. No second modal, hero card, or inset “window.”
- **One field for every tab.** Light-on-dark throughout. Do not paint Ask DE cream and the other tabs black.
- Magenta `#D3126A` is the only loud color: active tab underline, send, submit, selected issue, user bubbles, Fastest badge, 1px shell cap. Do not fill boxes with violet.
- **Ask DE** is a conversational UI (conversation first, composer dominant, discovery chips).
- **Get Support** is a service-desk form: incident rail (Tier 0 above), then focused issue choices, then dark raised fields and magenta submit.

## Architecture

The modal is **Ask → Support → Tools**, not a miniature site nav.

| Tab (label) | Internal id | Purpose |
|-------------|-------------|---------|
| **Ask DE** | `chat` | Discovery / conversation for people who are not sure where to go |
| **Get Support** | `ticket` | Report a problem. Incident first, then a short ticket form |
| **Client Tools** | `resources` | Sign-in gate for visitors; authenticated shortcuts only after a real portal session |

**Possible security incident** is featured on Get Support. Ask DE also offers it as a chip that **switches to Get Support** and applies `applyDeskTicketChip("security-incident")`.

Composer lives on **Ask DE only**. Incoming replies on Get Support / Client Tools use the heads-up toast + Ask DE unread badge.

## Workflow

```
DE Desk UI checklist:
- [ ] Exactly one .de-desk-shell (no double chrome)
- [ ] Graphite shell + simple header + circular expand/close
- [ ] Three tabs; active = magenta underline
- [ ] Ask DE: dark transcript, discovery chips, dominant composer
- [ ] Get Support: incident rail + issue list + dark form + magenta submit
- [ ] Client Tools unauth: sign-in CTA, then support/remote only
- [ ] Client Tools auth: Support / Secure services / Account launcher — no fake status
- [ ] Contrast: white type on graphite; magenta only on actions
- [ ] Visible focus, ~44px controls, prefers-reduced-motion
- [ ] Browser screenshot at 390 / 768 / 1440
- [ ] Logic untouched unless requested
```

### Restyle pass

1. Change layout/classes in `ZohoASAPWidget.tsx` only as needed. Do not invent `DeskModalV2`.
2. Unauthenticated Client Tools must not render a fake client environment.
3. Authenticated launcher uses `PORTAL_HOME`, `PORTAL_TICKETS`, `PORTAL_FILES`, `PORTAL_CONTRACTS`, and `REMOTE_SUPPORT_HREF`. Never apex `/portal*` on the marketing host.

## Anti-patterns

- Whole-widget paper theme
- Cream card inside a purple/glowing frame
- Nested rounded cards or dual-tone stripes that look like two windows
- Status-row competing CTAs and a footer nav of the same three tabs
- Shared composer on Get Support / Client Tools
- Cream/off-white inputs on a black marketing well
- Purple-filled chrome, glassmorphism stack, neon
- Saying “online” when only AI is available — say **available**
- Billing / Pay Invoice as a prominent Desk choice
