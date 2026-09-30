import { Suspense, lazy } from "react";
import { useLocation } from "wouter";

// The Desk widget is ~140 KB of source and was statically bundled into the
// entry chunk of every marketing route. It has no above-the-fold UI of its own
// (the launcher lives in SiteBottomBar), so it is code-split and fetched right
// after first paint instead (perf audit, 2026-09-13).
const ZohoASAPWidget = lazy(() =>
  import("@/components/ZohoASAPWidget").then((m) => ({ default: m.ZohoASAPWidget })),
);

/**
 * Sitewide marketing chrome (not Client Portal).
 *
 * The bottom-bar Ask DE control is the single entry chooser. Once a visitor
 * chooses what they need, this existing Desk opens directly on that function.
 * Existing chat, ticket, and Client Tools behavior remains intact.
 *
 * Visual direction: one graphite enterprise shell, and only one. The theme
 * lives entirely inside ZohoASAPWidget's own stylesheet now — no external
 * override, and no second treatment to swap back to. Both the graphite
 * override and the paper reference file are gone; a colour that is wrong is
 * wrong in exactly one place.
 */
export function MarketingChrome() {
  const [location] = useLocation();

  if (location.startsWith("/portal")) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ZohoASAPWidget isEnabled />
    </Suspense>
  );
}
