/**
 * Portal Learning catalog — role-personalized curricula derived from TechSales Hub
 * taxonomy (DE Core 36 scorecard pillars, ProActive ecosystem includes, onboarding).
 *
 * Capability-first language (no vendor name dumps). Hub document library cards are
 * attached at request time via the company-documents bridge when available.
 */

export type LearningAudience =
  | "staff"
  | "manager"
  | "dept_it_contact"
  | "company_it_contact"
  | "de_admin";

export type LearningPillar =
  | "everyday"
  | "governance"
  | "identity_devices"
  | "cyber_defense"
  | "infrastructure"
  | "onboarding"
  | "ecosystem";

export type LearningLesson = {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  minutes: number;
  pillar: LearningPillar;
  audiences: LearningAudience[];
  steps: string[];
  actions: Array<{ label: string; href: string; external?: boolean }>;
  hubDocSlugs?: string[];
  badge?: string;
};

export type LearningPath = {
  id: string;
  title: string;
  tagline: string;
  audience: LearningAudience;
  mission: string;
  lessonIds: string[];
};

const ALL_CLIENT: LearningAudience[] = [
  "staff",
  "manager",
  "dept_it_contact",
  "company_it_contact",
  "de_admin",
];
const LEADERS: LearningAudience[] = ["manager", "dept_it_contact", "company_it_contact", "de_admin"];
const IT_ROLES: LearningAudience[] = ["dept_it_contact", "company_it_contact", "de_admin"];
const COMPANY_IT: LearningAudience[] = ["company_it_contact", "de_admin"];

