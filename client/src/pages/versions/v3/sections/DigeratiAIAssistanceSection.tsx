// FROZEN — homepage version 3, snapshot of client/src/pages/sections/DigeratiAIAssistanceSection.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { ArrowRight, CheckCircle, Shield, Radio, Layers, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import { revealTransition, revealViewport } from "@/lib/animations";
import { useBooking } from "@/contexts/BookingContext";
import { CTA } from "@/lib/ctaCopy";
import { ParallaxStill } from "@/components/visual/ParallaxStill";
import officeEveningImg from "@assets/de-arizona-office-evening.png";

const capabilities = [
  "Partner-backed detection and alerting across endpoints and identity",
  "Human triage — analysts decide what matters before you get a false alarm",
  "Prioritized remediation guidance tied to your environment",
  "Documented response paths when something needs escalation",
];

export const DigeratiAIAssistanceSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const { openBooking } = useBooking();

  return (
    <section className="de-dark-chapter de-chapter-hairline de-field-grain de-field-lit relative overflow-hidden py-16 md:py-24">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 relative z-10">
        <div className="grid items-stretch gap-12 lg:grid-cols-2">
          {/* Visual Well Column */}
          <motion.div
            className="order-2 flex justify-center lg:order-1 lg:justify-start"
            initial={prefersReducedMotion ? false : { opacity: 0.55, x: -12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <div className="relative w-full max-w-md lg:max-w-none lg:h-full">
              <div className="relative flex aspect-[4/3] min-h-[18rem] overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#1a1522] to-[#0e0c13] shadow-2xl lg:aspect-auto lg:h-full lg:min-h-[24rem]">
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md">
                  <Activity className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
                  <span>Arizona SOC Operations</span>
                </div>
                <ParallaxStill
                  src={officeEveningImg}
                  alt="Arizona professional office where Digerati Experts supports local businesses"
                  travel={6}
                  width={448}
                  height={300}
                  className="absolute inset-0 opacity-90 transition-opacity duration-500 hover:opacity-100"
                />
                <div className="relative mt-auto w-full bg-gradient-to-t from-black/95 via-black/60 to-transparent p-6 pt-20">
                  <p className="text-lg font-bold text-white">Local Operations · Human Judgment</p>
                  <p className="text-xs text-white/75 mt-1">
                    Arizona-Based · Principal-Led · Always-On Telemetry
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Narrative & Capabilities Column */}
          <motion.div
            className="order-1 lg:order-2 flex flex-col justify-between"
            initial={prefersReducedMotion ? false : { opacity: 0.55, x: 12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <div>
              <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[#D3126A]/10 border border-[#D3126A]/20">
                <Radio className="h-3.5 w-3.5 text-[#D3126A]" aria-hidden />
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#D3126A]">
                  Detection & Response
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white leading-tight tracking-[-0.02em]">
                Monitoring that ends with a person who owns the outcome
              </h2>
              <p className="text-base md:text-lg text-white/75 mb-6 leading-relaxed max-w-xl">
                We leverage modern threat detection tooling so signals surface immediately — then our team investigates,
                prioritizes, and acts. Technology scales coverage; accountability remains human.
              </p>

              <ul className="space-y-3 mb-8">
                {capabilities.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-white/90 text-sm md:text-base">
                    <CheckCircle className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mb-8 grid gap-4 sm:grid-cols-2">
                <div className="de-paper-on-well group relative overflow-hidden rounded-xl bg-white p-5">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D3126A] via-[#E61E76] to-transparent opacity-80" />
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--de-paper-hairline)] bg-[#D3126A]/10 text-[#D3126A] transition-colors group-hover:bg-[#D3126A] group-hover:text-white">
                    <Shield className="h-5 w-5" aria-hidden />
                  </div>
                  <p className="mb-1 text-base font-bold text-[#1A1228]">Coverage with Context</p>
                  <p className="text-xs leading-relaxed text-black/60 md:text-sm">
                    Alerts are interpreted against your specific environment — never dumped into an unmonitored ticket queue.
                  </p>
                </div>
                <div className="de-paper-on-well group relative overflow-hidden rounded-xl bg-white p-5">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#D3126A] via-[#E61E76] to-transparent opacity-80" />
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--de-paper-hairline)] bg-[#D3126A]/10 text-[#D3126A] transition-colors group-hover:bg-[#D3126A] group-hover:text-white">
                    <Layers className="h-5 w-5" aria-hidden />
                  </div>
                  <p className="mb-1 text-base font-bold text-[#1A1228]">Documented Next Steps</p>
                  <p className="text-xs leading-relaxed text-black/60 md:text-sm">
                    Findings translate into actionable steps your executive and IT teams can execute without decoding cryptic jargon.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Button
                type="button"
                onClick={() => openBooking("ai_assistance_section")}
                className="h-12 bg-gradient-to-r from-[#D3126A] to-[#E61E76] px-8 text-base font-bold text-white shadow-lg shadow-[#D3126A]/25 transition-all hover:brightness-110"
                data-testid="button-ai-section-assessment"
              >
                {CTA.primary}
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
