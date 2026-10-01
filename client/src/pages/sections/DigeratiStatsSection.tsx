import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, DollarSign, MapPin, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { IconWell } from "@/components/visual/IconWell";
import {
  getHomepageCyberFacts,
  type CyberAwarenessFact,
} from "@/data/cyberAwarenessFacts";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  cardDark,
  cardDarkInteractive,
} from "@/components/home/HomeChapter";

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
      <IconWell icon={Icon} size="sm" surface="dark" />
      <p className="mt-5 font-mono de-tabular-nums text-3xl font-bold tracking-tight text-white md:text-4xl">
        {fact.metric}
      </p>
      <p className="mt-2.5 flex-1 text-base leading-relaxed text-white/70">{fact.statement}</p>
      <p className="mt-4 border-t border-[var(--de-hairline)] pt-3 text-sm font-medium text-white/55 group-hover:text-white/85">
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
          className={`${cardDarkInteractive} flex h-full flex-col p-6`}
          data-testid={`homepage-stat-${index}`}
        >
          {body}
        </a>
      ) : (
        <div className={`${cardDark} flex h-full flex-col p-6`} data-testid={`homepage-stat-${index}`}>
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
    <HomeChapter tone="surface">
      <HomeContainer>
        <motion.div
          initial={prefersReducedMotion ? false : revealInitial}
          whileInView={revealInView}
          viewport={revealViewport}
          transition={revealTransition}
        >
          <HomeChapterHeader
            tone="surface"
            eyebrow="Why Digerati Experts"
            title={
              <>
                The Threats Are <span className="de-hero-accent">Real</span>
              </>
            }
            lede="Don't become a statistic. These numbers show why proactive security matters — and why endpoint, identity, and recovery discipline have to be owned, not assumed."
            link={{ label: "Full sourced facts", href: "/resources/cyber-facts" }}
          />
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
      </HomeContainer>
    </HomeChapter>
  );
};