/** Curated lessons — language mirrors Hub scorecard / ecosystem themes. */
export const LEARNING_LESSONS: LearningLesson[] = [
  // ── Everyday (all roles) ───────────────────────────────────────────────
  {
    id: "day-get-help",
    title: "How to get help the right way",
    summary: "One clear door for IT issues — so nothing gets lost in chat or hallway conversations.",
    whyItMatters:
      "Untracked issues become lost productivity and repeat failures. A ticket gives DE a trail, an owner, and a fix that sticks.",
    minutes: 4,
    pillar: "everyday",
    audiences: ALL_CLIENT,
    badge: "Start here",
    steps: [
      "Open Support Tickets from the portal — that is the single intake for issues.",
      "Describe what you expected, what happened, and any error text (screenshots help).",
      "Note urgency: blocking your work vs can wait until tomorrow.",
      "Watch for updates in the ticket thread — that is the system of record.",
    ],
    actions: [
      { label: "Open a ticket", href: "/portal/tickets" },
      { label: "Browse Knowledge Base", href: "/portal/kb" },
    ],
  },
  {
    id: "day-mfa",
    title: "Your second factor is the front door",
    summary: "Passwords alone are not enough. MFA is the control insurers ask about first.",
    whyItMatters:
      "Stolen passwords are the #1 way in. A phone prompt, key, or code turns a leaked password into a near-miss instead of a breach.",
    minutes: 6,
    pillar: "identity_devices",
    audiences: ALL_CLIENT,
    steps: [
      "Confirm MFA is enabled on email, portal, and any remote access you use.",
      "Prefer an authenticator app or hardware key over SMS when available.",
      "Never share MFA codes — DE will never ask you for a live code in chat or email.",
      "If you lose your phone, open a ticket immediately so access can be recovered safely.",
    ],
    actions: [
      { label: "Portal MFA settings", href: "/portal/settings" },
      { label: "KB: MFA setup", href: "/portal/kb" },
    ],
  },
  {
    id: "day-phishing",
    title: "Spot the scam before you click",
    summary: "Security awareness is not a lecture — it is how you become part of the detection network.",
    whyItMatters:
      "People are the most-attacked surface. A pause, a hover, and a report beat any filter that misses one message.",
    minutes: 7,
    pillar: "cyber_defense",
    audiences: ALL_CLIENT,
    badge: "High impact",
    steps: [
      "Hover links before clicking — does the real destination match the brand?",
      "Treat urgency + money + secrecy as a red flag trio (wire, gift cards, ‘CEO needs this now’).",
      "Check the From address carefully — lookalikes swap letters (rn vs m, 0 vs O).",
      "Report suspicious mail to your IT contact or via a ticket — do not forward to coworkers as a joke.",
    ],
    actions: [
      { label: "Report via ticket", href: "/portal/tickets" },
      { label: "Security facts", href: "https://digeratiexperts.com/resources/cyber-facts", external: true },
    ],
  },
  {
    id: "day-device-habits",
    title: "Keep your company device healthy",
    summary: "Updates, lock screens, and lost-laptop basics — the habits that keep the fleet protectable.",
    whyItMatters:
      "Unmanaged habits create unmanaged risk. A locked, updated, encrypted laptop is a hardware problem — not a data breach.",
    minutes: 5,
    pillar: "identity_devices",
    audiences: ALL_CLIENT,
    steps: [
      "Restart weekly so patches finish applying.",
      "Lock when you walk away (Win+L / Ctrl+Cmd+Q).",
      "Do not install random apps — request software through Access / Forms when required.",
      "If a laptop is lost or stolen, call or ticket immediately for remote lock / wipe coordination.",
    ],
    actions: [
      { label: "Access request forms", href: "/portal/forms" },
      { label: "Infrastructure view", href: "/portal/infrastructure" },
    ],
  },
  {
    id: "day-remote",
    title: "Working remotely without opening the barn door",
    summary: "Secure remote access habits — VPN / zero-trust paths, public Wi‑Fi, and home networks.",
    whyItMatters:
      "Remote work expands the attack surface. The same login from a coffee shop needs the same discipline as the office.",
    minutes: 6,
    pillar: "infrastructure",
    audiences: ALL_CLIENT,
    steps: [
      "Use the company-approved remote path (VPN or secure access portal) — not random RDP tools.",
      "Avoid public Wi‑Fi for finance or admin work; use a phone hotspot if unsure.",
      "Never save shared passwords in browser profiles on personal machines.",
      "If access feels broken, ticket it — do not invent a workaround that bypasses security.",
    ],
    actions: [
      { label: "VPN access", href: "/portal/vpn" },
      { label: "KB: VPN getting started", href: "/portal/kb" },
    ],
  },
  {
    id: "day-files-backup",
    title: "Where your files should live",
    summary: "Company data belongs in company systems — so backup and recovery can reach it.",
    whyItMatters:
      "Files only on a desktop or personal drive disappear when a drive dies. Protected locations are what DE can restore.",
    minutes: 5,
    pillar: "infrastructure",
    audiences: ALL_CLIENT,
    steps: [
      "Save work to the sanctioned cloud / file share — not Desktop-only folders.",
      "If a file vanishes, stop recreating it for an hour and open a ticket (restore may be faster).",
      "Do not sync company folders to personal Dropbox / personal Google Drive.",
      "Ask your manager or IT contact which locations are backed up for your team.",
    ],
    actions: [{ label: "Open a restore ticket", href: "/portal/tickets" }],
  },

  // ── Manager ────────────────────────────────────────────────────────────
  {
    id: "mgr-approvals",
    title: "Approve access like a gatekeeper, not a rubber stamp",
    summary: "Your Approvals queue is how least-privilege stays real when people change roles.",
    whyItMatters:
      "Access that outlives a role is a classic breach path. Managers who verify ‘need’ keep the company insurable and clean.",
    minutes: 8,
    pillar: "governance",
    audiences: LEADERS,
    badge: "Manager path",
    steps: [
      "Open Approvals and read what was requested — systems, devices, and why.",
      "Ask: does this person need this for their current role, or is it convenience?",
      "Approve, reject, or request more info — silence stalls someone’s first day.",
      "When someone leaves your team, trigger offboarding / access removal the same day.",
    ],
    actions: [
      { label: "Open Approvals", href: "/portal/approvals" },
      { label: "People & Org", href: "/portal/people" },
    ],
  },
  {
    id: "mgr-offboard",
    title: "Same-day offboarding for your direct reports",
    summary: "Access granted on day one must be removed the day someone leaves — managers start that clock.",
    whyItMatters:
      "Departed-employee accounts are a classic breach and data-theft path — and a common insurance question.",
    minutes: 7,
    pillar: "identity_devices",
    audiences: LEADERS,
    steps: [
      "Notify company IT / DE the moment a departure is confirmed (before the goodbye lunch).",
      "List systems you know they used beyond the obvious (finance tools, shared mailboxes, vendor portals).",
      "Collect company devices and tokens — do not ‘let them finish the week’ on a live account.",
      "Confirm via ticket that mailbox / files ownership transferred to the right person.",
    ],
    actions: [
      { label: "Request offboarding help", href: "/portal/forms" },
      { label: "Open ticket", href: "/portal/tickets" },
    ],
  },
  {
    id: "mgr-escalate",
    title: "When to escalate vs handle in-team",
    summary: "Managers triage: password confusion vs possible compromise vs business outage.",
    whyItMatters:
      "The first hours of an incident decide its cost. Improvising under pressure multiplies damage.",
    minutes: 6,
    pillar: "cyber_defense",
    audiences: LEADERS,
    steps: [
      "Suspected account takeover (weird mail, MFA spam, locked out after phish) → ticket as urgent + call DE if after hours process exists.",
      "One person cannot print → normal ticket.",
      "Whole office offline → escalate immediately; do not reboot the firewall yourself unless directed.",
      "Keep a short timeline of what happened — it becomes the incident narrative.",
    ],
    actions: [{ label: "Urgent ticket", href: "/portal/tickets" }],
  },
  {
    id: "mgr-team-hygiene",
    title: "Set the tone for your department",
    summary: "Culture beats policy PDFs. Managers who model MFA, tickets, and phishing caution raise the floor.",
    whyItMatters:
      "Policies set expectations; managers make them real. Insurers and customers increasingly ask whether staff actually follow the rules.",
    minutes: 5,
    pillar: "governance",
    audiences: LEADERS,
    steps: [
      "Mention ‘report phishing’ in team huddles — normalize the pause.",
      "Do not ask staff to share passwords with you ‘just this once’.",
      "Route software and access needs through Forms / Approvals.",
      "Celebrate people who catch scams — never shame clickers; coach them.",
    ],
    actions: [{ label: "Team access forms", href: "/portal/forms" }],
  },

  // ── Department IT contact ──────────────────────────────────────────────
  {
    id: "dit-bridge",
    title: "You are the bridge between your dept and DE",
    summary: "Dept IT contacts translate business needs into clear requests — and shield staff from chaotic workarounds.",
    whyItMatters:
      "Without a named bridge, technology decisions drift and problems have no escalation path.",
    minutes: 8,
    pillar: "governance",
    audiences: IT_ROLES,
    badge: "Dept IT",
    steps: [
      "Use Live Chat / tickets for coordination — keep a paper trail.",
      "Gather context before escalating (who, when started, what changed).",
      "Know your department’s sanctioned apps and devices.",
      "Push access and device requests through Approvals so company IT sees the full picture.",
    ],
    actions: [
      { label: "Live Chat", href: "/portal/chat" },
      { label: "Approvals", href: "/portal/approvals" },
    ],
  },
  {
    id: "dit-devices",
    title: "Department device & identity hygiene",
    summary: "Enrollment, patching, and joiner/leaver signals for the people you support.",
    whyItMatters:
      "Unmanaged devices are invisible — no security baseline, no remote lock, no proof of protection.",
    minutes: 9,
    pillar: "identity_devices",
    audiences: IT_ROLES,
    steps: [
      "Confirm new hires’ devices are enrolled before day-one email access when possible.",
      "Watch for ‘personal laptop for company mail’ requests — route to company IT policy.",
      "Flag stale accounts in your dept (contractors, interns) for access review.",
      "Use Infrastructure views to spot odd devices that appear under your team.",
    ],
    actions: [
      { label: "Infrastructure", href: "/portal/infrastructure" },
      { label: "People & Org", href: "/portal/people" },
    ],
  },
  {
    id: "dit-first-response",
    title: "First-response playbook (before you page everyone)",
    summary: "Stabilize, contain curiosity, and collect facts — then escalate with a clean handoff.",
    whyItMatters:
      "Tools without responders are alarms nobody hears — but untrained responders can make outages worse.",
    minutes: 8,
    pillar: "cyber_defense",
    audiences: IT_ROLES,
    steps: [
      "For ransomware-like symptoms: disconnect suspect device from network, do not pay, do not wipe yet.",
      "For email compromise: have user stop clicking; ticket for password reset + session revoke.",
      "For outages: note scope (one user / floor / company) and recent changes.",
      "Hand DE a timeline — that is gold during MDR investigation.",
    ],
    actions: [{ label: "Escalate to DE", href: "/portal/chat" }],
  },

  // ── Company IT contact ─────────────────────────────────────────────────
  {
    id: "cit-onboarding",
    title: "Client onboarding: what ‘ready’ really means",
    summary: "From TechSales onboarding themes — access, standards, coordination, and phase acceptance.",
    whyItMatters:
      "Onboarding failures create shadow IT and security gaps that last years. A clean start is cheaper than a cleanup.",
    minutes: 12,
    pillar: "onboarding",
    audiences: COMPANY_IT,
    badge: "Company IT",
    hubDocSlugs: ["onboarding-checklist", "proactive-ecosystem-overview"],
    steps: [
      "Align on legal & authority contacts (who can approve changes).",
      "Deliver Access & Credentials packages securely — never via unprotected email threads.",
      "Approve standards (MFA, device enrollment, backup locations) before users invent workarounds.",
      "Use phase acceptance so ‘go live’ is a decision, not a surprise.",
    ],
    actions: [
      { label: "Contracts & documents", href: "/portal/contracts" },
      { label: "People & Org setup", href: "/portal/people" },
    ],
  },
  {
    id: "cit-ecosystem",
    title: "What your ProActive ecosystem is built to cover",
    summary: "Map Hub ecosystem includes into plain language: identity, cyber defense, backup, network, workplace.",
    whyItMatters:
      "If leaders do not know what is included, they buy duplicates — or assume coverage that is not there.",
    minutes: 10,
    pillar: "ecosystem",
    audiences: COMPANY_IT,
    hubDocSlugs: [
      "proactive-ecosystem-overview",
      "proactive-it-tier-bridge",
      "office-ecosystem-bridge",
      "business-program-bridge",
      "enterprise-tier-bridge",
    ],
    steps: [
      "Identity & devices: MFA, enrollment, endpoint protection, patching.",
      "Cyber defense: email protection, detection & response, awareness training (Office+).",
      "Resilience: endpoint / server / M365 backup coverage by tier.",
      "Network: managed gateway and, at higher tiers, SASE / zero-trust user access.",
      "Open your Contracts library for the tier bridge that matches your program.",
    ],
    actions: [
      { label: "Your services", href: "/portal/services" },
      { label: "Document library", href: "/portal/contracts" },
    ],
  },
  {
    id: "cit-joiner-leaver",
    title: "Company-wide joiner / mover / leaver",
    summary: "Access granted on day one, adjusted when roles change, removed the day someone leaves.",
    whyItMatters:
      "Stale accounts retain access to business systems — the quiet failure mode behind many incidents.",
    minutes: 10,
    pillar: "identity_devices",
    audiences: COMPANY_IT,
    steps: [
      "Standardize intake: HR / manager notifies → Approvals → DE provisioning.",
      "Require MFA before mailbox and VPN for new accounts.",
      "On role change, remove old group access — do not only add new.",
      "Same-day deprovision on termination; verify with a checklist, not memory.",
    ],
    actions: [
      { label: "Access / offboard forms", href: "/portal/forms" },
      { label: "Approvals engine", href: "/portal/approvals" },
    ],
  },
  {
    id: "cit-mdr-story",
    title: "How managed detection watches while you sleep",
    summary: "What ‘24×7 monitoring’ means in practice — alerts, containment authority, and your role during an incident.",
    whyItMatters:
      "Ransomware detonates at 2 a.m. Tools without responders are alarms nobody hears.",
    minutes: 9,
    pillar: "cyber_defense",
    audiences: COMPANY_IT,
    hubDocSlugs: ["sow-security-stack"],
    steps: [
      "Endpoint and identity alerts flow to a security operations capability.",
      "Your job: keep agents installed, keep MFA on, keep an incident contact list current.",
      "During an incident: preserve evidence, follow DE containment guidance, communicate to leadership.",
      "Afterward: capture lessons in your risk register / QBR notes.",
    ],
    actions: [
      { label: "System status", href: "/portal/status" },
      { label: "Open war-room ticket", href: "/portal/tickets" },
    ],
  },
  {
    id: "cit-backup-dr",
    title: "Backup coverage & restore confidence",
    summary: "Know what is backed up, how often, and who authorizes a restore test.",
    whyItMatters:
      "Backups that are never restore-tested are a story you tell yourself. Proof is a successful restore.",
    minutes: 9,
    pillar: "infrastructure",
    audiences: COMPANY_IT,
    hubDocSlugs: ["sow-bdr"],
    steps: [
      "Inventory: endpoints, servers, Microsoft 365 / Google — which tiers include which.",
      "Schedule periodic restore tests with DE (file-level and, where licensed, DR).",
      "Document RPO/RTO expectations leadership actually agreed to.",
      "Treat backup admin credentials as privileged — separate from daily accounts.",
    ],
    actions: [{ label: "Discuss in Business Review", href: "/portal/qbr" }],
  },
  {
    id: "cit-compliance",
    title: "Compliance & cyber-insurance readiness",
    summary: "Answer questionnaires from evidence — not from memory.",
    whyItMatters:
      "Insurance applications and customer questionnaires are lost revenue and denied claims waiting to happen when answers are guesses.",
    minutes: 11,
    pillar: "governance",
    audiences: COMPANY_IT,
    hubDocSlugs: ["sow-compliance-risk-ops", "sow-csra"],
    steps: [
      "Keep a living list of frameworks / carrier questions that apply to you.",
      "Map each question to a control owner (DE vs client vs third party).",
      "Store evidence (policies, MFA screenshots, backup reports) where your team can find it.",
      "Use QBR / roadmap sessions to close gaps before renewal season.",
    ],
    actions: [
      { label: "IT Roadmap", href: "/portal/roadmap" },
      { label: "Business Reviews", href: "/portal/qbr" },
    ],
  },
  {
    id: "cit-privileged",
    title: "Privileged access: fewer keys, louder alarms",
    summary: "Admin rights limited to the few who need them, separated from daily accounts, and logged.",
    whyItMatters:
      "One compromised admin account is a company-wide incident.",
    minutes: 8,
    pillar: "identity_devices",
    audiences: COMPANY_IT,
    steps: [
      "Separate admin accounts from daily email accounts.",
      "No local admin for standard users without a time-bound exception.",
      "Review admin group membership monthly.",
      "Vendor access gets an owner and an end date.",
    ],
    actions: [{ label: "Review People & Org", href: "/portal/people" }],
  },
  {
    id: "cit-roadmap",
    title: "vCIO rhythm: roadmap instead of surprise spend",
    summary: "A rolling technology plan reviewed with leadership on a regular cadence.",
    whyItMatters:
      "Without a roadmap, technology is a cost center that surprises you. With one, it becomes a planned business capability.",
    minutes: 8,
    pillar: "governance",
    audiences: COMPANY_IT,
    hubDocSlugs: ["sow-vcio-strategic"],
    steps: [
      "Keep priorities in the portal Roadmap — not only in email threads.",
      "Tie spend to business goals (growth, risk, compliance), not shiny tools.",
      "Review quarterly; update when the business changes.",
      "Bring open risks and exceptions to the QBR — do not bury them.",
    ],
    actions: [
      { label: "Open Roadmap", href: "/portal/roadmap" },
      { label: "QBR workspace", href: "/portal/qbr" },
    ],
  },

  // ── DE admin ───────────────────────────────────────────────────────────
  {
    id: "dea-curriculum",
    title: "How this Learning Center is wired",
    summary: "Role paths pull from TechSales Hub taxonomy (scorecard pillars + ecosystem includes + document library).",
    whyItMatters:
      "DE admins need one place to verify client education matches what Hub sells and delivers.",
    minutes: 5,
    pillar: "ecosystem",
    audiences: ["de_admin"],
    badge: "DE only",
    steps: [
      "Lessons are curated in-portal from Hub capability language (vendor names scrubbed).",
      "Company document cards hydrate from TechSales `/webhooks/portal/company-documents` when sync is configured.",
      "Staff / Manager / Dept IT / Company IT each get a different mission and lesson set.",
      "Extend by editing `server/portalLearningCatalog.ts` — keep scorecard tone.",
    ],
    actions: [
      { label: "Login door alerts", href: "/portal/admin/login-knocks" },
      { label: "Lifecycle APIs", href: "/portal/admin/lifecycle" },
    ],
  },
];

