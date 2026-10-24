// Base system first, so each section stylesheet (imported by its section) wins ties, as in the mocks.
import "./v8.css";
import { MegaMenu } from "@/components/MegaMenu";
import { FullPageScrollProvider, ScrollSectionAuto } from "@/components/FullPageScroll";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { useSEO } from "@/hooks/useSEO";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import { V8Hero } from "./sections/01-hero";
import { V8WhyWeExist } from "./sections/02-why-we-exist";
import { V8ThreatsAreReal } from "./sections/03-threats-are-real";
import { V8WhatWeTackle } from "./sections/04-what-we-tackle";
import { V8Services } from "./sections/05-services";
import { V8EightBlocks } from "./sections/06-eight-blocks";
import { V8ClientProof } from "./sections/07-client-proof";
import { V8WhyArizona } from "./sections/08-why-arizona";
import { V8Team } from "./sections/09-team";
import { V8Industries } from "./sections/10-industries";
import { V8Pricing } from "./sections/11-pricing";
import { V8ThreatsInsights } from "./sections/12-threats-insights";
import { V8LeadForm } from "./sections/13-lead-form";
import { V8Faq } from "./sections/14-faq";
import { V8NextStep } from "./sections/15-next-step";
import { V8ContactFooter } from "./sections/16-contact-footer";
// Light "dashboard" treatment (Joe, 2026-10-02): last, so it wins over the section sheets.
import "./v8-dashboard.css";
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
 * The homepage at / since Joe, 2026-10-03 ("its approved. do it."): it carries
 * the homepage title, description, canonical and structured data. The previous
 * homepage is kept at /version-0 and Version 7 at /version-7; /version-8 is a
 * 301 to /.
 *
 * Lane H refinement (2026-10-22, docs/plans/opencode/lane-h-homepage.md +
 * lane-h-update-1.md): the 16 section components are composed onto the plan's
 * story spine — hero → credibility strip → problems/risk → ways to engage →
 * packages → assessment/process (eight blocks) → security updates + monitoring →
 * industries → proof & trust → FAQ → closing CTA/contact. Nothing is deleted:
 * content that left a chapter moved to the one that owns its beat (the threat
 * feed moved off the homepage to /resources/security-updates; 02's CTA band moved
 * into the closing block).
 *
 * Every id of the 14-section layout keeps working for the spy row, the dock and
 * deep links: primary ids sit on the chapter that owns the beat, and merged-away
 * ids (`#trust`, `#team`, `#contact`) are alias wrappers around the block that
 * now holds that content. Aliases that own a different field theme are listed in
 * the `sections` array before their chapter so the header theme still flips at
 * the right band.
 *
 * Each section sits in a `v8s-NN` wrapper and its stylesheet is scoped to it:
 * the mocks were standalone pages, so class names repeat across sections
 * (`.lead` is both the team column and the lead-form grid).
 */
const sections: { id: string; label: string; theme: "dark" | "light"; showInNav?: boolean }[] = [
  { id: "hero", label: "Home", theme: "dark" },
  { id: "stats", label: "Why DE", theme: "dark" },
  { id: "challenges", label: "Problems", theme: "light", showInNav: false },
  { id: "services", label: "How It Works", theme: "dark" },
  { id: "pricing", label: "Packages", theme: "dark" },
  { id: "protection", label: "Protect", theme: "light", showInNav: false },
  { id: "insights", label: "Insights", theme: "dark", showInNav: false },
  { id: "industries", label: "Industries", theme: "dark" },
  // Alias blocks first: their field differs from the chapter's, so the header
  // theme must flip at them (the probe takes the first match in this array).
  { id: "trust", label: "Trust", theme: "light", showInNav: false },
  { id: "testimonials", label: "Proof", theme: "dark", showInNav: false },
  { id: "team", label: "Team", theme: "dark", showInNav: false },
  { id: "faq", label: "FAQ", theme: "light", showInNav: false },
  { id: "contact", label: "Contact", theme: "dark" },
  { id: "cta", label: "Next step", theme: "light", showInNav: false },
];

