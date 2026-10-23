import { GOOGLE_MAPS_CID_URL, GOOGLE_REVIEW_QR_SRC, GOOGLE_REVIEW_URL } from "@/data/reviewsCatalog";
import { objectIcon } from "../content";

const OUTCOMES = [
  { icon: "network", title: "Fewer vendors to manage", text: "One accountable team for IT support and security operations." },
  { icon: "eye", title: "Clearer security visibility", text: "Identity, endpoint, email, and backup posture you can actually explain." },
  { icon: "headset", title: "Faster triage when something breaks", text: "Named ownership and documented standards — not ticket roulette." },
];

export function ProofSection(): JSX.Element {
  return (
    <section className="sec proof t-store" id="proof">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">Client proof</p>
            <h2>Outcomes Arizona businesses hire us for.</h2>
          </div>
          <div className="links">
            <p className="lede">Fewer vendors, clearer visibility, and accountable support when something breaks.</p>
            <a className="link" href="/resources/case-studies">View case studies</a>
          </div>
        </div>
        <div className="grid g3">
          {OUTCOMES.map((outcome) => (
            <div className="card" key={outcome.title}>
              <img className="obj" src={objectIcon(outcome.icon)} alt="" />
              <h3>{outcome.title}</h3>
              <p className="muted">{outcome.text}</p>
            </div>
          ))}
        </div>
        <div className="trust">
          <a href="/about/client-bill-of-rights" className="card">
            <img className="obj" src={objectIcon("lock")} alt="" />
            <div>
              <h3>Client Bill of Rights</h3>
              <p className="muted" style={{ marginBottom: 12 }}>Your credentials, tenants, and licenses stay yours — with access transparency and a clear exit path.</p>
              <span className="link">Read the Bill of Rights</span>
            </div>
          </a>
          <a href="/trust/trust-center" className="card">
            <img className="obj" src={objectIcon("shield")} alt="" />
            <div>
              <h3>Trust Center</h3>
              <p className="muted" style={{ marginBottom: 12 }}>Security documentation and operating expectations for diligence and cyber-insurance conversations.</p>
              <span className="link">Open the Trust Center</span>
            </div>
          </a>
        </div>
        <div className="card qr" style={{ marginTop: 20 }}>
          <img src={GOOGLE_REVIEW_QR_SRC} alt="QR code to leave Digerati Experts a Google review" />
          <div>
            <h3>Worked with us?</h3>
            <p className="muted" style={{ marginBottom: 10 }}>Scan with your phone, or use the link, to leave a Google review.</p>
            <div className="row" style={{ gap: 24 }}>
              <a className="link" href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer">Leave a Google review</a>
              <a className="link" href={GOOGLE_MAPS_CID_URL} target="_blank" rel="noopener noreferrer">Read us on Google</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
