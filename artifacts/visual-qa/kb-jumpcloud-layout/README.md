# Knowledge base docs layout — visual QA (issue #960, 2026-11-05)

Local dev server, memory-only store with the seeded KB articles, development-only bootstrap admin. Article under test: KB0000013 "How to enroll your mobile device" (the longest seed article).

| Folder / file | What |
|---|---|
| `before/` | `origin/main` @ 296721de: public index, portal index and article, 390 / 768 / 1440, portal light + black |
| `after/` | this branch, same matrix, plus `drawer-open-390.png`, `keyboard-toc-1440.png`, `hero-article-{light,black}-1440@2x.png` |
| `*/results.json` | axe (wcag2a/aa, 21a/aa, 22aa) and horizontal-overflow result per screenshot; `after/` also has the keyboard checks |
| `zoho/` | `zoho/help-center/stylesheet.css` previewed on the live help center (stylesheet request routed to the local file; nothing published) at 390 / 1100 / 1440, rest and scrolled |
| `capture.mjs`, `zoho-preview.mjs` | the scripts that produced them |

Results: no horizontal overflow anywhere. axe: 0 violations in all 16 `after/` captures. The baseline had 8 `color-contrast` nodes on the black-theme article (magenta links on black); the new layout uses the theme's link ink (`--pt-brand`) and clears them.

Keyboard (`after/results.json`): "On this page" link → Enter jumps to the heading 84px below the top bar and the rail marks it current; the narrow-width "Browse categories" toggle opens with Enter, moves focus to the current article, closes on Escape and returns focus to the toggle.

The public marketing site has one theme (dark hero, paper body), so the public index has no light/dark pair; the portal is captured in light and black (its dark default).
