// ProActive Office, Business and Enterprise datasheets. Inclusions follow
// client/src/data/pricing.ts; wording otherwise preserves the May 2026 sheets.
import type { Doc } from "../system/families.mts";
import { BOOK, EDITION, MOVE_UP, PRICE_NOTE, SLA } from "./shared.mts";

const CTA = {
  label: "Schedule a Cyber Risk Assessment",
  detail: "Confirm the right service level, required controls and implementation roadmap for your environment.",
  ...BOOK,
};

export const proactiveOffice: Doc = {
  slug: "proactive-office-ecosystem-datasheet",
  family: "datasheet",
  file: "assets/resources/datasheets/proactive-office-ecosystem-datasheet.pdf",
  docId: "DE-DS-POF",
  edition: EDITION,
  title: "ProActive Office Ecosystem Datasheet | Digerati Experts",
  kicker: "ProActive Ecosystem · Level 2 of 4",
  h1: "ProActive Office",
  subtitle:
    "Managed IT, workplace operations, secure productivity support, managed network connectivity, endpoint backup and 24/7 managed detection and response for growing offices.",
  lede:
    "ProActive Office is built for companies that need Digerati Experts to manage the everyday employee technology environment. It adds workplace operations, productivity platform support, endpoint backup and managed network connectivity over the ProActive IT baseline.",
  aside: {
    tier: "office",
    facts: [
      { label: "Best fit", value: "Businesses with employees, workstations, office connectivity and productivity platforms that need more than basic support." },
      { label: "Primary outcome", value: "A stable office technology environment with secure onboarding, workplace tools, endpoint backup and managed connectivity." },
    ],
  },
  keywords: "Digerati Experts, ProActive Office, managed IT, managed workplace, endpoint backup, MDR, datasheet",
  cta: CTA,
  scopeNote: PRICE_NOTE,
  blocks: [
    {
      t: "cols",
      items: [
        { t: "section", title: "Purpose", body: [{ t: "list", items: [
          "Improve the daily employee technology experience.",
          "Manage user provisioning, productivity tools and device and workplace technology.",
          "Reduce risk from weak access controls, unmanaged devices and inconsistent offboarding.",
        ] }] },
        { t: "section", title: "Typical deliverables", body: [{ t: "list", items: [
          "Office technology operating model",
          "User onboarding and offboarding workflow",
          "Endpoint backup baseline",
          "Productivity platform support map",
          "Annual technology and cyber review",
        ] }] },
      ],
    },
    {
      t: "section",
      title: "Scope at this level",
      body: [{
        t: "scope",
        rows: [
          { cap: "The ProActive IT baseline", st: "in", detail: "Builds on what matters at the IT level: service desk, DE Security Foundation, security baseline, awareness and documented environment." },
          { cap: "Managed Workplace", st: "in", detail: "Support for users and productivity platforms: Microsoft 365, Google Workspace and Zoho." },
          { cap: "Managed network and connectivity", st: "in", detail: "Office reliability and secure access planning." },
          { cap: "Stronger identity controls", st: "in", detail: "MFA, SSO and password hygiene." },
          { cap: "Advanced email anti-phishing", st: "in", detail: "Stronger protection against phishing and impersonation." },
          { cap: "24/7 managed detection and response", st: "in", detail: "Part of the DE Security Foundation at this level." },
          { cap: "Endpoint backup", st: "in", detail: "For covered endpoints." },
          { cap: "Company spend-card lifecycle controls", st: "add", detail: "Optional, when you want stronger offboarding controls." },
          { cap: "Backup and DR posture, compliance reporting", st: "out", detail: "Begin in ProActive Business." },
        ],
      }],
    },
    {
      t: "cols",
      items: [
        { t: "section", title: "Cadence and scope", body: [{ t: "list", items: [
          "One combined technology and cyber review per year.",
          `Response targets and 24/7/365 emergency incident response availability are defined in the DE Service Level Agreement (${SLA.label}).`,
          "Final coverage depends on the Cyber Risk Assessment, user count, endpoints, locations and backup scope.",
        ] }] },
        { t: "section", title: "When to move up", body: [{ t: "list", items: [
          `**ProActive Business** when ${MOVE_UP.business.charAt(0).toLowerCase()}${MOVE_UP.business.slice(1)}`,
          `**ProActive Enterprise** when ${MOVE_UP.enterprise.charAt(0).toLowerCase()}${MOVE_UP.enterprise.slice(1)}`,
        ] }] },
      ],
    },
    { t: "section", title: "Where ProActive Office sits", body: [{ t: "ladder", current: "office" }] },
  ],
};

