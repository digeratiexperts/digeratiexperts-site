import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { Activity, ArrowRight, FileText, Search, Settings, type LucideIcon } from "lucide-react";
import { protectionDomains, type ProtectionDomain } from "@/components/visual/ProtectionCommandDeck";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
// v10.css first so this section's rules follow the base system in the cascade,
// as the section stylesheet follows tokens.css in the mock.
import "../v10.css";
import { TipTag } from "./TipTag";
import "./06-eight-blocks.css";
import { SceneBackdrop } from "../scene/SceneBackdrop";

/**
 * Section 06: "What we protect" (the eight blocks) and "How protection works".
 * Mock: artifacts/design-concepts/homepage-sections-2026-10/sections/06-eight-blocks.html.
 *
 * ≥768px: paper band with one dark evidence panel (rail of seven, reading
 * pane, the Risk & exposure block as a continuous rail beneath).
 * <768px: Joe's approved 390px layout, as live in ProtectionCommandDeck.
 * One selectedId drives both layouts. All eight blocks come from
 * protectionDomains; nothing is re-typed here.
 */

const iconProps = { size: 20, strokeWidth: 1.8, "aria-hidden": true } as const;

/** Seven peers, then the continuous block: the arrow-key order of both layouts. */
const ORDER = protectionDomains.map((d) => d.id);
const peers = protectionDomains.filter((d) => !d.continuous);
const continuousDomain = protectionDomains.find((d) => d.continuous);
const byId = (id: string) => protectionDomains.find((d) => d.id === id) ?? protectionDomains[0];

/** Live AnimatePresence mode="wait": exit up, enter from below, 0.2s each. */
const paneEase = [0.25, 0.1, 0.25, 1] as const;

const steps: {
  number: number;
  title: string;
  description: string;
  icon: LucideIcon;
  testId: string;
  href: string;
}[] = [
  {
    number: 1,
    title: "Assessment",
    description: "Review identity, endpoints, email, backups, network, and operating reality.",
    icon: Search,
    testId: "step-discovery",
    href: "/book",
  },
  {
    number: 2,
    title: "Roadmap",
    description: "Match the operating model to the environment — fit, not a ranking ladder.",
    icon: FileText,
    testId: "step-planning",
    href: "/solutions/proactive-ecosystem",
  },
  {
    number: 3,
    title: "Implementation",
    description: "Documented credentials you own. Controls sized to the model we matched.",
    icon: Settings,
    testId: "step-implementation",
    href: "/solutions/proactive-ecosystem",
  },
  {
    number: 4,
    title: "Continuous",
    description:
      "Day-to-day support and the DE Security Foundation are included at every tier; detection, response, recovery, and governance deepen with the plan.",
    icon: Activity,
    testId: "step-protection",
    href: "/solutions/proactive-ecosystem",
  },
];

