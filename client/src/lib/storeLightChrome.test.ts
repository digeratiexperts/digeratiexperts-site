import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isStorePath } from "./storeChromeGestures";

const dir = dirname(fileURLToPath(import.meta.url));

describe("store checkout light chrome", () => {
  it("treats checkout as a store path so bottom popups can use a white surface", () => {
    expect(isStorePath("/store/checkout")).toBe(true);
    expect(isStorePath("/solutions")).toBe(false);
  });

  it("pins the assessment bar on checkout so a short 1440 page still shows it", () => {
    const src = readFileSync(resolve(dir, "../components/StickyCTABar.tsx"), "utf8");
    expect(src).toMatch(/isStickyCtaPinnedRoute\(location\)/);
    expect(src).toMatch(/useReducedMotion/);
    // A short page counts as past the threshold once its height has settled.
    expect(src).toMatch(/pinned \|\| settledShortPage\(\) \|\| isPastStickyCtaThreshold/);
  });

  it("paints the sticky assessment bar white on store routes", () => {
    const src = readFileSync(resolve(dir, "../components/StickyCTABar.tsx"), "utf8");
    expect(src).toMatch(/isStorePath\(location\)/);
    expect(src).toMatch(/data-surface=\{light \? "light" : "dark"\}/);
    expect(src).toMatch(/border-black\/10 bg-white/);
    expect(src).toMatch(/variant="brand"/);
  });

  it("paints the cookie banner white on store routes without restyling marketing pages", () => {
    const src = readFileSync(resolve(dir, "../components/CookieConsentBanner.tsx"), "utf8");
    expect(src).toMatch(/isStorePath\(location\)/);
    expect(src).toMatch(/background: "#ffffff"/);
    expect(src).toMatch(/background: "#0a0a0a"/);
    expect(src).toMatch(/light \? "hidden" : "hidden lg:block"/);
    expect(src).toMatch(/useReducedMotion/);
    expect(src).toMatch(/bg-\[#D3126A\]/);
  });

  it("keeps checkout Pay Now above the white bottom chrome", () => {
    const summary = readFileSync(resolve(dir, "../components/store/SolutionOrderSummary.tsx"), "utf8");
    const css = readFileSync(resolve(dir, "../index.css"), "utf8");
    expect(summary).toMatch(/de-checkout-summary/);
    expect(css).toMatch(/\.de-checkout-summary/);
    expect(css).toMatch(/--de-cookie-h/);
    expect(css).toMatch(/--de-sticky-cta-h/);
  });
});
