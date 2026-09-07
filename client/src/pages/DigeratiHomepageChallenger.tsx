import { MegaMenu } from "@/components/MegaMenu";
import { FullPageScrollProvider, ScrollSectionAuto } from "@/components/FullPageScroll";
import { useSEO } from "@/hooks/useSEO";

import { ReferenceHeroSection } from "./sections/ReferenceHeroSection";
import { DigeratiAlertBanner } from "./sections/DigeratiAlertBanner";
import { DigeratiServicesSection } from "./sections/DigeratiServicesSection";
import { DigeratiHowWeProtectSection } from "./sections/DigeratiHowWeProtectSection";
import { DigeratiLeadFormSection } from "./sections/DigeratiLeadFormSection";
import { DigeratiWhatWeTackleSection } from "./sections/DigeratiWhatWeTackleSection";
import { DigeratiAIAssistanceSection } from "./sections/DigeratiAIAssistanceSection";
import { DigeratiIndustriesSection } from "./sections/DigeratiIndustriesSection";
import { DigeratiPricingSection } from "./sections/DigeratiPricingSection";
import { DigeratiTestimonialsSection } from "./sections/DigeratiTestimonialsSection";
import { HomepageProofSection } from "./sections/HomepageProofSection";
import { DigeratiMeetExpertsSection } from "./sections/DigeratiMeetExpertsSection";
import { DigeratiFAQSection } from "./sections/DigeratiFAQSection";
import { DigeratiNewsletterSection } from "./sections/DigeratiNewsletterSection";
import { DigeratiContactSection } from "./sections/DigeratiContactSection";
import { DigeratiEnhancedFooterSection } from "./sections/DigeratiEnhancedFooterSection";
import { DigeratiStatsSection } from "./sections/DigeratiStatsSection";
import { DigeratiTrustPhotoSection } from "./sections/DigeratiTrustPhotoSection";
import { DigeratiCTASectionChallenger } from "./sections/DigeratiCTASectionChallenger";
import { DigeratiResourceRailChallenger } from "./sections/DigeratiResourceRailChallenger";

const challengerSections: { id: string; label: string; theme: 'dark' | 'light'; showInNav?: boolean }[] = [
  { id: 'hero', label: 'Home', theme: 'dark' },
  { id: 'challenges', label: 'Problems', theme: 'light', showInNav: false },
  { id: 'services', label: 'How It Works', theme: 'dark' },
  { id: 'pricing', label: 'Packages', theme: 'dark' },
  { id: 'protection', label: 'Protect', theme: 'light', showInNav: false },
  { id: 'testimonials', label: 'Proof', theme: 'dark', showInNav: false },
  { id: 'trust', label: 'Why DE', theme: 'light', showInNav: false },
  { id: 'industries', label: 'Industries', theme: 'dark' },
  { id: 'operations', label: 'Operations', theme: 'dark', showInNav: false },
  { id: 'stats', label: 'Risk', theme: 'dark', showInNav: false },
  { id: 'faq', label: 'FAQ', theme: 'light', showInNav: false },
  { id: 'cta', label: 'Next step', theme: 'dark', showInNav: false },
  { id: 'contact', label: 'Contact', theme: 'dark' },
];

/**
 * Hidden review-only homepage challenger.
 *
 * This page reuses the production sections so comparisons are meaningful,
 * but changes the story order and two challenger-only surfaces. It is noindex,
 * absent from navigation, and intentionally separate from `/` until approved.
 */
export const DigeratiHomepageChallenger = (): JSX.Element => {
  useSEO({
    noIndex: true,
    title: 'Homepage Challenger Preview',
    description: 'Review-only Digerati Experts homepage challenger.',
    canonical: '/',
  });

  return (
    <FullPageScrollProvider sections={challengerSections} enableOnMobile={false}>
      <div className="de-dark-well min-h-screen bg-[#050312] pb-8">
        <MegaMenu />

        <ScrollSectionAuto id="hero" chapter>
          <ReferenceHeroSection />
          <DigeratiAlertBanner />
        </ScrollSectionAuto>

        <ScrollSectionAuto id="challenges">
          <DigeratiWhatWeTackleSection />
        </ScrollSectionAuto>

        <ScrollSectionAuto id="services" chapter>
          <DigeratiServicesSection />
        </ScrollSectionAuto>

        <ScrollSectionAuto id="pricing" chapter>
          <DigeratiPricingSection />
        </ScrollSectionAuto>

        <ScrollSectionAuto id="protection">
          <DigeratiHowWeProtectSection />
        </ScrollSectionAuto>

        <ScrollSectionAuto id="testimonials">
          <DigeratiTestimonialsSection />
          <HomepageProofSection />
        </ScrollSectionAuto>

        <ScrollSectionAuto id="trust">
          <DigeratiTrustPhotoSection />
          <DigeratiMeetExpertsSection />
        </ScrollSectionAuto>

        <ScrollSectionAuto id="industries" chapter>
          <DigeratiIndustriesSection />
        </ScrollSectionAuto>

        <ScrollSectionAuto id="operations">
          <DigeratiAIAssistanceSection />
        </ScrollSectionAuto>

        <DigeratiResourceRailChallenger />

        <ScrollSectionAuto id="stats">
          <DigeratiStatsSection />
        </ScrollSectionAuto>

        {/* Form decisions are deliberately deferred: preserve all existing forms. */}
        <DigeratiLeadFormSection />

        <ScrollSectionAuto id="faq" chapter>
          <DigeratiFAQSection />
          <DigeratiNewsletterSection />
        </ScrollSectionAuto>

        <ScrollSectionAuto id="cta">
          <DigeratiCTASectionChallenger />
        </ScrollSectionAuto>

        <ScrollSectionAuto id="contact" chapter className="scroll-mt-20">
          <DigeratiContactSection />
          <DigeratiEnhancedFooterSection />
        </ScrollSectionAuto>
      </div>
    </FullPageScrollProvider>
  );
};
