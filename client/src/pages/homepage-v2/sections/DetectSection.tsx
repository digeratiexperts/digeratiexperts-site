import { CheckIcon } from "../icons";
import { RatiMark } from "@/components/mascots/Mascots";
import { HOME_CTA } from "../cta";

const STEPS = [
  { title: "Signal", text: "Detection tooling surfaces the signals" },
  { title: "Alert triage", text: "Alerts triaged by DE technicians during business hours, on plans that include it" },
  { title: "Named owner", text: "A person owns the outcome, with documented next steps" },
];

/** Rati sits small in the corner of the card. No caption about the mascot. */
export function DetectSection(): JSX.Element {
  return (
    <section className="sec alt t-signal" id="detect">
      <div className="wrap detect">
        <div>
          <p className="mark">Detection and response</p>
          <h2>Automated security alert monitoring, with alerts triaged by DE technicians during business hours, on plans that include it.</h2>
          <p className="lede" style={{ marginTop: 16 }}>Modern detection tooling surfaces the signals. Our team investigates, prioritizes, and acts. Technology scales coverage; accountability stays human.</p>
          <ul className="check">
            <li><CheckIcon />Partner-backed detection across endpoints and identity</li>
            <li><CheckIcon />Automated security alert monitoring, with alerts triaged by DE technicians during business hours, on plans that include it.</li>
            <li><CheckIcon />Prioritized remediation tied to your environment</li>
            <li><CheckIcon />Documented response paths when something needs escalation</li>
          </ul>
          <a href="#contact" className="btn btn-cta">{HOME_CTA.primary}</a>
        </div>
        <div className="card deep flow">
          <div className="assess-top"><span>Arizona operations</span><span className="chip">Illustrative</span></div>
          {STEPS.map((step, index) => (
            <div className="flow-step" key={step.title}>
              <b>{index + 1}</b>
              <div>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </div>
            </div>
          ))}
          <RatiMark size={30} className="rati-corner" />
        </div>
      </div>
    </section>
  );
}
