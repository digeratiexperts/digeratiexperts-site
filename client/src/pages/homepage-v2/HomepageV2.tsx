import "./homepage-v2.css";
import { MegaMenu } from "@/components/MegaMenu";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { useSEO } from "@/hooks/useSEO";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import { HeroSection } from "./sections/HeroSection";
import { PillarsStrip } from "./sections/PillarsStrip";
import { WhySection } from "./sections/WhySection";
import { ThreatStatsSection } from "./sections/ThreatStatsSection";
import { ChallengesSection } from "./sections/ChallengesSection";
import { ServicesSection } from "./sections/ServicesSection";
import { ProtectionSection } from "./sections/ProtectionSection";
import { HowProtectionSection } from "./sections/HowProtectionSection";
import { ProofSection } from "./sections/ProofSection";
import { FitSection } from "./sections/FitSection";
import { TeamSection } from "./sections/TeamSection";
import { IndustriesSection } from "./sections/IndustriesSection";
import { PricingSection } from "./sections/PricingSection";
import { DetectSection } from "./sections/DetectSection";
import { InsightsSection } from "./sections/InsightsSection";
import { FaqSection } from "./sections/FaqSection";
import { ContactSection } from "./sections/ContactSection";
import { SiteFooter } from "./sections/SiteFooter";

/**
 * Homepage v2 at `/`, built from the approved reference (design/reference/homepage-v2).
 * Section order and token sets follow SWAP-PROMPT.md. The global chrome (MegaMenu, the
 * bottom bar with the Ask DE launcher) is shared with the rest of the site.
 * The previous homepage stays at /concepts/home-classic (noindex).
 */
export default function HomepageV2(): JSX.Element {
  useSEO({
    title: "Managed IT Services & Cybersecurity in Arizona",
    description: "Arizona MSP/MSSP. Cybersecurity-first managed IT, 24/7 emergency incident response, and a Cyber Risk Assessment that matches the operating model to your environment.",
    canonical: "/",
  });
  return (
    <div className="hv2">
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <MegaMenu />
      <SiteBottomBar autohide />
      <main id="home-main">
        <HeroSection />
        <PillarsStrip />
        <WhySection />
        <ThreatStatsSection />
        <ChallengesSection />
        <ServicesSection />
        <ProtectionSection />
        <HowProtectionSection />
        <ProofSection />
        <FitSection />
        <TeamSection />
        <IndustriesSection />
        <PricingSection />
        <DetectSection />
        <InsightsSection />
        <FaqSection />
        <ContactSection />
      </main>
      <SiteFooter />
    </div>
  );
}
