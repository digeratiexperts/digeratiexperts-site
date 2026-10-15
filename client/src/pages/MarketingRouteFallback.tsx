import { lazy, Suspense } from "react";
import { Redirect, Route, Switch } from "wouter";
import CampaignIndex from "@/pages/campaigns/CampaignIndex";
import CampaignLanding from "@/pages/campaigns/CampaignLanding";
import ResourceAssetPage from "@/pages/resources/ResourceAssetPage";
import ExecutiveBriefPage, { ExecutiveBriefIndex } from "@/pages/resources/ExecutiveBriefPage";
import "@/styles/executive-brief-print.css";

// Lazy so its page stylesheet stays out of the entry CSS (at its budget).
const AiBackgroundCheck = lazy(() => import("@/pages/campaigns/AiBackgroundCheck"));

/**
 * Late-bound routes for the marketing/resource work ported from stale PR #59.
 *
 * These live behind App.tsx's existing catch-all deliberately: App.tsx changed
 * substantially after #59 branched, so this resolver preserves current routing
 * byte-for-byte while still giving the new pages a real Wouter <Route> context
 * (required by useParams). Once trunk routing settles, these routes can be
 * promoted into App.tsx without changing their public URLs.
 */
export function MarketingRouteFallback() {
  return (
    <Switch>
      <Route path="/resources/datasheets/:slug" component={ResourceAssetPage} />
      <Route path="/resources/reports/:slug" component={ResourceAssetPage} />
      <Route path="/resources/checklists/:slug" component={ResourceAssetPage} />
      <Route path="/resources/briefs/:slug" component={ExecutiveBriefPage} />
      <Route path="/resources/briefs" component={ExecutiveBriefIndex} />
      <Route path="/go/ai-background-check">
        <Suspense fallback={<div className="min-h-screen bg-de-bg" />}>
          <AiBackgroundCheck />
        </Suspense>
      </Route>
      <Route path="/go/:slug" component={CampaignLanding} />
      <Route path="/go" component={CampaignIndex} />
      <Route path="/lp/:slug">{(params) => <Redirect to={`/go/${params.slug}`} />}</Route>
      <Route path="/ads/:slug">{(params) => <Redirect to={`/go/${params.slug}`} />}</Route>
    </Switch>
  );
}

export function isMarketingFallbackPath(path: string): boolean {
  return (
    path === "/go" ||
    path.startsWith("/go/") ||
    path.startsWith("/lp/") ||
    path.startsWith("/ads/") ||
    path === "/resources/briefs" ||
    path.startsWith("/resources/briefs/") ||
    path.startsWith("/resources/datasheets/") ||
    path.startsWith("/resources/reports/") ||
    path.startsWith("/resources/checklists/")
  );
}
