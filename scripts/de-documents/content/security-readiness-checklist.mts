import type { Doc } from "../system/families.mts";
import { BOOK, EDITION, NO_NAMES } from "./shared.mts";

export const securityChecklist: Doc = {
  slug: "security-readiness-checklist",
  family: "checklist",
  file: "assets/resources/checklists/security-readiness-checklist.pdf",
  docId: "DE-CL-SEC",
  edition: EDITION,
  title: "Small Business Cybersecurity Readiness Checklist | Digerati Experts",
  kicker: "Checklist",
  h1: "Cybersecurity Readiness",
  subtitle: "A practical review of identity, devices, email, backups, network security and employee access.",
  keywords: "Digerati Experts, cybersecurity checklist, small business, MFA, backups, security awareness",
  cta: {
    label: "Request a Cyber Risk Assessment",
    detail:
      "If several items are unknown or marked no, a Cyber Risk Assessment shows what is exposed and whether you need a targeted standalone service or broader managed IT and security ownership through the ProActive Ecosystem.",
    ...BOOK,
  },
  scopeNote: `Educational checklist. It does not assess or certify any environment. ${NO_NAMES}`,
  opener: {
    t: "editorial",
    masthead: true,
    title: "Small Business Cybersecurity Readiness Checklist",
    stand: "A practical review of identity, devices, email, backups, network security and employee access.",
    sections: [
      {
        rail: "Purpose",
        h: "Find the gaps before they become business problems",
        paras: [
          "Use this checklist to quickly identify whether a business has the basic controls needed to reduce common cyber risk. A “no” answer does not always mean a system is failing, but it does indicate an area that should be reviewed before it becomes a business problem.",
        ],
      },
      {
        rail: "How to use it",
        h: "Ten checks, one honest answer each",
        steps: [
          "Answer with whoever manages your IT, accounts and devices.",
          "Mark **Yes**, **No** or **Unknown** for each check.",
          "Write the owner, and any evidence, on the notes line.",
          "Count your No and Unknown answers and read the guide on the last page.",
        ],
      },
      {
        rail: "What's covered",
        h: "Three areas, ten checks",
        terms: [
          ["01–04", "**Identity and devices.** MFA, stale and shared accounts, device inventory, encryption and endpoint security."],
          ["05–07", "**Email, backups and network.** Phishing and impersonation filtering, restore testing, secure remote access."],
          ["08–10", "**People and process.** Onboarding and offboarding, security awareness training, leadership reporting."],
        ],
      },
    ],
  },
  blocks: [
    {
      t: "section",
      title: "Security readiness review",
      body: [{
        t: "checks",
        groups: [
          {
            title: "Identity and devices",
            items: [
              { area: "Identity", q: "Are all users protected by MFA, especially administrators?" },
              { area: "Identity", q: "Are stale accounts, former employees and shared logins removed or controlled?" },
              { area: "Devices", q: "Does the business have an accurate device inventory?" },
              { area: "Devices", q: "Are laptops and desktops encrypted and protected by endpoint security?" },
            ],
          },
          {
            title: "Email, backups and network",
            items: [
              { area: "Email", q: "Are phishing, impersonation and malicious attachments filtered?" },
              { area: "Backups", q: "Have backups been restored and tested recently?" },
              { area: "Network", q: "Is remote access secured without exposing unnecessary services?" },
            ],
          },
          {
            title: "People and process",
            items: [
              { area: "Policies", q: "Is onboarding and offboarding documented and repeatable?" },
              { area: "Training", q: "Do employees receive security awareness training?" },
              { area: "Reporting", q: "Does leadership receive recurring security and technology reporting?" },
            ],
          },
        ],
      }],
    },
    {
      t: "section",
      title: "Reading your answers",
      intro: "Count the checks you marked **No** or **Unknown**. This is a rule of thumb for deciding what to do next, not an assessment or a score of your security.",
      body: [
        {
          t: "table",
          head: ["No + Unknown", "What it suggests"],
          rowHeader: true,
          widths: ["22%", "78%"],
          rows: [
            ["0–2", "Basic posture may be acceptable, but should still be validated."],
            ["3–5", "Schedule a focused security review."],
            ["6 or more", "Treat it as a priority risk review before a preventable issue becomes expensive."],
          ],
        },
        { t: "notes", label: "Notes and follow-ups", height: 80 },
      ],
    },
  ],
};
