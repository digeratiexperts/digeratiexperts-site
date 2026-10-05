import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { PRICING_SCOPE_NOTE, formatPrice, pricingTiers, type PricingTierKey } from "@/data/pricing";
import { ecosystemFitCopy } from "@/components/EcosystemProgression";
import "./11-pricing.css";
import { ChapterPattern } from "@/components/site/Atmosphere";

/**
 * 11 · Pricing (mock: sections/11-pricing.html). Names, rates, minimums, labels and links come
 * from @/data/pricing; fit lines from EcosystemProgression (the live homepage rail).
 */

// Mirrors the (unexported) `highlights` map in client/src/components/EcosystemProgression.tsx,
// which the live homepage renders with `detailed`. Keep the two in step.
const highlights: Record<PricingTierKey, string[]> = {
  it: ["Managed IT & help desk", "Baseline identity & endpoint", "Entry cybersecurity"],
  office: ["Everything in IT", "Managed network", "Endpoint backup"],
  business: ["Identity · endpoint · email", "SOC / MDR", "BCDR · strategy reviews"],
  enterprise: ["Advanced governance", "Audit-ready reporting", "Quarterly strategy"],
};

const arrow = { strokeWidth: 1.8, "aria-hidden": true } as const;

export function V8Pricing(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const reveal = {
    initial: prefersReducedMotion ? false : revealInitial,
    whileInView: revealInView,
    viewport: revealViewport,
    transition: revealTransition,
  } as const;

  return (
    <section className="f-well v8-section" aria-labelledby="pricing-heading" data-testid="homepage-pricing">
      <ChapterPattern variant="lattice" />
      <div className="v8-canvas">
        <div className="v8-box pricing-box">
          <motion.div className="v8-head" {...reveal}>
            <p className="v8-eyebrow">ProActive Ecosystem</p>
            <h2 className="v8-h2 pricing-h2" id="pricing-heading">
              <span className="pricing-h2__line">Four operating models.</span>{" "}
              <span className="pricing-h2__line">One matched to your environment.</span>
            </h2>
            <p className="v8-lede">
              We do not start with a package and pile on add-ons. If Office would need heavy modification, Business is
              the correct fit for that environment — not universally “better.” User count is a signal, never the sole
              criterion.
            </p>
          </motion.div>

          <motion.ol className="v8-grid v8-grid--4 pricing-grid" {...reveal}>
            {pricingTiers.map((tier, index) => {
              const isFlagship = tier.id === "business";
              return (
                <li key={tier.id} className={`v8-card pricing-card${isFlagship ? " pricing-card--flagship" : ""}`}>
                  <div className="pricing-card__meta">
                    <span className="v8-seq">{String(index + 1).padStart(2, "0")}</span>
                    {isFlagship && <span className="pricing-flag">Flagship Cyber</span>}
                  </div>
                  <h3 className="v8-h3">{tier.name}</h3>
                  <p className="pricing-price">
                    <span className="v8-num pricing-amount">{formatPrice(tier.user)}</span>
                    <span className="pricing-per">/user/mo</span>
                  </p>
                  <p className="pricing-min">
                    <span className="v8-num">{formatPrice(tier.monthlyMinimum)}</span> monthly minimum
                  </p>
                  <p className="v8-body pricing-fit">{ecosystemFitCopy[tier.id]}</p>
                  <ul className="pricing-list">
                    {highlights[tier.id].map((item) => (
                      <li key={item}>
                        <span className="v8-dash" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link className="v8-link" href={tier.learnMoreUrl} data-testid={`pricing-summary-${tier.id}`}>
                    {tier.label} <ArrowRight size={16} {...arrow} />
                  </Link>
                </li>
              );
            })}
          </motion.ol>

          <motion.div className="pricing-close" {...reveal}>
            <p className="v8-body pricing-fitnote">
              Not sure which package fits? We assess your environment — users, devices, locations, infrastructure,
              security, compliance, recovery, and whether you need fully managed or co-managed operations — then match
              the model.
            </p>
            <div className="pricing-close__copy">
              <h3 className="v8-h3">Not just IT support — one operating model</h3>
              <p className="v8-body">
                ProActive Business consolidates capabilities organizations often buy separately: managed IT, workplace,
                identity, endpoint security, email security, network security, backup &amp; recovery, security
                operations, and technology + cyber strategy — one accountable partner.
              </p>
              <p className="v8-small">{PRICING_SCOPE_NOTE}</p>
            </div>
            <div className="pricing-close__actions">
              <Link
                className="v8-btn v8-btn--primary"
                href="/proactive-ecosystem-pricing"
                data-testid="button-compare-everything"
              >
                Compare Everything <ArrowRight size={20} {...arrow} />
              </Link>
              <Link
                className="v8-btn v8-btn--outline"
                href="/proactive-ecosystem-pricing#pricing-tools"
                data-testid="button-pricing-tools"
              >
                Pricing tools
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