export const proactiveBusiness: Doc = {
  slug: "proactive-business-ecosystem-datasheet",
  family: "datasheet",
  file: "assets/resources/datasheets/proactive-business-ecosystem-datasheet.pdf",
  docId: "DE-DS-PBU",
  edition: EDITION,
  title: "ProActive Business Ecosystem Datasheet | Digerati Experts",
  kicker: "ProActive Ecosystem · Level 3 of 4",
  h1: "ProActive Business",
  subtitle:
    "Expanded managed IT and security operations for businesses that need backup and disaster recovery, awareness training, risk reporting and planning discipline.",
  lede:
    "ProActive Business is for companies that need Digerati Experts to take broader ownership of IT and security operations. It moves beyond workplace support into backup and BCDR, cloud storage protection, threat detection, security operations, security awareness and recurring business reviews.",
  aside: {
    tier: "business",
    facts: [
      { label: "Best fit", value: "Companies where downtime, ransomware, access control, employee risk and planning gaps would create material business impact." },
      { label: "Primary outcome", value: "A stronger IT and security operating program with backup resilience, risk visibility, user training and recurring planning." },
    ],
  },
  keywords: "Digerati Experts, ProActive Business, managed security, BCDR, compliance reporting, datasheet",
  cta: CTA,
  scopeNote: PRICE_NOTE,
  blocks: [
    {
      t: "cols",
      items: [
        { t: "section", title: "Purpose", body: [{ t: "list", items: [
          "Reduce business exposure from downtime, ransomware, accidental deletion and access gaps.",
          "Create recurring technology planning instead of waiting for emergencies.",
          "Build a more complete security posture across identity, endpoints, email, backup, network and users.",
        ] }] },
        { t: "section", title: "Typical deliverables", body: [{ t: "list", items: [
          "Backup and BCDR coverage map",
          "Security operations summary",
          "Risk and compliance reporting package",
          "Semi-annual business and security review",
          "Prioritized roadmap and budget guidance",
        ] }] },
      ],
    },
    {
      t: "section",
      title: "Scope at this level",
      body: [{
        t: "scope",
        rows: [
          { cap: "Everything in ProActive Office", st: "in", detail: "Workplace, managed network, endpoint backup and the IT baseline." },
          { cap: "24/7 managed detection and response", st: "in", detail: "DE Security Foundation with enhanced security operations and threat detection." },
          { cap: "Backup and disaster recovery posture", st: "in", detail: "Endpoint backup, BCDR and user cloud storage protection." },
          { cap: "Security awareness training", st: "in", detail: "Included for users." },
          { cap: "Compliance and risk reporting support", st: "in", detail: "Practical reporting for leadership visibility." },
          { cap: "Planning and reviews", st: "in", detail: "Budgeting and planning support; technology and security reviews twice a year." },
          { cap: "Audit-grade reporting, quarterly executive reviews", st: "out", detail: "Begin in ProActive Enterprise." },
        ],
      }],
    },
    {
      t: "cols",
      items: [
        { t: "section", title: "Planning rhythm", body: [{ t: "list", items: [
          "Budgeting and planning support included.",
          "Technology and security business reviews twice per year.",
          "Recommendations tied to risk, business impact, cost and implementation priority.",
        ] }] },
        { t: "section", title: "Scope drivers", body: [{ t: "list", items: [
          "Multiple sites require Digerati Experts network solutions.",
          "Company spend-card lifecycle controls are required, included or available depending on final design.",
          "Compliance obligations, advanced reporting and audit preparation may increase scope.",
        ] }] },
      ],
    },
    { t: "section", title: "Where ProActive Business sits", body: [{ t: "ladder", current: "business" }] },
    {
      t: "section",
      title: "When to move up",
      body: [{ t: "table", head: ["Move to", "When"], rowHeader: true, widths: ["28%", "72%"], rows: [["ProActive Enterprise", MOVE_UP.enterprise]] }],
    },
  ],
};