export const LEARNING_PATHS: LearningPath[] = [
  {
    id: "path-staff",
    title: "Everyday operator",
    tagline: "Stay safe, get help fast, keep work moving.",
    audience: "staff",
    mission:
      "You are the sensor network. Learn the habits that stop phishing, protect MFA, and get issues fixed without chaos.",
    lessonIds: [
      "day-get-help",
      "day-mfa",
      "day-phishing",
      "day-device-habits",
      "day-remote",
      "day-files-backup",
    ],
  },
  {
    id: "path-manager",
    title: "People leader",
    tagline: "Approve wisely. Offboard fast. Escalate cleanly.",
    audience: "manager",
    mission:
      "Your Approvals and offboarding decisions are security controls. Lead the culture your policies describe.",
    lessonIds: [
      "day-get-help",
      "day-mfa",
      "day-phishing",
      "mgr-approvals",
      "mgr-offboard",
      "mgr-escalate",
      "mgr-team-hygiene",
      "day-files-backup",
    ],
  },
  {
    id: "path-dept-it",
    title: "Department IT contact",
    tagline: "Bridge the gap. Stabilize first. Escalate with facts.",
    audience: "dept_it_contact",
    mission:
      "You translate department needs into clean DE requests — and you are the first calm voice when something feels wrong.",
    lessonIds: [
      "day-get-help",
      "day-mfa",
      "day-phishing",
      "dit-bridge",
      "dit-devices",
      "dit-first-response",
      "mgr-approvals",
      "mgr-offboard",
      "day-remote",
    ],
  },
  {
    id: "path-company-it",
    title: "Company IT contact",
    tagline: "Own the program. Prove the posture. Run the rhythm.",
    audience: "company_it_contact",
    mission:
      "You are accountable for how the ProActive ecosystem shows up: identity, detection, backup, compliance evidence, and the roadmap.",
    lessonIds: [
      "cit-onboarding",
      "cit-ecosystem",
      "cit-joiner-leaver",
      "cit-mdr-story",
      "cit-backup-dr",
      "cit-compliance",
      "cit-privileged",
      "cit-roadmap",
      "day-phishing",
      "mgr-approvals",
    ],
  },
  {
    id: "path-de-admin",
    title: "DE administrator",
    tagline: "See every path. Verify Hub alignment. Coach the client.",
    audience: "de_admin",
    mission:
      "Full curriculum visibility plus the wiring notes — so you can coach each client role into the right lessons.",
    lessonIds: LEARNING_LESSONS.map((l) => l.id),
  },
];

