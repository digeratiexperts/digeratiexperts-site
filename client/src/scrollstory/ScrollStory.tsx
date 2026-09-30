import { useEffect, useRef, useState } from "react";
import { EnvironmentFolio, type FolioChapter } from "./EnvironmentFolio";
import "./scrollstory.css";

declare global {
  interface Window {
    ScrollCraft?: {
      mount: (root: Element | Document | string, opts?: Record<string, unknown>) => unknown;
      instances: unknown[];
    };
  }
}

/**
 * Scroll amplification wrapper for existing story pages (issue #165).
 *
 * Additive by contract: children are the page's real content, rendered
 * identically for crawlers, reduced-motion visitors, and when the engine has
 * not loaded. The vendored Scrollcraft engine (client/src/scrollstory/engine,
 * never edited per the skill's hard rule) reads data-sc-* attributes off that
 * markup and drives it; it generates no DOM.
 *
 * The engine has no teardown API, so a mount is per-element and per-visit:
 * instances over unmounted React trees go inert (their acts detach from the
 * document and stop matching scroll geometry). We mark mounted roots to avoid
 * double-mounting the same element under StrictMode or re-renders.
 */
export function ScrollStory({
  chapters,
  children,
}: {
  chapters: FolioChapter[];
  children: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [reached, setReached] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || root.dataset.scMounted) return;
    root.dataset.scMounted = "1";
    let cancelled = false;
    import("@/scrollstory/engine/scrollcraft.js").then(() => {
      if (cancelled || !rootRef.current?.isConnected) return;
      window.ScrollCraft?.mount(rootRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-de-chapter]"));
    if (!targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.deChapter);
          if (Number.isFinite(idx)) {
            setReached((prev) => Math.max(prev, idx + 1));
          }
        }
      },
      { rootMargin: "0px 0px -35% 0px", threshold: 0.1 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="de-scrollstory">
      <EnvironmentFolio chapters={chapters} reached={reached} />
      {children}
    </div>
  );
}
