// FROZEN — homepage version 4, clean sheet, 2026-09-29.
// Preview at /version-4. Does not replace /. Source of truth:
// docs/VERSION-4-HOMEPAGE-SOURCE-OF-TRUTH.md
// The next idea gets version 5. Do not edit this folder in place.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { DE_LOGO_REVERSE } from "@/lib/brandAssets";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { EnvironmentFigure } from "./EnvironmentFigure";
import "./v4.css";

const PARTS = ["People", "Identity", "Endpoints", "Email", "Cloud", "Network", "Applications", "Data", "Vendors"];

const BLOCKS = [
  { name: "Identity & Access", line: "Who can reach a system, and how that access changes." },
  { name: "Endpoint", line: "The devices in scope, and whether they stay visible and maintained." },
  { name: "Email & Collaboration", line: "Mail, domains, and the collaboration the business actually uses." },
  { name: "Browser & Web", line: "Managed browsing and access to the business web applications." },
  { name: "Network", line: "Edge, switching, wireless, and how the network is documented." },
  { name: "Detection & Response", line: "What is watched, how a signal is triaged, and who is told." },
  { name: "Human Risk", line: "People as a managed control: awareness, practice, and a way to report." },
];

const OS = [
  ["Workplace", "The devices and accounts people use to do the work."],
  ["Communications", "Email, meetings, and the shared record of a conversation."],
  ["Network", "How the office, the remote worker, and the guest stay separated."],
  ["Cloud and data", "Where the files live, who can open them, and how they are kept."],
  ["Business systems", "The applications the company runs on, kept supportable."],
  ["Automation", "Repeated work taken out of inboxes and into a known path."],
  ["Support", "A person to call, with the environment already documented."],
  ["Governance", "Decisions, access, and changes written down."],
  ["Continuity", "A way back if a system, a site, or a person is interrupted."],
] as const;

const OUTCOMES = [
  ["Protect", "Reduce the ways an incident starts, and limit how far it travels."],
  ["Work better", "Make the everyday tools reliable enough to disappear."],
  ["Communicate", "Keep mail and meetings trustworthy."],
  ["Automate", "Move repeated tasks onto a path someone owns."],
  ["Comply", "Show the work in a form a customer, an insurer, or an auditor can read."],
  ["Recover", "Return the business to work from a copy that was actually tested."],
  ["Grow", "Add people, sites, and systems without losing the map."],
] as const;

const TIERS = [
  ["IT", "/solutions/proactive-it-ecosystem"],
  ["Office", "/solutions/proactive-office-ecosystem"],
  ["Business", "/solutions/proactive-business-ecosystem"],
  ["Enterprise", "/solutions/proactive-enterprise-ecosystem"],
] as const;

function useAlignment(active: boolean) {
  const [heading, setHeading] = useState(active ? 348 : 360);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.querySelector<HTMLElement>(".v4");
    const section = document.getElementById("alignment");
    if (!root || !section) return;
    if (reduce || !active) {
      root.classList.add("is-still");
      section.style.setProperty("--align", "1");
      setHeading(360);
      return;
    }
    root.classList.remove("is-still");
    section.style.setProperty("--align", "0");
    setHeading(348);
    let frame = 0;
    const read = () => {
      frame = 0;
      const top = section.getBoundingClientRect().top;
      const start = window.innerHeight * 0.82;
      const end = window.innerHeight * 0.28;
      const raw = (start - top) / (start - end);
      const progress = Math.min(1, Math.max(0, raw));
      section.style.setProperty("--align", progress.toFixed(3));
      setHeading(Math.round(348 + progress * 12));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [active]);
  return heading;
}

