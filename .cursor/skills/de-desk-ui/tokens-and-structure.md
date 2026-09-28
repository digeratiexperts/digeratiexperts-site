# DE Desk tokens and structure

Rejected shots (do not restore): `design/approved/desk-ask-de-target.png`, `desk-get-support-target.png` — cream-in-purple.

## Brand tokens

The Desk is the white precision panel from `design/UI-STYLE-RULES.md` (support chrome, approved 2026-08-30; Joe, 2026-09-28: "It's supposed to be white theme"). Every tab takes the same white token set, Client Tools included. One theme: no block re-declares the `--desk-*` tokens, and nothing in the Desk reads the site's dark `--de-surface` / `--de-raised` / `--de-bg` / `--de-hairline` (guard tests fail on either).

| Token | Value | Use |
|-------|-------|-----|
| Panel | `--desk-surface` `#fbfbfa` | The one outer frame and every tab's field |
| Well | `--desk-well` `#f4f3f1` | Inputs' resting ground, composer well |
| Box | `--desk-box` `#ffffff` | Grouped lists, assistant bubbles, form fields |
| Hairline | `--desk-border` `rgba(15,15,18,0.12)` | The panel border and separators — no glow, no magenta ring |
| Ink | `--desk-ink` `#111116` / `--desk-ink-muted` `#5e5b66` | Titles, body and blurbs on every surface |
| Magenta | `#D3126A` | Active tab underline, send, submit, incident rail, user bubbles, 1px panel cap |
| Magenta text | `--desk-pink-ink` `#A30E52` | Magenta used as text on white (passes 4.5:1) |
| Violet | `#8B5CF6` | Not used on the Desk |
| Available | Emerald pip | Say “available”, not “online” |

White text appears only on magenta. Do **not** paint the Desk graphite, and do **not** nest a cream card in a purple glow.

## Shared chrome (top → bottom)

1. **One `.de-desk-shell`** — `role="dialog"` `aria-label="DE Desk help"` `data-testid="desk-modal"`. `data-tab` is `chat` \| `ticket` \| `resources`.
2. **Header** — compact DE mark + green available pip; title “DE Desk”; subtitle “DE Desk is available” (or “{name} joined · live handoff”). Expand + close. On `sm+` the header moves the window; double-click resets. Drag any edge or the south-east grip to resize.
3. **Tabs** — Ask DE \| Get Support \| Client Tools. Active = ink label + magenta underline. Unread count badges Ask DE only.
4. **Body** — the same white field on every tab. No status row. No footer tab list.
5. **Composer (Ask DE only)** — white input on the well + magenta send. Placeholder: “Type the issue…” while nobody is in the chat (it must not imply someone is waiting); “Message {name}…” once a person has joined.
6. **Lock line (Ask DE only)** — “Never share passwords, MFA codes, or private keys.”

## Ask DE

- White transcript. Opening bubble: “DE” avatar only. No sender line (the name is in the header) and no **Available** badge; a name and a live dot appear only when a real person joins (`agentLive`).
- Greeting and four starter chips: per page, from `DESK_PAGE_COPY` in `client/src/lib/deskAskDeMotion.ts`, with **Possible security incident** always last (routes to Get Support).
- After send: magenta user bubbles with white text; white assistant bubbles with a hairline.

## Get Support

- Lead: “Direct Engineering Support” / “Tell us what happened. We'll route your request straight to the Arizona desk.”
- Featured **Possible security incident** rail, then a vertical list from `DESK_STANDARD_TICKET_CHIPS`, then Name, Work email, What's happening?, Details, Urgency. Default **Medium**.
- White inputs with a hairline, ink type, magenta focus ring, magenta **Create ticket**.
- If the incident chip fired, show “Routed as a possible security incident.”
- Company and category behind **Add company or category**. No file upload in the widget (a test fails on a fake one).

## Client Tools

Unauthenticated (default on the marketing site):

1. “Already a Digerati Experts client?”
2. Magenta **Sign in to Client Tools** → `PORTAL_LOGIN`
3. “Need help right now?” → Start remote support (`REMOTE_SUPPORT_HREF`). Get Support is one click away in the tab bar, so it has no row here.

Authenticated (real `/api/portal/me` session only):

- Support: Create ticket, View my tickets, Start remote support
- Secure services: Secure file exchange, Account & password help
- Account: Open client portal, Documents & agreements

Do **not** invent service status, devices, software libraries, or vendor product names. Do **not** put Cyber Risk Assessment, More tools, composer, or a repeated footer on this tab.

## a11y

- Visible `:focus-visible` (magenta ring).
- Interactive controls ~44px where practical.
- `prefers-reduced-motion` on pulse, heads-up, and tool-row motion.
- Ticket submit is fail-closed: treat `!response.ok` or missing `zohoTicketId` as failure.

## Primary file

`client/src/components/ZohoASAPWidget.tsx`
