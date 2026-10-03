// Base system first, so each section stylesheet (imported by its section) wins ties, as in the mocks.
import "./v7.css";
import { MegaMenu } from "@/components/MegaMenu";
import { FullPageScrollProvider, ScrollSectionAuto } from "@/components/FullPageScroll";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { V7Hero } from "./sections/01-hero";
import { V7WhyWeExist } from "./sections/02-why-we-exist";
import { V7ThreatsAreReal } from "./sections/03-threats-are-real";
import { V7WhatWeTackle } from "./sections/04-what-we-tackle";
import { V7Services } from "./sections/05-services";
import { V7EightBlocks } from "./sections/06-eight-blocks";
import { V7ClientProof } from "./sections/07-client-proof";
import { V7WhyArizona } from "./sections/08-why-arizona";
import { V7Team } from "./sections/09-team";
import { V7Industries } from "./sections/10-industries";
import { V7Pricing } from "./sections/11-pricing";
import { V7ThreatsInsights } from "./sections/12-threats-insights";
import { V7LeadForm } from "./sections/13-lead-form";
import { V7Faq } from "./sections/14-faq";
import { V7NextStep } from "./sections/15-next-step";
import { V7ContactFooter } from "./sections/16-contact-footer";
// Light "dashboard" treatment (Joe, 2026-10-02): last, so it wins over the section sheets.
import "./v7-dashboard.css";
import { useRef } from "react";
import { useSpotlight } from "./useSpotlight";

/**
 * Digerati Experts homepage, Version 7: the live homepage, section by section,
 * built from Joe's reviewed section mockups (PR #315,
 * artifacts/design-concepts/homepage-sections-2026-10/).
 *
 * Joe, 2026-10-01: "mock up every section … make it look how it should look";
 * round 2: one assessment form and one newsletter, the one-row pronunciation,
 * keep the industries photo hover ("a lot of subtle work can be lost so be
 * careful"), and "upgrade the bar on the bottom with autohide features that are
 * not annoying"; then "continue".
 *
 * Real site chrome (MegaMenu, the unified bottom bar with autohide on), the live
 * section ids so the spy row and the dock work, every fact read from the file
 * that already carries it, forms posting to the live endpoints.
 * Preview only (noindex, VersionFrame); production / is unchanged.
 *
 * Each section sits in a `v7s-NN` wrapper and its stylesheet is scoped to it:
 * the mocks were standalone pages, so class names repeat across sections
 * (`.lead` is both the team column and the lead-form grid).
 */
const sections: { id: string; label: string; theme: "dark" | "light"; showInNav?: boolean }[] = [
  { id: "hero", label: "Home", theme: "dark" },
  { id: "stats", label: "Why DE", theme: "dark" },
  { id: "challenges", label: "Problems", theme: "light", showInNav: false },
  { id: "services", label: "How It Works", theme: "dark" },
  { id: "protection", label: "Protect", theme: "light", showInNav: false },
  { id: "testimonials", label: "Proof", theme: "dark", showInNav: false },
  { id: "trust", label: "Trust", theme: "light", showInNav: false },
  { id: "team", label: "Team", theme: "dark", showInNav: false },
  { id: "industries", label: "Industries", theme: "dark" },
  { id: "pricing", label: "Packages", theme: "dark" },
  { id: "insights", label: "Insights", theme: "dark", showInNav: false },
  { id: "faq", label: "FAQ", theme: "light", showInNav: false },
  { id: "cta", label: "Next step", theme: "light", showInNav: false },
  { id: "contact", label: "Contact", theme: "dark" },
];

export default function HomepageV7(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  useSpotlight(rootRef);
  return (
    <FullPageScrollProvider sections={sections} enableOnMobile={false}>
      <div className="v7 min-h-screen bg-[#050312]" ref={rootRef}>
        <MegaMenu />
        <SiteBottomBar autohide />
        <main id="home-main" className="contents">
          <ScrollSectionAuto id="hero" chapter>
            <div className="v7s-01"><V7Hero /></div>
            <div className="v7s-02"><V7WhyWeExist /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="stats" chapter>
            <div className="v7s-03"><V7ThreatsAreReal /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="challenges">
            <div className="v7s-04"><V7WhatWeTackle /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="services" chapter>
            <div className="v7s-05"><V7Services /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="protection">
            <div className="v7s-06"><V7EightBlocks /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="testimonials">
            <div className="v7s-07"><V7ClientProof /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="trust">
            <div className="v7s-08"><V7WhyArizona /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="team">
            <div className="v7s-09"><V7Team /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="industries" chapter>
            <div className="v7s-10"><V7Industries /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="pricing" chapter>
            <div className="v7s-11"><V7Pricing /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="insights">
            <div className="v7s-12"><V7ThreatsInsights /></div>
            <div className="v7s-13"><V7LeadForm /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="faq" chapter>
            <div className="v7s-14"><V7Faq /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="cta">
            <div className="v7s-15"><V7NextStep /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="contact" chapter className="scroll-mt-20">
            <div className="v7s-16"><V7ContactFooter /></div>
          </ScrollSectionAuto>
        </main>
      </div>
    </FullPageScrollProvider>
  );
}
