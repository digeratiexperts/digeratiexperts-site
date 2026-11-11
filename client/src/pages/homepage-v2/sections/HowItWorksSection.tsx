import { HOME_CTA } from "../cta";

/**
 * Three steps from first call to a running plan. The four-step methodology
 * (assess, plan, build, run) now lives on /solutions.
 */
const STEPS = [
  {
    title: "A short fit call",
    text: "Tell us what's going on. We'll tell you straight whether we're the right team, and if we're not, who might be.",
  },
  {
    title: "Your Cyber Risk Assessment",
    text: "We review identity, endpoints, email, backups, and how your team really works, then hand you a written report.",
  },
  {
    title: "A plan, priced in the open",
    text: "We match a plan to what we found, at the per-user prices already on our pricing page. Scope is confirmed before work begins.",
  },
];

export function HowItWorksSection(): JSX.Element {
  return (
    <section className="sec alt t-signal" id="how">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">How it works</p>
            <h2>Three steps. No mystery.</h2>
          </div>
          <a className="link" href="/resources/reports/cyber-risk-assessment-sample" data-cta="how_sample_report">See a sample report</a>
        </div>
        <div className="steps steps-3">
          {STEPS.map((step, index) => (
            <div className="step" key={step.title}>
              <em>{index + 1}</em>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 28 }}>
          <a href={HOME_CTA.fitCallHref} className="btn btn-cta" data-cta="how_fit_call">{HOME_CTA.fitCall}</a>
          <a href="/pricing" className="btn btn-line" data-cta="how_pricing">See Plans &amp; Pricing</a>
        </div>
      </div>
    </section>
  );
}
