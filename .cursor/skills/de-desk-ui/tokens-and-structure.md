# DE Desk tokens and structure

Rejected shots (do not restore): `design/approved/desk-ask-de-target.png`, `desk-get-support-target.png` — cream-in-purple.

## Brand tokens

The Desk is the black + grey + gold panel from `design/UI-STYLE-RULES.md` (support chrome; Joe, 2026-10-01, picked from eight mockups and built with the mark's Signal Gold, without the halo; it supersedes the white panel of 2026-09-28). Every tab takes the same dark token set, Client Tools included. One theme: no block re-declares the `--desk-*` tokens, and nothing in the Desk reads the site's dark `--de-surface` / `--de-raised` / `--de-bg` / `--de-hairline` (guard tests fail on either).

| Token | Value | Use |
|-------|-------|-----|
| Panel | `--desk-surface` `#0b0b0d` | The one outer frame and every tab's field |
| Box | `--desk-box` `#19191c` / hover `--desk-box-hover` `#1f1f23` | Grouped lists, assistant bubbles, form fields, the composer |
| Well | `--desk-well` `#232327` | Icon wells inside rows and chips (a step lighter than the row) |
| Hairline | `--desk-border` `rgba(255,255,255,0.10)` / strong `0.16` | The panel border and separators — no glow, no gold ring |
| Ink | `--desk-ink` `#f5f5f4` / `--desk-ink-muted` `#b4b4ba` / `--desk-ink-dim` `#9a9aa2` | Titles, body, blurbs, timestamps and the lock line; every ink clears 4.5:1 on every Desk ground (a test fails otherwise) |
| Gold | `--desk-gold` `#E3B23C` (the mark's Signal Gold, `brand/README.md`) | 1px panel cap, active tab underline, avatar ring, send, submit, selected states, user bubbles, the incident rail's hairline and wash, icon glyphs |
| Gold text | `--desk-gold-ink` `#EDBE4C` | Gold used as text (links, the ticket reference, quiet actions); a step brighter so it clears 4.5:1 on every ground |
| On gold | `--desk-on-gold` `#0b0b0d` | Text and glyphs on a gold or green fill |
| Error / live | `--desk-red` `#f87171` / `--desk-green` `#4ade80` | Field errors; the available pip and a real person's live handoff |
| Magenta, violet | `#D3126A`, `#8B5CF6` | Not used on the Desk |
| Available | Emerald pip | Say “available”, not “online” |

Near-black text appears only on gold (and the green live mark). Do **not** paint the Desk white or paper, do **not** bring magenta back, and do **not** put a glowing halo around the panel.

## Shared chrome (top → bottom)

1. **One `.de-desk-shell`** — `role="dialog"` `aria-label="DE Desk help"` `data-testid="desk-modal"`. `data-tab` is `chat` \| `ticket` \| `resources`.
2. **Placement** — docked, the window stops below the live bottom of the site header and the homepage section bar (`--de-nav-current-bottom` + `--de-spy-h`); it never covers the nav. On open, focus lands on the composer (desktop Ask DE) or the active tab — not the first header button.
3. **Header** — compact DE mark + green available pip; title “DE Desk”; subtitle “DE Desk is available” (or “{name} joined · live handoff”). Expand + close. On `sm+` the header moves the window; double-click resets. The expand button carries a full-screen hint (Joe, 2026-10-02): about a second after the docked Desk opens, three gold pulses with the arrows pushing outward and a gold "Full screen" label, about five seconds in all. It plays at most once per page load and three times per browser, never once the visitor has used full screen, never with a person live in the chat, and never on phones (no expand button below 640px). Reduced motion keeps the gold edge and the label without movement. Drag any edge or the south-east grip to resize.
4. **Tabs** — Ask DE \| Get Support \| Client Tools. Active = ink label + gold underline. Unread count badges Ask DE only.
5. **Body** — the same black field on every tab. No status row. No footer tab list.
6. **Composer (Ask DE only)** — charcoal input + gold send. Text box hint (Joe, 2026-10-02): once the greeting finishes, three gold pulses, a soft gold light sweeping across the field and a gold placeholder, about five seconds. Only on Ask DE, before the visitor has said anything and with nobody live; at most once per page load and three times per browser; it stops the moment they type and retires after their first message. It plays before the full-screen hint, which waits for it, so the two never animate together. Reduced motion keeps the gold edge and placeholder without movement. Placeholder: “Type the issue…” while nobody is in the chat (it must not imply someone is waiting); “Message {name}…” once a person has joined.
7. **Lock line (Ask DE only)** — “Never share passwords, MFA codes, or private keys.”

## Ask DE

- Black transcript, charcoal bubbles. Opening bubble: “DE” avatar only. No sender line (the name is in the header) and no **Available** badge; a name and a live dot appear only when a real person joins (`agentLive`).
- Greeting and four starter chips: per page, from `DESK_PAGE_COPY` in `client/src/lib/deskAskDeMotion.ts`, with **Possible security incident** always last (routes to Get Support).
- After send: gold user bubbles with near-black text; charcoal assistant bubbles with a hairline.
- Once the visitor has sent something, a quiet action row sits above the composer: **Make this a ticket** (Get Support, subject and details drafted from the visitor's own messages, never overwriting a draft they started; the ticket already carries the chat session id) and **Start over** (forgets the thread and the server session).
- Replies render as elements (`client/src/lib/deskRichText.tsx`, never raw HTML): paragraphs, bullet and numbered lists, **bold**, https links (new tab), site paths (same tab, the Desk stays open) and phone numbers as tap-to-call.
- Under the latest reply, the advisor's next steps (`client/src/lib/deskActions.ts`, client allowlist, at most three): the first is the one gold pill, the rest are quiet. A phone step reads "Call {number}", never "Contact sales". Request a callback / Share my details / Leave a message open a small inline form that posts to `/api/public/advisor/action` with the chat session and the honeypot.
- The composer is a textarea that grows to about five lines: Enter sends, Shift+Enter breaks the line; it stays focused (read-only) while a reply is on its way.
- A failed send gets **Try again**, which resends the same words without duplicating the message.
- A reader scrolled up is never yanked down; a gold "New message" pill jumps to the end.
- The conversation is kept for the browser tab (`client/src/lib/deskChatSession.ts`, sessionStorage, 12 hours) so a reload returns to it.

## Get Support

- Lead: “Direct Engineering Support” / “Tell us what happened. We'll route your request straight to the Arizona desk.”
- Featured **Possible security incident** rail, then a vertical list from `DESK_STANDARD_TICKET_CHIPS`, then Name, Work email, What's happening?, Details, Urgency. Default **Medium**.
- Charcoal inputs with a white/16 hairline, ink type, gold focus ring, gold **Create ticket** with near-black text.
- If the incident chip fired, show “Routed as a possible security incident.”
- The confirmation shows the ticket reference with a copy button, and "View my tickets" for a signed-in client.
- Company and category behind **Add company or category**. No file upload in the widget (a test fails on a fake one).

## Client Tools

Unauthenticated (default on the marketing site):

1. “Already a Digerati Experts client?”
2. Gold **Sign in to Client Tools** → `PORTAL_LOGIN`
3. “Need help right now?” → Start remote support (`REMOTE_SUPPORT_HREF`). Get Support is one click away in the tab bar, so it has no row here.

Authenticated (real `/api/portal/me` session only):

- Support: Create ticket, View my tickets, Start remote support
- Secure services: Secure file exchange, Account & password help
- Account: Open client portal, Documents & agreements

Do **not** invent service status, devices, software libraries, or vendor product names. Do **not** put Cyber Risk Assessment, More tools, composer, or a repeated footer on this tab.

## Polish rules (Joe, 2026-10-02: "make sure it's fully optimized and has all the missing touches")

- The empty send button is a quiet well with a dim icon, never half-transparent gold.
- Suggested questions and issue labels wrap to a second line; they never end in an ellipsis.
- The Get Support Details box is tall enough to show its whole prompt at every width.
- A failed Ask DE reply carries a faint red edge and tint, so it reads as an error before "Try again".
- The ticket confirmation shows a labelled gold ticket number; "Back to Ask DE" and "View my tickets" are outlined secondary buttons.
- Signed-in Client Tools opens with the welcome as a heading, and every Desk list uses gold icons.
- Full screen keeps the header across the window and puts tabs, content and composer in a centred 760px column.
- On phones the privacy line under the composer stays on one line.

## a11y

- Visible `:focus-visible` (gold ring). The Ask DE launcher on the bottom bar is the one white ring (2026-10-03): it sits around a gold badge, and it pins `focus-visible:rounded-full`. Site-wide, keyboard focus never changes a control's shape: the global `:focus-visible` outline sets no border-radius and follows each control's own corners (2026-10-03).
- Interactive controls ~44px where practical.
- `prefers-reduced-motion` on pulse, heads-up, and tool-row motion.
- Ticket submit is fail-closed: treat `!response.ok` or missing `zohoTicketId` as failure.
- Keyboard (2026-10-03): the chooser opens with focus on its first choice (Close is last in the DOM, pinned top-right). The Desk opens with focus on the composer (desktop Ask DE) or the active tab; Tab and Shift+Tab stay inside it and only count what Tab can reach. Tabs move with Arrow keys, Home and End. Escape closes it and focus returns to the opener, or to the Ask DE launcher when the opener is gone.
- The resize edges and corner grip are pointer-only (`tabIndex={-1}`, `aria-hidden`); Expand in the header is the keyboard way to resize.
- Short screens: docked, the Desk is never taller than the viewport (header and close stay on screen on a phone held sideways or at 200% zoom), even if that means sitting over the nav.
- Forced colours (Windows contrast themes): every state drawn only in gold (active tab, selected issue and urgency, incident, gold buttons, the visitor's bubbles) has a border or outline the system can colour.
- Hint rules live in `client/src/lib/deskHints.ts` with behavioural tests; `npm run smoke:desk` (run in CI against the production build) checks fit, overflow, keyboard, the hint sequence and the polish invariants in a real browser.

## Primary file

`client/src/components/ZohoASAPWidget.tsx`
