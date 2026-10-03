// Compliance & Risk Reports overview and the sample QBR (reports family).
import type { Doc } from "../system/families.mts";
import { BOOK, EDITION, NO_NAMES, QBR_CADENCE, QBR_CADENCE_ALT, SCOPE_NOTE } from "./shared.mts";

const SHOW = [
  { step: "Current controls", detail: "The state of key security and IT controls." },
  { step: "Business risk", detail: "Risk created by missing, weak or inconsistent controls." },
  { step: "Prioritized actions", detail: "Remediation ranked by risk and operational impact." },
  { step: "Evidence", detail: "Documentation needed for compliance conversations." },
];

export const complianceReports: Doc = {
  slug: "compliance-risk-reports-overview",
  family: "report",
  file: "assets/resources/reports/compliance-risk-reports-overview.pdf",
  docId: "DE-RP-CRR",
  edition: EDITION,
  title: "Compliance & Risk Reports Overview | Digerati Experts",
  kicker: "Overview",
  h1: "Compliance & Risk Reports",
  subtitle:
    "A practical overview of how Digerati Experts translates technical controls, risk findings and compliance evidence into leadership-ready reporting.",
  keywords: "Digerati Experts, compliance reporting, risk reporting, CIS Controls, NIST, HIPAA, PCI DSS, CMMC, SOC 2",
  cta: {
    label: "Schedule a Cyber Risk Assessment",
    detail: "Confirm the right service level, required controls and reporting depth for your environment.",
    ...BOOK,
  },
  scopeNote: SCOPE_NOTE,
  brief: {
    k: "Overview · Compliance & risk reporting",
    q: "A practical overview of how Digerati Experts translates technical controls, risk findings and compliance evidence into **leadership-ready reporting**.",
    bottom:
      "Compliance & Risk Reports help leadership see where technology risk exists, which controls are in place, what needs improvement and which actions to prioritize.",
    bottomDetail:
      "This overview is not a legal opinion or certification document. It is a practical reporting model for managing security and compliance readiness.",
    kpi: [
      { label: "Engagement", v: "Standalone or included", u: "In ProActive Business and Enterprise, by reporting depth" },
    ],
    takeaways: [
      { b: "Controls, risk, actions, evidence.", s: "Reports are designed to show the controls in place, the risk they leave, prioritized remediation and the evidence needed." },
      { b: "Framework-aligned, not a certification.", s: "CIS Controls and NIST-based practices guide the work; HIPAA, PCI DSS, CMMC, SOC 2 and others are mapped when relevant." },
      { b: "Your leadership decides.", s: "Digerati Experts supports evidence and controls; your leadership and advisors make final compliance decisions." },
    ],
    toc: true,
  },
  blocks: [
    {
      t: "section",
      title: "Who it is for",
      body: [{
        t: "table",
        head: ["Topic", "Detail"],
        rowHeader: true,
        widths: ["24%", "76%"],
        rows: [
          ["Best fit", "Businesses that need practical risk visibility, security control tracking, compliance evidence support or executive reporting."],
          ["Primary outcome", "Clearer visibility into security posture, control gaps, remediation priorities and compliance readiness."],
          ["Engagement type", "A standalone report package, or included in ProActive Business and ProActive Enterprise depending on reporting depth."],
        ],
      }],
    },
    {
      t: "section",
      title: "What the reports are designed to show",
      body: [{ t: "flow", prefix: "VIEW", label: "What the reports show", steps: SHOW }],
    },
    {
      t: "cols",
      items: [
        { t: "section", title: "Common reporting categories", body: [{ t: "list", items: [
          "Identity and access controls",
          "Endpoint and device protection",
          "Email and phishing risk",
          "Backup, BCDR and recovery readiness",
          "Network and secure access posture",
          "Security awareness and employee risk",
        ] }] },
        { t: "section", title: "Business use cases", body: [{ t: "list", items: [
          "Support cyber insurance conversations.",
          "Prioritize remediation spending.",
          "Create leadership visibility without overwhelming executives with raw technical data.",
          "Prepare for audits, customer security questionnaires or board-level risk conversations.",
        ] }] },
      ],
    },
    {
      t: "section",
      title: "Framework alignment",
      body: [
        {
          t: "table",
          head: ["Framework", "Role in reporting"],
          rowHeader: true,
          widths: ["34%", "66%"],
          rows: [
            ["CIS Controls, NIST-based practices", "Primary guidance for control alignment."],
            ["HIPAA, PCI DSS, CMMC, SOC 2 and others", "Mapped when relevant to the client."],
          ],
        },
        { t: "callout", kind: "boundary", label: "Boundary", text: "Framework names are your requirements, not Digerati Experts certifications. Digerati Experts supports technical evidence and control implementation; client leadership and legal or compliance advisors remain responsible for final compliance decisions." },
      ],
    },
    { t: "section", title: "Typical deliverables", body: [{ t: "list", style: "num", items: [
      "Executive summary",
      "Risk priority table",
      "Control status overview",
      "Evidence and documentation checklist",
      "Remediation roadmap",
    ] }] },
  ],
};

