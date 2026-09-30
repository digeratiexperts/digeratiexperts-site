import { useSyncExternalStore } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";

export const SITE_ORIGIN = "https://digeratiexperts.com";

let pageCanonical: string | undefined;
const listeners = new Set<() => void>();

export function registerPageCanonical(canonical?: string) {
  const next = canonical || undefined;
  if (pageCanonical === next) return;
  pageCanonical = next;
  listeners.forEach((listener) => listener());
}

export function getRegisteredPageCanonical() {
  return pageCanonical;
}

export function subscribePageCanonical(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

/** Exactly one winning canonical. A page-level useSEO value beats the path fallback. */
export function canonicalHrefsFor(locationPath: string): string[] {
  if (pageCanonical) return [`${SITE_ORIGIN}${pageCanonical}`];
  const path = locationPath.replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase() || "/";
  return [path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`];
}

/**
 * Fallback canonical for pages that do not declare their own.
 *
 * index.html used to carry a static `<link rel="canonical" href="https://digeratiexperts.com/">`
 * that every page inherited, so the blog index, the ebook, the service matrix
 * and others were telling search engines they were duplicates of the homepage
 * (metadata sweep, 2026-09-13). Rendered at the app root, this emits the
 * current path unless useSEO registered a page-level canonical.
 */
export function DefaultCanonical() {
  const [location] = useLocation();
  useSyncExternalStore(subscribePageCanonical, getRegisteredPageCanonical, getRegisteredPageCanonical);
  // Routes are all lowercase and wouter matches case-insensitively, so /Pricing
  // and /pricing/ both canonicalise to /pricing.
  const hrefs = canonicalHrefsFor(location);
  return (
    <Helmet>
      <link rel="canonical" href={hrefs[0]} />
    </Helmet>
  );
}
