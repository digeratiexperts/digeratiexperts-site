import { MegaMenu } from "@/components/MegaMenu";
import { FullPageScrollProvider, ScrollSectionAuto } from "@/components/FullPageScroll";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { useSEO } from "@/hooks/useSEO";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";

// Import all section components
import { ModernHeroSection } from "./sections/ModernHeroSection";
import { DigeratiAlertBanner } from "./sections/DigeratiAlertBanner";
import { DigeratiServicesSection } from "./sections/DigeratiServicesSection";
import { DigeratiHowWeProtectSection } from "./sections/DigeratiHowWeProtectSection";
import { DigeratiWhatWeTackleSection } from "./sections/DigeratiWhatWeTackleSection";
import { DigeratiIndustriesSection } from "./sections/DigeratiIndustriesSection";
import { DigeratiPricingSection } from "./sections/DigeratiPricingSection";
import { DigeratiTestimonialsSection } from "./sections/DigeratiTestimonialsSection";
import { HomepageProofSection } from "./sections/HomepageProofSection";
import { DigeratiMeetExpertsSection } from "./sections/DigeratiMeetExpertsSection";
import { DigeratiFAQSection } from "./sections/DigeratiFAQSection";
import { DigeratiCTASection } from "./sections/DigeratiCTASection";
import { DigeratiContactSection } from "./sections/DigeratiContactSection";
import { DigeratiEnhancedFooterSection } from "./sections/DigeratiEnhancedFooterSection";
import { DigeratiStatsSection } from "./sections/DigeratiStatsSection";
import { DigeratiTrustPhotoSection } from "./sections/DigeratiTrustPhotoSection";

const homepageSections: { id: string; label: string; theme: 'dark' | 'light'; showInNav?: boolean }[] = [
  { id: 'hero', label: 'Home', theme: 'dark' },
  { id: 'risk', label: 'Why DE', theme: 'dark' },
  { id: 'engagement', label: 'How It Works', theme: 'dark' },
  { id: 'ecosystem', label: 'Packages', theme: 'light' },
  { id: 'proof', label: 'Proof', theme: 'dark' },
  { id: 'leadership', label: 'Industries', theme: 'dark' },
  { id: 'next-step', label: 'Next Step', theme: 'light' },
];

export const DigeratiHomepage = (): JSX.Element => {
  useSEO({
    title: 'Managed Security Service Provider',
    description: "Arizona MSP/MSSP. Cybersecurity-first managed IT, 24/7 operations, and a Cyber Risk Assessment that matches the operating model to your environment.",
    canonical: '/',
  });

  return (
    <FullPageScrollProvider sections={homepageSections} enableOnMobile={false}>
      <div className="de-dark-well min-h-screen bg-[#050312] pb-8">
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        {/* Navigation — chat lives in App MarketingChrome sitewide */}
        <MegaMenu />
        <SiteBottomBar />

        {/* 1. Hero */}
        <ScrollSectionAuto id="hero" chapter>
          <ModernHeroSection />
          <DigeratiAlertBanner />
        </ScrollSectionAuto>

        {/* 2. Trust and risk */}
        <ScrollSectionAuto id="risk" chapter>
          <DigeratiStatsSection />
          <DigeratiWhatWeTackleSection />
        </ScrollSectionAuto>

        {/* 3. Engagement options */}
        <ScrollSectionAuto id="engagement" chapter>
          <DigeratiServicesSection />
        </ScrollSectionAuto>

        {/* 4. Service ecosystem */}
        <ScrollSectionAuto id="ecosystem" chapter>
          <DigeratiHowWeProtectSection />
          <DigeratiPricingSection />
        </ScrollSectionAuto>

        {/* 5. Proof */}
        <ScrollSectionAuto id="proof" chapter>
          <DigeratiTestimonialsSection />
          <HomepageProofSection />
          <DigeratiTrustPhotoSection />
        </ScrollSectionAuto>

        {/* 6. Industries and founder */}
        <ScrollSectionAuto id="leadership" chapter>
          <DigeratiIndustriesSection />
          <DigeratiMeetExpertsSection />
        </ScrollSectionAuto>

        {/* 7. Final conversion */}
        <ScrollSectionAuto id="next-step" chapter className="scroll-mt-20">
          <DigeratiFAQSection />
          <DigeratiCTASection />
          <DigeratiContactSection />
          <DigeratiEnhancedFooterSection />
        </ScrollSectionAuto>
      </div>
    </FullPageScrollProvider>
  );
};