export const proactiveEnterprise: Doc = {
  slug: "proactive-enterprise-ecosystem-datasheet",
  family: "datasheet",
  file: "assets/resources/datasheets/proactive-enterprise-ecosystem-datasheet.pdf",
  docId: "DE-DS-PEN",
  edition: EDITION,
  title: "ProActive Enterprise Ecosystem Datasheet | Digerati Experts",
  kicker: "ProActive Ecosystem · Level 4 of 4",
  h1: "ProActive Enterprise",
  subtitle:
    "Advanced managed IT, security, compliance, reporting and multi-site technology governance for organizations that require a more mature operating model.",
  lede:
    "ProActive Enterprise is the most complete Digerati Experts package. It is designed for organizations with higher operational risk, multiple locations, advanced security posture needs, compliance expectations or executive-level reporting requirements, and includes quarterly strategy cadence and custom backup, BCDR, security and compliance maturity planning.",
  aside: {
    tier: "enterprise",
    facts: [
      { label: "Best fit", value: "Organizations with compliance requirements, multiple sites, high downtime sensitivity, complex access needs or executive reporting expectations." },
      { label: "Engagement type", value: "Advanced or custom managed IT and security ecosystem. Requires a compliance or advanced governance need." },
    ],
  },
  keywords: "Digerati Experts, ProActive Enterprise, compliance, governance, multi-site, managed security, datasheet",
  cta: CTA,
  scopeNote: PRICE_NOTE,
  blocks: [
    {
      t: "cols",
      items: [
        { t: "section", title: "Purpose", body: [{ t: "list", items: [
          "Build a mature technology and security program around business risk.",
          "Support multiple sites, advanced controls, security posture visibility and executive reporting.",
          "Create structured evidence, planning and governance for leadership and compliance conversations.",
        ] }] },
        { t: "section", title: "Typical deliverables", body: [{ t: "list", items: [
          "Quarterly business and security reviews",
          "Audit-grade reporting package",
          "Unified security posture summary",
          "Advanced backup and BCDR roadmap",
          "Multi-site network and secure access roadmap",
        ] }] },
      ],
    },
    {
      t: "section",
      title: "Scope at this level",
      body: [{
        t: "scope",
        rows: [
          { cap: "Everything in ProActive Business", st: "in", detail: "Including 24/7 managed detection and response and backup and DR posture." },
          { cap: "Unified security posture", st: "in", detail: "Full unified security posture program and reporting." },
          { cap: "Advanced compliance and risk reporting", st: "in", detail: "Audit-grade compliance reporting and security business review cadence." },
          { cap: "Custom BCDR architecture", st: "in", detail: "Advanced or custom backup and BCDR program." },
          { cap: "Privileged access program elements", st: "in", detail: "Controls for administrative and high-risk access." },
          { cap: "Quarterly executive reviews", st: "in", detail: "Quarterly technology and security business reviews." },
          { cap: "Spend-card and advanced workplace controls", st: "in", detail: "Included or customized as part of the broader governance model." },
        ],
      }],
    },
    {
      t: "cols",
      items: [
        { t: "section", title: "Strategy and governance", body: [{ t: "list", items: [
          "Executive roadmap tied to risk, compliance, budget, lifecycle and operational resilience.",
          "Quarterly reviews can cover security trends, incident summaries, risk register updates, backup readiness, project status and roadmap decisions.",
        ] }] },
        { t: "section", title: "Scope drivers", body: [{ t: "list", items: [
          "Compliance requirements, multi-site design, secure access architecture, data protection needs and reporting maturity drive final scope.",
          "Network solutions are required for multiple-site environments.",
        ] }] },
      ],
    },
    { t: "section", title: "Where ProActive Enterprise sits", body: [{ t: "ladder", current: "enterprise" }] },
  ],
};
