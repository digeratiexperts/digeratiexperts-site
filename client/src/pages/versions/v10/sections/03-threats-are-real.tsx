import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowRight, ArrowUpRight, DollarSign, MapPin, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { getHomepageCyberFacts, type CyberAwarenessFact } from "@/data/cyberAwarenessFacts";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import "./03-threats-are-real.css";
import { SceneBackdrop } from "../scene/SceneBackdrop";

/**
 * 03 · The threats are real, ported from
 * artifacts/design-concepts/homepage-sections-2026-10/sections/03-threats-are-real.html.
 * Facts read from getHomepageCyberFacts(); icons and test ids as
 * client/src/pages/sections/DigeratiStatsSection.tsx.
 */

const ICON = { size: 20, strokeWidth: 1.8, "aria-hidden": true } as const;

const FACT_ICONS: Record<string, LucideIcon> = {
  "dbir-ransomware-2026": AlertTriangle,
  "ibm-us-breach-cost-2026": DollarSign,
  "microsoft-mfa-blocks-2025": Shield,
  "az-ic3-losses-2024": MapPin,
};

function FactCellBody({ fact }: { fact: CyberAwarenessFact }): JSX.Element {
  const Icon = FACT_ICONS[fact.id] ?? AlertTriangle;
  const isPdf = Boolean(fact.sourceUrl && /\.pdf($|[?#])/i.test(fact.sourceUrl));
  return (
    <>
      <span className="v10-iconwell">
        <Icon {...ICON} />
      </span>
      <p className="v10-stat">{fact.metric}</p>
      <p className="stats-cell__statement">{fact.statement}</p>
      <p className="stats-source">
        <span className="stats-source__text">— {fact.source} </span>
        <span className="stats-source__tail">
          <span className="stats-source__text">{fact.year}</span>
          {fact.sourceUrl && (
            <span className="stats-source__ext">
              {isPdf && <span className="stats-source__pdf">PDF</span>}
              <ArrowUpRight {...ICON} size={15} />
            </span>
          )}
        </span>
        {fact.sourceUrl && <span className="v10-sr">(opens in a new tab)</span>}
      </p>
    </>
  );
}

export function V10ThreatsAreReal(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const facts = getHomepageCyberFacts();

  return (
    <section className="f-well v10-section" id="stats" aria-labelledby="stats-heading">
      <SceneBackdrop frame="exposure" />
      <div className="v10-canvas">
        <div className="v10-box stats-box">
          <motion.div
            className="stats-head"
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <div className="v10-head">
              <p className="v10-eyebrow">Why Digerati Experts</p>
              <h2 className="v10-h2" id="stats-heading">
                The Threats Are <span className="v10-accent">Real</span>
              </h2>
              <p className="v10-lede">
                Don&apos;t become a statistic. These numbers show why proactive security matters — and why endpoint,
                identity, and recovery discipline have to be owned, not assumed.
              </p>
            </div>
            <Link className="v10-link" href="/resources/cyber-facts">
              Full sourced facts <ArrowRight {...ICON} />
            </Link>
          </motion.div>

          <ul className="v10-cells stats-cells" aria-label="Sourced facts">
            {facts.map((fact, index) => (
              <motion.li
                key={fact.id}
                initial={prefersReducedMotion ? false : revealInitial}
                whileInView={revealInView}
                viewport={revealViewport}
                transition={{ ...revealTransition, delay: index * 0.04 }}
              >
                {fact.sourceUrl ? (
                  <a
                    className="stats-cell"
                    href={fact.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid={`homepage-stat-${index}`}
                  >
                    <FactCellBody fact={fact} />
                  </a>
                ) : (
                  <div className="stats-cell" data-testid={`homepage-stat-${index}`}>
                    <FactCellBody fact={fact} />
                  </div>
                )}
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
