import { pricing } from "../../../client/src/data/pricing";
import type { Doc } from "../system/families.mts";
import { BOOK, EDITION, ENGAGEMENT, MOVE_UP, PRICE_NOTE } from "./shared.mts";

const p = pricing.it;

export const proactiveIt: Doc = {
  slug: "proactive-it-ecosystem-datasheet",
  family: "datasheet",
  file: "assets/resources/datasheets/proactive-it-ecosystem-datasheet.pdf",
  docId: "DE-DS-PIT",
  edition: EDITION,
  title: "ProActive IT Ecosystem Datasheet | Digerati Experts",
  kicker: "ProActive Ecosystem · Level 1 of 4",
  h1: "ProActive IT",
  subtitle:
    "Essential managed IT with the DE Security Foundation included, for smaller, less complex environments that need professional technology ownership without a large internal IT burden.",
  lede:
    "ProActive IT is the starting point of the ProActive Ecosystem. It replaces reactive break-fix support with one accountable partner for users, devices, access and support, and establishes a documented, security-first baseline before the business expands into deeper workplace, backup, security operations and compliance programs.",
  aside: {
    tier: "it",
    facts: [
      { label: "Best fit", value: p.idealBuyer + "." },
      { label: "Primary outcome", value: "A managed baseline for users, devices, support and security hygiene." },
    ],
  },
  keywords: "Digerati Experts, ProActive IT, managed IT, cybersecurity, datasheet",
  cta: {
    label: "Schedule a Cyber Risk Assessment",
    detail: "Confirm the right service level, required controls and implementation roadmap for your environment.",
    ...BOOK,
  },
  scopeNote: PRICE_NOTE,
  blocks: [
    {
      t: "cols",
      items: [
        {
          t: "section",
          title: "Purpose",
          body: [{
            t: "list",
            items: [
              "Replace purely reactive IT support with a stable managed model.",
              "Establish ownership of users, endpoints, access, patching and support flow.",
              "Give leadership one accountable partner for day-to-day IT direction and risk reduction.",
            ],
          }],
        },
        {
          t: "section",
          title: "Typical deliverables",
          body: [{
            t: "list",
            items: [
              "Managed IT operating baseline",
              "User and device inventory direction",
              "Support escalation path",
              "Initial Cyber Risk Assessment findings",
              "Recommended roadmap for add-ons and level changes",
            ],
          }],
        },
      ],
    },
    {
      t: "section",
      title: "Scope at this level",
      body: [{
        t: "scope",
        rows: [
          { cap: "Service desk and issue ownership", st: "in", detail: "Triage and coordination for covered users." },
          { cap: "DE Security Foundation", st: "in", detail: "Included at every ProActive level." },
          { cap: "Managed security baseline", st: "in", detail: "Endpoint, identity, email and security monitoring baseline." },
          { cap: "Security awareness", st: "in", detail: "Awareness and phishing resilience for users." },
          { cap: "Documented environment", st: "in", detail: "Users, devices and access recorded as the operating baseline." },
          { cap: "Endpoint backup", st: "out", detail: "No default backup program at this level. Endpoint backup begins in ProActive Office." },
          { cap: "24/7 managed detection and response", st: "add", detail: "Included from ProActive Office; added to ProActive IT only by separate scope." },
          { cap: "Compliance reporting", st: "out", detail: "Audit-grade documentation sits in higher levels or standalone engagements." },
        ],
      }],
    },
    {
      t: "section",
      title: "Where ProActive IT sits",
      body: [{ t: "ladder", current: "it" }],
    },
    {
      t: "section",
      title: "When to move up",
      body: [{
        t: "table",
        head: ["Move to", "When"],
        rowHeader: true,
        widths: ["28%", "72%"],
        rows: [
          ["ProActive Office", MOVE_UP.office],
          ["ProActive Business", MOVE_UP.business],
          ["ProActive Enterprise", MOVE_UP.enterprise],
        ],
      }],
    },
    { t: "section", title: "How an engagement starts", body: [{ t: "flow", steps: ENGAGEMENT, label: "Engagement steps" }] },
  ],
};
