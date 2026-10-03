# DE Desk: black + grey + gold — 1 Oct 2026

**Tier 3 record.** What Joe asked for, what changed, and why. The rule it
produced lives in `design/DESIGN-AUTHORITY.md` (Joe-decided table),
`design/UI-STYLE-RULES.md` (support chrome), `.cursor/rules/de-desk-design.mdc`
and `.cursor/skills/de-desk-ui/` (Tier 2).

## Why

Joe sent a sheet of eight Desk UI mockups (1 Black + Grey + Yellow, 2 Black +
Grey + Electric Blue, 3 Dark Navy + Blue, 4 Dark + Teal / Mint, 5 Dark + Amber +
Blue Hybrid, 6 Charcoal Grey + Yellow, 7 Light Mode Clean, 8 Light Mode Grey +
Yellow) and asked which one we are going with. His shortlist was 1, 2 or 5.
Claude's pick was 1: the only option where the security-incident rail is
unmistakably first (in 2, 3 and 4 the rail shares its colour with every
issue-list icon); yellow on near-black reads best of the set and is the one
accent DE already owns through the gold three-bar mark; blue is the Store's
colour on this site; 7 and 8 are the live white panel with blue swapped in.

Joe overruled the brand rules for this surface ("fuck the brand rules",
"build it") and picked 1.

## What changed

- The Desk stylesheet's one `--desk-*` token set, from the white precision
  panel to: panel `#0b0b0d`, rows `#19191c`, icon wells `#232327`, white/10
  hairlines, ink `#f5f5f4` / `#b4b4ba` / `#9a9aa2`, and the mark's Signal
  Gold `#E3B23C` (`brand/README.md`) as the one accent. Text on gold is
  near-black. Gold as text is one step brighter (`#EDBE4C`) so it clears
  4.5:1 on every ground.
- Two things differ from the mockup on purpose: the glowing yellow halo
  around the panel is gone (a 1px gold cap and a plain hairline instead; the
  halo is the one thing that would date), and the yellow is the brand's
  Signal Gold rather than the mockup's brighter yellow.
- No magenta anywhere on the Desk: the avatar ring, active tab, send, submit,
  selected states, user bubbles, incident rail, focus rings and the panel cap
  all take gold. A real person's live handoff reads green, not blue.
- The Ask DE chooser on the bottom bar takes the same palette, so the support
  chrome is one system end to end.
- Desk logic, copy, tabs, routes, test ids and behaviour are unchanged.

## Evidence

`artifacts/visual-qa/desk-gold/`, each at 390, 768 and 1440, rendered from
the Vite dev server on this branch after main (with PR 303) was merged in
(Playwright, reduced motion, cookie banner dismissed):

- `chooser-*` — the Ask DE chooser on the bottom bar.
- `desk-ticket-*` — Get Support with the "ticket submission is temporarily
  unavailable" notice that PR 303 added. The status call was stubbed to
  `connected: false`, which is what production answers today (issue 314).
- `desk-ticket-form-*` — the form after an empty submit: field errors, the
  urgency control, the gold Create ticket button.
- `desk-chat-*` — Ask DE's greeting and discovery list.
- `desk-chat-sent-*` — a sent message (gold bubble), a reply and a next step.
  The reply was a stubbed QA response, not advisor output.
- `desk-resources-*` — Client Tools, signed out.

No horizontal overflow at any width. The notice's phone link was restyled
(ink + gold underline) so it reads as a link inside the red error box.

## Live

Merged as `4b25793` (PR 319) on 2026-10-02 with Joe's approval, and deployed
by the CI run for that commit. Verified on digeratiexperts.com at 13:20Z:
the served Desk chunk carries the black + gold tokens and none of the white
panel. Browser shots of the production site at 390, 768 and 1440 (the
chooser, Get Support and Ask DE) are in `artifacts/visual-qa/desk-gold/live/`.
