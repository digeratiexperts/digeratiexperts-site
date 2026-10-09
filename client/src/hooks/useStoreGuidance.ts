import { useEffect, useState } from "react";

/**
 * Scroll reveal for Door 2 cards (Joe, 2026-10-03: "more dynamic animations
 * that lead the user to do a task"). Elements marked `data-d2-reveal` rise in
 * once as they enter the viewport; `--d2-delay` staggers a row.
 *
 * Content is never hidden without this hook: the hidden start state only
 * applies under `html.d2-reveal-ready`, which is set here and removed on
 * unmount. Reduced motion reveals everything immediately.
 */
export function useStoreReveal(): void {
  useEffect(() => {
    const root = document.documentElement;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") return undefined;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.d2Reveal = "in";
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -4% 0px", threshold: 0 },
    );
    const watch = () => {
      document.querySelectorAll<HTMLElement>('[data-d2-reveal]:not([data-d2-reveal="in"])').forEach((el) => io.observe(el));
    };
    watch();
    // Only after the observer exists may cards start hidden; anything already on screen reveals on the first callback.
    root.classList.add("d2-reveal-ready");
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      root.classList.remove("d2-reveal-ready");
    };
  }, []);
}

/**
 * True for a few seconds after `key` changes (a need was added): the screen's
 * forward action plays its attention ring, then goes quiet again.
 */
export function useAttention(key: number | undefined, ms = 4200): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!key) return undefined;
    setOn(true);
    const timer = window.setTimeout(() => setOn(false), ms);
    return () => window.clearTimeout(timer);
  }, [key, ms]);
  return on;
}
