import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBooking } from "@/contexts/BookingContext";
import { PRIMARY_PHONE } from "@/data/companyContact";

interface PremiumCTASectionProps {
  headline?: string;
  subheadline?: string;
  primaryButtonText?: string;
  primaryButtonHref?: string;
  showPhoneButton?: boolean;
  phoneNumber?: string;
}

export function PremiumCTASection({
  headline = "Get clarity on your cyber risk",
  subheadline = "Book a Cyber Risk Assessment with Digerati Experts — we start from your exposure, not a generic product pitch.",
  primaryButtonText = "Get My Cyber Risk Assessment",
  primaryButtonHref = "/book",
  showPhoneButton = true,
  phoneNumber = PRIMARY_PHONE.display,
}: PremiumCTASectionProps) {
  const prefersReducedMotion = useReducedMotion();
  const { openBooking } = useBooking();
  const reveal = prefersReducedMotion
    ? { initial: false as const, whileInView: undefined, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.5 },
      };

  return (
    <section className="py-16 md:py-20 px-4 bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 30 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6 }}
          className="relative rounded-3xl overflow-hidden"
        >
          <div
            className="absolute inset-0"
            style={{
              background: "var(--de-magenta)",
            }}
          />

          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
            }}
          />

          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />

          <div className="relative z-10 px-8 py-12 md:px-16 md:py-16 text-center">
            <motion.h2
              initial={reveal.initial}
              whileInView={reveal.whileInView}
              viewport={{ once: true }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { ...reveal.transition, delay: 0.1 }
              }
              className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4"
            >
              {headline}
            </motion.h2>

            <motion.p
              initial={reveal.initial}
              whileInView={reveal.whileInView}
              viewport={{ once: true }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { ...reveal.transition, delay: 0.2 }
              }
              className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-8"
            >
              {subheadline}
            </motion.p>

            <motion.div
              initial={reveal.initial}
              whileInView={reveal.whileInView}
              viewport={{ once: true }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { ...reveal.transition, delay: 0.3 }
              }
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button
                size="lg"
                className="h-14 px-8 bg-white text-de-accent hover:bg-white/90 font-semibold text-base rounded-full shadow-lg shadow-black/20"
                data-testid="button-premium-cta-primary"
                onClick={(e) => {
                  e.preventDefault();
                  openBooking("cta_section");
                }}
              >
                <ArrowRight className="mr-2 h-5 w-5" />
                {primaryButtonText}
              </Button>

              {showPhoneButton && (
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-14 px-8 bg-transparent border-2 border-white/40 text-white hover:bg-white/10 hover:border-white/60 font-semibold text-base rounded-full"
                  data-testid="button-premium-cta-phone"
                >
                  <a href={`tel:${phoneNumber}`}>
                    <Phone className="mr-2 h-5 w-5" />
                    Call {phoneNumber}
                  </a>
                </Button>
              )}
            </motion.div>
          </div>

          <div className="absolute inset-0 rounded-3xl border border-white/20 pointer-events-none" />
        </motion.div>
      </div>
    </section>
  );
}
