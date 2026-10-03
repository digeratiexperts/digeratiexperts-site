import { useBooking } from "@/contexts/BookingContext";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { ClosingCta, type ChapterTone } from "@/components/site/chapters";

interface PremiumCTASectionProps {
  headline?: string;
  subheadline?: string;
  primaryButtonText?: string;
  primaryButtonHref?: string;
  showPhoneButton?: boolean;
  phoneNumber?: string;
  tone?: ChapterTone;
}

/**
 * Closing next-step band. Since the 2026-10 site chapter pass this is the
 * shared ClosingCta (one headline, magenta primary, phone secondary) instead of
 * a magenta slab with grid lines and blur blobs. The primary still opens the
 * booking modal; /book is the no-JS fallback.
 */
export function PremiumCTASection({
  headline = "Ready to Learn More?",
  subheadline = "Contact us today to discuss how we can help protect and enable your business.",
  primaryButtonText = "Schedule Consultation",
  primaryButtonHref = "/book",
  showPhoneButton = true,
  phoneNumber = PRIMARY_PHONE.display,
  tone = "surface",
}: PremiumCTASectionProps) {
  const { openBooking } = useBooking();
  const custom = phoneNumber !== PRIMARY_PHONE.display;

  return (
    <ClosingCta
      title={headline}
      lede={subheadline}
      tone={tone}
      primary={{
        label: primaryButtonText,
        href: primaryButtonHref,
        testId: "button-premium-cta-primary",
        onClick: (e) => {
          // Same as before the restyle: the primary always opens booking.
          e.preventDefault();
          openBooking("cta_section");
        },
      }}
      secondary={
        showPhoneButton && custom
          ? { label: `Call ${phoneNumber}`, href: `tel:${phoneNumber}`, testId: "button-premium-cta-phone" }
          : undefined
      }
      showPhone={showPhoneButton}
    />
  );
}
