// FROZEN — homepage version 1, snapshot of client/src/pages/sections/DigeratiAlertBanner.tsx from git ref origin/main on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { ArrowRight, Phone } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { Link } from "wouter";

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

export const DigeratiAlertBanner = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="de-dark-well relative py-8 md:py-12">
      <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
        <div className="de-paper-island relative px-6 py-10 sm:px-10 sm:py-14 md:px-12 md:py-16">
          <div className="mx-auto max-w-3xl relative z-10">
            <motion.div
              className="mb-8 md:mb-10"
              initial={prefersReducedMotion ? false : revealInitial}
              whileInView={revealInView}
              viewport={revealViewport}
              transition={revealTransition}
            >
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#A30E52] md:text-base">
                Why we exist
              </p>
              <h2 className="mb-4 font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#1A1228] md:text-4xl lg:text-5xl">
                We Exist to Protect and Enable Your Business
              </h2>
              <p className="max-w-2xl text-base font-medium leading-relaxed text-[#2A2438] md:text-lg">
                If you're like most business leaders, you don't want another vendor — you want a security-first partner who proactively reduces risk, improves uptime, and keeps your team moving.
              </p>
            </motion.div>

            <motion.ul
              className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-2xl border border-[var(--de-paper-hairline)] bg-white px-5 py-5 md:px-7 md:py-6"
              initial={prefersReducedMotion ? false : revealInitial}
              whileInView={revealInView}
              viewport={revealViewport}
              transition={revealTransition}
            >
              {features.map((feature) => (
                <li key={feature.title}>
                  <Link
                    href={feature.href}
                    data-testid={feature.testId}
                    className="group flex items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-paper)]"
                  >
                    <span className="mt-[0.7em] h-px w-2.5 shrink-0 bg-[#D3126A]" aria-hidden="true" />
                    <span>
                      <span className="block text-[15px] font-semibold leading-snug text-[#1A1228] group-hover:text-[#A30E52] md:text-base">
                        {feature.title}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-[#5A5368] md:text-[15px]">
                        {feature.description}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </motion.ul>

            <motion.div
              className="mt-10"
              initial={prefersReducedMotion ? false : revealInitial}
              whileInView={revealInView}
              viewport={revealViewport}
              transition={revealTransition}
            >
              <h3 className="mb-2 font-heading text-xl font-semibold tracking-[-0.02em] text-[#1A1228] md:text-2xl">
                Ready to Secure Your Business?
              </h3>
              <p className="mb-6 max-w-2xl text-base leading-relaxed text-[#2A2438] md:text-lg">
                Get enterprise-grade protection tailored for Arizona businesses. Let's discuss your security needs.
              </p>

              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-lg border-0 bg-[#D3126A] px-7 text-base font-semibold text-white shadow-none transition-colors hover:bg-[#e01874] hover:shadow-none"
                  data-testid="button-schedule-consultation-banner"
                >
                  <a href="/book">
                    <ArrowRight className="mr-2 h-5 w-5" />
                    Schedule Consultation
                  </a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-lg border border-[var(--de-paper-hairline)] bg-white px-7 text-base font-semibold text-[#1A1228] shadow-none hover:border-[#D3126A] hover:bg-white hover:text-[#A30E52]"
                  data-testid="button-call-banner"
                >
                  <a href={PRIMARY_PHONE.telHref}>
                    <Phone className="mr-2 h-5 w-5" />
                    Call {PRIMARY_PHONE.display}
                  </a>
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
