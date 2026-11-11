import "./homepage-v2.css";
import { useRef } from "react";
import { MegaMenu } from "@/components/MegaMenu";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { useSEO } from "@/hooks/useSEO";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import { HeroSection } from "./sections/HeroSection";
import { SituationsSection } from "./sections/SituationsSection";
import { HowItWorksSection } from "./sections/HowItWorksSection";
import { PricingSection } from "./sections/PricingSection";
import { ProofSection } from "./sections/ProofSection";
import { TeamSection } from "./sections/TeamSection";
import { IndustriesSection } from "./sections/IndustriesSection";
import { FaqSection } from "./sections/FaqSection";
import { ContactSection } from "./sections/ContactSection";
import { SiteFooter } from "./sections/SiteFooter";
import { useCtaTracking } from "./useCtaTracking";

/**
 * Homepage v2 at `/`, built from the approved reference (design/reference/homepage-v2).
 * Section order and token sets follow SWAP-PROMPT.md. The global chrome (MegaMenu, the
 * bottom bar with the Ask DE launcher) is shared with the rest of the site.
 * The previous homepage stays at /concepts/home-classic (noindex).
 *
 * Restructure (2026-11-11, pending Joe's approval in the PR): nine chapters in buyer
 * language. The eight protection blocks, the four-step methodology and detection moved to
 * /solutions; the threat statistics moved to /resources/cyber-facts. Pillars, Why, Challenges,
 * Services, Fit and Insights are off the homepage; their files stay for a quick revert.
 */
export default function HomepageV2(): JSX.Element {
  useSEO({
    title: "Managed IT Services & Cybersecurity in Arizona",
    description:
      "Arizona MSP/MSSP. Cybersecurity-first managed IT, 24/7 emergency incident response, and a Cyber Risk Assessment that matches the operating model to your environment.",
    canonical: "/",
  });
  const rootRef = useRef<HTMLDivElement>(null);
  useCtaTracking(rootRef, "/");
  // The global chrome renders outside `.hv2`: the page's scoped reset must not reach the
  // shared MegaMenu or the Ask DE launcher.
  return (
    <>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <MegaMenu />
      <SiteBottomBar autohide />
      <div className="hv2" ref={rootRef}>
        <main id="home-main">
          <HeroSection />
          <SituationsSection />
          <HowItWorksSection />
          <PricingSection />
          <ProofSection />
          <TeamSection />
          <IndustriesSection />
          <FaqSection />
          <ContactSection />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}
