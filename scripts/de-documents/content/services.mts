// Service datasheets: Co-Managed IT, UCaaS / Voice & Meetings, Managed Workplace,
// and the ProActive Ecosystem overview (which opens in the brief register).
import { pricing } from "../../../client/src/data/pricing";
import type { Doc } from "../system/families.mts";
import { BOOK, COMANAGED_ALT, COMANAGED_LANES, EDITION, NO_NAMES, SCOPE_NOTE, money } from "./shared.mts";

const ASSESS = {
  label: "Schedule a Cyber Risk Assessment",
  detail: "Confirm the right service level, required controls and implementation roadmap for your environment.",
  ...BOOK,
};

export const coManaged: Doc = {
  slug: "co-managed-it-datasheet",
  family: "datasheet",
  file: "assets/resources/datasheets/co-managed-it-datasheet.pdf",
  docId: "DE-DS-COM",
  edition: EDITION,
  title: "Co-Managed IT Datasheet | Digerati Experts",
  kicker: "Co-managed IT",
  h1: "Co-Managed IT",
  subtitle:
    "Security-first IT support for organizations that already have internal IT but need additional capacity, tools, coverage or specialized security guidance.",
  lede:
    "Co-Managed IT is a separate path for companies that already have internal IT resources. Digerati Experts can support the internal team with security operations, assessments, projects, endpoint and device programs, vendor coordination, documentation or escalation coverage without replacing the client's existing IT function.",
  aside: {
    box: { label: "Engagement model", value: "Co-managed", more: "Scoped by responsibility boundaries, systems, approvals and escalation paths." },
    facts: [
      { label: "Best fit", value: "Organizations with an internal IT person or team that needs security expertise, extra capacity, projects, tools or structured oversight." },
      { label: "Primary outcome", value: "A stronger internal IT function with outside support, security guidance and operational backup." },
    ],
  },
  keywords: "Digerati Experts, co-managed IT, internal IT support, security operations, datasheet",
  cta: ASSESS,
  scopeNote: SCOPE_NOTE,
  blocks: [
    { t: "section", title: "Who owns what", body: [{ t: "figure", svg: COMANAGED_LANES, alt: COMANAGED_ALT, caption: "The boundary is agreed in writing before work starts; roles shown are the common ones, and each engagement is scoped." }] },
    {
      t: "cols",
      items: [
        { t: "section", title: "What this model is for", body: [{ t: "list", items: [
          "Supporting internal IT without creating confusion over ownership.",
          "Adding specialized security, compliance, backup, secure access or project execution capacity.",
          "Creating documented roles so internal staff, leadership and Digerati Experts know who owns what.",
        ] }] },
        { t: "section", title: "Common co-managed roles", body: [{ t: "list", items: [
          "Security assessment and remediation roadmap support.",
          "SOC and threat detection coordination and incident escalation.",
          "Backup, BCDR and recovery planning support.",
          "Project execution for onboarding, network, identity, device or cloud initiatives.",
        ] }] },
      ],
    },
    {
      t: "cols",
      items: [
        { t: "section", title: "Operating rules", body: [{ t: "list", items: [
          "Authority boundaries are defined before work starts.",
          "Client internal IT remains the day-to-day owner where assigned.",
          "Digerati Experts may drop-ship pre-provisioned devices, coordinate remote setup or act as a specialized service provider, depending on scope.",
        ] }] },
        { t: "section", title: "Where it fits", body: [{ t: "list", items: [
          "Works as a standalone engagement or as a parallel path to the ProActive Ecosystem levels.",
          "Best when leadership wants maturity and security without removing the existing internal IT relationship.",
          "Not a substitute for full IT ownership unless the client chooses to move into a ProActive Ecosystem package.",
        ] }] },
      ],
    },
    { t: "section", title: "Typical deliverables", body: [{ t: "list", style: "num", items: [
      "Responsibility matrix",
      "Escalation map",
      "Security assessment and roadmap",
      "Project plan or recurring support model",
      "Documentation and governance cadence",
    ] }] },
  ],
};

