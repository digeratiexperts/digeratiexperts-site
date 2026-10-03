# Ask DE launcher: gold ring on desktop, gold disc on phones — 3 Oct 2026

**Tier 3 record.** What Joe asked for, what changed, and why. The rule it
produced lives in `design/DESIGN-AUTHORITY.md` (Joe-decided table, DE Desk and
gold rows), `design/UI-STYLE-RULES.md` (support chrome),
`.cursor/rules/de-desk-design.mdc` and `.cursor/skills/de-desk-ui/` (Tier 2).

## Why

With the Desk and its chooser gold (`de-desk-gold-2026-10-01.md`), the bottom-bar
launcher that opens them was still a white disc with a magenta focus ring. Joe
asked to see it restyled. Claude mocked three directions on the live homepage
(CSS injected, nothing deployed), each at rest, hover and keyboard focus, at
390 and 1440, beside the gold chooser and the open Desk:

- A. Charcoal disc with a gold mark.
- B. Gold ring on charcoal with a white mark.
- C. Solid gold disc with a dark mark.

Claude's pick was B. Joe's answer, in his words:

> I agree with B for desktop, but I prefer C on mobile. B looks more refined up
> close; C stays clearer when the launcher becomes a small, standalone button.
>
> My choice would be B on desktop, C on mobile, with the same speech mark and
> gold tone throughout.

His notes per image:

- Keep B's mark white on hover instead of turning it gold. Make the white focus
  outline a single clean ring that follows the button's shape; today's
  rectangular outline looks disconnected from the round launcher.
- On the phone, without "Ask DE" beside it, the icon does all the work, and C's
  solid gold disc reads most clearly. A disappears into the background; B's
  nested rings feel fiddly. Move the launcher slightly farther inward and
  upward; it crowds the visible card and pink button.
- On desktop the text already explains the action, so the icon can be quieter.
  B connects with the brand without becoming another prominent call to action.
- Use the same badge in the chooser header as on the launcher. "Get Support"
  and "Get Help" sound too similar.

## What changed

- One badge for the launcher and the chooser header (`askDeBadgeClasses` in
  `SiteBottomBar.tsx`), so the two always match:
  - beside the "Ask DE" label (640px and up, where the label shows): Signal Gold
    `#E3B23C` 2px ring, `#0b0b0d` fill, `#f5f5f4` mark; on hover the ring
    brightens to `#EDBE4C` and a faint gold fill appears, the mark stays white;
  - standing alone (below 640px, and the compact launcher on the Store routes at
    every width): a solid `#E3B23C` disc with a `#0b0b0d` mark, `#EDBE4C` on
    hover.
- Focus: one white ring (`#f5f5f4`, 2px, on a 2px black gap) that follows the
  pill on desktop and the circle on phones. `focus-visible:rounded-full` stops
  the global `*:focus-visible { border-radius: 4px }` squaring it off. Without a
  label the button is a 40px circle (the extra right padding is only beside
  the label).
- The first-visit pulse ring is gold at 55% instead of magenta.
- Phones (below 640px): the bottom chrome sits 20px from the screen edge
  instead of 12px (`--de-chrome-inset: 1.25rem`), on the page's own side
  margin. Everything that stacks above the bar is offset from the same inset,
  so it moves with it.
- The chooser's chat choice reads "Ask a Question" / "Get answers and guidance"
  instead of "Get Help" / "Ask DE a question and get guidance". It still opens
  the Desk's Ask DE tab; "Get Support" is unchanged and matches its tab.
- Behaviour, routes, test ids, aria labels and the Desk itself are unchanged.

## Contrast

| | Ring vs its black gap | Ring vs the bar (`#0a0a0a`) | Mark vs badge | Badge edge vs bar |
|---|---|---|---|---|
| Labelled (B), white focus ring | 19.25:1 | 18.15:1 | 18.03:1 | 10.09:1 (gold ring) |
| Alone (C), white focus ring | 19.25:1 | 18.15:1 | 10.02:1 | 10.09:1 (gold disc) |
| Before: white disc, magenta ring | 6.19:1 | 5.83:1 | 18.82:1 | 19.80:1 |

## Evidence

`artifacts/visual-qa/ask-de-launcher/`:

- `before/`: production on 3 Oct 2026 (the white launcher), rest, hover and
  focus at 390 and 1440, the 390 first screen and the 1440 chooser.
- `after/`: this branch on the Vite dev server (Playwright, reduced motion,
  cookie banner rejected): rest, hover and focus at 390, 768 and 1440; the
  chooser at each width; the first screen at each width; the 390 page scrolled
  so the chapter bar shows; the compact Store launcher at 390 and 1440;
  `measurements.json` with the computed colours, sizes, focus ring and insets.

The review page Joe saw for the three directions is a private claude.ai
artifact; its captures are not repeated here.
