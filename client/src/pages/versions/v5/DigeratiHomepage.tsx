// FROZEN — homepage version 5, three screens, 2026-09-30.
// Preview at /version-5. Does not replace /. The next idea gets version 6.
// Do not edit this folder in place.
import { Link } from "wouter";
import { DE_LOGO_REVERSE } from "@/lib/brandAssets";
import { PRIMARY_PHONE } from "@/data/companyContact";
import "./v5.css";

export function DigeratiHomepage() {
  return (
    <div className="v5">
      <header className="v5-header">
        <Link href="/" className="v5-logo" aria-label="Digerati Experts, live homepage">
          <img src={DE_LOGO_REVERSE} alt="" />
        </Link>
        <div className="v5-header-actions">
          <a className="v5-phone" href={PRIMARY_PHONE.telHref}>
            {PRIMARY_PHONE.display}
          </a>
          <Link className="v5-cta" href="/book">
            Understand Your Environment
          </Link>
        </div>
      </header>

      <main>
        <section className="v5-section v5-hero" aria-labelledby="v5-hero-title">
          <p className="v5-kicker">Digerati Experts</p>
          <h1 id="v5-hero-title">You lead the business. We lead the technology.</h1>
          <p className="v5-lede">
            Cybersecurity-first managed technology for companies in Arizona. You stay in command of the company. We take responsibility for the environment it runs on.
          </p>
          <figure className="v5-person">
            <img
              src="/images/founder/joe-petro-studio-blazer-white.jpg"
              alt="Joseph Petro, Founder of Digerati Experts"
              width={768}
              height={1024}
            />
            <figcaption>
              <p className="v5-name">Joseph Petro</p>
              <p className="v5-role">Founder &amp; Chief Technology Strategist</p>
              <p className="v5-place">Chandler, Arizona</p>
            </figcaption>
          </figure>
          <div className="v5-hero-actions">
            <Link className="v5-cta" href="/book">
              Understand Your Environment
            </Link>
          </div>
        </section>

        <section className="v5-section" aria-labelledby="v5-gap">
          <h2 id="v5-gap">The parts are already here. They are not one system.</h2>
          <p className="v5-lede">
            People, accounts, computers, mail, sites, and vendors can all be in place and still leave no one holding the whole environment.
          </p>
        </section>

        <section className="v5-section" aria-labelledby="v5-way">
          <h2 id="v5-way">The assessment comes before a recommendation.</h2>
          <p className="v5-lede">
            We do not choose a way in until we understand the environment.
          </p>
          <div className="v5-hero-actions">
            <Link className="v5-cta" href="/book">
              Understand Your Environment
            </Link>
          </div>
          <ul className="v5-doors">
            <li>
              <span className="v5-door-name">Handle our IT</span>
              <span className="v5-door-links">
                <Link href="/solutions/proactive-ecosystem">ProActive, fully managed</Link>
                <Link href="/solutions/co-managed-it">Co-managed, if your team stays</Link>
              </span>
            </li>
            <li>
              <span className="v5-door-name">Solve a business need</span>
              <span className="v5-door-links">
                <Link href="/solutions/business-needs">One service, not a whole program</Link>
              </span>
            </li>
            <li>
              <span className="v5-door-name">Already a client</span>
              <span className="v5-door-links">
                <Link href="/portal/marketplace">Client marketplace</Link>
              </span>
            </li>
          </ul>
          <p className="v5-quiet">
            <Link href="/about/team">Team</Link>
            {" · "}
            <Link href="/about/client-bill-of-rights">Client Bill of Rights</Link>
            {" · "}
            <Link href="/trust/trust-center">Trust Center</Link>
          </p>
        </section>
      </main>
    </div>
  );
}
