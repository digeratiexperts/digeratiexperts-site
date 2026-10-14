import { useState, type MouseEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { FAQJsonLd } from "@/components/JsonLd";
import { GREATER_PHOENIX_CITIES } from "@/data/greaterPhoenixCities";
import "./14-faq.css";
import { ChapterPattern } from "@/components/site/Atmosphere";

/**
 * Section 14 (mock: artifacts/design-concepts/homepage-sections-2026-10/sections/14-faq.html).
 * FAQ (questions/answers verbatim from DigeratiFAQSection.tsx, same FAQPage JSON-LD), then
 * "Security & Compliance Support" and "Serving Greater Phoenix" (from DigeratiNewsletterSection.tsx).
 * Joe, round 2: no newsletter card here; the one newsletter form is the footer's.
 */

interface FAQ {
  question: string;
  answer: string;
}

const faqs: FAQ[] = [
  {
    question: "What is your best service?",
    answer: "There isn’t a universally “best” package. ProActive is four operating models — IT, Office, Business, and Enterprise — matched to users, devices, locations, infrastructure, security, compliance, and whether you need fully or co-managed coverage. If Office would need heavy modification, Business is the correct fit for that environment, not a higher rank."
  },
  {
    question: "How do I choose the right plan for my business?",
    answer: "User count is a signal, never the sole criterion. We start with a Cyber Risk Assessment of your environment, then match IT, Office, Business, or Enterprise. We do not start with a package and pile on add-ons."
  },
  {
    question: "Can I customize the solutions?",
    answer: "Yes! We understand every business is unique. Our packages can be customized with additional services, and we offer both co-managed and fully managed options to fit your existing IT structure."
  },
  {
    question: "Is my data secure?",
    answer: "Yes. We use enterprise-grade controls, 24/7 monitoring, and documented security protocols. We help Arizona businesses prepare for HIPAA, PCI DSS, SOC 2, and cyber-insurance reviews — with clear ownership of credentials, policies, and evidence."
  }
];

const complianceItems = [
  "HIPAA-aligned security and compliance support",
  "SOC 2 readiness and control alignment",
  "Cyber insurance readiness",
  "Security and compliance reporting",
];

const svgProps = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function V10Faq(): JSX.Element {
  // One open at a time, the first open on arrival (mock: exclusive <details name="faq">, first [open]).
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const reduceMotion = useReducedMotion();
  const reveal = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: revealInitial,
          whileInView: revealInView,
          viewport: revealViewport,
          transition: { ...revealTransition, delay },
        };

  const toggle = (index: number) => (event: MouseEvent<HTMLElement>) => {
    // React owns the open state; stop the native toggle so the two never disagree.
    event.preventDefault();
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <>
      <section className="f-paper v10-section faq-band" aria-labelledby="faq-title">
        <ChapterPattern variant="dots" />
        <FAQJsonLd faqs={faqs} />
        <div className="v10-canvas faq">
          <motion.div className="v10-head" {...reveal()}>
            <p className="v10-eyebrow">Common questions</p>
            <h2 className="v10-h2" id="faq-title">
              Frequently Asked Questions
            </h2>
            <p className="v10-lede">Straight answers on how we work, what we recommend, and why.</p>
          </motion.div>
          <motion.div className="faq-list" {...reveal(0.04)}>
            {faqs.map((faq, index) => {
              const isOpen = openIndex === index;
              return (
                <details className="faq-item" open={isOpen} key={faq.question} data-testid={`faq-${index}`}>
                  <summary
                    onClick={toggle(index)}
                    id={`faq-question-${index}`}
                    aria-controls={`faq-answer-${index}`}
                    data-testid={`faq-trigger-${index}`}
                  >
                    <h3 className="v10-h3 faq-q">{faq.question}</h3>
                    <span className="faq-chev" aria-hidden="true">
                      <svg {...svgProps} width={20} height={20}>
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </summary>
                  <div className="faq-answer" id={`faq-answer-${index}`}>
                    <p data-testid={`faq-answer-${index}`}>{faq.answer}</p>
                  </div>
                </details>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="f-surface v10-section" id="compliance" aria-labelledby="compliance-title">
        <ChapterPattern variant="contour" />
        <div className="v10-canvas">
          <motion.div className="v10-grid v10-grid--2 comp" {...reveal()}>
            <div>
              <h2 className="v10-h2--sub" id="compliance-title">
                Security &amp; Compliance Support<span className="v10-colon" aria-hidden="true">:</span>
              </h2>
              <p className="v10-lede">
                Framework names describe customer requirements Digerati Experts helps organizations address — not
                certifications DE holds.
              </p>
            </div>
            <ul className="chip-row comp-chips" aria-label="Compliance support">
              {complianceItems.map((item) => (
                <li className="v10-chip" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div className="cards cards--one" {...reveal(0.04)}>
            <article className="v10-card sa-card" aria-labelledby="service-area-title">
              <div className="sa-head">
                <h3 className="v10-h3" id="service-area-title">
                  Serving Greater Phoenix<span className="v10-colon" aria-hidden="true">:</span>
                </h3>
                <p className="v10-body sa-lede">On-site and remote support across the Valley. Pick your city for local detail.</p>
              </div>
              <ul className="chip-row city-list" aria-label="Cities served">
                {GREATER_PHOENIX_CITIES.map((city) => (
                  <li key={city.slug}>
                    <a
                      className={`v10-chip${city.slug === "chandler-az" ? " is-home" : ""}`}
                      href={city.href}
                      data-city={city.name.toLowerCase()}
                      data-testid={`newsletter-location-${city.name.toLowerCase()}`}
                    >
                      {city.name}
                      <svg {...svgProps} width={15} height={15}>
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </article>
          </motion.div>
        </div>
      </section>
    </>
  );
}
