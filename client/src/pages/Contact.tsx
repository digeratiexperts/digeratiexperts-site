import { MegaMenu } from "@/components/MegaMenu";
import { DigeratiContactSection } from "@/pages/sections/DigeratiContactSection";
import { DigeratiEnhancedFooterSection } from "@/pages/sections/DigeratiEnhancedFooterSection";
import { useSEO } from "@/hooks/useSEO";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { EmailDomainNotice } from "@/components/EmailDomainNotice";

export default function Contact() {
  useSEO({
    title: "Contact",
    description:
      `Contact Digerati Experts in Chandler, Arizona. Call ${PRIMARY_PHONE.display} or send a message for a Cyber Risk Assessment.`,
    canonical: "/contact",
  });

  return (
    <div className="min-h-screen bg-[#050312]">
      <MegaMenu />
      <main id="main-content" tabIndex={-1} className="de-nav-clear">
        <DigeratiContactSection headingAs="h1" quiet />
        <div className="mx-auto max-w-3xl px-5 pb-16 sm:px-6 md:pb-20">
          <EmailDomainNotice />
        </div>
      </main>
      <DigeratiEnhancedFooterSection />
    </div>
  );
}