export const PILLAR_META: Record<
  LearningPillar,
  { label: string; blurb: string }
> = {
  everyday: {
    label: "Everyday mastery",
    blurb: "Habits that keep you productive and hard to phish.",
  },
  governance: {
    label: "Governance",
    blurb: "Ownership, approvals, policy, and business rhythm — from the Hub Governance pillar.",
  },
  identity_devices: {
    label: "Identity & devices",
    blurb: "Access, MFA, enrollment, and endpoint health — Hub Identity & Devices pillar.",
  },
  cyber_defense: {
    label: "Cyber defense",
    blurb: "Phishing, email, detection & response — Hub Cyber Defense pillar.",
  },
  infrastructure: {
    label: "Infrastructure & resilience",
    blurb: "Remote access, backup, and recovery — Hub Infrastructure pillar.",
  },
  onboarding: {
    label: "Onboarding",
    blurb: "TechSales client onboarding checklist themes — ready means standards accepted.",
  },
  ecosystem: {
    label: "ProActive ecosystem",
    blurb: "What your program includes across security, workplace, network, and continuity.",
  },
};

export function resolveLearningAudience(user: {
  role?: string | null;
  orgRole?: string | null;
  isCompanyItContact?: boolean | null;
}): LearningAudience {
  if (user.role === "admin") return "de_admin";
  if (user.isCompanyItContact) return "company_it_contact";
  const r = (user.orgRole || "staff") as string;
  if (r === "company_it_contact" || r === "dept_it_contact" || r === "manager" || r === "staff") {
    return r;
  }
  return "staff";
}

