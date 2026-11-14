import "./homepage-b3.css";
import { useEffect, useRef } from "react";
import { MegaMenu } from "@/components/MegaMenu";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { useSEO } from "@/hooks/useSEO";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import { SiteFooter } from "../homepage-v2/sections/SiteFooter";
import "../homepage-v2/homepage-v2.css";
import { startB3Motion } from "./b3Motion";
import {
  CloseSection,
  CoverageRings,
  DeskSection,
  FaqSection,
  Hero,
  PriceSection,
  SituationsSection,
  UsualDeck,
  WhoSection,
} from "./B3Sections";

/**
 * Homepage B3 at `/` (Joe, 2026-11-13: "all approved"). Built from the approved preview
 * (digeratiexperts.github.io/de-homepage-previews/b3/, after the patience pass):
 * hero with the open Coverage Rings, the problem/fix/plan deck, Coverage Rings,
 * situations (custom card always last), priced in the open, Service Desk vs Help Desk,
 * FAQ, and the closing Fit Call. The site's own MegaMenu, bottom bar (DE Desk) and footer
 * wrap it. Homepage v2 moves to /concepts/home-v2 (noindex).
 */
export default function HomepageB3(): JSX.Element {
  useSEO({
    // Must match shared/routeMeta.json "/" (Joe-approved, 2026-10-20).
    title: "Managed IT Services & Cybersecurity in Arizona",
    description:
      "Arizona MSP/MSSP. Cybersecurity-first managed IT, 24/7 emergency incident response, and a Cyber Risk Assessment that matches the operating model to your environment.",
    canonical: "/",
  });
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const handle = startB3Motion(root);
    return () => handle.stop();
  }, []);
  return (
    <>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <MegaMenu />
      <SiteBottomBar autohide />
      <div className="b3" ref={rootRef}>
        <main id="main">
          <Hero />
          <UsualDeck />
          <CoverageRings />
          <WhoSection />
          <SituationsSection />
          <PriceSection />
          <DeskSection />
          <FaqSection />
          <CloseSection />
        </main>
      </div>
      <div className="hv2">
        <SiteFooter />
      </div>
    </>
  );
}
