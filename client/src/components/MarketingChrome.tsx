import { Suspense, lazy } from "react";
import { useLocation } from "wouter";
import { DE_DESK_GRAPHITE_STYLE } from "@/components/deDeskGraphiteStyle";

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
 * Visual direction (DE Completion Program C5, 2026-09-12): one graphite
 * enterprise shell. The paper reference treatment lives on in
 * deDeskReferenceStyle.ts and can be swapped back here in one line.
 */
export function MarketingChrome() {
  const [location] = useLocation();

  if (location.startsWith("/portal")) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <ZohoASAPWidget isEnabled customCSS={DE_DESK_GRAPHITE_STYLE} />
    </Suspense>
  );
}
