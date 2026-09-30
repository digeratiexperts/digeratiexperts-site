// FROZEN — homepage version 1, snapshot of client/src/pages/sections/DigeratiStatsSection.tsx from git ref origin/main on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, DollarSign, MapPin, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconWell } from "@/components/visual/IconWell";
import {
  getHomepageCyberFacts,
  type CyberAwarenessFact,
} from "@/data/cyberAwarenessFacts";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";

const factIcons: Record<string, LucideIcon> = {
  "dbir-ransomware-2026": AlertTriangle,
  "ibm-us-breach-cost-2026": DollarSign,
  "microsoft-mfa-blocks-2025": Shield,
  "az-ic3-losses-2024": MapPin,
};

function FactCard({
  fact,
  index,
  prefersReducedMotion,
}: {
  fact: CyberAwarenessFact;
  index: number;
  prefersReducedMotion: boolean | null;
}) {
  const Icon = factIcons[fact.id] ?? AlertTriangle;
  const sourceLine = `— ${fact.source} ${fact.year}`;

  const body = (
    <>
      <div className="flex items-center justify-between">
        <IconWell icon={Icon} size="sm" surface="dark" />
        <span className="h-1.5 w-1.5 rounded-full bg-[#D3126A]" aria-hidden="true" />
      </div>
      <p className="mt-5 font-mono de-tabular-nums text-3xl font-bold tracking-tight text-white md:text-4xl">
        {fact.metric}
      </p>
      <p className="mt-2.5 flex-1 text-base leading-relaxed text-white/75 md:text-lg">{fact.statement}</p>
      <p className="mt-4 border-t border-white/10 pt-3 text-sm font-medium text-white/60 group-hover:text-white/90">
        {sourceLine}
      </p>
    </>
  );

  return (
    <motion.div
      initial={prefersReducedMotion ? false : revealInitial}
      whileInView={revealInView}
      viewport={revealViewport}
      transition={{ ...revealTransition, delay: index * 0.04 }}
      className="h-full"
    >
      {fact.sourceUrl ? (
        <a
          href={fact.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="de-interactive-tile group flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-[#181520] to-[#0f0d14] p-6 shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-[#D3126A] hover:shadow-lg hover:shadow-[#D3126A]/10 md:p-7"
          data-testid={`homepage-stat-${index}`}
        >
          {body}
        </a>
      ) : (
        <div
          className="flex h-full flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-[#181520] to-[#0f0d14] p-6 shadow-md md:p-7"
          data-testid={`homepage-stat-${index}`}
        >
          {body}
        </div>
      )}
    </motion.div>
  );
}

export const DigeratiStatsSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const facts = getHomepageCyberFacts();

  return (
    <section className="de-dark-well de-field-grain relative py-6 lg:py-8">
      {/* Hero violet drift echo (Joe 2026-08-31): the opening field's
          atmosphere carries into the first chapter as a background-image
          layer ON the style box itself — no overlay element, so it can never
          paint above content regardless of stacking contexts
          (adversarial-review correction). */}
      <div
        className="de-style-box relative mx-3 px-4 py-8 sm:mx-4 sm:px-8 md:py-16 lg:mx-6 lg:px-10 lg:py-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 18%, rgba(87,68,255,0.12), transparent 32%), radial-gradient(circle at 95% 90%, rgba(211,18,106,0.05), transparent 26%)",
        }}
      >
        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
          className="mb-10 max-w-3xl lg:mb-12"
        >
          <p className="mb-3 text-base font-semibold uppercase tracking-[0.2em] text-de-magenta-ink">
            Why Digerati Experts
          </p>
          <h2 className="mb-4 font-heading text-3xl font-semibold tracking-[-0.02em] text-white md:text-4xl">
            The Threats Are <span className="de-hero-accent">Real</span>
          </h2>
          <p className="max-w-2xl text-base font-medium leading-relaxed text-white/80 md:text-lg md:font-normal md:text-white/65">
            Don&apos;t become a statistic. These numbers show why proactive security matters —
            and why endpoint, identity, and recovery discipline have to be owned, not assumed.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
          {facts.map((fact, index) => (
            <FactCard
              key={fact.id}
              fact={fact}
              index={index}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>

        <p className="mt-6">
          <Link href="/resources/cyber-facts">
            <span className="inline-flex items-center gap-1 text-base font-semibold text-de-magenta-ink hover:text-[#f0187a]">
              Full sourced facts
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </p>
      </div>
    </section>
  );
};
