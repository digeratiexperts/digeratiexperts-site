# Homepage v2 scene story — visual QA (2026-10-25)

Before = `origin/main` c0fa29c, after = branch `claude/loving-edison-epagrb`. Local dev server, reduced motion (the
scroll settle animation is off, so frames show at their resting state), cookie banner accepted.

- `compare-{1440,768,390}.jpg`: before/after side by side for the four sections that change.
- `before/`, `after/`: full page at 1440, 768 and 390, and each target section (`why` is unchanged on purpose).
- `report.json` in each: page height, horizontal overflow, scene images loaded, page errors.

Checks: page height identical before and after at every width (no layout change); a pixel diff of the full pages
changes only four bands per width, the four scene sections; axe WCAG 2.2 AA 0 violations at 390 and 1440; scenes
hidden under forced colors and in print; the OS dark colour scheme renders byte-identical to light (Homepage v2 has no
theme switch; each section keeps its own token set), so its screenshots were not kept.
