import { CheckIcon } from "../icons";

const QUESTIONS = [
  {
    question: "What is your best service?",
    answer: "There isn't a universally \"best\" package. ProActive is four operating models — IT, Office, Business, and Enterprise — matched to users, devices, locations, infrastructure, security, compliance, and whether you need fully or co-managed coverage.",
  },
  {
    question: "How do I choose the right plan?",
    answer: "Every fully managed or co-managed plan starts with a required Cyber Risk Assessment. User count is a signal, never the sole criterion. After the assessment we match IT, Office, Business, or Enterprise. We don't start with a package and pile on add-ons.",
  },
  {
    question: "Can I customize the solutions?",
    answer: "Yes — within the operating model that fits. Scope is matched to your environment, and we offer fully managed or co-managed coverage to fit your existing IT structure. Specific needs can also be handled through standalone services.",
  },
  {
    question: "Do you work with businesses outside Arizona?",
    answer: "Yes, through Ready-to-Work IT. For businesses under 30 users, we buy the devices, set them up, test them, and ship them ready to use, and we provide per-user licenses like Microsoft 365. It's built for business owners and IT departments, in Arizona and beyond.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. We use enterprise-grade controls and documented security protocols, with monitoring matched to your plan — 24/7 SOC/MDR on Business and Enterprise. We help Arizona businesses prepare for HIPAA, PCI DSS, SOC 2, and cyber-insurance reviews, with clear ownership of credentials, policies, and evidence.",
  },
];

const CITIES = [
  { name: "Chandler", href: "/locations/chandler-az" },
  { name: "Phoenix", href: "/locations/phoenix-az" },
  { name: "Gilbert", href: "/locations/gilbert-az" },
  { name: "Tempe", href: "/locations/tempe-az" },
  { name: "Mesa", href: "/locations/mesa-az" },
  { name: "Scottsdale", href: "/locations/scottsdale-az" },
];

export function FaqSection(): JSX.Element {
  return (
    <section className="sec t-sonoran" id="faq">
      <div className="wrap">
        <div className="head">
          <div>
            <p className="mark">Common questions</p>
            <h2>Straight answers.</h2>
          </div>
        </div>
        <div className="faq">
          <div className="card">
            {QUESTIONS.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
          <div className="side">
            <div className="card">
              <h3>Security and compliance support</h3>
              <p className="small muted">Framework names describe requirements we help you address — not certifications DE holds.</p>
              <ul className="check">
                <li><CheckIcon />HIPAA-aligned security and compliance support</li>
                <li><CheckIcon />SOC 2 readiness and control alignment</li>
                <li><CheckIcon />Cyber insurance readiness</li>
                <li><CheckIcon />Security and compliance reporting</li>
              </ul>
            </div>
            <div className="card">
              <h3>Serving Greater Phoenix</h3>
              <p className="small muted">On-site and remote support across the Valley. Ready-to-Work IT ships beyond Arizona.</p>
              <div className="cities">
                {CITIES.map((city) => (
                  <a href={city.href} key={city.name}>{city.name}</a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
