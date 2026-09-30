// FROZEN — homepage version 3, snapshot of client/src/pages/sections/DigeratiPricingSection.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { PRICING_SCOPE_NOTE } from "@/data/pricing";
import { EcosystemProgression } from "../EcosystemProgression";
import { revealInitial, revealInView, revealViewport } from "@/lib/animations";

export const DigeratiPricingSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      data-testid="homepage-pricing"
      className="de-dark-chapter de-chapter-hairline de-field-grain relative py-10 md:py-20 lg:py-24"
    >
      <div className="relative z-10 mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
        >
          <EcosystemProgression detailed />
        </motion.div>

        <div className="mt-8 border-t border-[var(--de-hairline)] pt-8 md:mt-10 md:pt-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h3 className="font-heading text-xl font-semibold text-white md:text-2xl">
                Not just IT support — one operating model
              </h3>
              <p className="mt-2 text-base leading-relaxed text-white/55 md:text-lg">
                ProActive Business consolidates capabilities organizations often buy separately:
                managed IT, workplace, identity, endpoint security, email security, network
                security, backup & recovery, security operations, and technology + cyber strategy
                — one accountable partner.
              </p>
              <p className="mt-3 text-base leading-relaxed text-white/50">
                {PRICING_SCOPE_NOTE}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href="/proactive-ecosystem-pricing">
                <span
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#D3126A] px-6 text-base font-semibold text-white transition-colors hover:bg-[#e01874] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]"
                  data-testid="button-compare-everything"
                >
                  Compare Everything
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
              <Link href="/proactive-ecosystem-pricing#pricing-tools">
                <span
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[var(--de-hairline)] px-6 text-base font-semibold text-white transition-colors hover:border-[#D3126A] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D3126A]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-surface)]"
                  data-testid="button-pricing-tools"
                >
                  Pricing tools
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
