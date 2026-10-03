import { ArrowRight, Phone } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { useBooking } from "@/contexts/BookingContext";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { CTA } from "@/lib/ctaCopy";
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  buttonPrimary,
  buttonSecondary,
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

/** "Why we exist" — the manifesto chapter that follows the hero's trust strip. */
export const DigeratiAlertBanner = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const { openBooking } = useBooking();

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
            eyebrow="Why we exist"
            title="We Exist to Protect and Enable Your Business"
            lede="If you're like most business leaders, you don't want another vendor — you want a security-first partner who proactively reduces risk, improves uptime, and keeps your team moving."
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

        <motion.div
          className="mt-10 flex flex-col gap-5 border-t border-[var(--de-hairline)] pt-8 lg:flex-row lg:items-center lg:justify-between"
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <div className="max-w-2xl">
            <h3 className="font-heading text-xl font-semibold tracking-[-0.02em] text-white md:text-2xl">
              Ready to Secure Your Business?
            </h3>
            <p className="mt-1.5 text-base leading-relaxed text-white/65">
              Get enterprise-grade protection tailored for Arizona businesses. Let&apos;s discuss your security needs.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              className={buttonPrimary("well")}
              data-testid="button-cyber-risk-assessment-banner"
              onClick={() => openBooking("why-we-exist-banner")}
            >
              {CTA.primary}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <a href={PRIMARY_PHONE.telHref} className={buttonSecondary("well")} data-testid="button-call-banner">
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call {PRIMARY_PHONE.display}
            </a>
          </div>
        </motion.div>
      </HomeContainer>
    </HomeChapter>
  );
};
