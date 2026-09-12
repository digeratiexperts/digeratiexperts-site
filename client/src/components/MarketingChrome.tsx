import { useLocation } from "wouter";
import { ZohoASAPWidget } from "@/components/ZohoASAPWidget";
import { DE_DESK_GRAPHITE_STYLE } from "@/components/deDeskGraphiteStyle";

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

  return <ZohoASAPWidget isEnabled customCSS={DE_DESK_GRAPHITE_STYLE} />;
}
