import type { Doc } from "../system/families.mts";
import { BOOK, EDITION, NO_NAMES } from "./shared.mts";

export const cyberRiskSample: Doc = {
  slug: "cyber-risk-assessment-sample",
  family: "report",
  file: "assets/resources/reports/cyber-risk-assessment-sample.pdf",
  docId: "DE-RP-CRA",
  edition: EDITION,
  title: "Cyber Risk Assessment Sample Report (EXAMPLE) | Digerati Experts",
  kicker: "Sample report",
  h1: "Cyber Risk Assessment",
  subtitle: "A practical view of business technology risk, security gaps and prioritized remediation.",
  keywords: "Digerati Experts, Cyber Risk Assessment, sample report, example, cybersecurity, remediation roadmap",
  example: true,
  cta: {
    label: "Schedule a Cyber Risk Assessment",
    detail: "Receive findings specific to your business, in this format, with a remediation roadmap you can act on.",
    ...BOOK,
  },
  scopeNote: `Sample report. The organization, observations, rating and roadmap are illustrative and describe no real client. ${NO_NAMES}`,
  brief: {
    k: "Sample report · Cyber Risk Assessment",
    q: "A practical view of business technology risk, security gaps and prioritized remediation.",
    bottomLabel: "Sample bottom line",
    bottom:
      "Overall sample risk rating: **Moderate to High.** The exposure sits in identity security, backup validation, email protection, endpoint visibility and outdated network assumptions.",
    bottomDetail:
      "This sample shows the type of business-facing output Digerati Experts can provide after a Cyber Risk Assessment. It is not a client-specific finding.",
    kpi: [
      { label: "Sample risk rating", v: "Moderate to High", u: "Illustrative" },
      { label: "Areas reviewed", v: "5", u: "Identity, endpoint, backup, email, network" },
    ],
    takeaways: [
      { b: "Start with identity and recovery.", s: "Confirm MFA coverage, backup recoverability, endpoint protection and administrative access controls." },
      { b: "Fix in a 30 / 60 / 90-day sequence.", s: "Access and recovery first, then standardization, then reporting, training and review cadence." },
      { b: "Show risk, not raw tool data.", s: "What is exposed, why it matters, and what should be fixed first." },
    ],
    toc: true,
  },
  blocks: [
    {
      t: "section",
      title: "Executive risk summary",
      body: [
        {
          t: "p",
          text: "The purpose of a Cyber Risk Assessment is to translate technical gaps into business risk, operational exposure and a prioritized remediation roadmap. The assessment should not overwhelm leadership with raw tool data; it should show what is exposed, why it matters and what should be fixed first.",
        },
        {
          t: "table",
          head: ["Summary item", "Sample result"],
          rowHeader: true,
          widths: ["30%", "70%"],
          rows: [
            ["Overall risk rating", "Moderate to High"],
            ["Primary exposure themes", "Identity security, backup validation, email protection, endpoint visibility and outdated network assumptions"],
            ["Recommended first action", "Confirm MFA coverage, backup recoverability, endpoint protection and administrative access controls"],
          ],
          caption: "EXAMPLE content. Not a finding about any organization.",
        },
      ],
    },
    {
      t: "section",
      title: "Sample risk findings",
      intro: "Each observation is paired with the business impact leadership needs to weigh.",
      body: [{
        t: "table",
        head: ["Area", "Sample observation", "Business impact"],
        rowHeader: true,
        widths: ["20%", "40%", "40%"],
        rows: [
          ["Identity & access", "MFA is enabled for some users, but privileged accounts and shared accounts are not consistently enforced.", "A single stolen password could expose email, cloud files, administrative portals or client data."],
          ["Endpoint security", "Workstations have mixed protection status and inconsistent device inventory.", "Unknown or unmanaged devices increase ransomware and data-exposure risk."],
          ["Backups", "Backups exist, but restore testing and retention evidence are not documented.", "The company may not know whether it can recover after ransomware, deletion, hardware failure or cloud account compromise."],
          ["Email security", "Phishing controls and user training are inconsistent.", "Employees remain a high-risk entry point for credential theft and business email compromise."],
          ["Network & secure access", "Remote access and branch connectivity are handled without a documented secure access model.", "Operational growth may create hidden risk across users, sites and vendors."],
        ],
        caption: "EXAMPLE findings. Illustrative observations, not drawn from any organization.",
      }],
    },
    {
      t: "section",
      title: "Priority remediation roadmap",
      body: [{
        t: "flow",
        prefix: "PHASE",
        label: "Remediation roadmap in three 30-day phases",
        steps: [
          { step: "First 30 days", detail: "Verify MFA for all users and administrators, remove stale accounts, validate backup restore capability and document critical systems." },
          { step: "Days 31–60", detail: "Standardize endpoint protection, patching, email security and secure remote access." },
          { step: "Days 61–90", detail: "Build recurring reporting, user security training, compliance evidence and an executive technology review cadence." },
        ],
      }],
    },
    {
      t: "section",
      title: "Assessment deliverables",
      body: [{
        t: "list",
        items: [
          "Executive risk summary",
          "Technical findings summary",
          "Priority remediation roadmap",
          "Identity, endpoint, email, backup and network observations",
          "Recommended service model: a targeted standalone service or broader ProActive Ecosystem coverage",
        ],
      }],
    },
    {
      t: "editorial",
      inline: true,
      sections: [
        {
          rail: "Limitations",
          id: "limitations",
          h: "How to read this sample",
          paras: [
            "This sample shows the type of business-facing output Digerati Experts can provide after a Cyber Risk Assessment. It is not a client-specific finding.",
          ],
          list: [
            "The organization, observations, risk rating and roadmap are illustrative. They describe no real client.",
            "A real assessment reports what is found in your environment, so its findings, rating and sequence will differ.",
            "The roadmap shows the shape of prioritized remediation, not a commitment to particular dates or outcomes.",
          ],
        },
      ],
      close: true,
    },
  ],
};
