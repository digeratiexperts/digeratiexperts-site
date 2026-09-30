import { ArrowRight, CheckCircle, Shield, Layers } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { revealTransition, revealViewport } from "@/lib/animations";
import { useBooking } from "@/contexts/BookingContext";
import { CTA } from "@/lib/ctaCopy";
import { ParallaxStill } from "@/components/visual/ParallaxStill";
import { IconWell } from "@/components/visual/IconWell";
import officeEveningImg from "@assets/de-arizona-office-evening-960.webp";
import {
  Eyebrow,
  HomeChapter,
  HomeContainer,
  buttonPrimary,
  cardDark,
  ledeClass,
  titleClass,
} from "@/components/home/HomeChapter";

const capabilities = [
  "Partner-backed detection and alerting across endpoints and identity",
  "Human triage — analysts decide what matters before you get a false alarm",
  "Prioritized remediation guidance tied to your environment",
  "Documented response paths when something needs escalation",
];

const promises = [
  {
    icon: Shield,
    title: "Coverage with Context",
    detail: "Alerts are interpreted against your specific environment — never dumped into an unmonitored ticket queue.",
  },
  {
    icon: Layers,
    title: "Documented Next Steps",
    detail: "Findings translate into actionable steps your executive and IT teams can execute without decoding cryptic jargon.",
  },
];

export const DigeratiAIAssistanceSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const { openBooking } = useBooking();

  return (
    <HomeChapter tone="well">
      <HomeContainer>
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-14">
          <motion.div
            className="order-2 lg:order-1 lg:col-span-6"
            initial={prefersReducedMotion ? false : { opacity: 0.55, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <div className="relative flex aspect-[4/3] w-full flex-col overflow-hidden rounded-xl border border-[var(--de-hairline)] bg-[var(--de-raised)]">
              <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
                <span>Arizona operations</span>
              </div>
              <ParallaxStill
                src={officeEveningImg}
                alt="Arizona professional office where Digerati Experts supports local businesses"
                travel={6}
                width={960}
                height={640}
                className="absolute inset-0"
              />
              <div className="relative mt-auto w-full bg-gradient-to-t from-black/85 via-black/45 to-transparent p-5 pt-16">
                <p className="text-base font-semibold text-white">Local Operations · Human Judgment</p>
                <p className="mt-0.5 text-sm text-white/75">Arizona-based · Principal-led</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="order-1 lg:order-2 lg:col-span-6"
            initial={prefersReducedMotion ? false : { opacity: 0.55, x: 12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <Eyebrow tone="well" className="mb-4">
              Detection &amp; response
            </Eyebrow>
            <h2 className={`${titleClass} max-w-[22ch]`}>
              Monitoring that ends with a person who owns the outcome
            </h2>
            <p className={`${ledeClass("well")} mt-5 max-w-xl`}>
              We leverage modern threat detection tooling so signals surface immediately — then our team investigates,
              prioritizes, and acts. Technology scales coverage; accountability remains human.
            </p>

            <ul className="mt-6 space-y-2.5">
              {capabilities.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-base text-white/85">
                  <CheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-de-magenta-ink" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {promises.map((item) => (
                <div key={item.title} className={`${cardDark} p-5`}>
                  <IconWell icon={item.icon} size="sm" surface="dark" />
                  <p className="mt-4 text-base font-semibold text-white">{item.title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/65">{item.detail}</p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => openBooking("ai_assistance_section")}
              className={`${buttonPrimary("well")} mt-8`}
              data-testid="button-ai-section-assessment"
            >
              {CTA.primary}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.div>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
};
