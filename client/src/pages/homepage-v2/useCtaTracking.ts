import { useEffect, type RefObject } from "react";
import { analytics } from "@/lib/analytics";

/** The parts of a clicked element the tracker reads; a DOM Element satisfies it. */
export interface CtaElementLike {
  closest(selector: string): { getAttribute(name: string): string | null; textContent: string | null } | null;
}

export interface CtaClick {
  cta: string;
  label: string;
  href: string;
}

/**
 * Finds the CTA a click landed on: the nearest element with `data-cta`. Returns null for
 * clicks outside a tagged CTA, so ordinary links are not tracked.
 */
export function ctaClickFrom(target: CtaElementLike | null): CtaClick | null {
  const element = target?.closest("[data-cta]");
  if (!element) return null;
  const cta = element.getAttribute("data-cta")?.trim();
  if (!cta) return null;
  return {
    cta,
    label: (element.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
    href: element.getAttribute("href") ?? "",
  };
}

/**
 * One delegated listener for every tagged homepage CTA. Sends `cta_click` through the
 * consent-gated analytics module (nothing is sent without analytics consent).
 */
export function useCtaTracking(root: RefObject<HTMLElement>, page: string): void {
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const onClick = (event: MouseEvent) => {
      const click = ctaClickFrom(event.target instanceof Element ? event.target : null);
      if (click) analytics.ctaClicked(click.cta, click.label, click.href, page);
    };
    node.addEventListener("click", onClick);
    return () => node.removeEventListener("click", onClick);
  }, [root, page]);
}
