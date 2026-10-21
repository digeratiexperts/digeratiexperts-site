// Shared chrome for the homepage concepts (/concepts/home-chapters, /concepts/home-mesh).
// Scrollcraft layer: scrollcraft/builds/home-mesh/BRIEF.md. Every hook is a no-op when its
// target is missing, and the motion ones settle to their end state under reduced motion.
import { useEffect, useState } from "react";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Run `update` once now and then at most once per frame on scroll and resize. */
function onScrollFrame(update: () => void): () => void {
  let frame = 0;
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };
  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  return () => {
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    if (frame) cancelAnimationFrame(frame);
  };
}

/**
 * The site menu is fixed above these pages. Publish its bottom edge as --hc-nav-top on <html>,
 * so the chapter pill docks under it and anchored sections clear it.
 */
export function useNavDock(): void {
  useEffect(() => {
    const root = document.documentElement;
    const stop = onScrollFrame(() => {
      const menu = document.querySelector<HTMLElement>(".mega-menu-container");
      const bottom = menu ? Math.max(0, Math.round(menu.getBoundingClientRect().bottom)) : 0;
      root.style.setProperty("--hc-nav-top", `${bottom}px`);
    });
    return () => {
      stop();
      root.style.removeProperty("--hc-nav-top");
    };
  }, []);
}

/** The chapter whose band crosses the reading line (40% down the screen). */
export function useActiveChapter(ids: string[], initial: string): string {
  const [active, setActive] = useState(initial);
  const key = ids.join("|");
  useEffect(() => {
    const sections = ids.map((id) => document.getElementById(id)).filter((n): n is HTMLElement => n !== null);
    if (!("IntersectionObserver" in window) || sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
    // ids is read through key so a new array with the same ids does not re-subscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return active;
}

/**
 * Signature: true once the close (`closeId`) is a third of the way up the screen, and while the
 * visitor is past it. Drives "the pill becomes the principal".
 */
export function useClosing(closeId: string): boolean {
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const close = document.getElementById(closeId);
    if (!close) return;
    // Read from position, not from intersection changes: a jump (Home key, a nav link) can carry
    // the close from above the screen to below it without ever crossing, and no change would fire.
    return onScrollFrame(() => {
      const vh = window.innerHeight || 1;
      setClosing(close.getBoundingClientRect().top < vh * 0.65);
    });
  }, [closeId]);
  return closing;
}

/**
 * Peak: the monitoring hand-off (Signal, human triage, named owner) drawn by scroll. Writes
 * --hc-handoff (0 to 1) and --hc-handoff-len on the list and lights the owner at the end.
 */
export function useHandoff(selector = ".v8s-12 .dg"): void {
  useEffect(() => {
    const list = document.querySelector<HTMLElement>(selector);
    if (!list) return;
    const measure = () => {
      const last = list.lastElementChild as HTMLElement | null;
      if (last) list.style.setProperty("--hc-handoff-len", `${Math.max(0, last.offsetTop - 36)}px`);
    };
    if (reducedMotion()) {
      measure();
      list.style.setProperty("--hc-handoff", "1");
      list.classList.add("is-owned");
      return;
    }
    return onScrollFrame(() => {
      const vh = window.innerHeight || 1;
      const rect = list.getBoundingClientRect();
      // 0 when the list's top reaches 80% of the viewport, 1 when its bottom reaches 45%.
      const start = vh * 0.8;
      const end = vh * 0.45;
      const p = Math.max(0, Math.min(1, (start - rect.top) / (rect.height + (start - end))));
      measure();
      list.style.setProperty("--hc-handoff", p.toFixed(3));
      list.classList.toggle("is-owned", p >= 0.98);
    });
  }, [selector]);
}

/** Depth parallax on `.hc-plate[data-depth]`: each plate drifts against its own section. */
export function usePlateParallax(): void {
  useEffect(() => {
    if (reducedMotion()) return;
    const layers = Array.from(document.querySelectorAll<HTMLElement>(".hc-plate[data-depth]"));
    if (layers.length === 0) return;
    return onScrollFrame(() => {
      const vh = window.innerHeight || 1;
      for (const el of layers) {
        const rect = (el.parentElement ?? el).getBoundingClientRect();
        const progress = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - vh / 2) / vh));
        const depth = Number(el.dataset.depth) || 0;
        el.style.transform = `translate3d(0, ${(progress * depth * 120).toFixed(1)}px, 0) scale(1.08)`;
      }
    });
  }, []);
}
