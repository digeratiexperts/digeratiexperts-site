/**
 * FAQs for the city and industry templates (site-gaps plan, 2026-11-11).
 *
 * Every answer restates something the site already publishes: the SLA, the pricing page,
 * the Cyber Risk Assessment, the Client Bill of Rights, the guarantee, the page's own
 * service list. No new numbers, client names or certifications. Rendered with FaqChapter,
 * which also emits FAQPage JSON-LD.
 */

export interface LocalFaq {
  question: string;
  answer: string;
}

/** City pages. `localNote` is the city's own fact line from locationPages. */
export function cityFaqs(city: string, localNote?: string): LocalFaq[] {
  return [
    {
      question: `Do you have people in ${city}?`,
      answer:
        (localNote ? `${localNote} ` : "") +
        "Most support is remote and fast; on-site visits are scheduled from our Chandler office when your plan includes them.",
    },
    {
      question: `How fast do you respond to ${city} businesses?`,
      answer:
        "The same published SLA applies everywhere we serve: a 15-minute response for critical incidents, and emergency incident response 24/7/365.",
    },
    {
      question: "What does managed IT cost?",
      answer:
        "Our plans are priced per user per month and published on the pricing page. Final scope is confirmed after the Cyber Risk Assessment, before any work begins.",
    },
    {
      question: "How do we get started?",
      answer:
        "Book a short fit call. If we're the right team, the next step is a Cyber Risk Assessment: a written review of identity, endpoints, email and backups that the plan is built on.",
    },
    {
      question: "What if we want to leave later?",
      answer:
        "Your credentials, tenants and licenses stay yours under our Client Bill of Rights, with a documented exit path. New clients also get a 30-day money-back guarantee.",
    },
  ];
}

export const ACCOUNTING_FAQS: LocalFaq[] = [
  {
    question: "Will onboarding get in the way of tax season?",
    answer:
      "We schedule changes around your busy season. Identity, email and backups come first, so the systems you lean on in March and April are owned before then.",
  },
  {
    question: "Can you help with wire fraud and business email compromise?",
    answer:
      "Yes. MFA, email authentication (DMARC), business email compromise detection, and a verify-before-send process for wire and payment instructions.",
  },
  {
    question: "Our cyber-insurance renewal asks about security controls. Can you help?",
    answer:
      "The Cyber Risk Assessment and our documentation map your controls to the questions carriers typically ask, so answers are backed by evidence.",
  },
  {
    question: "What does it cost?",
    answer:
      "Plans are priced per user per month on our pricing page. Scope is confirmed after the assessment, before work begins.",
  },
];

export const VETERINARY_FAQS: LocalFaq[] = [
  {
    question: "Do we need our own IT person?",
    answer:
      "No. We act as your IT team, or work beside the person who handles it today. Either way you get one accountable team to call.",
  },
  {
    question: "Can you support more than one clinic?",
    answer:
      "Yes. Multi-location practices get one operating model, centralized security and monitoring, and the same SLA at every site.",
  },
  {
    question: "What happens to our practice management system and imaging if something fails?",
    answer:
      "Backups and recovery paths are tested by restoring them, not assumed, so we know how long getting PIMS, imaging and billing back actually takes.",
  },
  {
    question: "What does it cost?",
    answer:
      "Plans are priced per user per month on our pricing page. Scope is confirmed after the assessment, before work begins.",
  },
];

export const NONPROFIT_FAQS: LocalFaq[] = [
  {
    question: "Do you offer nonprofit pricing?",
    answer:
      "Yes. Registered 501(c)(3) organizations get the nonprofit discount described on this page, and we help you use Microsoft's nonprofit grants where you qualify.",
  },
  {
    question: "Our team is mostly volunteers. Will this be too complicated?",
    answer:
      "Support is built for people who are not technical: plain-language help, simple sign-in with MFA, and short security awareness training.",
  },
  {
    question: "Can you help with grant and audit security questions?",
    answer:
      "Yes. We keep the documentation funders and auditors typically ask for, so the evidence is ready when the questionnaire arrives.",
  },
  {
    question: "How do we get started?",
    answer:
      "Book a short fit call. If we're the right team, the next step is a Cyber Risk Assessment that the plan is built on.",
  },
];

export const REAL_ESTATE_FAQS: LocalFaq[] = [
  {
    question: "How do you help stop wire fraud?",
    answer:
      "Email authentication (DMARC and SPF), business email compromise detection, MFA, staff training on the tactics, and a verify-by-phone step before any wire instruction is trusted.",
  },
  {
    question: "Our agents work from phones and on the road. Is that a problem?",
    answer:
      "No. Access is protected with MFA and managed devices wherever agents work, without slowing down a closing.",
  },
  {
    question: "Who do we call when a wire looks wrong?",
    answer:
      "Our Arizona team. Emergency incident response runs 24/7/365, and critical incidents get a 15-minute response under our published SLA.",
  },
  {
    question: "What does it cost?",
    answer:
      "Plans are priced per user per month on our pricing page. Scope is confirmed after the assessment, before work begins.",
  },
];