function DashList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>
          <span className="v10-dash" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function PaneContent({ domain }: { domain: ProtectionDomain }) {
  const Icon = domain.icon;
  const { architecture: arch, operatingModel: om } = domain;
  return (
    <>
      <header className="pane__head">
        <span className="v10-iconwell">
          <Icon {...iconProps} />
        </span>
        <div>
          <h3 className="v10-h3">{domain.name}</h3>
          <span className="pane__answers">Answers {domain.answers}</span>
        </div>
      </header>
      <p className="pane__purpose">{domain.purpose}</p>
      <div className="pane__row">
        <div>
          <p className="v10-meta">Questions the assessment should answer</p>
          <ul className="qlist" aria-label="What an assessment asks">
            {domain.commonQuestions.map((q) => (
              <li key={q}>
                <span className="v10-dash" aria-hidden="true" />
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="v10-meta">{arch.boundaryName}</p>
          <div className="boundary" role="group" aria-label={arch.boundaryName}>
            <div className="boundary__nodes">
              {arch.nodes.map((node, i) => (
                <FragmentNode key={node.title} node={node} withLink={i > 0} />
              ))}
            </div>
            <div className="gate">
              <span className="gate__dot" aria-hidden="true" />
              <span className="gate__label">{arch.gate.label}</span>
              <span className="gate__policy">{arch.gate.policy}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="v10-cells groups">
        <div>
          <p className="v10-meta">Representative scope</p>
          <DashList items={om.scopeExamples} />
        </div>
        <div>
          <p className="v10-meta">Management may include</p>
          <DashList items={om.managementExamples} />
        </div>
        <div>
          <p className="v10-meta">Signal examples</p>
          <DashList items={om.signalExamples} />
        </div>
        <div>
          <p className="v10-meta">Representative outputs</p>
          <DashList items={om.deliverableExamples} />
        </div>
      </div>
    </>
  );
}

/** A boundary node, preceded by the hairline link when it is not the first. */
function FragmentNode({
  node,
  withLink,
}: {
  node: ProtectionDomain["architecture"]["nodes"][number];
  withLink: boolean;
}) {
  return (
    <>
      {withLink ? <div className="link-h" aria-hidden="true" /> : null}
      <div className="node">
        <span className="node__title">{node.title}</span>
        <span className="node__sub">{node.subtitle}</span>
        <span className="node__meta">
          <span className="v10-meta">Detail</span>
          <span className="v10-meta">{node.detail}</span>
        </span>
      </div>
    </>
  );
}

export function V10EightBlocks(): JSX.Element {
  const reduce = useReducedMotion();
  const reveal = {
    initial: reduce ? false : revealInitial,
    whileInView: revealInView,
    viewport: revealViewport,
    transition: revealTransition,
  } as const;

  const [selectedId, setSelectedId] = useState(ORDER[0]);
  const active = byId(selectedId);

  const dTabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pTabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pRow = useRef<HTMLDivElement | null>(null);
  const [fade, setFade] = useState({ l: false, r: false });

  /* Edge fade only while the phone row actually scrolls. */
  const updateFade = useCallback(() => {
    const row = pRow.current;
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    const l = max > 1 && row.scrollLeft > 1;
    const r = max > 1 && row.scrollLeft < max - 1;
    setFade((prev) => (prev.l === l && prev.r === r ? prev : { l, r }));
  }, []);

  useEffect(() => {
    const row = pRow.current;
    if (!row) return;
    updateFade();
    row.addEventListener("scroll", updateFade, { passive: true });
    window.addEventListener("resize", updateFade);
    document.fonts?.ready.then(updateFade).catch(() => {});
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateFade) : null;
    ro?.observe(row);
    return () => {
      row.removeEventListener("scroll", updateFade);
      window.removeEventListener("resize", updateFade);
      ro?.disconnect();
    };
  }, [updateFade]);

  const select = (id: string, focus = false) => {
    setSelectedId(id);
    if (!focus) return;
    // Focus the tab in whichever layout is showing (the other is display:none).
    const phone = pRow.current?.offsetParent != null;
    const el = (phone ? pTabs : dTabs).current[id];
    el?.focus();
    if (phone && el && !byId(id).continuous) {
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
    }
  };

  /* Arrow keys, Home, End across all eight; activation follows focus. */
  const onTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    const i = ORDER.indexOf(id);
    let next: string | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = ORDER[(i + 1) % ORDER.length];
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = ORDER[(i - 1 + ORDER.length) % ORDER.length];
    else if (e.key === "Home") next = ORDER[0];
    else if (e.key === "End") next = ORDER[ORDER.length - 1];
    if (next) {
      e.preventDefault();
      select(next, true);
    }
  };

  const desktopTab = (d: ProtectionDomain) => {
    const Icon = d.icon;
    const on = d.id === selectedId;
    return (
      <button
        key={d.id}
        ref={(el) => {
          dTabs.current[d.id] = el;
        }}
        className="tab"
        id={`d-tab-${d.id}`}
        type="button"
        role="tab"
        aria-selected={on}
        aria-controls="d-panel"
        tabIndex={on ? 0 : -1}
        data-testid={`domain-tab-${d.id}`}
        data-continuous={d.continuous ? "true" : undefined}
        onClick={() => select(d.id)}
        onKeyDown={(e) => onTabKeyDown(e, d.id)}
      >
        <span className="v10-iconwell v10-iconwell--sm">
          <Icon {...iconProps} />
        </span>
        <span>
          {d.continuous ? (
            <span className="continuous__name">
              <span className="tab__name">{d.shortName}</span>
              <span className="v10-tag">Continuous</span>
            </span>
          ) : (
            <span className="tab__name">{d.shortName}</span>
          )}
          <span className="tab__answers">Answers {d.answers}</span>
        </span>
      </button>
    );
  };

  const phoneTabProps = (d: ProtectionDomain) => {
    const on = d.id === selectedId;
    return {
      ref: (el: HTMLButtonElement | null) => {
        pTabs.current[d.id] = el;
      },
      id: `p-tab-${d.id}`,
      type: "button" as const,
      role: "tab",
      "aria-selected": on,
      "aria-controls": "p-panel",
      tabIndex: on ? 0 : -1,
      "data-testid": `domain-tab-phone-${d.id}`,
      onClick: () => select(d.id),
      onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => onTabKeyDown(e, d.id),
    };
  };

  const paneDuration = reduce ? 0 : 0.2;
  const rowClass = ["phone__row", fade.l ? "fade-l" : "", fade.r ? "fade-r" : ""].filter(Boolean).join(" ");

  return (
    <>
      <section className="f-paper v10-section protect" aria-labelledby="protect-heading">
        <SceneBackdrop frame="protected" />
        <div className="v10-canvas">
          <motion.div className="v10-head" {...reveal}>
            <p className="v10-eyebrow">What we protect</p>
            <h2 className="v10-h2" id="protect-heading">
              Eight blocks. One accountable operating model.
            </h2>
            <p className="v10-lede">
              Protection is layered around the business, and each block answers a specific class of threat. Risk and
              exposure runs continuously beneath the other seven. Select a block below to see how we operate it.
            </p>
          </motion.div>

          <motion.div id="protection-stack" {...reveal}>
            {/* ≥768px: one dark evidence panel. */}
            <div className="model" role="group" aria-label="Eight-block protection model">
              <div className="model__bar">
                <div>
                  <p className="model__title">Eight-block protection model</p>
                  <p className="model__sub">
                    Explore how DE thinks about identity, endpoints, email, browser and web, network, detection and
                    response, and human risk, with risk and exposure running continuously beneath them, without implying
                    every client receives the same controls or tooling.
                  </p>
                </div>
                <TipTag tip="Illustrative architecture. Scope and controls depend on your operating model and environment.">Illustrative · Interactive model</TipTag>
              </div>
              <div className="model__body">
                <div
                  className="rail"
                  role="tablist"
                  aria-label="Protection blocks"
                  aria-orientation="vertical"
                  aria-owns={continuousDomain ? `d-tab-${continuousDomain.id}` : undefined}
                >
                  {peers.map(desktopTab)}
                </div>
                <div
                  className="pane"
                  id="d-panel"
                  role="tabpanel"
                  tabIndex={0}
                  aria-labelledby={`d-tab-${selectedId}`}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={active.id}
                      className="pane__inner"
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: paneDuration, ease: paneEase }}
                    >
                      <PaneContent domain={active} />
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="continuous">
                  {continuousDomain ? desktopTab(continuousDomain) : null}
                  <p className="continuous__text" data-testid="domain-continuous-note">
                    Seven blocks answer a threat class each. Risk &amp; exposure runs continuously beneath all seven as
                    the visibility and intelligence layer.
                  </p>
                </div>
              </div>
              <p className="v10-small model__foot">
                Source: Illustrative architecture. Exact scope, controls, monitoring, deliverables, vendors, and cadence
                depend on the selected operating model and client environment.
              </p>
            </div>

            {/* <768px: Joe's approved 390px layout. No frame chrome, no card in a card, no diagram widget. */}
            <div className="phone" data-testid="protection-deck-phone">
              <div className="phone__tabs" role="tablist" aria-label="Protection blocks">
                <div className={rowClass} ref={pRow}>
                  {peers.map((d) => (
                    <button key={d.id} className="ptab" {...phoneTabProps(d)}>
                      {d.phoneLabel}
                    </button>
                  ))}
                </div>
                {continuousDomain ? (
                  <button className="prail" data-continuous="true" {...phoneTabProps(continuousDomain)}>
                    <span className="prail__name">{continuousDomain.phoneLabel}</span>
                    <span className="prail__tag">Continuous · under all seven</span>
                  </button>
                ) : null}
              </div>
              <p className="phone__note" data-testid="domain-continuous-note-phone">
                Seven blocks each answer a threat class, and risk and exposure runs under all of them.
              </p>
              {/* The phone swaps instantly, as live. */}
              <article
                className="pblock"
                id="p-panel"
                role="tabpanel"
                aria-live="polite"
                aria-labelledby={`p-tab-${selectedId}`}
                data-testid="protection-deck-phone-domain"
              >
                <h3 className="pblock__name">
                  {active.name}
                  <span className="pblock__answers">Answers {active.answers}</span>
                </h3>
                <p className="pblock__purpose">{active.purpose}</p>
                <ul className="pblock__qs" aria-label="What an assessment asks">
                  {active.commonQuestions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                <div className="pblock__bnd">
                  <h4>{active.architecture.boundaryName}</h4>
                  <dl>
                    {active.architecture.nodes.map((n) => (
                      <div key={n.title}>
                        <dt>{n.title}</dt>
                        <dd>{n.subtitle}.</dd>
                      </div>
                    ))}
                    <div>
                      <dt>{active.architecture.gate.label}</dt>
                      <dd>{active.architecture.gate.policy}.</dd>
                    </div>
                  </dl>
                </div>
              </article>
            </div>
          </motion.div>
        </div>
      </section>

      <section
        className="f-surface v10-section v10-grain how"
        id="how-protection-works"
        aria-labelledby="how-protection-works-heading"
      >
        <div className="v10-canvas">
          <motion.div className="how__head" {...reveal}>
            <div className="v10-head">
              <p className="v10-eyebrow">How protection works</p>
              <h3 className="v10-h2 how__title" id="how-protection-works-heading">
                Assessment <span className="arrow" aria-hidden="true">→</span>
                <span className="sr-only"> to </span> Roadmap <span className="arrow" aria-hidden="true">→</span>
                <span className="sr-only"> to </span> Implementation <span className="arrow" aria-hidden="true">→</span>
                <span className="sr-only"> to </span> Continuous
              </h3>
            </div>
            <Link className="v10-link" href="/solutions/proactive-ecosystem">
              Full methodology <ArrowRight {...iconProps} />
            </Link>
          </motion.div>

          <motion.ol className="v10-cells steps" {...reveal}>
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <li key={step.number}>
                  <Link className="step" href={step.href} data-testid={step.testId}>
                    <span className="v10-seq">{String(step.number).padStart(2, "0")}</span>
                    <span className="v10-iconwell">
                      <Icon {...iconProps} />
                    </span>
                    <span className="v10-h4">{step.title}</span>
                    <span className="v10-body">{step.description}</span>
                  </Link>
                </li>
              );
            })}
          </motion.ol>
        </div>
      </section>
    </>
  );
}
