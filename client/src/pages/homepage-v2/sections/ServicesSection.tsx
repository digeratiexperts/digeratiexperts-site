import { CheckIcon } from "../icons";
import { objectIcon, THIRD_LANE_NAME } from "../content";

/** Managed IT always starts with the assessment; the third lane skips it (approved content rule). */
export function ServicesSection(): JSX.Element {
  return (
    <section className="sec t-store" id="services">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">How to work with us</p>
            <h2>Three ways to work with us.</h2>
          </div>
          <div className="links">
            <p className="lede">Managed IT always starts with a Cyber Risk Assessment. Small teams that just need equipment and licenses can order ready-to-work setups directly.</p>
            <a className="link" href="/solutions/standalone-services">View standalone services</a>
          </div>
        </div>
        <div className="lanes paths">
          <div className="managed">
            <div className="step1">
              <img className="obj" src={objectIcon("clipboard")} alt="" />
              <div>
                <span className="chip">Required first step</span>
                <b>Cyber Risk Assessment</b>
                <p>We review identity, endpoints, email, backups, and security posture. Then you choose fully managed or co-managed.</p>
              </div>
              <a href="#contact" className="btn btn-cta">Get my assessment</a>
            </div>
            <div className="then">Then choose how much we own</div>
            <div className="grid g2">
              <a href="/solutions/managed-it-support" className="card deep">
                <img className="obj" src={objectIcon("server")} alt="" />
                <span className="chip">Full operations</span>
                <h3>Fully managed IT &amp; cybersecurity</h3>
                <p className="muted">One accountable team for support, identity, endpoints, email, backup, and security operations — delivered through the ProActive Ecosystem.</p>
                <span className="link">Explore managed services</span>
              </a>
              <a href="/solutions/co-managed-it" className="card">
                <img className="obj" src={objectIcon("people")} alt="" />
                <span className="chip">Your team plus ours</span>
                <h3>Co-managed IT</h3>
                <p className="muted">Add DE security operations, monitoring, and specialized coverage — without replacing your team.</p>
                <span className="link">See co-managed</span>
              </a>
            </div>
          </div>
          <a href="#contact" className="card direct">
            <img className="obj" src={objectIcon("laptop")} alt="" />
            <span className="chip">Under 30 users</span>
            <h3>{THIRD_LANE_NAME}</h3>
            <p className="muted" style={{ marginBottom: 16 }}>Devices and licenses, set up before they reach you. No assessment needed.</p>
            <ul className="check">
              <li><CheckIcon />We buy the devices</li>
              <li><CheckIcon />We set them up and test them</li>
              <li><CheckIcon />We ship them ready to use</li>
              <li><CheckIcon />Per-user licenses, like Microsoft 365, through DE</li>
            </ul>
            <p className="who">For business owners and IT departments, in Arizona and beyond.</p>
            <span className="link">Order devices and licenses</span>
          </a>
        </div>

        <div className="card eco">
          <div className="eco-h">
            <h3>The ProActive Ecosystem</h3>
            <a className="link" href="/solutions/proactive-ecosystem">How the ecosystem works</a>
          </div>
          <div className="eco-grid">
            <a href="/solutions/proactive-business-ecosystem"><img src={objectIcon("eye")} alt="" /><div><h4>SOC / MDR monitoring</h4><p>24/7 detection and response on Business and Enterprise.</p></div></a>
            <a href="/solutions/endpoint-management"><img src={objectIcon("laptop")} alt="" /><div><h4>Endpoint security (EDR)</h4><p>Protect devices across the environment.</p></div></a>
            <a href="/solutions/identity-management"><img src={objectIcon("people")} alt="" /><div><h4>SMART Identity (MFA + SSO)</h4><p>Stronger access without user chaos.</p></div></a>
            <a href="/solutions/identity-management"><img src={objectIcon("lock")} alt="" /><div><h4>Privileged access controls</h4><p>Admin controls and audit visibility.</p></div></a>
            <a href="/solutions/backup-disaster-recovery"><img src={objectIcon("backup")} alt="" /><div><h4>Backup &amp; disaster recovery</h4><p>Recovery planning and restore discipline.</p></div></a>
            <a href="/solutions/email-security"><img src={objectIcon("email")} alt="" /><div><h4>Email protection</h4><p>Anti-phishing and mailbox defenses.</p></div></a>
          </div>
        </div>
      </div>
    </section>
  );
}