export default function HomepageV8(): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);
  useSpotlight(rootRef);
  useSEO({
    title: "Managed IT Services & Cybersecurity in Arizona",
    description: "Arizona MSP/MSSP. Cybersecurity-first managed IT, 24/7 emergency incident response, and a Cyber Risk Assessment that matches the operating model to your environment.",
    canonical: "/",
  });
  return (
    <FullPageScrollProvider sections={sections} enableOnMobile={false}>
      <div className="v8 min-h-screen bg-[#050312]" ref={rootRef}>
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <MegaMenu />
        <SiteBottomBar autohide />
        <main id="home-main" className="contents">
          {/* Hero + the trust strip it carries. */}
          <ScrollSectionAuto id="hero" chapter>
            <div className="v8s-01">
              <V8Hero />
            </div>
          </ScrollSectionAuto>

          {/* Credibility strip: why we exist (narrative) + the sourced facts (proof). */}
          <ScrollSectionAuto id="stats" chapter>
            <div className="v8s-02">
              <V8WhyWeExist />
            </div>
            <div className="v8s-03">
              <V8ThreatsAreReal />
            </div>
          </ScrollSectionAuto>

          {/* Problems / risk. */}
          <ScrollSectionAuto id="challenges">
            <div className="v8s-04">
              <V8WhatWeTackle />
            </div>
          </ScrollSectionAuto>

          {/* Ways to engage. */}
          <ScrollSectionAuto id="services" chapter>
            <div className="v8s-05">
              <V8Services />
            </div>
          </ScrollSectionAuto>

          {/* Packages (ProActive tiers). */}
          <ScrollSectionAuto id="pricing" chapter>
            <div className="v8s-11">
              <V8Pricing />
            </div>
          </ScrollSectionAuto>

          {/* Assessment / process: the eight blocks, Risk & Exposure as #8. */}
          <ScrollSectionAuto id="protection">
            <div className="v8s-06">
              <V8EightBlocks />
            </div>
          </ScrollSectionAuto>

          {/* Security Updates link (the feed moved to its own page) + monitoring. */}
          <ScrollSectionAuto id="insights">
            <div className="v8s-12">
              <V8ThreatsInsights />
            </div>
          </ScrollSectionAuto>

          {/* Industries. */}
          <ScrollSectionAuto id="industries" chapter>
            <div className="v8s-10">
              <V8Industries />
            </div>
          </ScrollSectionAuto>

          {/* Proof & trust: client proof + why Arizona + the people (one section). */}
          <ScrollSectionAuto id="testimonials">
            <div className="v8s-07">
              <V8ClientProof />
            </div>
            {/* Aliases for the ids the merge would otherwise drop: #trust, #team. */}
            <div className="v8s-08 scroll-mt-[var(--de-nav-offset)]" id="trust">
              <V8WhyArizona />
            </div>
            <div className="v8s-09 scroll-mt-[var(--de-nav-offset)]" id="team">
              <V8Team />
            </div>
          </ScrollSectionAuto>

          {/* FAQ. */}
          <ScrollSectionAuto id="faq" chapter>
            <div className="v8s-14">
              <V8Faq />
            </div>
          </ScrollSectionAuto>

          {/* Closing CTA / contact: next step + the assessment form + contact & footer. */}
          <ScrollSectionAuto id="cta">
            <div className="v8s-15">
              <V8NextStep />
            </div>
            <div className="v8s-13">
              <V8LeadForm />
            </div>
            {/* Alias for the id the merge would otherwise drop: #contact. */}
            <div className="v8s-16 scroll-mt-20" id="contact">
              <V8ContactFooter />
            </div>
          </ScrollSectionAuto>
        </main>
      </div>
    </FullPageScrollProvider>
  );
}