export function DigeratiHomepage() {
  const heading = useAlignment(true);

  return (
    <div className="v4">
      <header className="v4-header">
        <Link href="/" className="v4-logo" aria-label="Digerati Experts, live homepage">
          <img src={DE_LOGO_REVERSE} alt="" />
        </Link>
        <div className="v4-header-actions">
          <a className="v4-phone" href={PRIMARY_PHONE.telHref}>
            {PRIMARY_PHONE.display}
          </a>
          <Link className="v4-cta" href="/book">
            Understand Your Environment
          </Link>
        </div>
      </header>

      <main>
        <section className="v4-section v4-hero" aria-labelledby="v4-hero-title">
          <div>
            <p className="v4-kicker">Digerati Experts</p>
            <h1 id="v4-hero-title">You lead the business. We lead the technology.</h1>
            <p className="v4-lede">
              Cybersecurity-first managed technology for Arizona businesses. You stay in command of the company. We take responsibility for the environment it runs on.
            </p>
            <div className="v4-hero-actions">
              <Link className="v4-cta" href="/book">
                Understand Your Environment
              </Link>
              <a className="v4-text-link" href="#alignment">
                See the environment align
              </a>
            </div>
          </div>
          <figure className="v4-frame" style={{ ["--align" as string]: 0 }}>
            <EnvironmentFigure titleId="v4-hero-figure" />
            <figcaption className="v4-instrument">
              <span>Illustrative. Not a live view.</span>
              <span className="v4-off" aria-hidden="true">348°</span>
              <span className="v4-on" aria-hidden="true">360°</span>
            </figcaption>
          </figure>
        </section>

        <section className="v4-section v4-split" aria-labelledby="v4-disconnected">
          <div>
            <p className="v4-kicker">02</p>
            <h2 id="v4-disconnected">The parts are already here. They are not one system.</h2>
            <p className="v4-lede">
              People, identity, endpoints, email, cloud, network, applications, data, and vendors can all be purchased and still leave no one holding the whole environment.
            </p>
          </div>
          <div>
          <figure className="v4-frame" style={{ ["--align" as string]: 0 }}>
            <EnvironmentFigure titleId="v4-gap-figure" />
          </figure>
          <ul className="v4-parts">
            {PARTS.map((part) => (
              <li key={part}>{part}</li>
            ))}
          </ul>
          </div>
        </section>

        <section className="v4-section" id="alignment" aria-labelledby="v4-align">
          <p className="v4-kicker">03</p>
          <h2 id="v4-align">We do not promise outcomes before we understand the environment.</h2>
          <p className="v4-lede">
            The same picture settles. Nothing new is swapped in. What was slightly off comes into line, and only then is there a basis for a recommendation.
          </p>
          <figure className="v4-frame" style={{ marginTop: "2rem" }}>
            <EnvironmentFigure titleId="v4-align-figure" />
            <figcaption className="v4-instrument">
              <span id="v4-heading-note">Illustrative heading. Not a measurement of a customer environment.</span>
              <span>
                <strong aria-hidden="true">{heading}°</strong>
                <span className="v4-sr">The figure moves from 348 degrees to 360 degrees as this chapter passes. It is an illustration of alignment.</span>
              </span>
            </figcaption>
          </figure>
        </section>

        <section className="v4-section" aria-labelledby="v4-doors-title">
          <p className="v4-kicker">04</p>
          <div className="v4-assess">
            <h2 id="v4-doors-title">Understand the environment first.</h2>
            <p className="v4-lede" style={{ marginTop: 0 }}>
              The assessment is the step that decides the path. It is not a fourth product beside the others.
            </p>
            <div>
              <Link className="v4-cta" href="/book">
                Understand Your Environment
              </Link>
            </div>
          </div>
          <div className="v4-doors">
            <article className="v4-door">
              <h3>Handle Our IT</h3>
              <p>A team to run the environment, or a team beside the one you already have.</p>
              <Link href="/solutions/proactive-ecosystem">ProActive</Link>
              <Link href="/solutions/co-managed-it">Co-Managed</Link>
            </article>
            <article className="v4-door">
              <h3>Solve a Business Need</h3>
              <p>A defined problem, taken on its own, without pretending it is a whole operating model.</p>
              <Link href="/solutions/business-needs">Standalone</Link>
            </article>
            <article className="v4-door">
              <h3>Client Marketplace</h3>
              <p>For a company that is already a client and is ready to extend what is in place.</p>
              <Link href="/portal/marketplace">Existing-client expansion</Link>
            </article>
          </div>
        </section>

        <section className="v4-section" aria-labelledby="v4-security">
          <p className="v4-kicker">05</p>
          <h2 id="v4-security">Eight blocks. One of them never stops.</h2>
          <p className="v4-lede">
            This is the security foundation under the rest of the environment. It is a model of how Digerati Experts organizes the work. It is not a reading of your posture, and it does not name a tool.
          </p>
          <div className="v4-blocks">
            {BLOCKS.map((block) => (
              <article className="v4-block" key={block.name}>
                <h3>{block.name}</h3>
                <p>{block.line}</p>
              </article>
            ))}
          </div>
          <article className="v4-continuous">
            <h3>Risk & Exposure</h3>
            <p>
              The continuous intelligence layer beneath the seven blocks: what is exposed, what changed, and what that means for the business. It is not another card in the same row.
            </p>
          </article>
        </section>

        <section className="v4-section" aria-labelledby="v4-os">
          <p className="v4-kicker">06</p>
          <h2 id="v4-os">Security is the foundation. The business still has to run.</h2>
          <p className="v4-lede">
            The same environment, once it can be seen, becomes the operating system of the company. This page stays vendor-neutral.
          </p>
          <ul className="v4-os">
            {OS.map(([name, line]) => (
              <li key={name}>
                <strong>{name}</strong>
                <span className="v4-note">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="v4-section" aria-labelledby="v4-outcomes">
          <p className="v4-kicker">07</p>
          <h2 id="v4-outcomes">What you can accomplish</h2>
          <p className="v4-lede">These are capabilities. They are not a vendor list and they are not a promised score.</p>
          <ul className="v4-outcomes">
            {OUTCOMES.map(([name, line]) => (
              <li key={name}>
                <strong>{name}</strong>
                <span className="v4-note">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="v4-paper">
          <section className="v4-section" aria-labelledby="v4-proof">
            <p className="v4-kicker">08</p>
            <h2 id="v4-proof">Proof is what we will put in writing.</h2>
            <p className="v4-lede">
              Your technology. Your data. Your keys. The pages below are the public record. This chapter does not invent a quote, a logo, or a screen from an operations center.
            </p>
            <div className="v4-proof">
              <div>
                <Link href="/about/client-bill-of-rights">Client Bill of Rights</Link>
                <p>The pledges, on their own page.</p>
              </div>
              <div>
                <Link href="/about/guarantee">Guarantee</Link>
                <p>The published terms: a 30-day refund of service fees if you are not satisfied, and release from the agreement without penalties.</p>
              </div>
              <div>
                <Link href="/trust/trust-center">Trust Center</Link>
                <p>How to ask about security practices. Framework names there describe customer requirements. They are not Digerati Experts certifications.</p>
              </div>
              <div>
                <Link href="/about/team">The company</Link>
                <p>The people, named on the team page. This homepage does not stand in for them.</p>
              </div>
            </div>
            <ul className="v4-refusals">
              <li>We do not publish a customer quote on this page.</li>
              <li>We do not show a live operations console, a ticket count, or telemetry.</li>
              <li>We do not state monitoring hours here. The assessment and the plan name the fit.</li>
              <li>We do not choose a package before the environment is understood.</li>
            </ul>
          </section>
        </div>

        <section className="v4-section" aria-labelledby="v4-fit">
          <p className="v4-kicker">09</p>
          <h2 id="v4-fit">Who this is for, and how it scales</h2>
          <div className="v4-fit">
            <div>
              <p className="v4-lede" style={{ marginTop: 0 }}>
                Arizona businesses that cannot treat technology as a pile of separate subscriptions. A company with no in-house IT uses ProActive. A company that already has a team uses Co-Managed and keeps that team. A client that is already here extends through the marketplace.
              </p>
              <p className="v4-note">
                Four ProActive names, so you can see the range. Prices stay on the pricing page.
              </p>
              <p>
                <Link className="v4-text-link" href="/proactive-ecosystem-pricing">
                  See Plans & Pricing
                </Link>
              </p>
            </div>
            <ul className="v4-tiers">
              {TIERS.map(([name, href]) => (
                <li key={name}>
                  <span>{name}</span>
                  <Link href={href} aria-label={`Open the ${name} package`}>Open</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="v4-section v4-close v4-end" aria-labelledby="v4-close">
          <div>
            <p className="v4-kicker">10</p>
            <h2 className="v4-display" id="v4-close">You lead the business. We lead the technology.</h2>
            <p className="v4-lede">The environment you saw at the start is the same one. It is aligned. The next step is still to understand yours.</p>
            <div className="v4-hero-actions">
              <Link className="v4-cta" href="/book">
                Understand Your Environment
              </Link>
              <a className="v4-phone" href={PRIMARY_PHONE.telHref} style={{ display: "inline-flex" }}>
                {PRIMARY_PHONE.display}
              </a>
            </div>
          </div>
          <figure className="v4-frame" style={{ ["--align" as string]: 1 }}>
            <EnvironmentFigure titleId="v4-close-figure" />
            <figcaption className="v4-instrument">
              <span>Aligned.</span>
              <strong aria-hidden="true">360°</strong>
            </figcaption>
          </figure>
        </section>
      </main>
    </div>
  );
}
