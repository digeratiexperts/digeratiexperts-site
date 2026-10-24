import { PinIcon } from "../icons";
import { HOME_CTA } from "../cta";

const OWNERS = [
  { title: "Security operations", text: "Monitoring, detection, and response ownership when threats appear." },
  { title: "Technical operations", text: "Day-to-day support, identity, endpoints, and environment stability." },
  { title: "Client success", text: "QBRs, roadmaps, and a named relationship — not a rotating queue." },
];

/** The only place Joe's photo appears on the homepage. Never in the hero. */
export function TeamSection(): JSX.Element {
  return (
    <section className="sec t-ink" id="team">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">Human trust and ownership</p>
            <h2>The people behind your technology.</h2>
          </div>
          <div className="links">
            <p className="lede">When something happens, you should know who owns it — not wonder which queue picked up your ticket.</p>
            <a className="link" href="/about/team">Meet the team</a>
          </div>
        </div>
        <div className="team">
          <div className="card portrait">
            <img src="/images/founder/joe-petro-studio-blazer-white.webp" alt="Joseph Petro, Founder of Digerati Experts" />
            <div className="cap">
              <h3>Joseph Petro</h3>
              <p className="role">Founder &amp; Chief Technology Strategist</p>
              <p className="loc"><PinIcon />Chandler, Arizona HQ</p>
            </div>
          </div>
          <div>
            <h3 className="big">Principal-led managed security operations</h3>
            <p className="muted">Based right here in Chandler. Joe stays directly involved in risk assessments, infrastructure architecture, and key client milestones — so growing organizations get cybersecurity-first managed IT without becoming account number four thousand.</p>
            <div className="owners">
              {OWNERS.map((owner) => (
                <div key={owner.title}>
                  <b>{owner.title}</b>
                  <p>{owner.text}</p>
                </div>
              ))}
            </div>
            <a href="#contact" className="btn btn-cta">{HOME_CTA.secondary}</a>
          </div>
        </div>
      </div>
    </section>
  );
}
