import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
      question: "Where do we start if we are not sure what we need?",
      answer: "Start with the business, not a package. We look at your environment, the risks that matter, what is already working, and where a practical improvement would have the most value. Then we recommend a right-sized next step in plain English."
    },
    {
      question: "Do we need a fully managed plan?",
      answer: "Not always. Some clients want Digerati Experts to own day-to-day IT and security; others already have internal staff and need a co-managed partner. We can help you decide based on your team, risk, budget, and the amount of responsibility you want to keep in-house."
    },
    {
      question: "Can I customize the solutions?",
      answer: "Yes. The packages create a clear starting point, but the final scope should fit your users, locations, existing tools, compliance obligations, and internal capabilities. We will explain what belongs in the core plan and what is genuinely optional."
    },
    {
      question: "How do you handle security and compliance questions?",
      answer: "With evidence and context. We can walk through the controls included in your service, explain how monitoring and escalation work, and help organize documentation for insurers, auditors, and vendor reviews. Specific requirements are confirmed against your actual scope—never assumed from a badge."
    },
    {
      question: "Will I get handed off after the sale?",
      answer: "No disappearing act. You will know who owns the relationship, what happens next, and where to go when priorities change. Specialists may join for particular work, but accountability stays clear."
    }
  ];

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="py-10 md:py-14 lg:py-16 bg-[#F7FAFC]">
      <FAQJsonLd faqs={faqs} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.35 }}
          className="text-center mb-6 md:mb-8"
        >
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3 md:mb-4 px-2">
            Frequently Asked Questions
          </h2>
          <p className="text-base md:text-lg text-gray-500 px-4">
            Straight answers to the questions business owners ask before trusting an IT and security partner.
          </p>
        </motion.div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            
            return (
              <motion.div
                key={index}
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-30px" }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                data-testid={`faq-${index}`}
              >
                <div 
                  className={`bg-white rounded-xl shadow-md border-l-4 transition-all duration-300 hover:shadow-lg ${
                    isOpen 
                      ? 'border-l-violet-600 shadow-lg' 
                      : 'border-l-violet-400/50 hover:border-l-violet-500'
                  }`}
                >
                  <button
                    className="w-full px-5 py-5 md:px-6 md:py-6 flex items-center justify-between text-left group"
                    onClick={() => toggleAccordion(index)}
                    aria-expanded={isOpen}
                    data-testid={`faq-trigger-${index}`}
                  >
                    <span className={`text-base md:text-lg font-semibold pr-4 transition-colors duration-200 ${
                      isOpen ? 'text-violet-700' : 'text-gray-900 group-hover:text-violet-600'
                    }`}>
                      {faq.question}
                    </span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isOpen 
                        ? 'bg-violet-600 rotate-180' 
                        : 'bg-violet-100 group-hover:bg-violet-200'
                    }`}>
                      <ChevronDown 
                        className={`h-5 w-5 transition-colors duration-200 flex-shrink-0 ${
                          isOpen ? 'text-white' : 'text-violet-600'
                        }`}
                      />
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-5 md:px-6 md:pb-6 pt-0">
                          <div className="border-t border-gray-100 pt-4">
                            <p className="text-base text-gray-600 leading-relaxed" data-testid={`faq-answer-${index}`}>
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
    </section>
  );
};