export const ucaas: Doc = {
  slug: "ucaas-voice-meetings-datasheet",
  family: "datasheet",
  file: "assets/resources/datasheets/ucaas-voice-meetings-datasheet.pdf",
  docId: "DE-DS-UCV",
  edition: EDITION,
  title: "UCaaS / Voice & Meetings Datasheet | Digerati Experts",
  kicker: "Infrastructure add-on",
  h1: "UCaaS: Voice & Meetings",
  subtitle:
    "Unified phone, meetings, messaging and communications support for businesses that need reliable voice and collaboration inside a managed IT strategy.",
  lede:
    "UCaaS / Voice & Meetings is offered as an infrastructure add-on when clients need a better communications platform. Digerati Experts helps align business phone, meetings, user access, device readiness, number planning and support workflows with the broader IT and security environment.",
  aside: {
    box: { label: "Engagement model", value: "Infrastructure add-on", more: "For ProActive Ecosystem clients or scoped standalone projects." },
    facts: [
      { label: "Best fit", value: "Businesses replacing legacy phones, consolidating communication tools, opening new offices or standardizing user calling and meetings." },
      { label: "Primary outcome", value: "A cleaner communications environment with better user experience, supportability and lifecycle management." },
    ],
  },
  keywords: "Digerati Experts, UCaaS, VoIP, business phone, meetings, collaboration, datasheet",
  cta: ASSESS,
  scopeNote: SCOPE_NOTE,
  blocks: [
    {
      t: "section",
      title: "Core planning areas",
      body: [{
        t: "flow",
        prefix: "AREA",
        label: "Core planning areas",
        steps: [
          { step: "Call flow mapping", detail: "User and department call flows." },
          { step: "Numbers and porting", detail: "Number inventory, porting readiness and phone assignment." },
          { step: "Meetings and collaboration", detail: "Meeting and collaboration requirements." },
          { step: "Network readiness", detail: "Review for voice quality and reliability." },
        ],
      }],
    },
    {
      t: "cols",
      items: [
        { t: "section", title: "What this service is for", body: [{ t: "list", items: [
          "Replacing fragmented phone and meeting tools with a more supportable environment.",
          "Helping employees communicate from office, remote and mobile work contexts.",
          "Aligning communication tools with identity, device readiness, onboarding and offboarding.",
        ] }] },
        { t: "section", title: "Security and lifecycle", body: [{ t: "list", items: [
          "User access managed through defined onboarding and offboarding workflows.",
          "Administrative access limited, documented and protected.",
          "Departing employees lose access to communication systems as part of standard offboarding.",
        ] }] },
      ],
    },
    {
      t: "cols",
      items: [
        { t: "section", title: "Where it fits", body: [{ t: "list", items: [
          "An optional infrastructure add-on when clients build a package.",
          "Useful during office moves, new site launches, phone replacement or collaboration platform cleanup.",
          "Can be paired with Managed Network & Connectivity and Managed Workplace for stronger operational results.",
        ] }] },
        { t: "section", title: "Typical deliverables", body: [{ t: "list", items: [
          "Voice and meeting requirements map",
          "User and extension planning sheet",
          "Number and call flow checklist",
          "Implementation roadmap",
          "Support and lifecycle recommendations",
        ] }] },
      ],
    },
  ],
};

export const managedWorkplace: Doc = {
  slug: "managed-workplace-overview",
  family: "datasheet",
  file: "assets/resources/datasheets/managed-workplace-overview.pdf",
  docId: "DE-DS-MWO",
  edition: EDITION,
  title: "Managed Workplace Overview | Digerati Experts",
  kicker: "Service overview",
  h1: "Managed Workplace",
  subtitle: "Secure employee onboarding, access, devices, productivity tools and workplace technology operations.",
  lede:
    "Managed Workplace helps standardize the employee technology lifecycle: onboarding, offboarding, identity and access, devices, productivity tools, collaboration platforms, workflow support and the security controls around the modern workplace.",
  aside: {
    facts: [
      { label: "Best fit", value: "Businesses with growing teams, inconsistent onboarding and offboarding, scattered SaaS tools, device sprawl, or concerns about employee access after role changes or departures." },
      { label: "Platforms", value: "Microsoft 365, Google Workspace, Zoho and related workplace tools." },
    ],
  },
  keywords: "Digerati Experts, Managed Workplace, onboarding, offboarding, identity, Microsoft 365, Google Workspace, Zoho",
  cta: {
    label: "Request a Managed Workplace review",
    detail: "Review your employee lifecycle and access model with Digerati Experts.",
    ...BOOK,
  },
  scopeNote: SCOPE_NOTE,
  blocks: [
    {
      t: "section",
      title: "The employee lifecycle",
      body: [{
        t: "flow",
        prefix: "STAGE",
        label: "Employee technology lifecycle",
        steps: [
          { step: "Onboarding", detail: "Accounts, access groups, devices, apps and baseline security." },
          { step: "Identity and access", detail: "MFA, SSO, role-based access and account lifecycle governance." },
          { step: "Daily work", detail: "Productivity platforms and device support." },
          { step: "Offboarding", detail: "Access removal, device return, data preservation, license cleanup." },
        ],
      }],
    },
    {
      t: "section",
      title: "What Managed Workplace covers",
      body: [{
        t: "table",
        head: ["Component", "What it means", "Business benefit"],
        rowHeader: true,
        widths: ["22%", "42%", "36%"],
        rows: [
          ["Onboarding", "User accounts, access groups, devices, productivity apps and baseline security setup.", "New hires start faster and with fewer access gaps."],
          ["Offboarding", "Account disablement, access removal, device return, data preservation and license cleanup.", "Reduces data leakage and orphaned access."],
          ["Identity & access", "MFA, SSO, role-based access and account lifecycle governance.", "Protects business apps and cloud data."],
          ["Productivity platforms", "Microsoft 365, Google Workspace, Zoho and related workplace tools.", "Keeps daily operations stable and supported."],
          ["Device support", "Device standards, inventory, endpoint protection and support coordination.", "Improves reliability and security visibility."],
          ["Reporting", "Workplace technology health, access posture and lifecycle activity.", "Gives leadership visibility into operational risk."],
        ],
      }],
    },
    {
      t: "section",
      title: "What this is not",
      keep: true,
      body: [
        { t: "callout", kind: "boundary", label: "Boundary", text: "Managed Workplace runs the technology around your people. Employment, payroll, benefits and legal decisions stay with you." },
        { t: "list", items: [
          "Not payroll administration",
          "Not employment law advice",
          "Not benefits administration",
          "Not HR investigations",
          "Not a replacement for company leadership decisions or legal review",
        ] },
      ],
    },
  ],
};

