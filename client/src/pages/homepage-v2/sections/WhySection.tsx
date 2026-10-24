import { objectIcon } from "../content";

const REASONS = [
  { icon: "shield", title: "Security-first operations", text: "Every system, endpoint, and user is protected — by design, not by reaction." },
  { icon: "people", title: "Co-managed or fully managed", text: "We support your internal IT or serve as your outsourced technology team." },
  { icon: "chart", title: "Executive-level transparency", text: "Reports, KPIs, and compliance insights that make sense — and drive decisions." },
];

export function WhySection(): JSX.Element {
  return (
    <section className="sec" id="why">
      <div className="wrap why">
        <div>
          <p className="mark">Why we exist</p>
          <h2>We exist to protect and enable your business.</h2>
          <p className="lede">You don't want another vendor. You want a security-first partner who reduces risk, improves uptime, and keeps your team moving.</p>
          <div className="card define">
            <span className="p">Our name, <em>digerati</em>, is a blend of <em>digital</em> and <em>literati</em>, in use since the early 1990s.</span>
            <p>It means people with deep expertise in computers and digital technology — the ones who actually know how the machinery works.</p>
          </div>
        </div>
        <div className="why-list">
          {REASONS.map((reason) => (
            <div className="card" key={reason.title}>
              <img className="obj" src={objectIcon(reason.icon)} alt="" />
              <div>
                <h3>{reason.title}</h3>
                <p className="muted">{reason.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
