import { motion, useReducedMotion } from "framer-motion";
import { revealTransition, revealViewport } from "@/lib/animations";
import { ArrowRight, MapPin, UserCheck, Scale } from "lucide-react";
import { ParallaxStill } from "@/components/visual/ParallaxStill";
import { IconWell } from "@/components/visual/IconWell";
import trustDeskImg from "@assets/de-trust-assessment-desk-960.webp";
import { CTA } from "@/lib/ctaCopy";
import {
  Eyebrow,
  HomeChapter,
  HomeContainer,
  buttonPrimary,
  ledeClass,
  titleClass,
} from "@/components/home/HomeChapter";

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
    <HomeChapter tone="paper" data-testid="section-trust-photo">
      <HomeContainer>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <motion.div
            className="lg:col-span-6"
            initial={prefersReducedMotion ? false : { opacity: 0.55, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <Eyebrow tone="paper" className="mb-4">
              Why Arizona businesses work with us
            </Eyebrow>
            <h2 className={`${titleClass} max-w-[22ch]`}>
              Protection that fits <span className="text-[#D3126A]">how you actually operate.</span>
            </h2>
            <p className={`${ledeClass("paper")} mt-5 max-w-xl`}>
              From medical practices to law firms to family-owned offices, we protect the businesses
              Arizona runs on—the ones that cannot afford downtime, a breach, or lost client data.
            </p>

            <ul className="mt-8 divide-y divide-[var(--de-paper-hairline)] border-y border-[var(--de-paper-hairline)]">
              {pillars.map((pillar) => (
                <li key={pillar.title} className="flex gap-4 py-4">
                  <IconWell icon={pillar.icon} size="sm" surface="light" />
                  <div>
                    <p className="text-base font-semibold text-[#1A1228]">{pillar.title}</p>
                    <p className="mt-0.5 text-base leading-relaxed text-[#5A5368]">{pillar.detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            <a href="/book" className={`${buttonPrimary("paper")} mt-8`} data-testid="link-trust-cta">
              {CTA.primary}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </motion.div>

          <motion.div
            className="relative flex lg:col-span-6"
            initial={prefersReducedMotion ? false : { opacity: 0.55, x: 12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <div className="relative flex aspect-[4/3] w-full flex-col overflow-hidden rounded-xl border border-[var(--de-paper-hairline)]">
              <ParallaxStill
                src={trustDeskImg}
                alt="Principal-led cyber risk assessment work for an Arizona business"
                travel={6}
                width={960}
                height={640}
                className="absolute inset-0"
                testId="img-trust-assessment-desk"
              />
              <div className="relative mt-auto bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5 pt-16">
                <p className="text-base font-semibold text-white">
                  Principal-led assessments sized to how your business runs
                </p>
                <p className="mt-0.5 text-sm text-white/75">Arizona MSP · Cybersecurity &amp; Managed IT</p>
              </div>
            </div>
          </motion.div>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
};
