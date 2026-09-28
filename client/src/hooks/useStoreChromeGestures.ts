import { useEffect, useRef } from "react";
import {
  STORE_GESTURE_LOCK_CLASS,
  findHorizontalScroller,
  getNavigationApi,
  isHorizontalDominantDelta,
  isStorePath,
  isTraverseNavigateEvent,
  shouldInterceptTraverse,
} from "@/lib/storeChromeGestures";

/**
 * While the visitor is in the store, claim horizontal trackpad / touch
 * swipes so Chrome and Safari do not fire Back / Forward. Rails keep
 * GPU-composited scrolling; the real back button still leaves the store.
 */
export function useStoreChromeGestures(location: string) {
  const lastHorizontalAt = useRef(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const active = isStorePath(location);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(STORE_GESTURE_LOCK_CLASS, active);
    if (!active) {
      return () => root.classList.remove(STORE_GESTURE_LOCK_CLASS);
    }
    // The gesture claim exists for horizontal rails (the warehouse). Pages
    // without one, the public Store's Door 2 among them, keep the browser's
    // own swipe-back; the class alone stays for the jelly stylesheet.
    if (!document.querySelector(".de-store-h-rail")) {
      return () => root.classList.remove(STORE_GESTURE_LOCK_CLASS);
    }

    const markHorizontal = () => {
      lastHorizontalAt.current = performance.now();
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return;
      if (!isHorizontalDominantDelta(event.deltaX, event.deltaY)) return;
      markHorizontal();
      event.preventDefault();
      const scroller = findHorizontalScroller(event.target);
      if (scroller) scroller.scrollLeft += event.deltaX;
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      touchStart.current = { x: touch.clientX, y: touch.clientY };
    };

    const onTouchMove = (event: TouchEvent) => {
      const start = touchStart.current;
      const touch = event.touches[0];
      if (!start || !touch) return;
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (!isHorizontalDominantDelta(deltaX, deltaY, 8)) return;
      markHorizontal();
      const scroller = findHorizontalScroller(event.target);
      if (scroller) {
        event.preventDefault();
        scroller.scrollLeft -= deltaX;
        touchStart.current = { x: touch.clientX, y: touch.clientY };
        return;
      }
      event.preventDefault();
    };

    const onTouchEnd = () => {
      touchStart.current = null;
    };

    const onNavigate = (event: Event) => {
      if (!isTraverseNavigateEvent(event)) return;
      if (!shouldInterceptTraverse(performance.now(), lastHorizontalAt.current)) return;
      event.preventDefault();
    };

    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    window.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    window.addEventListener("touchmove", onTouchMove, { capture: true, passive: false });
    window.addEventListener("touchend", onTouchEnd, { capture: true, passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { capture: true, passive: true });

    const navigation = getNavigationApi();
    navigation?.addEventListener("navigate", onNavigate);

    return () => {
      root.classList.remove(STORE_GESTURE_LOCK_CLASS);
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("touchstart", onTouchStart, true);
      window.removeEventListener("touchmove", onTouchMove, true);
      window.removeEventListener("touchend", onTouchEnd, true);
      window.removeEventListener("touchcancel", onTouchEnd, true);
      navigation?.removeEventListener("navigate", onNavigate);
    };
  }, [active]);
}
