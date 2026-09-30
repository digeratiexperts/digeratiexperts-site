// FROZEN — homepage version 3, snapshot of client/src/pages/sections/DigeratiFAQSection.tsx from the working tree on 2026-09-02.
// Do not edit. Start a new version with scripts/snapshot-homepage-version.mjs.
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { FAQJsonLd } from "@/components/JsonLd";

interface FAQ {
  question: string;
  answer: string;
}

export const DigeratiFAQSection = (): JSX.Element => {
  const prefersReducedMotion = useReducedMotion();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="de-dark-well relative py-8 md:py-14">
      <FAQJsonLd faqs={faqs} />
      <div className="mx-auto max-w-[var(--de-canvas)] px-3 sm:px-4 lg:px-6">
        <div className="de-paper-island relative px-6 py-10 sm:px-10 sm:py-14 md:px-12 md:py-16">
          <div className="relative z-10 mx-auto max-w-4xl">
            <motion.div
              initial={prefersReducedMotion ? false : revealInitial}
              whileInView={revealInView}
              viewport={revealViewport}
              transition={revealTransition}
              className="mb-10 text-center md:mb-12"
            >
              <p className="mb-3 text-base font-semibold uppercase tracking-[0.2em] text-[#D3126A]">
                Common questions
              </p>
              <h2 className="mb-4 font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-[#1A1228] md:text-4xl lg:text-5xl">
                Frequently Asked Questions
              </h2>
              <p className="mx-auto max-w-2xl text-lg leading-relaxed text-black/60 md:text-xl">
                Straight answers on how we work, what we recommend, and why.
              </p>
            </motion.div>

            <div className="space-y-3 md:space-y-4">
              {faqs.map((faq, index) => {
                const isOpen = openIndex === index;

                return (
                  <motion.div
                    key={index}
                    initial={prefersReducedMotion ? false : revealInitial}
                    whileInView={revealInView}
                    viewport={revealViewport}
                    transition={{ ...revealTransition, delay: index * 0.04 }}
                    data-testid={`faq-${index}`}
                  >
                    <div
                      className={`de-paper-faq-item rounded-2xl ${isOpen ? "is-open" : ""}`}
                    >
                      <button
                        className="group flex w-full min-h-11 items-center justify-between gap-4 px-5 py-5 text-left focus-visible:outline-none md:px-7 md:py-6"
                        onClick={() => toggleAccordion(index)}
                        aria-expanded={isOpen}
                        aria-controls={`faq-answer-${index}`}
                        id={`faq-question-${index}`}
                        data-testid={`faq-trigger-${index}`}
                      >
                        <span className="pr-2 text-base font-semibold text-[#1A1228] md:text-lg">
                          {faq.question}
                        </span>
                        <span
                          className={`de-paper-faq-chevron flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#D3126A]/10 group-hover:bg-[#D3126A]/15 ${
                            isOpen ? "is-open bg-[#D3126A]/15" : ""
                          }`}
                          aria-hidden="true"
                        >
                          <ChevronDown className="h-5 w-5 text-[#D3126A]" />
                        </span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={prefersReducedMotion ? false : { height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.25, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-6 pt-0 md:px-7 md:pb-7">
                              <div className="border-t border-[var(--de-paper-hairline)] pt-4">
                                <p
                                  className="text-base leading-relaxed text-black/60 md:text-lg"
                                  id={`faq-answer-${index}`}
                                  data-testid={`faq-answer-${index}`}
                                >
                                  {faq.answer}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
