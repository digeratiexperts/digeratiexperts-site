import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { revealInitial, revealInView, revealTransition, revealViewport } from "@/lib/animations";
import { FAQJsonLd } from "@/components/JsonLd";
import {
  HomeChapter,
  HomeChapterHeader,
  HomeContainer,
  buttonPrimary,
  buttonSecondary,
  cardDark,
  cardPaper,
  Eyebrow,
  ledeClass,
  titleClass,
  textLinkClass,
} from "@/components/home/HomeChapter";

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
    <HomeChapter tone="paper">
      <FAQJsonLd faqs={faqs} />
      <HomeContainer>
        <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-14">
          <motion.div
            className="lg:col-span-4"
            initial={prefersReducedMotion ? false : revealInitial}
            whileInView={revealInView}
            viewport={revealViewport}
            transition={revealTransition}
          >
            <Eyebrow tone="paper" className="mb-4">
              Common questions
            </Eyebrow>
            <h2 className={`${titleClass} max-w-[16ch]`}>Frequently Asked Questions</h2>
            <p className={`${ledeClass("paper")} mt-5 max-w-md`}>
              Straight answers on how we work, what we recommend, and why.
            </p>
          </motion.div>

          <div className="lg:col-span-8">
            <div className="space-y-3">
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
                      className={`de-paper-faq-item rounded-xl ${isOpen ? "is-open" : ""}`}
                    >
                      <button
                        className="group flex w-full min-h-11 items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-inset md:px-6 md:py-5"
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
                            <div className="px-5 pb-5 pt-0 md:px-6 md:pb-6">
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
      </HomeContainer>
    </HomeChapter>
  );
};
