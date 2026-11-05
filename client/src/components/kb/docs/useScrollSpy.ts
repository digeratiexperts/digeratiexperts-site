import { useEffect, useState } from "react";

/**
 * The id of the last heading whose top has scrolled above `offset` pixels
 * from the viewport top (the first heading before any has). Recomputed on
 * scroll and resize, once per frame.
 */
export function useScrollSpy(ids: string[], offset = 120): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");
  useEffect(() => {
    if (!ids.length) {
      setActive(null);
      return;
    }
    let frame = 0;
    const compute = () => {
      frame = 0;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - offset <= 0) current = id;
        else break;
      }
      // At the very bottom, the last heading wins even if it never reached the offset.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = ids[ids.length - 1];
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, offset]);
  return active;
}
