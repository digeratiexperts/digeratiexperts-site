// Base system first, so each section stylesheet (imported by its section) wins ties, as in the mocks.
import "./v9.css";
import { MegaMenu } from "@/components/MegaMenu";
import { FullPageScrollProvider, ScrollSectionAuto } from "@/components/FullPageScroll";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { useSEO } from "@/hooks/useSEO";
import { V9Hero } from "./sections/01-hero";
import { V9WhyWeExist } from "./sections/02-why-we-exist";
import { V9ThreatsAreReal } from "./sections/03-threats-are-real";
import { V9WhatWeTackle } from "./sections/04-what-we-tackle";
import { V9Services } from "./sections/05-services";
import { V9EightBlocks } from "./sections/06-eight-blocks";
import { V9ClientProof } from "./sections/07-client-proof";
import { V9WhyArizona } from "./sections/08-why-arizona";
import { V9Team } from "./sections/09-team";
import { V9Industries } from "./sections/10-industries";
import { V9Pricing } from "./sections/11-pricing";
import { V9ThreatsInsights } from "./sections/12-threats-insights";
import { V9LeadForm } from "./sections/13-lead-form";
import { V9Faq } from "./sections/14-faq";
import { V9NextStep } from "./sections/15-next-step";
import { V9ContactFooter } from "./sections/16-contact-footer";
// Light "dashboard" treatment (Joe, 2026-10-02): last, so it wins over the section sheets.
import "./v9-dashboard.css";
import { useRef } from "react";
import { useSpotlight } from "./useSpotlight";

/**
 * Digerati Experts homepage, Version 8: Version 7 copied as-is (Version 7 stays
 * frozen at /version-7) with Joe's 2026-10-03 section notes applied here only.
 * Joe: "one main version based on version 7 but with my preferences included",
 * keeping the other two (the live homepage and Version 7) as they are.
 *
 * Version 7 origin: the live homepage, section by section,
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
 * The homepage at / since Joe, 2026-10-03 ("its approved. do it."): it carries
 * the homepage title, description, canonical and structured data. The previous
 * homepage is kept at /version-0 and Version 7 at /version-7; /version-8 is a
 * 301 to /.
 *
 * Each section sits in a `v9s-NN` wrapper and its stylesheet is scoped to it:
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

export default function HomepageV9(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  useSpotlight(rootRef);
  useSEO({
    title: "Managed Security Service Provider",
    description: "Arizona MSP/MSSP. Cybersecurity-first managed IT, 24/7 emergency incident response, and a Cyber Risk Assessment that matches the operating model to your environment.",
    canonical: "/",
  });
  return (
    <FullPageScrollProvider sections={sections} enableOnMobile={false}>
      <div className="v9 min-h-screen bg-[#050312]" ref={rootRef}>
        <MegaMenu />
        <SiteBottomBar autohide />
        <main id="home-main" className="contents">
          <ScrollSectionAuto id="hero" chapter>
            <div className="v9s-01"><V9Hero /></div>
            <div className="v9s-02"><V9WhyWeExist /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="stats" chapter>
            <div className="v9s-03"><V9ThreatsAreReal /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="challenges">
            <div className="v9s-04"><V9WhatWeTackle /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="services" chapter>
            <div className="v9s-05"><V9Services /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="protection">
            <div className="v9s-06"><V9EightBlocks /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="testimonials">
            <div className="v9s-07"><V9ClientProof /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="trust">
            <div className="v9s-08"><V9WhyArizona /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="team">
            <div className="v9s-09"><V9Team /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="industries" chapter>
            <div className="v9s-10"><V9Industries /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="pricing" chapter>
            <div className="v9s-11"><V9Pricing /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="insights">
            <div className="v9s-12"><V9ThreatsInsights /></div>
            <div className="v9s-13"><V9LeadForm /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="faq" chapter>
            <div className="v9s-14"><V9Faq /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="cta">
            <div className="v9s-15"><V9NextStep /></div>
          </ScrollSectionAuto>
          <ScrollSectionAuto id="contact" chapter className="scroll-mt-20">
            <div className="v9s-16"><V9ContactFooter /></div>
          </ScrollSectionAuto>
        </main>
      </div>
    </FullPageScrollProvider>
  );
}
