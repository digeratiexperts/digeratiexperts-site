import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/brand-fonts.css";
import "./index.css";
import { initAnalytics } from "./lib/analytics";
import { installAnalyticsNavigationBoundary } from "./lib/analyticsNavigation";
import { installPrerenderSwap } from "./prerenderSwap";

installAnalyticsNavigationBoundary();

const HomepageChallengerApp = lazy(() => import("./pages/HomepageChallengerApp"));
const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
const isHomepageChallenger = pathname === "/homepage-challenger";

if (!isHomepageChallenger) {
  initAnalytics();
}

const rootElement = document.getElementById("root")!;
// Prerendered pages arrive with a visible snapshot and a hidden #root (server/prerender.ts).
installPrerenderSwap(rootElement);

createRoot(rootElement).render(
  isHomepageChallenger ? (
    <Suspense fallback={<div className="min-h-screen bg-[#050312]" aria-hidden="true" />}>
      <HomepageChallengerApp />
    </Suspense>
  ) : (
    <App />
  ),
);
