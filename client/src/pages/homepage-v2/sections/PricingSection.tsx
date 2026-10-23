import { CheckIcon } from "../icons";
import { objectIcon, THIRD_LANE_NAME } from "../content";

const TIERS = [
  {
    name: "IT",
    icon: "laptop",
    price: "$125",
    minimum: "$1,600 monthly minimum",
    summary: "Smaller, less complex environments that need essential protection and a documented baseline.",
    features: ["Managed IT & help desk", "Baseline identity & endpoint", "Entry cybersecurity"],
    cta: "ProActive IT",
    ctaClass: "btn btn-line",
  },
  {
    name: "Office",
    icon: "network",
    price: "$165",
    minimum: "$2,400 monthly minimum",
    summary: "A broader managed workplace — more users, devices, and a professionally operated network.",
    features: ["Everything in IT", "Managed network", "Endpoint backup"],
    cta: "ProActive Office",
    ctaClass: "btn btn-line",
  },
  {
    name: "Business",
    icon: "shield",
    price: "$245",
    minimum: "$5,400 monthly minimum",
    summary: "Deeper infrastructure, cyber operations, recovery, governance, and strategy.",
    features: ["Identity, endpoint, and email", "24/7 SOC / MDR", "BCDR and strategy reviews"],
    cta: "ProActive Business",
    ctaClass: "btn btn-cta",
    flagship: true,
  },
  {
    name: "Enterprise",
    icon: "building",
    price: "$345",
    minimum: "$9,000 monthly minimum",
    summary: "Multi-site, regulated, or security-sensitive environments that need the greatest depth.",
    features: ["Advanced governance", "Audit-ready reporting", "Quarterly strategy"],
    cta: "ProActive Enterprise",
    ctaClass: "btn btn-line",
  },
];

/** 24/7 MDR / SOC is Business and Enterprise only (approved content rule). */
export function PricingSection(): JSX.Element {
  return (
    <section className="sec t-ink" id="pricing">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">ProActive Ecosystem</p>
            <h2>Four operating models. One matched to you.</h2>
          </div>
          <p className="lede">We don't start with a package and pile on add-ons. If Office would need heavy modification, Business is the right fit for that environment — not universally "better."</p>
        </div>
        <div className="grid g4">
          {TIERS.map((tier) => (
            <div className={`card tier${tier.flagship ? " deep" : ""}`} key={tier.name}>
              <img className="obj" src={objectIcon(tier.icon)} alt="" />
              <div className="top">
                <span className="name">{tier.name}</span>
                {tier.flagship && <span className="chip">Flagship cyber</span>}
              </div>
              <div className="price">{tier.price}<small> /user/mo</small></div>
              <div className="min">{tier.minimum}</div>
              <p className="muted">{tier.summary}</p>
              <ul className="check">
                {tier.features.map((feature) => (
                  <li key={feature}><CheckIcon />{feature}</li>
                ))}
              </ul>
              <a href="#contact" className={tier.ctaClass}>{tier.cta}</a>
            </div>
          ))}
        </div>
        <div className="pnote">
          <div className="card">
            <h3>Every managed plan starts with an assessment</h3>
            <p className="muted">Your Cyber Risk Assessment comes first. We assess users, devices, locations, infrastructure, security, compliance, recovery, and whether you need fully or co-managed operations — then match the model. User count is a signal, never the sole criterion.</p>
            <p className="small muted" style={{ marginTop: 12 }}>Under 30 users and only need devices and licenses? <a className="link" href="#services">See {THIRD_LANE_NAME}</a>.</p>
          </div>
          <div className="card">
            <h3>Not just IT support — one operating model</h3>
            <p className="muted">ProActive Business consolidates what organizations often buy separately: managed IT, identity, endpoint, email, network, backup, security operations, and strategy.</p>
            <p className="small muted" style={{ marginTop: 12 }}>Estimates are not quotes. Your Cyber Risk Assessment confirms final scope. <a className="link" href="/ecosystem-pricing">Compare everything</a></p>
          </div>
        </div>
      </div>
    </section>
  );
}
