// FROZEN — homepage version 3, snapshot of client/src/pages/sections/DigeratiTrustPhotoSection.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { motion, useReducedMotion } from "framer-motion";
import { revealTransition, revealViewport } from "@/lib/animations";
import { Shield, ArrowRight, MapPin, UserCheck, Scale } from "lucide-react";
import { ParallaxStill } from "@/components/visual/ParallaxStill";
import trustDeskImg from "@assets/de-trust-assessment-desk.png";
import { CTA } from "@/lib/ctaCopy";

const pillars = [
  {
    icon: MapPin,
    title: "Arizona-based",
    detail: "Local principal support for businesses that need a real person, not a ticket queue.",
  },
  {
    icon: UserCheck,
    title: "Principal-led",
    detail: "Recommendations come from the people who will stand behind the work.",
  },
  {
    icon: Scale,
    title: "Sized to your business",
    detail: "Controls and tooling matched to your risk—not an enterprise stack you will not use.",
  },
];

export const DigeratiTrustPhotoSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="de-dark-well relative py-8 md:py-14" data-testid="section-trust-photo">
      <div className="max-w-[var(--de-canvas)] mx-auto px-3 sm:px-4 lg:px-6">
        <div className="de-paper-island relative px-6 py-10 sm:px-10 sm:py-14 md:px-12 md:py-16">
          <div className="grid grid-cols-1 items-stretch gap-12 lg:grid-cols-2 lg:gap-16 relative z-10">
            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0.55, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={revealViewport}
              transition={revealTransition}
            >
              <div className="flex items-center gap-2 mb-5">
                <Shield className="w-4 h-4 text-[#D3126A]" aria-hidden="true" />
                <span className="text-xs md:text-sm font-bold text-[#A30E52] uppercase tracking-[0.2em]">
                  Why Arizona businesses work with us
                </span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1A1228] leading-tight mb-6 tracking-tight">
                Protection that fits{" "}
                <span className="text-[#D3126A]">
                  how you actually operate.
                </span>
              </h2>

              <p className="text-base md:text-lg text-[#3A3448] leading-relaxed mb-8 max-w-xl">
                From medical practices to law firms to family-owned offices, we protect the businesses
                Arizona runs on—the ones that cannot afford downtime, a breach, or lost client data.
              </p>

              <div className="space-y-5 mb-10">
                {pillars.map((pillar) => (
                  <div key={pillar.title} className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#D3126A]/10 border border-[#D3126A]/20">
                      <pillar.icon className="h-4 w-4 text-[#D3126A]" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#1A1228]">{pillar.title}</p>
                      <p className="text-sm md:text-base text-[#5A5368] leading-relaxed">{pillar.detail}</p>
                    </div>
                  </div>
                ))}
              </div>

              <a
                href="/book"
                className="inline-flex items-center gap-2 rounded-lg bg-[#D3126A] px-7 py-3.5 text-base font-semibold text-white transition-colors duration-200 hover:bg-[#e01874] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-paper)]"
                data-testid="link-trust-cta"
              >
                {CTA.primary}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </motion.div>

            <motion.div
              className="relative flex"
              initial={prefersReducedMotion ? false : { opacity: 0.55, x: 12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={revealViewport}
              transition={revealTransition}
            >
              <div className="relative flex aspect-[4/3] w-full flex-col overflow-hidden rounded-2xl border border-de-paper-hairline shadow-lg shadow-black/10 lg:aspect-auto lg:min-h-full">
                <ParallaxStill
                  src={trustDeskImg}
                  alt="Principal-led cyber risk assessment work for an Arizona business"
                  travel={6}
                  width={960}
                  height={720}
                  className="absolute inset-0"
                  testId="img-trust-assessment-desk"
                />
                <div className="relative mt-auto bg-gradient-to-t from-black/75 via-black/35 to-transparent p-5 pt-16">
                  <p className="text-white text-base font-medium">
                    Principal-led assessments sized to how your business runs
                  </p>
                  <p className="text-white/80 text-base mt-1">
                    Arizona MSP · Cybersecurity & Managed IT
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
