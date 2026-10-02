import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { useThreatFeed } from "@/hooks/useThreatFeed";
import { useBooking } from "@/contexts/BookingContext";
import { CTA } from "@/lib/ctaCopy";
import { formatThreatDate, THREAT_ATTRIBUTION, type ThreatItem } from "@shared/threatFeed";
import "./12-threats-insights.css";

/**
 * Section 12 (mock: artifacts/design-concepts/homepage-sections-2026-10/sections/12-threats-insights.html).
 * Block 1: the live threat feed (useThreatFeed("homepage"), API order, live loading/empty shells).
 * Block 2: "Monitoring that ends with a person who owns the outcome" (live DigeratiAIAssistanceSection copy,
 * booking source "ai_assistance_section").
 */

const svgProps = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const ArrowIcon = () => (
  <svg {...svgProps}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);
const ExternalIcon = () => (
  <svg {...svgProps}>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </svg>
);
const CheckIcon = () => (
  <svg {...svgProps}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const ShieldIcon = () => (
  <svg {...svgProps}>
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);
const LayersIcon = () => (
  <svg {...svgProps}>
    <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
    <path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
    <path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
  </svg>
);

/** Tier 0: the company is never "Digerati" alone. The live attribution string still reads
 *  "Digerati prioritizes…"; render it as "Digerati Experts prioritizes…" as the mock does. */
function companyNamed(text: string): string {
  return text.replace(/\bDigerati(?! Experts)\b/g, "Digerati Experts");
}

function sourceLine(item: ThreatItem): string {
  return `${item.sourceName}${item.vendor ? ` · ${item.vendor}` : ""}${item.cve ? ` · ${item.cve}` : ""}`;
}

function capturedDate(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString().slice(0, 10);
}

const monitorChecks = [
  "Partner-backed detection and alerting across endpoints and identity",
  "Human triage — analysts decide what matters before you get a false alarm",
  "Prioritized remediation guidance tied to your environment",
  "Documented response paths when something needs escalation",
];

export function V7ThreatsInsights(): JSX.Element {
  const reduceMotion = useReducedMotion();
  const reveal = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: revealInitial,
          whileInView: revealInView,
          viewport: revealViewport,
          transition: { ...revealTransition, delay },
        };
  const { openBooking } = useBooking();
  const { payload, loading } = useThreatFeed("homepage");
  const items = payload.items;
  const captured = capturedDate(payload.generatedAt);

  return (
    <>
      <section className="f-well v7-section feed" aria-labelledby="insights-heading" data-testid="v7-insights">
        <div className="v7-canvas">
          <motion.div className="feed-head" {...reveal()}>
            <div className="v7-head">
              <p className="v7-eyebrow">Security Updates</p>
              <h2 className="v7-h2" id="insights-heading">
                Recent Threats &amp; Insights<span className="v7-colon" aria-hidden="true">:</span>
              </h2>
              <p className="v7-lede">
                Current items prioritized by active exploitation, exploit probability, and SMB relevance. Full stream,
                dates, and sources live on{" "}
                <Link className="v7-link--quiet" href="/resources/security-updates">
                  Security Updates
                </Link>
                .
              </p>
            </div>
            <div className="feed-actions">
              <Link className="v7-btn v7-btn--outline" href="/resources/security-updates" data-testid="view-all-updates">
                View All Security Updates <ArrowIcon />
              </Link>
              <Link className="v7-link" href="/resources/blog" data-testid="view-digerati-journal">
                Read the Digerati Journal <ArrowIcon />
              </Link>
            </div>
          </motion.div>

          {loading ? (
            <div className="v7-card feed-state" data-testid="insights-loading" role="status">
              <p className="v7-h4">Loading current threats…</p>
              <p className="v7-body">Checking CISA, FIRST, NVD, and Microsoft MSRC. Nothing is invented while this loads.</p>
            </div>
          ) : items.length === 0 ? (
            <div className="v7-card feed-state" data-testid="insights-empty">
              <p className="v7-h4">No current items meet the homepage threshold.</p>
              <p className="v7-body">
                We only promote threats with confirmed exploitation, high exploit probability, or clear SMB relevance —
                and only within the last 45 days. The full stream stays on Security Updates with dates and sources.
              </p>
            </div>
          ) : (
            <>
              <p className="feed-caption" id="feed-caption">
                <span className="v7-tag v7-tag--live">
                  {captured ? `Live feed · Captured ${captured}` : "Live feed"}
                </span>
              </p>
              <ul className="v7-grid v7-grid--2 feed-grid" aria-describedby="feed-caption">
                {items.map((item, index) => (
                  <motion.li key={item.id} {...reveal(index * 0.04)}>
                    <article className="v7-card--paper feed-card" data-testid={`insight-card-${index}`}>
                      <div className="feed-card__row">
                        <span
                          className={`v7-tag v7-tag--paper${item.severity === "critical" ? " feed-tag--critical" : ""}`}
                        >
                          {item.kicker}
                        </span>
                        <time className="feed-date" dateTime={item.publishedAt.slice(0, 10)}>
                          {formatThreatDate(item.publishedAt)}
                        </time>
                      </div>
                      <h3 className="v7-h3">{item.title}</h3>
                      <p className="feed-card__excerpt">{item.excerpt}</p>
                      <div className="feed-card__foot">
                        <span className="feed-card__src">{sourceLine(item)}</span>
                        <a className="v7-link" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                          Read source
                          <span className="sr-only">
                            {" "}
                            for {item.cve ?? item.title} on {item.sourceName} (opens in new tab)
                          </span>{" "}
                          <ExternalIcon />
                        </a>
                      </div>
                    </article>
                  </motion.li>
                ))}
              </ul>
            </>
          )}

          <p className="v7-small feed-sources">{companyNamed(payload.attribution || THREAT_ATTRIBUTION)}</p>
        </div>
      </section>

      <section className="f-well v7-section monitor" aria-labelledby="monitor-heading">
        <div className="v7-canvas monitor-grid">
          <motion.div className="monitor-copy" {...reveal()}>
            <p className="v7-eyebrow">Detection &amp; Response</p>
            <h2 className="v7-h2" id="monitor-heading">
              Monitoring that ends with a person who owns the outcome
            </h2>
            <p className="v7-lede">
              We leverage modern threat detection tooling so signals surface immediately — then our team investigates,
              prioritizes, and acts. Technology scales coverage; accountability remains human.
            </p>

            <ul className="monitor-checks">
              {monitorChecks.map((text) => (
                <li className="v7-check" key={text}>
                  <CheckIcon />
                  <span>{text}</span>
                </li>
              ))}
            </ul>

            <ul className="v7-cells monitor-cells">
              <li>
                <span className="v7-iconwell">
                  <ShieldIcon />
                </span>
                <h3 className="v7-h4">Coverage with Context</h3>
                <p className="v7-body">
                  Alerts are interpreted against your specific environment — never dumped into an unmonitored ticket
                  queue.
                </p>
              </li>
              <li>
                <span className="v7-iconwell">
                  <LayersIcon />
                </span>
                <h3 className="v7-h4">Documented Next Steps</h3>
                <p className="v7-body">
                  Findings translate into actionable steps your executive and IT teams can execute without decoding
                  cryptic jargon.
                </p>
              </li>
            </ul>

            <p className="monitor-cta">
              <a
                className="v7-btn v7-btn--primary"
                href="/book"
                onClick={(event) => {
                  event.preventDefault();
                  openBooking("ai_assistance_section");
                }}
                data-testid="button-ai-section-assessment"
              >
                {CTA.primary} <ArrowIcon />
              </a>
            </p>
          </motion.div>

          <motion.figure className="v7-card v7-card--inset monitor-figure" {...reveal(0.04)}>
            <span className="v7-tag" style={{ alignSelf: "flex-start" }}>
              Illustrative
            </span>
            <ol className="dg" aria-label="Signal, then human triage, then a named owner">
              <li className="dg-step">
                <span className="v7-seq">01</span>
                <div>
                  <span className="dg-label">Signal</span>
                  <p className="v7-small">Signals surface immediately</p>
                </div>
              </li>
              <li className="dg-step dg-step--hot">
                <span className="v7-seq">02</span>
                <div>
                  <span className="dg-label">Human triage</span>
                  <p className="v7-small">Our team investigates, prioritizes</p>
                </div>
              </li>
              <li className="dg-step">
                <span className="v7-seq">03</span>
                <div>
                  <span className="dg-label">Named owner</span>
                  <p className="v7-small">A person who owns the outcome · documented next steps</p>
                </div>
              </li>
            </ol>
            <figcaption className="monitor-figure__cap">
              <span className="dg-label">Local Operations · Human Judgment</span>
              <span className="v7-small">Arizona-Based · Principal-Led</span>
            </figcaption>
          </motion.figure>
        </div>
      </section>
    </>
  );
}
