/**
 * Store takes first claim on horizontal trackpad / touch swipes so the
 * browser does not treat them as Back / Forward. Explicit back-button
 * and keyboard history still work — we only intercept a traverse that
 * arrives immediately after a horizontal gesture.
 */

export const STORE_GESTURE_LOCK_CLASS = "de-store-gesture-lock";
export const STORE_HORIZONTAL_RAIL_CLASS = "de-store-h-rail";
export const STORE_TRAVERSE_WINDOW_MS = 450;

export function isStorePath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return (
    pathname === "/store" ||
    pathname.startsWith("/store/") ||
    pathname === "/solutions/request" ||
    pathname === "/internal/warehouse" ||
    pathname.startsWith("/internal/warehouse/")
  );
}

export function isHorizontalDominantDelta(deltaX: number, deltaY: number, min = 1): boolean {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  return absX > absY && absX >= min;
}

export function shouldInterceptTraverse(
  nowMs: number,
  lastHorizontalMs: number,
  windowMs = STORE_TRAVERSE_WINDOW_MS,
): boolean {
  return lastHorizontalMs > 0 && nowMs - lastHorizontalMs < windowMs;
}

export function findHorizontalScroller(start: EventTarget | null): HTMLElement | null {
  let node: Element | null = start instanceof Element ? start : null;
  while (node && node !== document.documentElement && node !== document.body) {
    if (node instanceof HTMLElement) {
      const overflowX = getComputedStyle(node).overflowX;
      const canScrollX =
        (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") &&
        node.scrollWidth > node.clientWidth + 1;
      if (canScrollX) return node;
    }
    node = node.parentElement;
  }
  return null;
}

type NavigationLike = {
  addEventListener(type: "navigate", listener: (event: Event) => void): void;
  removeEventListener(type: "navigate", listener: (event: Event) => void): void;
};

export function getNavigationApi(): NavigationLike | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { navigation?: NavigationLike }).navigation;
}

export function isTraverseNavigateEvent(event: Event): boolean {
  return "navigationType" in event && (event as { navigationType?: string }).navigationType === "traverse";
}
