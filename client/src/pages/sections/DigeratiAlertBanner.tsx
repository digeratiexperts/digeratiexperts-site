import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
} from "@/components/home/HomeChapter";

const features = [
  {
    title: "Security-First Operations",
    description: "Every system, endpoint, and user is protected - by design, not by reaction.",
    testId: "card-security-first",
    href: "/solutions/proactive-ecosystem",
  },
  {
    title: "Co-Managed or Fully Managed",
    description: "We support your internal IT or serve as your outsourced technology team.",
    testId: "card-co-managed",
    href: "/solutions/co-managed-it",
  },
  {
    title: "Executive-Level Transparency",
    description: "Reports, KPIs, and compliance insights that make sense - and drive decisions.",
    testId: "card-transparency",
    href: "/trust",
  },
];

/** Three ways the work is run. The closer used to sell a consultation and "enterprise-grade" protection; the booking page is the assessment surface. */
export const DigeratiAlertBanner = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <HomeChapter tone="well" seam={false}>
      <HomeContainer>
        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <HomeChapterHeader
            tone="well"
            eyebrow="How the work is run"
            title="The assessment opens one of these doors"
            lede="Fully managed, co-managed, or a look at how the work is already run. The environment decides which one fits."
          />
        </motion.div>

        <motion.ul
          className="grid gap-6 border-t border-[var(--de-hairline)] pt-8 md:grid-cols-3 md:gap-0 md:divide-x md:divide-[var(--de-hairline)]"
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          {features.map((feature, index) => (
            <li key={feature.title} className="md:px-6 md:first:pl-0 md:last:pr-0">
              <Link
                href={feature.href}
                data-testid={feature.testId}
                className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-bg)]"
              >
                <span className="font-mono text-sm font-semibold tracking-[0.16em] text-de-magenta-ink">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-3 flex items-center gap-2 text-lg font-semibold text-white">
                  {feature.title}
                  <ArrowRight
                    className="h-4 w-4 text-white/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-de-magenta-ink"
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-2 block text-base leading-relaxed text-white/65">
                  {feature.description}
                </span>
              </Link>
            </li>
          ))}
        </motion.ul>

      </HomeContainer>
    </HomeChapter>
  );
};
