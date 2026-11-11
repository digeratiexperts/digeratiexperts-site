import { objectIcon } from "../content";

/**
 * "What do you need help with?" Buyer situations, in the buyer's words, each pointing at
 * the page that answers it. Nothing here is a new promise: every line restates a page.
 */
const SITUATIONS = [
  {
    icon: "bell",
    title: "Something just went wrong",
    text: "Locked out, a suspicious email clicked, a system down. Emergency incident response runs 24/7/365.",
    href: "/help-desk",
    link: "Get help now",
    cta: "situation_urgent",
  },
  {
    icon: "network",
    title: "You're done with your current IT provider",
    text: "What to get back first, how a switch works, and the promises we put in writing.",
    href: "/solutions/switching-it-providers",
    link: "How switching works",
    cta: "situation_switching",
  },
  {
    icon: "clipboard",
    title: "An insurer or auditor is asking questions",
    text: "Cyber-insurance questionnaires, HIPAA, PCI DSS: evidence you can hand over, not guesses.",
    href: "/solutions/compliance-reports",
    link: "Compliance reporting",
    cta: "situation_compliance",
  },
  {
    icon: "people",
    title: "Your IT person is stretched thin",
    text: "Keep your in-house person. We add the security stack, the after-hours cover, and the depth.",
    href: "/solutions/co-managed-it",
    link: "Co-managed IT",
    cta: "situation_comanaged",
  },
  {
    icon: "chart",
    title: "You want IT handled for a known monthly price",
    text: "Fully managed IT and security, priced per user, published before you ever talk to us.",
    href: "/pricing",
    link: "See plans and pricing",
    cta: "situation_managed",
  },
  {
    icon: "laptop",
    title: "You just need devices and licenses",
    text: "A team under 30 that needs laptops set up and Microsoft 365 licensed, without a managed plan.",
    href: "/solutions/standalone-services",
    link: "Devices and licenses",
    cta: "situation_devices",
  },
];

export function SituationsSection(): JSX.Element {
  return (
    <section className="sec t-signal" id="situations">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">Start where you are</p>
            <h2>What do you need help with?</h2>
          </div>
          <div className="links">
            <p className="lede">Pick the one that sounds like this week. Each goes straight to the answer.</p>
          </div>
        </div>
        <div className="grid g3 tackle situations">
          {SITUATIONS.map((situation) => (
            <a className="card" key={situation.title} href={situation.href} data-cta={situation.cta}>
              <img className="obj" src={objectIcon(situation.icon)} alt="" />
              <div>
                <h3>{situation.title}</h3>
                <p className="muted">{situation.text}</p>
                <span className="link">{situation.link}</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