const lv = (k: "it" | "office" | "business" | "enterprise") => `${money(pricing[k].user)} / ${money(pricing[k].monthlyMinimum)}`;

export const ecosystemOverview: Doc = {
  slug: "proactive-ecosystem-overview",
  family: "datasheet",
  file: "assets/resources/datasheets/proactive-ecosystem-overview.pdf",
  docId: "DE-DS-PEO",
  edition: EDITION,
  title: "ProActive IT & Security Ecosystem Overview | Digerati Experts",
  kicker: "ProActive Ecosystem · Overview",
  h1: "The ProActive Ecosystem",
  subtitle: "A cybersecurity-first managed IT model for stable operations, protected users and strategic technology ownership.",
  lede:
    "The ProActive Ecosystem is Digerati Experts' cybersecurity-first managed IT model. It is built for companies that want more than reactive support tickets, and combines user support, secure access, device and workplace operations, backup, network and security controls, reporting and strategic guidance, depending on the level of coverage selected.",
  keywords: "Digerati Experts, ProActive Ecosystem, managed IT, MSSP, coverage levels, pricing, overview",
  cta: {
    label: "Schedule a Cyber Risk Assessment",
    detail: "Determine the right coverage level for your environment.",
    ...BOOK,
  },
  scopeNote: `Public pricing is starting-at guidance, not a quote. Final pricing depends on users, endpoints, sites, compliance requirements, backup scope, existing technology condition and selected add-ons; your Cyber Risk Assessment confirms final scope. ${NO_NAMES}`,
  blocks: [
    {
      t: "takeaways",
      title: "In brief",
      items: [
        { b: "One model, four operating depths.", s: "IT, Office, Business and Enterprise all include the DE Security Foundation; they differ in operating depth, not quality." },
        { b: "Standalone when one role is enough.", s: "Standalone services solve one clearly defined technology role. The Ecosystem is for broader IT and security ownership." },
        { b: "Published starting points, assessed scope.", s: "Rates are starting-at guidance; the Cyber Risk Assessment confirms the right level and final pricing." },
      ],
    },
    {
      t: "section",
      title: "Coverage levels",
      body: [{
        t: "table",
        head: ["Level", "Best fit", "Typical focus", "From / min"],
        rowHeader: true,
        widths: ["20%", "27%", "38%", "15%"],
        rows: [
          ["ProActive IT", "Businesses that need core managed IT and security direction.", "Foundational support, endpoint visibility, DE Security Foundation, security awareness and a documented baseline.", lv("it")],
          ["ProActive Office", "Teams that need secure workplace operations.", "Users, devices, productivity platforms, managed network, endpoint backup and 24/7 managed detection and response.", lv("office")],
          ["ProActive Business", "Companies that need stronger protection and leadership reporting.", "Backup and DR posture, user cloud backup, enhanced threat detection, security awareness training, compliance and risk reporting, semi-annual reviews.", lv("business")],
          ["ProActive Enterprise", "Complex, multi-site or compliance-driven organizations.", "Advanced or custom security, compliance reporting, business continuity, quarterly planning and audit-grade evidence.", lv("enterprise")],
        ],
        caption: "Rates per user per month / monthly minimum.",
      }],
    },
    { t: "section", title: "Operating depth at a glance", body: [{ t: "ladder" }] },
    {
      t: "cols",
      items: [
        { t: "section", title: "Standalone or Ecosystem", body: [{ t: "p", text: "Standalone services solve one clearly defined technology role. The ProActive Ecosystem is for broader IT and security ownership, where Digerati Experts guides the overall stack, risk posture and operating model." }] },
        { t: "section", title: "Common add-on areas", body: [{ t: "list", items: [
          "UCaaS voice and meetings",
          "Co-managed IT support for internal teams",
          "Compliance reports and evidence collection",
          "Security awareness training",
          "Network and secure access modernization",
          "Backup and BCDR expansion",
        ] }] },
      ],
    },
  ],
};
