import { isDoor2Path } from "./isDoor2Path";
import { isWarehousePath } from "./warehousePaths";
import { isQuizRoomPath } from "./quizRoom";

export const STICKY_CTA_SCROLL_IDLE_MS = 900;
export const STICKY_CTA_AUTO_HIDE_MS = 12_000;
export const STICKY_CTA_RESHOW_DELTA_PX = 160;
export const STICKY_CTA_END_RESERVE_PX = 160;

const COMPETING_CHROME_SELECTORS = [
  "[data-testid='sticky-cta-bar']",
  ".de-bottom-bar",
  ".de-unified-bar",
  ".de-fab-rail",
  "[data-sticky-cta-chrome]",
  // Cookie stacks under the assessment bar via --de-cookie-h. Treating it as a
  // blocker hid the Risk Assessment CTA whenever the banner was on screen.
  "[data-testid='cookie-consent-banner']",
];

const BLOCKING_OVERLAY_SELECTORS = [
  "[role='dialog']",
  "[aria-modal='true']",
  "[data-radix-dialog-content]",
  "[data-radix-dialog-overlay]",
  ".de-desk-shell",
  // Commerce surfaces with their own CTAs/prices — the assessment bar must not
  // print over another product's "Add"/price link or a trust claim. Ordinary
  // marketing prose is left alone; every StoreProductCard (full catalog grid,
  // every merchandising rail, and the PDP buy box) carries a `product-*`
  // testid, so this one prefix covers all of them without allowlisting each
  // container individually. The PDP's bespoke "Recommended with this
  // service" cards don't reuse StoreProductCard (`related-*` testid instead)
  // so that section is allowlisted by its own wrapper below.
  "[data-testid='store-trust-strip']",
  "[data-testid^='product-']",
  "[data-testid='pdp-related-products']",
];

export function isStickyCtaRouteAllowed(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return (
    pathname !== "/" &&
    // A homepage version preview IS the homepage, just not at "/". The bar is
    // kept off "/" because a homepage carries its own conversion architecture
    // and a second competing CTA undercuts it — which is just as true of a
    // preview of one. Without this every /version-N review judged the page
    // with sticky chrome the real homepage never shows: at 1440 the bar sits
    // across the middle of the hero, cutting the headline.
    !pathname.startsWith("/version-") &&
    !pathname.startsWith("/portal") &&
    !pathname.startsWith("/store") &&
    !isDoor2Path(pathname) &&
    !isWarehousePath(pathname) &&
    // The quiz room carries its own next step; a second CTA would compete with
    // the question being answered (issue 419).
    !isQuizRoomPath(pathname)
  );
}

/** Checkout (and quote) stay pinned even when the page is too short to scroll. */
export function isStickyCtaPinnedRoute(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return (
    pathname === "/internal/warehouse/checkout" ||
    pathname.startsWith("/internal/warehouse/checkout/") ||
    pathname === "/internal/warehouse/quote-request" ||
    pathname.startsWith("/internal/warehouse/quote-request/")
  );
}

export function isPastStickyCtaThreshold(scrollY: number, viewportH: number): boolean {
  return scrollY > viewportH * 0.5;
}

/** True when the document cannot scroll far enough to ever pass the 50% threshold. */
export function isTooShortToReachStickyThreshold(
  viewportH: number,
  scrollHeight: number,
): boolean {
  return scrollHeight - viewportH <= viewportH * 0.5;
}

/** Park the bar when the visitor is on the page footer so links stay clickable. */
export function isNearDocumentEnd(
  scrollY: number,
  viewportH: number,
  scrollHeight: number,
  reservePx = STICKY_CTA_END_RESERVE_PX,
): boolean {
  return scrollY + viewportH >= scrollHeight - reservePx;
}

/** True once a marketing footer has entered the viewport — not only at the last 160px. */
export function isPageFooterOnScreen(footerTop: number, viewportH: number): boolean {
  return Number.isFinite(footerTop) && footerTop < viewportH;
}

/**
 * The cookie banner goes first and the bar waits for it to be answered (Joe,
 * 2026-10-07: "show the cookie bar first and the Risk Assessment bar only after
 * it's dismissed"). On phones the banner, the Ask DE bar and this bar covered a
 * third of a 390px screen; at 1440x900 the 189px banner and the 102px bar
 * stacked covered 40% of the page, so the rule holds at every width.
 */
export function isCookieFirst(cookieBannerBlocking: boolean): boolean {
  return cookieBannerBlocking;
}

export function shouldShowStickyCta(input: {
  dismissed: boolean;
  routeAllowed: boolean;
  pastThreshold: boolean;
  scrolling: boolean;
  overlapping: boolean;
  autoHidden: boolean;
  pinned?: boolean;
  cookieFirst?: boolean;
}): boolean {
  if (input.dismissed || !input.routeAllowed) return false;
  if (input.overlapping) return false;
  if (input.pinned) {
    // Checkout must stay on a short page: no scroll threshold, no 12s auto-hide,
    // no “park because the footer is already in view.”
    return true;
  }
  if (input.cookieFirst) return false;
  return input.pastThreshold && !input.scrolling && !input.autoHidden;
}

export function isStickyCtaChrome(el: Element | null): boolean {
  if (!el) return true;
  return COMPETING_CHROME_SELECTORS.some((selector) => el.closest(selector));
}

/** Dialogs, Desk, and store product CTAs occupy the same dock — cookie chrome stacks instead. */
export function isBlockingStickyCtaTarget(el: Element | null): boolean {
  if (!el) return false;
  if (typeof document !== "undefined" && (el === document.documentElement || el === document.body)) {
    return false;
  }
  if (isStickyCtaChrome(el)) return false;
  return BLOCKING_OVERLAY_SELECTORS.some((selector) => el.closest(selector));
}

export function samplePointsInRect(rect: DOMRect): Array<{ x: number; y: number }> {
  const y = rect.top + Math.min(24, Math.max(8, rect.height / 2));
  const inset = Math.min(48, rect.width * 0.12);
  return [
    { x: rect.left + inset, y },
    { x: rect.left + rect.width / 2, y },
    { x: rect.right - inset, y },
  ];
}

export function rectOverlapsPageContent(
  rect: Pick<DOMRect, "top" | "left" | "width" | "height" | "right">,
  elementsFromPoint: (x: number) => Element[],
): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  const points = samplePointsInRect(rect as DOMRect);
  const root = typeof document === "undefined" ? null : document.documentElement;
  const body = typeof document === "undefined" ? null : document.body;
  return points.some(({ x }) => {
    const stack = elementsFromPoint(x);
    return stack.some((el) => {
      if (el === root || el === body) return false;
      return isBlockingStickyCtaTarget(el);
    });
  });
}
