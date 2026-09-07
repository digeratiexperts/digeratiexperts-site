import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnalytics } from "./lib/analytics";

const HomepageChallengerApp = lazy(() => import("./pages/HomepageChallengerApp"));
const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
const isHomepageChallenger = pathname === "/homepage-challenger";

if (!isHomepageChallenger) {
  initAnalytics();
}

createRoot(document.getElementById("root")!).render(
  isHomepageChallenger ? (
    <Suspense fallback={<div className="min-h-screen bg-[#050312]" aria-hidden="true" />}>
      <HomepageChallengerApp />
    </Suspense>
  ) : (
    <App />
  ),
);
