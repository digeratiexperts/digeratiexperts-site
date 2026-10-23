import { CheckIcon } from "../icons";
import { RatiMark } from "@/components/mascots/Mascots";

const STEPS = [
  { title: "Signal", text: "Signals surface immediately" },
  { title: "Human triage", text: "Our team investigates and prioritizes" },
  { title: "Named owner", text: "A person owns the outcome, with documented next steps" },
];

/** Rati sits small in the corner of the card. No caption about the mascot. */
export function DetectSection(): JSX.Element {
  return (
    <section className="sec alt t-signal" id="detect">
      <div className="wrap detect">
        <div>
          <p className="mark">Detection and response</p>
          <h2>Monitoring that ends with a person who owns the outcome.</h2>
          <p className="lede" style={{ marginTop: 16 }}>Modern detection tooling surfaces signals immediately. Our team investigates, prioritizes, and acts. Technology scales coverage; accountability stays human.</p>
          <ul className="check">
            <li><CheckIcon />Partner-backed detection across endpoints and identity</li>
            <li><CheckIcon />Human triage — analysts decide what matters before you get a false alarm</li>
            <li><CheckIcon />Prioritized remediation tied to your environment</li>
            <li><CheckIcon />Documented response paths when something needs escalation</li>
          </ul>
          <a href="#contact" className="btn btn-cta">Get My Cyber Risk Assessment</a>
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
