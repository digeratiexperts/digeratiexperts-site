import { objectIcon } from "../content";

const CHALLENGES = [
  { icon: "lock", title: "Ransomware & malware", text: "Threat detection and rapid response to stop attacks before damage occurs." },
  { icon: "backup", title: "Data loss", text: "Backup strategies with tested disaster recovery to keep the business running." },
  { icon: "clipboard", title: "Compliance gaps", text: "Navigate HIPAA, PCI DSS, and SOC 2 requirements with continuous monitoring and reporting." },
  { icon: "email", title: "Phishing & social engineering", text: "Layered email security plus ongoing security awareness training." },
  { icon: "bell", title: "Zero-day vulnerabilities", text: "Proactive patching and assessments to close gaps before they're exploited." },
  { icon: "eye", title: "Insider threats", text: "Behavior analytics and access controls to prevent internal breaches." },
];

export function ChallengesSection(): JSX.Element {
  return (
    <section className="sec alt t-signal" id="challenges">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">Problems we solve</p>
            <h2>What we tackle.</h2>
          </div>
          <div className="links">
            <p className="lede">The problems we own with you. Detail lives on Solutions and Cyber Facts.</p>
            <a className="link" href="/resources/cyber-facts">Full threat context</a>
          </div>
        </div>
        <div className="grid g3 tackle">
          {CHALLENGES.map((challenge) => (
            <div className="card" key={challenge.title}>
              <img className="obj" src={objectIcon(challenge.icon)} alt="" />
              <div>
                <h3>{challenge.title}</h3>
                <p className="muted">{challenge.text}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="card strip">
          <p><b>Don't see your challenge?</b> <span className="muted">We handle custom threat profiles across Arizona.</span></p>
          <a href="#contact" className="btn btn-cta">Discuss your security needs</a>
        </div>
      </div>
    </section>
  );
}
