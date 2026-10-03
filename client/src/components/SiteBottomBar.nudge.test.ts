import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const bottomBarSrc = readFileSync(resolve(here, "SiteBottomBar.tsx"), "utf8");
const indexCss = readFileSync(resolve(here, "../index.css"), "utf8");

function nudgeBottom(): string {
  const block = bottomBarSrc.match(/className="de-ask-nudge [\s\S]*?data-testid="ask-de-nudge"/);
  const bottom = block?.[0].match(/bottom:\s*"([^"]+)"/);
  return bottom?.[1] ?? "";
}

describe("Ask DE nudge position", () => {
  it("clears the unified bar, the store cart and the cookie banner", () => {
    const bottom = nudgeBottom();
    expect(bottom).toMatch(/var\(--de-unified-bar-h, 3\.5rem\)/);
    expect(bottom).toMatch(/var\(--de-store-cart-h, 0px\)/);
    expect(bottom).toMatch(/var\(--de-cookie-h, 0px\)/);
    expect(bottom).toMatch(/env\(safe-area-inset-bottom, 0px\)/);
  });

  it("matches the unified bar, which the cookie banner also lifts", () => {
    expect(indexCss).toMatch(/\.de-unified-bar \{[^}]*bottom:\s*calc\(var\(--de-chrome-inset\) \+ var\(--de-cookie-h\)\)/);
  });
});

describe("Ask DE nudge on phones", () => {
  it("holds the nudge until the reader leaves the first screen", () => {
    expect(bottomBarSrc).toMatch(/const NUDGE_PHONE_QUERY = "\(max-width: 767px\)"/);
    expect(bottomBarSrc).toMatch(/phone\.matches && window\.scrollY < window\.innerHeight/);
  });

  it("steps a shown nudge away on scroll or typing, without dismissing it for good", () => {
    const block = bottomBarSrc.match(/if \(!showNudge \|\| !window\.matchMedia\(NUDGE_PHONE_QUERY\)\.matches\) return;[\s\S]*?\}, \[showNudge\]\);/)?.[0] ?? "";
    expect(block).toMatch(/NUDGE_PHONE_SCROLL_AWAY/);
    expect(block).toMatch(/focusin/);
    expect(block).not.toMatch(/markDeskNudgeDismissed/);
  });
});
