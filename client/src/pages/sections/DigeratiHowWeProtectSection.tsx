import { motion, useReducedMotion } from "framer-motion";
import { Search, FileText, Settings, Activity, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { IconWell } from "@/components/visual/IconWell";
import type { LucideIcon } from "lucide-react";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { ProtectionCommandDeck } from "@/components/visual/ProtectionCommandDeck";
import {
  Eyebrow,
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  indexClass,
} from "@/components/home/HomeChapter";

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
    description: "Day-to-day support and the DE Security Foundation are included at every tier; detection, response, recovery, and governance deepen with the plan.",
    icon: Activity,
    testId: "step-protection",
    href: "/solutions/proactive-ecosystem",
  },
];

export const DigeratiHowWeProtectSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <>
      {/* Paper chapter from md up. Below md the deck renders Joe's 390px
          mock (2026-10-01): one dark field, so the chapter drops to the well
          and the heading inks switch with it. */}
      <HomeChapter tone="paper" className="max-md:border-[var(--de-hairline)] max-md:bg-[var(--de-bg)] max-md:text-white">
        <HomeContainer className="max-md:px-4">
          <motion.div
            className="mb-8 max-w-2xl md:mb-12"
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <Eyebrow tone="paper" className="mb-4 max-md:text-de-magenta-ink">
              What we protect
            </Eyebrow>
            <h2 className="font-heading text-[26px] font-semibold leading-[1.15] tracking-[-0.02em] text-white sm:text-3xl md:text-4xl md:text-[#1A1228]">
              Eight blocks. One accountable operating model.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.55] text-white/70 md:text-lg md:leading-relaxed md:text-[#3A3448]">
              Protection is layered around the business, and each block answers a specific class
              of threat. Risk and exposure runs continuously beneath the other seven. Select a
              block below to see how we operate it.
            </p>
          </motion.div>

          {/* Interactive eight-block protection command deck */}
          <div id="protection-stack">
            <ProtectionCommandDeck />
          </div>
        </HomeContainer>
      </HomeChapter>

      <HomeChapter tone="surface" id="how-protection-works" aria-labelledby="how-protection-works-heading">
        <HomeContainer>
          <HomeChapterHeader
            tone="surface"
            as="h3"
            titleId="how-protection-works-heading"
            eyebrow="How protection works"
            title="Assessment → Roadmap → Implementation → Continuous"
            link={{ label: "Full methodology", href: "/solutions/proactive-ecosystem" }}
          />

          <ol className="grid grid-cols-1 gap-6 border-t border-[var(--de-hairline)] pt-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-[var(--de-hairline)]">
            {steps.map((step) => {
              const IconComponent = step.icon;
              return (
                <li key={step.number} className="lg:px-6 lg:first:pl-0 lg:last:pr-0">
                  <Link
                    href={step.href}
                    data-testid={step.testId}
                    className="group flex h-full flex-col rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]"
                  >
                    <div className="flex items-center gap-3">
                      <IconWell icon={IconComponent} size="sm" surface="dark" />
                      <span className={indexClass("surface")} aria-hidden="true">
                        {String(step.number).padStart(2, "0")}
                      </span>
                    </div>
                    <h4 className="mt-4 text-lg font-semibold text-white">{step.title}</h4>
                    <p className="mt-2 text-base leading-relaxed text-white/65">{step.description}</p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-white/50 transition-colors group-hover:text-de-magenta-ink">
                      Learn more
                      <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </HomeContainer>
      </HomeChapter>
    </>
  );
};
