import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, MapPin, Scale, UserCheck } from "lucide-react";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { DE_LOGO_PRIMARY } from "@/lib/brandAssets";
import { CTA } from "@/lib/ctaCopy";
import { TipTag } from "./TipTag";
import "./08-why-arizona.css";

/**
 * 08 · Why Arizona businesses work with us (mock: sections/08-why-arizona.html).
 * The figure is an EXAMPLE FORMAT outline of an assessment report. Row descriptions are
 * verbatim repo copy: Healthcare.tsx ("A prioritized risk summary …") and
 * AssessmentReportSample.tsx (the VALIDATE and REMEDIATE roadmap lines). No numbers,
 * no client, no scores.
 */

const pillars = [
  {
    icon: MapPin,
    title: "Arizona-based",
    detail: "Local principal support for businesses that need a real person, not a ticket queue.",
  },
  {
    icon: UserCheck,
    title: "Principal-led",
    detail: "Recommendations come from the people who will stand behind the work.",
  },
  {
    icon: Scale,
    title: "Sized to your business",
    detail: "Controls and tooling matched to your risk—not an enterprise stack you will not use.",
  },
];

const reportRows = [
  { label: "Prioritized findings", detail: "A prioritized risk summary — urgent vs later — not a product dump" },
  { label: "Business-impact context", detail: "Confirm evidence, ownership, scope, and business impact." },
  {
    label: "Right-sized recommendations",
    detail: "Prioritize approved control and process changes by risk and dependency.",
  },
];

const icon = { size: 20, strokeWidth: 1.8, "aria-hidden": true } as const;

export function V8WhyArizona(): JSX.Element {
  const prefersReducedMotion = useReducedMotion();
  const reveal = {
    initial: prefersReducedMotion ? false : revealInitial,
    whileInView: revealInView,
    viewport: revealViewport,
    transition: revealTransition,
  } as const;

  return (
    <section className="f-paper v8-section" aria-labelledby="trust-title" data-testid="section-trust-photo">
      <div className="v8-canvas why">
        <motion.div className="why__copy" {...reveal}>
          <p className="v8-eyebrow">Why Arizona businesses work with us</p>
          <h2 className="v8-h2" id="trust-title">
            Protection that fits how you actually operate.
          </h2>
          <p className="v8-lede">
            From medical practices to law firms to family-owned offices, we protect the businesses Arizona runs on—the
            ones that cannot afford downtime, a breach, or lost client data.
          </p>

          <ul className="why__pillars">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.title}>
                  <span className="v8-iconwell v8-iconwell--light v8-iconwell--sm">
                    <Icon {...icon} />
                  </span>
                  <div>
                    <h3 className="v8-h4">{p.title}</h3>
                    <p className="v8-body">{p.detail}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="why__cta-row">
            <a className="v8-btn v8-btn--primary why__cta" href="/book" data-testid="link-trust-cta">
              {CTA.primary} <ArrowRight {...icon} />
            </a>
          </div>
        </motion.div>

        <motion.figure
          className="docfig"
          aria-label="Example format: outline of a Cyber Risk Assessment findings report"
          {...reveal}
        >
          <div className="doc">
            <div className="doc__bar">
              <img className="doc__logo" src={DE_LOGO_PRIMARY} alt="Digerati Experts" />
            </div>
            <div className="doc__title">
              <TipTag className="v8-tag--paper" tip="Shows how an assessment report is laid out, not a real client's findings.">Example format</TipTag>
              <p className="doc__name">Cyber Risk Assessment — findings</p>
            </div>
            {reportRows.map((row) => (
              <div className="doc__row" key={row.label}>
                <p className="doc__label">
                  <span className="v8-dash" aria-hidden="true" />
                  {row.label}
                </p>
                <p className="v8-small">{row.detail}</p>
                <span className="doc__bar-ph" aria-hidden="true" />
              </div>
            ))}
          </div>
          <figcaption>
            <p className="v8-small">Principal-led assessments sized to how your business runs</p>
            <p className="v8-small">Arizona MSP · Cybersecurity &amp; Managed IT</p>
          </figcaption>
        </motion.figure>
      </div>
    </section>
  );
}
