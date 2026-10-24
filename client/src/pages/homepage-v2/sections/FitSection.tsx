import deskImage from "@assets/de-trust-assessment-desk-960.webp";
import { HOME_CTA } from "../cta";

const FIT_POINTS = [
  { title: "Arizona-based", text: "Local principal support — a real person, not a ticket queue." },
  { title: "Principal-led", text: "Recommendations come from the people who stand behind the work." },
  { title: "Sized to your business", text: "Controls matched to your risk — not an enterprise stack you won't use." },
];

export function FitSection(): JSX.Element {
  return (
    <section className="sec t-sonoran" id="fit">
      <div className="wrap fit">
        <div>
          <p className="mark">Why Arizona businesses work with us</p>
          <h2>Protection that fits how you actually operate.</h2>
          <p className="lede" style={{ marginTop: 16 }}>From medical practices to law firms to family-owned offices — the businesses Arizona runs on, that can't afford downtime, a breach, or lost client data.</p>
          <div className="fit-list">
            {FIT_POINTS.map((point) => (
              <div className="card" key={point.title}>
                <h3>{point.title}</h3>
                <p className="muted">{point.text}</p>
              </div>
            ))}
          </div>
          <a href="#contact" className="btn btn-cta">{HOME_CTA.primary}</a>
        </div>
        <div className="photo">
          <img src={deskImage} alt="Principal-led cyber risk assessment work for an Arizona business" />
          <div className="findings">
            <h4>Cyber Risk Assessment findings <span className="chip" style={{ marginLeft: 6 }}>Example format</span></h4>
            <ul>
              <li><span>Prioritized findings — urgent vs later</span><span>not a product dump</span></li>
              <li><span>Business-impact context</span><span>evidence &amp; ownership</span></li>
              <li><span>Right-sized recommendations</span><span>by risk &amp; dependency</span></li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
