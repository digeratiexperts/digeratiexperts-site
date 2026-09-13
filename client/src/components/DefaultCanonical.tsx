import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";

export const SITE_ORIGIN = "https://digeratiexperts.com";

/**
 * Fallback canonical for pages that do not declare their own.
 *
 * index.html used to carry a static `<link rel="canonical" href="https://digeratiexperts.com/">`
 * that every page inherited, so the blog index, the ebook, the service matrix
 * and others were telling search engines they were duplicates of the homepage
 * (metadata sweep, 2026-09-13). Rendered at the app root, this emits the
 * current path; any page-level <Helmet> canonical rendered deeper in the tree
 * overrides it, so existing alias → primary canonicals are unchanged.
 */
export function DefaultCanonical() {
  const [location] = useLocation();
  const path = location.replace(/[?#].*$/, "").replace(/\/+$/, "") || "/";
  return (
    <Helmet>
      <link rel="canonical" href={path === "/" ? `${SITE_ORIGIN}/` : `${SITE_ORIGIN}${path}`} />
    </Helmet>
  );
}
