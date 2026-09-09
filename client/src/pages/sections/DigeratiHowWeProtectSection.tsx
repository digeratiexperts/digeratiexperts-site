import { motion, useReducedMotion } from "framer-motion";
import { Search, FileText, Settings, Activity, KeyRound, Monitor, Mail, Wifi, Database, Radio, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { IconWell } from "@/components/visual/IconWell";
import type { LucideIcon } from "lucide-react";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { ProtectionCommandDeck } from "@/components/visual/ProtectionCommandDeck";

const steps: {
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
  testId: string;
  href: string;
}[] = [
  {
    number: 1,
    title: "Assessment",
    description: "Review identity, endpoints, email, backups, network, and operating reality.",
    icon: Search,
    testId: "step-discovery",
    href: "/book",
  },
  {
    number: 2,
    title: "Roadmap",
    description: "Match the operating model to the environment — fit, not a ranking ladder.",
    icon: FileText,
    testId: "step-planning",
    href: "/solutions/proactive-ecosystem",
  },
  {
    number: 3,
    title: "Implementation",
    description: "Documented credentials you own. Controls sized to the model we matched.",
    icon: Settings,
    testId: "step-implementation",
    href: "/solutions/proactive-ecosystem",
  },
  {
    number: 4,
    title: "Continuous",
    description: "Day-to-day support, security operations where included, and reviews at that tier’s cadence.",
    icon: Activity,
    testId: "step-protection",
    href: "/solutions/proactive-ecosystem",
  },
];

export const DigeratiHowWeProtectSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <>
      <section className="de-dark-well relative py-8 md:py-14">
        <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
          <div className="de-paper-island relative px-6 py-10 sm:px-10 sm:py-14 md:px-12 md:py-16">
            <div className="relative z-10">
              <motion.div
                className="mb-8 max-w-2xl md:mb-12"
                initial={prefersReducedMotion ? false : revealInitial}
                whileInView={revealInView}
                viewport={revealViewport}
                transition={revealTransition}
              >
                <p className="mb-3 text-base font-semibold uppercase tracking-[0.2em] text-[#A30E52]">
                  What we protect
                </p>
                <h2 className="mb-4 font-heading text-3xl font-semibold tracking-[-0.02em] text-[#1A1228] md:text-4xl">
                  Eight blocks. One accountable operating model.
                </h2>
                <p className="text-lg leading-relaxed text-[#3A3448]">
                  Protection is layered around the business, and each block answers a specific class
                  of threat. Risk and exposure runs continuously beneath the other seven. Select a
                  block below to see how we operate it.
                </p>
              </motion.div>


              {/* Interactive eight-block protection command deck */}
              <div id="protection-stack">
                <ProtectionCommandDeck />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-protection-works"
        className="de-process-band relative overflow-hidden py-14 md:py-16 lg:py-20"
        aria-labelledby="how-protection-works-heading"
      >
        <div className="container relative z-10 mx-auto px-3 sm:px-4 lg:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4 md:mb-12">
            <div className="max-w-3xl">
              <p className="mb-2 text-base font-semibold uppercase tracking-[0.2em] text-de-magenta-ink">
                How protection works
              </p>
              <h3
                id="how-protection-works-heading"
                className="font-heading text-2xl font-semibold tracking-[-0.02em] text-white md:text-3xl"
              >
                Assessment → Roadmap → Implementation → Continuous
              </h3>
            </div>
            <Link href="/solutions/proactive-ecosystem">
              <span className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-white underline-offset-4 hover:text-[#D3126A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]">
                Full methodology
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          </div>

          <ol className="mx-auto grid max-w-[92rem] grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {steps.map((step, index) => {
              const IconComponent = step.icon;
              return (
                <li
                  key={step.number}
                  className={`${index > 0 ? "lg:border-l lg:border-[var(--de-hairline)]" : "lg:pl-0"} lg:px-6`}
                >
                  <Link
                    href={step.href}
                    data-testid={step.testId}
                    className="de-interactive-tile group flex h-full flex-col rounded-xl border border-transparent p-3 hover:border-de-hairline hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]"
                  >
                    <p className="font-mono text-sm font-bold tracking-[0.18em] text-[#D3126A]" aria-hidden="true">
                      {String(step.number).padStart(2, "0")}
                    </p>
                    <span className="mt-3 mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#D3126A]/30 bg-[#D3126A]/10 text-[#D3126A] shadow-[0_0_16px_-4px_rgba(211,18,106,0.45)] transition-all group-hover:border-[#D3126A]/60 group-hover:shadow-[0_0_20px_-4px_rgba(211,18,106,0.6)]">
                      <IconComponent className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h4 className="mb-2 text-lg font-semibold text-white">
                      {step.title}
                    </h4>
                    <p className="text-base leading-relaxed text-white/75 md:text-lg">
                      {step.description}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    </>
  );
};
