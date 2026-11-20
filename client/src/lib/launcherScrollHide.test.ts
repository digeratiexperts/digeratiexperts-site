import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LAUNCHER_SCROLLING_ATTR,
  LAUNCHER_SCROLL_IDLE_MS,
  LAUNCHER_SCROLL_MIN_DELTA_PX,
  isRealScroll,
  launcherHoldsAttention,
} from "./launcherScrollHide";

const here = dirname(fileURLToPath(import.meta.url));
const indexCss = readFileSync(resolve(here, "../index.css"), "utf8");
const barSrc = readFileSync(resolve(here, "../components/SiteBottomBar.tsx"), "utf8");

describe("launcher scroll-hide rules", () => {
  it("leaves the launcher alone while it is in use", () => {
    const idle = { pointerInside: false, focusInside: false, deskOpen: false };
    expect(launcherHoldsAttention(idle)).toBe(false);
    expect(launcherHoldsAttention({ ...idle, pointerInside: true })).toBe(true);
    expect(launcherHoldsAttention({ ...idle, focusInside: true })).toBe(true);
    expect(launcherHoldsAttention({ ...idle, deskOpen: true })).toBe(true);
  });

  it("ignores tiny movement but counts a real scroll in either direction", () => {
    expect(isRealScroll(0)).toBe(false);
    expect(isRealScroll(LAUNCHER_SCROLL_MIN_DELTA_PX - 1)).toBe(false);
    expect(isRealScroll(LAUNCHER_SCROLL_MIN_DELTA_PX)).toBe(true);
    expect(isRealScroll(-LAUNCHER_SCROLL_MIN_DELTA_PX)).toBe(true);
    expect(isRealScroll(-300)).toBe(true);
  });

  it("brings the launcher back quickly once the page is still", () => {
    expect(LAUNCHER_SCROLL_IDLE_MS).toBeGreaterThanOrEqual(400);
    expect(LAUNCHER_SCROLL_IDLE_MS).toBeLessThanOrEqual(1000);
  });
});

describe("launcher scroll-hide wiring", () => {
  it("hides only by opacity and visibility, never keyboard focus", () => {
    const rule = indexCss.match(
      /html\[data-de-launcher-scrolling="true"\] \.de-unified-bar:not\(:focus-within\) \{([^}]*)\}/,
    )?.[1];
    expect(rule, "scroll-hide rule present").toBeTruthy();
    expect(rule).toMatch(/opacity:\s*0\s*!important/);
    expect(rule).toMatch(/visibility:\s*hidden/);
    expect(rule).toMatch(/pointer-events:\s*none/);
    // layout must not change, or --de-unified-bar-h would jump when it returns
    expect(rule).not.toMatch(/display:/);
    expect(rule).not.toMatch(/transform:/);
  });

  it("CSS attribute matches the one the component sets", () => {
    // dataset key deLauncherScrolling <-> data-de-launcher-scrolling
    const attr = `data-${LAUNCHER_SCROLLING_ATTR.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    expect(indexCss).toContain(`html[${attr}="true"]`);
  });

  it("the bar sets and always clears the attribute", () => {
    expect(barSrc).toMatch(/root\.dataset\[LAUNCHER_SCROLLING_ATTR\] = "true"/);
    expect(barSrc).toMatch(/delete root\.dataset\[LAUNCHER_SCROLLING_ATTR\]/);
    // cleanup must clear it, so unmounting mid-scroll never leaves chrome hidden
    const effect = barSrc.match(/window\.addEventListener\("scroll", onScroll, \{ passive: true \}\);\s*return \(\) => \{[\s\S]*?settle\(\);/);
    expect(effect?.[0]).toMatch(/removeEventListener\("scroll", onScroll\)/);
  });

  it("fades back in only when motion is allowed", () => {
    expect(indexCss).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{\s*\.de-unified-bar \{\s*transition: opacity 160ms ease-out;/,
    );
  });
});
