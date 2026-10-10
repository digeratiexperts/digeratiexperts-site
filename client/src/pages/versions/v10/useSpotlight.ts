import { useEffect, type RefObject } from "react";

/**
 * Element kit: a soft light that follows the pointer across a card and along
 * its edge. Sets --mx/--my (px) on the card under a fine pointer; the light
 * itself is CSS (`SPOTLIGHT` rules in v10-dashboard.css, same selector list).
 * No effect on touch, and nothing moves, so reduced motion is unaffected.
 */
export const SPOTLIGHT_SELECTOR = [
  ".v10s-02 .claims > *",
  ".v10s-04 .problem",
  ".v10s-05 .v10-card",
  ".v10s-08 .why__pillars li",
  ".v10s-11 .v10-card",
  ".v10s-12 .feed-card",
  ".v10s-14 .faq-item",
  ".v10s-15 .next__standards li",
].join(", ");

export function useSpotlight(rootRef: RefObject<HTMLElement>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    let last: PointerEvent | null = null;
    const paint = () => {
      frame = 0;
      const event = last;
      if (!event) return;
      const card = (event.target as Element | null)?.closest?.(SPOTLIGHT_SELECTOR) as HTMLElement | null;
      if (!card || !root.contains(card)) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${Math.round(event.clientX - rect.left)}px`);
      card.style.setProperty("--my", `${Math.round(event.clientY - rect.top)}px`);
    };
    const onMove = (event: PointerEvent) => {
      last = event;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    root.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      root.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(frame);
    };
  }, [rootRef]);
}
