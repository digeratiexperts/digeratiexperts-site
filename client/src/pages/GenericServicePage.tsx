import { PageTemplate } from "@/components/PageTemplate";
import {
  CheckCircle,
  Phone,
  ArrowRight,
  Zap,
  AlertTriangle,
  Grid3X3,
  MapPin,
  HelpCircle,
  ListChecks,
  Quote,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useSEO } from "@/hooks/useSEO";
import { ServiceMatrix } from "@/components/ServiceMatrix";
import { ServiceCapabilityMatrix } from "@/components/ServiceCapabilityMatrix";
import { pageNarratives, type PageNarrative } from "@/pages/routes/pageNarratives";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { IconWell } from "@/components/visual/IconWell";
import { StatementHeading } from "@/components/visual/StatementHeading";
import { createStaggerDelay, revealInView, revealInitial, revealTransition, revealViewport } from "@/lib/animations";
import { Button } from "@/components/ui/button";
import { ProofChip } from "@/components/evidence/ProofChip";
import { StatusToken } from "@/components/evidence/StatusToken";
import { Shield, Clock, Award, Users } from "lucide-react";

interface ServiceFeature {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface ServiceStat {
  value: string;
  label: string;
  source: string;
}

interface GenericServicePageProps {
  title: string;
  subtitle: string;
  description: string;
  features: ServiceFeature[];
  benefits: string[];
  gradientColors?: string;
  stat?: ServiceStat;
  canonical?: string;
  recommendedTier?: "it" | "office" | "business" | "enterprise";
  serviceKey?: string;
  narrative?: PageNarrative;
}

function breadcrumbsFromCanonical(
  canonical: string | undefined,
  title: string,
): { label: string; href?: string }[] | undefined {
  if (!canonical) return undefined;
  const family = canonical.startsWith("/solutions/")
    ? { label: "Solutions", href: "/solutions" }
    : canonical.startsWith("/industries/")
      ? { label: "Industries", href: "/industries" }
      : canonical.startsWith("/resources/")
        ? { label: "Resources", href: "/resources" }
        : canonical.startsWith("/support/")
          ? { label: "Support", href: "/about/support" }
          : canonical.startsWith("/about/")
            ? { label: "About" }
            : canonical.startsWith("/trust/")
              ? { label: "Trust", href: "/trust/trust-center" }
              : canonical.startsWith("/legal/")
                ? { label: "Legal" }
                : null;
  if (!family) return undefined;
  return [family, { label: title }];
}

const FeatureCard = ({
  feature,
  index,
  prefersReducedMotion,
}: {
  feature: ServiceFeature;
  index: number;
  prefersReducedMotion: boolean;
}) => (
  <motion.article
    initial={prefersReducedMotion ? false : revealInitial}
    whileInView={revealInView}
    viewport={revealViewport}
    transition={{ ...revealTransition, delay: createStaggerDelay(index) }}
    className="de-hud-card group h-full p-6 transition-all duration-200 hover:border-[#D3126A]/40"
  >
    <div className="mb-4">
      {feature.icon ? (
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-de-accent-ink">
          {feature.icon}
        </span>
      ) : (
        <span className="mb-1 block h-1 w-8 bg-[#D3126A]" aria-hidden="true" />
      )}
    </div>
    <h3 className="font-heading text-xl font-semibold text-white">{feature.title}</h3>
    <p className="mt-2 leading-relaxed text-white/75 text-sm">{feature.description}</p>
  </motion.article>
);

export default function GenericServicePage({
  title,
  subtitle,
  description,
  features,
  benefits,
  stat,
  canonical,
  recommendedTier,
  serviceKey,
  narrative: narrativeProp,
}: GenericServicePageProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const narrative = narrativeProp ?? (serviceKey ? pageNarratives[serviceKey] : undefined);
  const breadcrumbs = breadcrumbsFromCanonical(canonical, title);

  useSEO({
    title,
    description,
    canonical,
  });

  return (
    <PageTemplate title={title} subtitle={subtitle} variant="dark" breadcrumbs={breadcrumbs}>
      <div className="space-y-16">
        {/* Factual Contextual Proof Chips */}
        <div className="flex flex-wrap items-center gap-3">
          <ProofChip metric="24/7" label="Human-Led SOC" icon={Shield} />
          <ProofChip metric="ARIZONA" label="Local Engineering Team" icon={Users} />
          <ProofChip metric="8 BLOCKS" label="Managed Protection" icon={Award} />
          <ProofChip metric="SLA" label="Defined Response Times" icon={Clock} />
        </div>

        {stat && (
          <motion.div
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
            className="rounded-2xl border border-de-hairline bg-de-raised p-6"
            data-testid="service-stat-callout"
          >
            <div className="flex items-start gap-4">
              <IconWell icon={AlertTriangle} size="md" surface="dark" />
              <div>
                <div className="font-heading text-3xl font-semibold text-de-accent-ink">{stat.value}</div>
                <p className="mt-1 text-white/80">{stat.label}</p>
                <p className="mt-1 text-sm text-white/50">— {stat.source}</p>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
          className="max-w-4xl border-l-2 border-[#D3126A] pl-6"
        >
          <p className="text-xl leading-relaxed text-white/80">{description}</p>
          {narrative?.whoFor && (
            <p className="mt-4 text-base leading-relaxed text-white/70">
              <span className="font-medium text-de-accent-ink">Who this is for: </span>
              {narrative.whoFor}
            </p>
          )}
        </motion.div>

        {narrative?.painPoints && narrative.painPoints.length > 0 && (
          <section data-testid="section-pain-points">
            <div className="mb-6 flex items-center gap-3">
              <IconWell icon={ListChecks} size="sm" surface="dark" />
              <div>
                <StatementHeading as="h2" className="text-3xl">
                  Is this you
                </StatementHeading>
                <p className="text-sm text-white/60">If two or more feel familiar, this page is for your office.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {narrative.painPoints.map((pain, index) => (
                <motion.div
                  key={pain}
                  initial={prefersReducedMotion ? false : revealInitial}
                  whileInView={revealInView}
                  viewport={revealViewport}
                  transition={{ ...revealTransition, delay: createStaggerDelay(index) }}
                  className="de-interactive-card flex items-start gap-3 rounded-xl border border-de-hairline bg-de-raised p-4"
                >
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" />
                  <p className="text-white/85">{pain}</p>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {features.length > 0 && (
          <div>
            <div className="mb-8 flex items-center gap-3">
              <IconWell icon={Zap} size="sm" surface="dark" />
              <StatementHeading as="h2" className="text-3xl">
                What you get
              </StatementHeading>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <FeatureCard
                  key={feature.title}
                  feature={feature}
                  index={index}
                  prefersReducedMotion={prefersReducedMotion}
                />
              ))}
            </div>
          </div>
        )}

        {narrative?.process && narrative.process.length > 0 && (
          <section data-testid="section-process">
            <div className="mb-8 flex items-center gap-3">
              <IconWell icon={ArrowRight} size="sm" surface="dark" />
              <div>
                <StatementHeading as="h2" className="text-3xl">
                  How engagement works
                </StatementHeading>
                <p className="text-sm text-white/60">A clear path — not a black box of tickets.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {narrative.process.map((step, index) => (
                <motion.div
                  key={step.title}
                  initial={prefersReducedMotion ? false : revealInitial}
                  whileInView={revealInView}
                  viewport={revealViewport}
                  transition={{ ...revealTransition, delay: createStaggerDelay(index) }}
                  className="de-interactive-card rounded-xl border border-de-hairline bg-de-raised p-5"
                >
                  <div className="mb-2 font-mono text-[11px] font-bold tracking-widest text-[#F04C97] uppercase">
                    0{index + 1} / STEP
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-white font-heading">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-white/70">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {benefits.length > 0 && (
          <motion.div
            className="rounded-2xl border border-de-hairline bg-de-raised p-8 md:p-12"
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <div className="mb-8 flex items-center gap-3">
              <IconWell icon={CheckCircle} size="sm" surface="dark" />
              <StatementHeading as="h2" className="text-3xl">
                Outcomes that matter
              </StatementHeading>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit}
                  className="flex items-start gap-3 rounded-xl border border-de-hairline bg-de-bg p-4"
                  initial={prefersReducedMotion ? false : revealInitial}
                  whileInView={revealInView}
                  viewport={revealViewport}
                  transition={{ ...revealTransition, delay: createStaggerDelay(index) }}
                >
                  <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-de-accent-ink" />
                  <span className="font-medium text-white/80">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {(narrative?.arizonaNote || narrative?.proof) && (
          <section className="grid gap-6 md:grid-cols-2" data-testid="section-local-proof">
            {narrative.arizonaNote && (
              <div className="rounded-2xl border border-de-hairline bg-de-raised p-6">
                <div className="mb-3 flex items-center gap-2 text-de-accent-ink">
                  <MapPin className="h-5 w-5" />
                  <span className="text-sm font-semibold uppercase tracking-wide">Arizona operator</span>
                </div>
                <p className="leading-relaxed text-white/85">{narrative.arizonaNote}</p>
              </div>
            )}
            {narrative.proof && (
              <div className="rounded-2xl border border-[#D3126A]/35 bg-de-bg p-6">
                <Quote className="mb-3 h-6 w-6 text-de-accent-ink" />
                <p className="mb-3 text-lg leading-relaxed text-white">“{narrative.proof.quote}”</p>
                <p className="text-sm text-white/55">— {narrative.proof.attribution}</p>
              </div>
            )}
          </section>
        )}

        {serviceKey && (
          <motion.div
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <div className="mb-6 flex items-center gap-3">
              <IconWell icon={Grid3X3} size="sm" surface="dark" />
              <div>
                <StatementHeading as="h2" className="text-2xl">
                  Service tiers
                </StatementHeading>
                <p className="text-sm text-white/70">Compare what’s included at each tier</p>
              </div>
            </div>
            <ServiceCapabilityMatrix
              serviceKey={serviceKey}
              highlightTier={recommendedTier === "it" ? "essentials" : recommendedTier}
            />
          </motion.div>
        )}

        {recommendedTier && (
          <motion.div
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <div className="mb-8 text-center">
              <StatementHeading as="h2" className="text-2xl">
                Where this capability typically lives
              </StatementHeading>
              <p className="mt-2 text-white/70">
                Fit language — not a ranking. Confirm the operating model in your Cyber Risk Assessment.
              </p>
            </div>
            <ServiceMatrix
              variant="full"
              highlightTier={recommendedTier}
              showOnlyHighlighted={!!recommendedTier}
            />
          </motion.div>
        )}

        {narrative?.faqs && narrative.faqs.length > 0 && (
          <section data-testid="section-faqs">
            <div className="mb-8 flex items-center gap-3">
              <IconWell icon={HelpCircle} size="sm" surface="dark" />
              <StatementHeading as="h2" className="text-3xl">
                Questions owners actually ask
              </StatementHeading>
            </div>
            <div className="max-w-4xl space-y-4">
              {narrative.faqs.map((faq) => (
                <div key={faq.q} className="rounded-xl border border-de-hairline bg-de-raised p-5">
                  <h3 className="mb-2 text-lg font-semibold text-white">{faq.q}</h3>
                  <p className="leading-relaxed text-white/70">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <motion.div
          className="rounded-2xl border border-[#D3126A]/40 bg-[#D3126A] px-8 py-10 text-center md:px-12 md:py-12"
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <h2 className="mb-4 font-heading text-3xl font-semibold text-white md:text-4xl">
            {narrative?.ctaHeadline || "Schedule your cyber risk assessment"}
          </h2>
          <p className="mx-auto mb-8 max-w-2xl text-lg text-white/90 md:text-xl">
            {narrative?.ctaBody ||
              "We’ll map risk, stack gaps, and the right next step for your Arizona business — without a hard sell."}
          </p>
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Button asChild size="lg" className="h-12 bg-white px-8 font-semibold text-[#D3126A] hover:bg-white/95">
              <a href="/book" data-testid="button-contact">
                {CTA.primary}
                <ArrowRight className="ml-1 h-5 w-5" />
              </a>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/70 bg-transparent px-8 font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <a href={PRIMARY_PHONE.telHref} data-testid="button-call">
                <Phone className="mr-1 h-5 w-5" />
                Call {PRIMARY_PHONE.display}
              </a>
            </Button>
          </div>
        </motion.div>
      </div>
    </PageTemplate>
  );
}
