const STEPS = [
  { title: "Assessment", text: "Review identity, endpoints, email, backups, network, and operating reality." },
  { title: "Roadmap", text: "Match the operating model to the environment — fit, not a ranking ladder." },
  { title: "Implementation", text: "Documented credentials you own. Controls sized to the model we matched." },
  { title: "Continuous", text: "Day-to-day support and the DE Security Foundation at every tier; detection, response, recovery, and governance deepen with the plan." },
];

export function HowProtectionSection(): JSX.Element {
  return (
    <section className="sec alt t-signal" id="how">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">How protection works</p>
            <h2>Assess, plan, build, then run it.</h2>
          </div>
          <a className="link" href="/solutions">Full methodology</a>
        </div>
        <div className="steps">
          {STEPS.map((step, index) => (
            <div className="step" key={step.title}>
              <em>{index + 1}</em>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
