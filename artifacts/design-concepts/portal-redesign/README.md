# Portal redesign: concepts and decision

**Mode:** Exploration (Joe, 2026-09-30: "redesign this properly … fully featured and fully working and looks amazing like a top notch SaaS program"). Tier 0 and Tier 1 of `design/DESIGN-AUTHORITY.md` hold in full; Tier 2 is challenged where each brief says so.

**Surface:** the authenticated client portal (`/portal/*`), shell plus dashboard as the representative page. 46 pages, 29 client nav items plus 9 admin items today.

Every figure, name and ticket on these pages is **EXAMPLE** data (`design/VISUAL_EVIDENCE.md`). Fonts fall back to system faces in this sandbox because Google Fonts is blocked; the tokens name Space Grotesk / Inter / Oxanium.

## What the audit found (Tier 3 evidence, `artifacts/visual-qa/portal-redesign/before/`)

| Sev | Finding |
|---|---|
| P0 | 29 flat nav items in one scrolling list; the last items hide under the "Sign out" footer at 900 px tall. Nine items use the catch-all `other` key; Billing and Invoices share a key and an icon. |
| P0 | At 768 the topbar title wraps into the tenant selector ("Create Support Ticket"). The dark site body shows below the light portal when the page is shorter than the viewport. |
| P1 | Two titles per page (topbar `h1` and page `h2` say the same thing). |
| P1 | Dashboard leads with four zero tiles and no verdict; the user cannot tell whether things are okay. Quick actions sit in a pink-to-blue gradient wash (Tier 2 says violet is lighting, never a fill). |
| P1 | Status and priority are pastel Tailwind defaults with raw enum text (`in_progress`). No state system. |
| P1 | Colour is three systems at once: a navy gradient rail (`#030228`, not a DE token), magenta pills, slate content. DE tokens are unused; 296 hard-coded `#D3126A` in portal files. |
| P2 | No search, command palette, notifications or breadcrumbs. No collapsed sidebar. The shell remounts on every route and re-checks the session ("Checking session…" flash). |
| P2 | `dark:` utilities everywhere but nothing toggles the class: dead code. |
| P3 | Nested `<a>` inside wouter `Link` on the tickets list (DOM warning, a11y defect). |

## The three concepts

### A. Control Room (`a-control-room/`)
- **Hypothesis:** a portal is an operations surface; the first screen must answer "is anything on fire, and what needs me?" in five seconds, then let the user act without leaving.
- **Keeps (Tier 2):** graphite well, raised charcoal panels, magenta for actions only, Space Grotesk / Inter / Oxanium, hairline borders, one loud band per page (the verdict).
- **Changes:** navy gradient rail replaced by the graphite field; nav grouped into Support / Account / Programs / Tools / Admin with counts and "sample" tags where a page is not live; verdict band and attention queue replace the zero tiles; command palette and notifications in the topbar; sidebar collapses to icons.
- **Tier 1 effect:** precise, trustworthy, cybersecurity-first, reads as a control surface rather than a template.
- **Risk:** density on 390 needs discipline; the verdict must never claim more than the data supports (Tier 0 truth).

### B. Paper Ledger (`b-paper-ledger/`)
- **Hypothesis:** a client of a consultancy wants a calm document, not a console. A paper field with a graphite band and top navigation reads like a monthly statement.
- **Keeps:** paper token `#f7f5f2`, graphite band, magenta paper-ink for state, type stack.
- **Changes (and proposes against Tier 2 defaults):** light-first portal, no sidebar (top menu plus a section sub-nav), document reading order, ledger table for open items.
- **Tier 1 effect:** mature, premium, editorial.
- **Risk:** 46 pages and 38 nav items do not fit a top menu without a second nav layer; the DE Desk operations panel and the warehouse need a console, not a document. Rendered at 768 the header already crowds. This concept fits a client-only summary view better than the whole portal.

### C. Rail and Pane (`c-rail-and-pane/`)
- **Hypothesis:** collapse the 29 items into four sections on an icon rail; each section opens a list pane and a detail pane, so tickets, approvals and requests become an inbox with no page loads.
- **Keeps:** graphite and magenta tokens, type stack.
- **Changes:** three-pane app layout, section-first navigation, inline detail.
- **Tier 1 effect:** technically sophisticated, precise.
- **Risk:** every existing page is a full route with its own layout; a three-pane model means rewriting 46 pages or living with two shells (which `DESIGN-AUTHORITY.md` §2 forbids without a migration plan). Mobile collapses to a bottom tab bar, a bigger behaviour change than the other two.

## Decision (provisional until Joe picks)

**Build A, carrying C's section model (already in A's sidebar) and B's verdict-first reading order.** It is the only concept that keeps every route and page contract intact while replacing the shell, so functional preservation (Tier 0) is cheap to prove, and it satisfies Tier 1 without introducing a second design system. B remains the recommended direction for a future client-facing "account statement" export. C's inbox pattern can arrive later inside A's shell for the tickets and approvals pages without changing the shell.

Joe can overrule this in the PR. If B or C is chosen, the primitives built for A (tokens, page header, status tokens, data table, empty states) carry over; only the shell changes.
