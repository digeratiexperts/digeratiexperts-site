import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { PRICING_SCOPE_NOTE } from "@/data/pricing";
import { EcosystemProgression } from "@/components/EcosystemProgression";
import { revealInitial, revealInView, revealViewport } from "@/lib/animations";
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  buttonPrimary,
  buttonSecondary,
} from "@/components/home/HomeChapter";

export const DigeratiPricingSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <HomeChapter tone="well" data-testid="homepage-pricing">
      <HomeContainer>
        <HomeChapterHeader
          tone="well"
          eyebrow="ProActive Ecosystem"
          title="Four operating models. One matched to your environment."
          lede="We do not start with a package and pile on add-ons. If Office would need heavy modification, Business is the correct fit for that environment — not universally “better.” User count is a signal, never the sole criterion."
          link={{ label: "See detailed plans", href: "/proactive-ecosystem-pricing" }}
        />

        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
        >
          <EcosystemProgression detailed bare />
        </motion.div>

        <div className="mt-10 border-t border-[var(--de-hairline)] pt-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h3 className="font-heading text-xl font-semibold text-white md:text-2xl">
                Not just IT support — one operating model
              </h3>
              <p className="mt-2 text-base leading-relaxed text-white/65">
                ProActive Business consolidates capabilities organizations often buy separately:
                managed IT, workplace, identity, endpoint security, email security, network
                security, backup &amp; recovery, security operations, and technology + cyber strategy
                — one accountable partner.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/55">{PRICING_SCOPE_NOTE}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link href="/proactive-ecosystem-pricing" className={buttonPrimary("well")} data-testid="button-compare-everything">
                Compare Everything
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/proactive-ecosystem-pricing#pricing-tools" className={buttonSecondary("well")} data-testid="button-pricing-tools">
                Pricing tools
              </Link>
            </div>
          </div>
        </div>
      </HomeContainer>
    </HomeChapter>
  );
};