export function buildLearningPayload(audience: LearningAudience) {
  const path = LEARNING_PATHS.find((p) => p.audience === audience) || LEARNING_PATHS[0];
  const lessonMap = new Map(LEARNING_LESSONS.map((l) => [l.id, l]));
  const lessons = path.lessonIds
    .map((id) => lessonMap.get(id))
    .filter((l): l is LearningLesson => !!l)
    .filter((l) => l.audiences.includes(audience) || audience === "de_admin");

  const pillars = Array.from(new Set(lessons.map((l) => l.pillar))).map((key) => ({
    key,
    ...PILLAR_META[key],
    lessonCount: lessons.filter((l) => l.pillar === key).length,
  }));

  return {
    audience,
    path,
    lessons,
    pillars,
    roleLabel: ROLE_LABELS[audience],
    allPaths:
      audience === "de_admin"
        ? LEARNING_PATHS.map((p) => ({
            id: p.id,
            title: p.title,
            tagline: p.tagline,
            audience: p.audience,
            lessonCount: p.lessonIds.length,
          }))
        : undefined,
  };
}

export const ROLE_LABELS: Record<LearningAudience, string> = {
  staff: "Team member",
  manager: "Manager",
  dept_it_contact: "Department IT contact",
  company_it_contact: "Company IT contact",
  de_admin: "DE administrator",
};

/** Hub library docs that are educational (not pure legal). */
export {
  learningResourceTitle,
  naiveLearningResourceTitle,
  presentLearningResourceTitle,
} from "@shared/learningResourceTitle";

export const LEARNING_HUB_DOC_SLUGS = new Set([
  "onboarding-checklist",
  "proactive-ecosystem-overview",
  "proactive-it-tier-bridge",
  "office-ecosystem-bridge",
  "business-program-bridge",
  "enterprise-tier-bridge",
  "service-architecture",
  "sow-security-stack",
  "sow-bdr",
  "sow-core-it",
  "sow-workplace",
  "sow-vcio-strategic",
  "sow-compliance-risk-ops",
  "sow-network",
  "sow-ucaas-voip",
]);
