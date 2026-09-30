import { describe, expect, it } from "vitest";
import {
  isNearDocumentEnd,
  isPageFooterOnScreen,
  isPastStickyCtaThreshold,
  isStickyCtaPinnedRoute,
  isStickyCtaRouteAllowed,
  isTooShortToReachStickyThreshold,
  rectOverlapsPageContent,
  shouldShowStickyCta,
} from "./stickyCtaVisibility";

describe("sticky CTA visibility", () => {
  it("stays off the homepage and portal", () => {
    expect(isStickyCtaRouteAllowed("/")).toBe(false);
    expect(isStickyCtaRouteAllowed("/portal/dashboard")).toBe(false);
    expect(isStickyCtaRouteAllowed("/solutions")).toBe(true);
    expect(isStickyCtaRouteAllowed("/store")).toBe(false);
    expect(isStickyCtaRouteAllowed("/internal/warehouse")).toBe(false);
    expect(isStickyCtaRouteAllowed("/solutions/business-needs")).toBe(false);
    expect(isStickyCtaRouteAllowed("/solutions/request")).toBe(false);
  });

  it("keeps the bar off homepage version previews, exactly as it is off /", () => {
    // A /version-N page is the homepage shown somewhere else. Letting the bar
    // onto it means every homepage review is judged against chrome the real
    // homepage never carries, and against a second CTA competing with the
    // page's own conversion architecture.
    expect(isStickyCtaRouteAllowed("/version-1")).toBe(false);
    expect(isStickyCtaRouteAllowed("/version-3")).toBe(false);
    expect(isStickyCtaRouteAllowed("/version-4")).toBe(false);
    expect(isStickyCtaRouteAllowed("/version-4?present=1")).toBe(false);
    // The index that lists the versions is an ordinary page and keeps the bar.
    expect(isStickyCtaRouteAllowed("/versions")).toBe(true);
  });

  it("pins checkout and quote even when the page is too short to scroll", () => {
    expect(isStickyCtaPinnedRoute("/internal/warehouse/checkout")).toBe(true);
    expect(isStickyCtaPinnedRoute("/internal/warehouse/quote-request")).toBe(true);
    expect(isStickyCtaPinnedRoute("/store/checkout")).toBe(false);
    expect(isStickyCtaPinnedRoute("/store")).toBe(false);
    expect(isStickyCtaPinnedRoute("/solutions")).toBe(false);
  });

  it("waits until the visitor is halfway down the first screen", () => {
    expect(isPastStickyCtaThreshold(100, 800)).toBe(false);
    expect(isPastStickyCtaThreshold(401, 800)).toBe(true);
  });

  it("treats a short document as already past the scroll threshold", () => {
    expect(isTooShortToReachStickyThreshold(900, 900)).toBe(true);
    expect(isTooShortToReachStickyThreshold(900, 1100)).toBe(true);
    expect(isTooShortToReachStickyThreshold(900, 2400)).toBe(false);
  });

  it("hides while scrolling, overlapping, timed out, or dismissed", () => {
    const base = {
      dismissed: false,
      routeAllowed: true,
      pastThreshold: true,
      scrolling: false,
      overlapping: false,
      autoHidden: false,
    };
    expect(shouldShowStickyCta(base)).toBe(true);
    expect(shouldShowStickyCta({ ...base, scrolling: true })).toBe(false);
    expect(shouldShowStickyCta({ ...base, overlapping: true })).toBe(false);
    expect(shouldShowStickyCta({ ...base, autoHidden: true })).toBe(false);
    expect(shouldShowStickyCta({ ...base, dismissed: true })).toBe(false);
  });

  it("shows on a pinned checkout page without waiting for scroll or a long document", () => {
    const checkout = {
      dismissed: false,
      routeAllowed: true,
      pastThreshold: false,
      scrolling: true,
      overlapping: false,
      autoHidden: true,
      pinned: true,
    };
    expect(shouldShowStickyCta(checkout)).toBe(true);
    expect(shouldShowStickyCta({ ...checkout, overlapping: true })).toBe(false);
    expect(shouldShowStickyCta({ ...checkout, dismissed: true })).toBe(false);
  });

  it("does not treat ordinary page copy as overlap", () => {
    const article = {
      closest: () => null,
    } as unknown as Element;
    const overlaps = rectOverlapsPageContent(
      { top: 700, left: 40, width: 1200, height: 100, right: 1240 },
      () => [article],
    );
    expect(overlaps).toBe(false);
  });

  it("parks when a dialog sits in the same slot", () => {
    const dialog = {
      closest: (selector: string) => (selector === "[role='dialog']" ? dialog : null),
    } as unknown as Element;
    expect(
      rectOverlapsPageContent(
        { top: 700, left: 40, width: 1200, height: 100, right: 1240 },
        () => [dialog],
      ),
    ).toBe(true);
  });

  it("stacks with the cookie banner instead of parking behind it", () => {
    const cookie = {
      closest: (selector: string) =>
        selector === "[data-testid='cookie-consent-banner']" ? cookie : null,
    } as unknown as Element;
    expect(
      rectOverlapsPageContent(
        { top: 700, left: 40, width: 1200, height: 100, right: 1240 },
        () => [cookie],
      ),
    ).toBe(false);
  });

  it("parks near the document footer", () => {
    expect(isNearDocumentEnd(2200, 800, 2400)).toBe(true);
    expect(isNearDocumentEnd(400, 800, 2400)).toBe(false);
  });

  it("parks as soon as the marketing footer enters the viewport", () => {
    expect(isPageFooterOnScreen(880, 900)).toBe(true);
    expect(isPageFooterOnScreen(1200, 900)).toBe(false);
  });

  it("ignores the dock and the bar itself", () => {
    const dock = {
      closest: (selector: string) => (selector === ".de-unified-bar" ? dock : null),
    } as unknown as Element;
    const overlaps = rectOverlapsPageContent(
      { top: 700, left: 40, width: 1200, height: 100, right: 1240 },
      () => [dock],
    );
    expect(overlaps).toBe(false);
  });
});
