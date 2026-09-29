# DE Desk tokens and structure

Rejected shots (do not restore): `design/approved/desk-ask-de-target.png`, `desk-get-support-target.png` — cream-in-purple.

## Brand tokens

Outer chrome is graphite DE app, and every tab inside it takes the same graphite token set, Client Tools included. One theme: no block re-declares the `--desk-*` tokens (a guard test fails if one does).

| Token | Value | Use |
|-------|-------|-----|
| Shell | `--de-surface` `#0a0a0a` | One outer frame |
| Shell border | `--de-hairline` `rgba(255,255,255,0.10)` | Single hairline — no lavender glow |
| Raised | `--de-raised` `#151217` | Inputs, assistant bubbles, tool icon wells on dark |
| Magenta | `#D3126A` | Active underline, send, submit, featured rail, Fastest badge, security action, 1px shell cap |
| Violet | `#8B5CF6` | Do not fill chrome, badges, or wells. Lighting only if used at all. |
| Ask DE / ticket field | graphite | Light-on-dark transcript and dark raised form fields |
| Grouped lists | `--desk-box` + `--desk-border-strong` | Get Support issues and Client Tools rows: the same graphite as every tab |
| Ink | `--desk-ink` / `--desk-ink-muted` | Titles and blurbs on every surface, lists included |
| Available | Emerald pip | Say “available”, not “online” |

Do **not** paint the whole widget paper. Do **not** nest a cream card in a purple glow.

## Shared chrome (top → bottom)

1. **One `.de-desk-shell`** — `role="dialog"` `aria-label="DE Desk help"` `data-testid="desk-modal"`. `data-tab` is `chat` \| `ticket` \| `resources`.
2. **Header** — compact DE mark + green available pip; title “DE Desk”; subtitle “DE Desk is available” (or “{name} joined · live handoff”). Expand + close. On `sm+` the header moves the window; double-click resets. Drag any edge or the south-east grip to resize.
3. **Tabs** — Ask DE \| Get Support \| Client Tools. Active = light label + magenta underline. Unread count badges Ask DE only.
4. **Body** — same graphite field on every tab. No status row. No footer tab list.
5. **Composer (Ask DE only)** — raised dark input + magenta send. Placeholder: “Type the issue…” while nobody is in the chat (it must not imply someone is waiting); “Message {name}…” once a person has joined.
6. **Lock line (Ask DE only)** — “Never share passwords, MFA codes, or private keys.”

## Ask DE

- Dark transcript. Opening bubble: “DE” avatar only. No sender line (the name is in the header) and no **Available** badge; a name and a live dot appear only when a real person joins (`agentLive`).
- Greeting and four starter chips: per page, from `DESK_PAGE_COPY` in `client/src/lib/deskAskDeMotion.ts`, with **Possible security incident** always last (routes to Get Support).
- After send: magenta user bubbles; raised assistant bubbles.

## Get Support

- Lead: “Direct Engineering Support” / “Tell us what happened. We'll route your request straight to the Arizona desk.”
- Featured **Possible security incident** rail, then a vertical list from `DESK_STANDARD_TICKET_CHIPS`, then Name, Work email, What's happening?, Details, Urgency. Default **Medium**.
- Dark raised inputs, white type, magenta **Create ticket**.
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
