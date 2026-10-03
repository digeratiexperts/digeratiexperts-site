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
  /** Canonical tel: URI — use display formatting in phoneNumber, not in href. */
  phoneTelHref?: string;
  tone?: ChapterTone;
}

/**
 * Closing next-step band. Since the 2026-10 site chapter pass this is the
 * shared ClosingCta (one headline, magenta primary, phone secondary) instead of
 * a magenta slab with grid lines and blur blobs (and so no motion to reduce).
 * The primary still opens the booking modal; /book is the no-JS fallback.
 */
export function PremiumCTASection({
  headline = "Get clarity on your cyber risk",
  subheadline = "Book a Cyber Risk Assessment with Digerati Experts — we start from your exposure, not a generic product pitch.",
  primaryButtonText = "Get My Cyber Risk Assessment",
  primaryButtonHref = "/book",
  showPhoneButton = true,
  phoneNumber = PRIMARY_PHONE.display,
  phoneTelHref = PRIMARY_PHONE.telHref,
  tone = "surface",
}: PremiumCTASectionProps) {
  const { openBooking } = useBooking();
  const custom = phoneNumber !== PRIMARY_PHONE.display || phoneTelHref !== PRIMARY_PHONE.telHref;

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
          ? { label: `Call ${phoneNumber}`, href: phoneTelHref, testId: "button-premium-cta-phone" }
          : undefined
      }
      showPhone={showPhoneButton}
    />
  );
}
