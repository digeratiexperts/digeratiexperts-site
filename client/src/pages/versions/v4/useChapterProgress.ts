import { useEffect, useRef, useState } from "react";

/**
 * Scroll progress across a range, 0 at the moment the range's top reaches the
 * bottom of the viewport, 1 when its bottom reaches the top.
 *
 * rAF-coalesced and passive: the scroll handler only marks a frame dirty, and
 * the read happens once per frame. Reading layout inside the scroll event is
 * what makes scroll-driven pages stutter at speed, and V4 is verified while
 * motion is happening, not only after it settles.
 */
export function useChapterProgress(ref: React.RefObject<HTMLElement | null>): number {
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const read = () => {
      frame.current = null;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 when the range's top reaches the bottom of the viewport; 1 when its
      // BOTTOM reaches the bottom of the viewport — that is, when the last
      // chapter is fully on screen and being read.
      //
      // Measuring to the range leaving the top instead would mean the story
      // can only finish after its final chapter has scrolled away, and on a
      // page that ends shortly after the range it can never finish at all.
      // That is exactly how the first build of this left the estate stuck
      // part-aligned at every width.
      const travelled = vh - rect.top;
      const span = rect.height || 1;
      const next = travelled / span;
      setProgress(next < 0 ? 0 : next > 1 ? 1 : next);
    };

    const schedule = () => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [ref]);

  return progress;
}

/** Map a value from one range to another, clamped. Used for act timing. */
export function ramp(t: number, from: number, to: number): number {
  if (to <= from) return t >= to ? 1 : 0;
  const v = (t - from) / (to - from);
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Smoothstep, so nothing arrives or leaves with a hard edge. */
export function ease(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}