export const qbrSample: Doc = {
  slug: "sample-quarterly-business-review",
  family: "report",
  file: "assets/resources/reports/sample-quarterly-business-review.pdf",
  docId: "DE-RP-QBR",
  edition: EDITION,
  title: "Sample Quarterly Business Review (EXAMPLE) | Digerati Experts",
  kicker: "Sample report",
  h1: "Quarterly Business Review",
  subtitle:
    "A leadership-ready sample showing how Digerati Experts reviews technology health, security posture, support trends, projects, budget items and next-quarter priorities.",
  keywords: "Digerati Experts, QBR, quarterly business review, sample, example, technology planning",
  example: true,
  cta: {
    label: "Choose your review cadence",
    detail: "Use this sample to decide what reporting cadence your organization needs, then schedule an assessment to confirm the right QBR scope.",
    ...BOOK,
  },
  scopeNote: `Sample report structure. It contains no client data, metrics or results. ${NO_NAMES}`,
  brief: {
    k: "Sample report · Quarterly Business Review",
    q: "How Digerati Experts reviews technology health, security posture, support trends, projects, budget items and **next-quarter priorities**.",
    bottomLabel: "What a QBR is for",
    bottom:
      "The QBR keeps technology decisions connected to business outcomes: risk, reliability, employee experience, upcoming projects, budget planning and the decisions that keep the business moving securely.",
    bottomDetail: "Instead of only reviewing tickets, the conversation focuses on what leadership needs to decide.",
    kpi: [
      { label: "Cadence", v: "Twice a year", u: "ProActive Business" },
      { label: "", v: "Quarterly", u: "ProActive Enterprise; by scope for strategic clients" },
    ],
    takeaways: [
      { b: "Decisions, not ticket counts.", s: "The conversation centers on risk, reliability, budget and the decisions leadership needs to make." },
      { b: "Five agenda blocks.", s: "Summary, support trends, security posture, backup readiness and projects and lifecycle." },
      { b: "Cadence follows the level.", s: "Semi-annual in ProActive Business, quarterly in ProActive Enterprise." },
    ],
    toc: true,
  },
  blocks: [
    {
      t: "section",
      title: "Who it is for",
      body: [{
        t: "table",
        head: ["Topic", "Detail"],
        rowHeader: true,
        widths: ["24%", "76%"],
        rows: [
          ["Best fit", "Clients in ProActive Business, ProActive Enterprise or strategic engagements that need recurring planning and leadership visibility."],
          ["Primary outcome", "A structured business review that turns IT and security activity into priorities, decisions and a practical roadmap."],
          ["Engagement type", "Semi-annual in ProActive Business; quarterly in ProActive Enterprise; available by scope for strategic clients."],
        ],
      }],
    },
    { t: "section", title: "Review cadence by level", body: [{ t: "figure", svg: QBR_CADENCE, alt: QBR_CADENCE_ALT, caption: "Reviews per year by ProActive level. Spacing is illustrative; dates are agreed with each client." }] },
    { t: "section", title: "Sample agenda", body: [{ t: "list", style: "num", items: [
      "Executive summary and major changes since the last review.",
      "Support trends, recurring issues and employee experience observations.",
      "Security posture update, major risks and remediation progress.",
      "Backup and BCDR readiness and recovery posture.",
      "Project status, lifecycle items and upcoming decisions.",
    ] }] },
    {
      t: "cols",
      items: [
        { t: "section", title: "Example metrics to include", body: [
          { t: "list", items: [
            "Ticket volume and response pattern by category.",
            "Endpoint health, patching posture and device lifecycle status.",
            "Security awareness participation and phishing risk indicators.",
            "Backup completion trends and restore testing status.",
            "Open risks, accepted risks and remediation deadlines.",
          ] },
          { t: "callout", kind: "example", label: "Example", text: "Metric categories only. This sample shows no values, because none would be real." },
        ] },
        { t: "section", title: "Decisions the QBR should drive", body: [{ t: "list", items: [
          "Which risks need budget now versus later.",
          "Which systems or devices should be replaced before failure.",
          "Which policies, access changes or user controls need approval.",
          "Which projects should be scheduled for the next quarter.",
        ] }] },
      ],
    },
    {
      t: "cols",
      items: [
        { t: "section", title: "How Digerati Experts uses the QBR", body: [{ t: "list", items: [
          "To keep the client roadmap active and practical.",
          "To document decisions, tradeoffs and accepted risks.",
          "To connect IT operations, security, compliance and budget planning in one leadership conversation.",
        ] }] },
        { t: "section", title: "Typical deliverables", body: [{ t: "list", items: [
          "QBR agenda",
          "Executive summary page",
          "Risk and project roadmap",
          "Budget and action list",
          "Decision log for leadership follow-up",
        ] }] },
      ],
    },
  ],
};
