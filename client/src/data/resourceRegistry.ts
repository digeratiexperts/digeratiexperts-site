import registryJson from "./resourceRegistry.v2.json";

export type ResourceType = "report" | "checklist" | "datasheet";

export interface ResourceItem {
  type: ResourceType;
  title: string;
  slug: string;
  file: string;
  cover: string;
  route: string;
  cta: string;
  status: "ready-draft" | "pending";
}

export interface BlogItem {
  title: string;
  slug: string;
  excerpt: string;
  author: string;
  date: string;
  coverImage: string;
  category: string;
  seoTitle: string;
  seoDescription: string;
}

interface RegistryShape {
  version: string;
  brand: string;
  created: string;
  note: string;
  resources: ResourceItem[];
  blogs: BlogItem[];
  pending: {
    caseStudies: string;
    optionalFutureAssets: string[];
  };
  fallbackCtas: {
    missingDownload: string;
    missingCaseStudy: string;
    missingResource: string;
  };
}

export const registry = registryJson as RegistryShape;

export const resources: ResourceItem[] = registry.resources;
export const blogs: BlogItem[] = registry.blogs;
export const fallbackCtas = registry.fallbackCtas;

export const resourcesByType = (type: ResourceType): ResourceItem[] =>
  resources.filter((r) => r.type === type);

export const resourceBySlug = (slug: string): ResourceItem | undefined =>
  resources.find((r) => r.slug === slug);

export const RESOURCE_TYPE_LABEL: Record<ResourceType, string> = {
  datasheet: "Datasheet",
  checklist: "Checklist",
  report: "Report",
};

export const blogBySlug = (slug: string): BlogItem | undefined =>
  blogs.find((b) => b.slug === slug);

export const optionalFutureAssets: string[] = registry.pending.optionalFutureAssets;
export const caseStudiesNotice: string = registry.pending.caseStudies;

// Per-resource landing copy. Grounded in the canonical service architecture
// (no fabricated outcomes, vendor names, or customer claims).
export interface ResourceLandingMeta {
  tagline: string;
  forWho: string;
  inside: string[];
  positioning?: string;
}

export const resourceLandingMeta: Record<string, ResourceLandingMeta> = {
  "cyber-risk-assessment-sample": {
    tagline:
      "A leadership-ready preview of how Digerati Experts translates technical findings into business risk, priorities, and a 30/60/90 remediation roadmap.",
    forWho:
      "Owners, operations leads, and IT decision-makers who want to see what a useful Cyber Risk Assessment actually looks like before scheduling one.",
    inside: [
      "Executive risk summary written for non-technical leadership",
      "Prioritized findings across identity, endpoints, email, backups, and access",
      "Sample 30/60/90-day remediation roadmap",
      "Recommendation framework: standalone fix vs. broader ProActive Ecosystem coverage",
    ],
    positioning:
      "Pair this sample with a real assessment of your environment to see what changes for your business.",
  },
  "compliance-risk-reports-overview": {
    tagline:
      "How Digerati Experts produces evidence-supporting compliance and risk reporting — without overstating what an MSP can sign off on.",
    forWho:
      "Businesses preparing for an audit, a cyber insurance review, or a board-level conversation about compliance posture.",
    inside: [
      "What our reports include: framework mapping, evidence support, audit readiness, and risk reporting",
      "How findings are scoped, prioritized, and tracked over time",
      "What we explicitly do not provide (legal compliance signoff)",
      "Where Compliance & Risk Reports fit inside the ProActive Business and Enterprise Ecosystems",
    ],
    positioning:
      "Available as a standalone service or included at increasing depth from ProActive Business through ProActive Enterprise.",
  },
  "sample-quarterly-business-review": {
    tagline:
      "A worked example of a Digerati Experts QBR — the recurring leadership conversation behind every ProActive Ecosystem engagement.",
    forWho:
      "Leaders who want predictable visibility into technology health, security posture, support trends, and what’s coming next quarter.",
    inside: [
      "Technology health, security posture, and support trend snapshots",
      "Project status, budget alignment, and lifecycle planning",
      "Risk themes and recommended next-quarter priorities",
      "Sample cadence by ecosystem level (annual, semi-annual, quarterly)",
    ],
    positioning:
      "Review cadence: 1×/yr in Office, technology + security reviews 2×/yr in Business, quarterly in Enterprise.",
  },
  "security-readiness-checklist": {
    tagline:
      "A practical, leadership-readable checklist for the security controls every small or growing business should have in place — and the questions to ask if you don’t.",
    forWho:
      "Owners and operators who want a clear, jargon-free way to gauge where their environment stands today.",
    inside: [
      "Identity, MFA, and admin access basics",
      "Endpoint protection, patching, and inventory",
      "Email protection and user awareness",
      "Backup readiness and offboarding hygiene",
      "Reporting, ownership, and review cadence",
    ],
  },
  "backup-bcdr-checklist": {
    tagline:
      "What real backup and business continuity readiness looks like — beyond just having backups configured.",
    forWho:
      "Businesses that need to confirm whether a real outage, ransomware event, or accidental deletion would actually be recoverable.",
    inside: [
      "Endpoint, server, and cloud workload coverage",
      "Recovery objectives (RPO/RTO) translated for non-technical leadership",
      "Restore validation and tabletop testing",
      "BCDR vs. backup vs. file sync — what each one actually protects",
      "Where this fits across the ProActive Office, Business, and Enterprise Ecosystems",
    ],
    positioning:
      "Endpoint backup is included from ProActive Office. Full BCDR + cloud storage backup is included from ProActive Business.",
  },
  "proactive-ecosystem-overview": {
    tagline:
      "The umbrella offer: complete managed IT and cybersecurity for growing businesses that want fewer issues, stronger protection, and one accountable technology partner.",
    forWho:
      "Leaders comparing managed IT, security, compliance, and helpdesk options as one operating model rather than a stack of disconnected vendors.",
    inside: [
      "The four ProActive Ecosystem package levels: IT, Office, Business, and Enterprise",
      "What’s included at each level across managed IT, security, backup, and compliance",
      "How standalone services and add-ons (UCaaS, Co-Managed IT) fit alongside the packages",
      "Review cadence and ownership model — what changes as you move up a level",
    ],
    positioning:
      "Use this as the master overview, then drill into the per-level datasheets for specifics.",
  },
  "managed-workplace-overview": {
    tagline:
      "How Digerati Experts manages the modern workplace — devices, identity, lifecycle, and the operational security that keeps people working safely.",
    forWho:
      "Businesses that want device standards, employee lifecycle hygiene, and workplace operations handled as one program — not ad-hoc.",
    inside: [
      "Device standards, deployment, and lifecycle management",
      "Identity, MFA, and access controls across daily tools",
      "Employee onboarding/offboarding security workflows",
      "Company spend-card controls, departmental assignment, and offboarding deactivation",
      "How Managed Workplace scales from limited add-on (IT) to advanced/custom (Enterprise)",
    ],
    positioning:
      "Available as an add-on with ProActive IT, included at Office, enhanced at Business, and advanced/custom at Enterprise.",
  },
  "proactive-it-ecosystem-datasheet": {
    tagline:
      "Entry-level managed IT with the DE Security Foundation included for businesses that want a real partner instead of break/fix support.",
    forWho:
      "Small businesses moving off reactive IT support and looking for predictable coverage on the essentials.",
    inside: [
      "Managed service desk and Microsoft 365 / Google Workspace support",
      "Managed endpoint security, email protection, MFA, and security monitoring baseline",
      "Security awareness and phishing resilience",
      "Basic IT planning and ownership",
      "Optional add-ons: Managed Workplace, BCDR, UCaaS",
    ],
    positioning:
      "Backup is not included at the IT level. Add Managed Workplace, BCDR, or move up to ProActive Office for broader coverage.",
  },
  "proactive-office-ecosystem-datasheet": {
    tagline:
      "The small-office operating package — managed IT, 24/7 managed detection and response, stronger identity, endpoint backup, and a real annual review.",
    forWho:
      "Growing offices that need their network, devices, identity, and backup managed as one package.",
    inside: [
      "Everything in ProActive IT, plus full Managed Workplace",
      "Stronger endpoint security, email protection, and identity controls",
      "Security awareness training, phishing simulation, and 24/7 managed detection and response",
      "Managed network and connectivity",
      "Endpoint backup included; BCDR available as add-on",
      "1× combined technology + cybersecurity review per year",
    ],
    positioning:
      "The right starting point for offices that need 24/7 managed threat response but not yet the deeper BCDR, compliance, and governance scope of ProActive Business.",
  },
  "proactive-business-ecosystem-datasheet": {
    tagline:
      "Security-first managed IT for businesses where downtime, data loss, or a security incident would actually hurt.",
    forWho:
      "Established businesses that need enhanced security, real backup and business continuity, and recurring leadership reviews.",
    inside: [
      "Everything in ProActive Office, with enhanced endpoint, email, and identity controls",
      "Threat detection & response / SOC included",
      "Endpoint backup, BCDR, and user cloud storage backup included",
      "Security Awareness Training included",
      "Compliance & Risk Reports (basic) included",
      "Budgeting + technology and security business reviews 2×/yr",
    ],
    positioning:
      "The most common fit for established small-and-mid-sized businesses building a real security posture.",
  },
  "proactive-enterprise-ecosystem-datasheet": {
    tagline:
      "Governance, compliance, and mature security operations for businesses that need evidence-supporting reporting and quarterly leadership cadence.",
    forWho:
      "Multi-site or regulated businesses where identity governance, full security posture, and audit readiness are non-negotiable.",
    inside: [
      "Everything in ProActive Business, scaled to advanced/custom controls",
      "Identity governance and full Unified Security Posture",
      "Advanced threat detection, multi-site managed network, and advanced backup/BCDR",
      "Evidence-supporting Compliance & Risk Reports",
      "Quarterly technology and security business reviews",
    ],
    positioning:
      "The right level when leadership needs continuous visibility, audit evidence, and a mature security operating model.",
  },
  "co-managed-it-datasheet": {
    tagline:
      "Co-Managed IT is a separate path for businesses with internal IT — not a ProActive package level. We extend your team without replacing them.",
    forWho:
      "Businesses with existing internal IT capacity that want pre-provisioned devices, specific managed services, or surge support — without giving up ownership.",
    inside: [
      "Model A — Pre-provisioned devices: we ship configured devices for your internal IT to deploy",
      "Model B — Service-provider support: we deliver specific services without replacing your team",
      "How Co-Managed IT differs from a full ProActive Ecosystem engagement",
      "How to scope, contract, and operate alongside an internal IT lead",
    ],
    positioning:
      "Not part of the ProActive Ecosystem package levels. Sold and scoped separately.",
  },
  "ucaas-voice-meetings-datasheet": {
    tagline:
      "Voice and meetings infrastructure built for business operations — available standalone or as an add-on when building a ProActive Ecosystem.",
    forWho:
      "Businesses replacing legacy phone systems or unifying voice, meetings, and messaging on modern infrastructure.",
    inside: [
      "Business voice, meetings, and messaging on one platform",
      "Number porting, call routing, and reliability considerations",
      "Security, MFA, and admin controls for voice infrastructure",
      "How UCaaS attaches to ProActive IT, Office, Business, or Enterprise as an add-on",
    ],
    positioning:
      "UCaaS is an infrastructure add-on. It is not included by default in any ProActive Ecosystem level.",
  },
};

export const landingMetaBySlug = (slug: string): ResourceLandingMeta | undefined =>
  resourceLandingMeta[slug];

// Inline blog body content. Source files: content/blog/*.md
// Kept as React-ready paragraph/heading arrays so we don't pull in a markdown dep.
export type BlogBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "ul"; items: string[] }
  | {
      kind: "callout";
      tone?: "insight" | "warning" | "note" | "tip";
      title?: string;
      text: string;
    }
  | { kind: "quote"; text: string; cite?: string };

export interface BlogBody {
  // Legacy single-version shape (still used by most posts).
  readTime: string;
  blocks?: BlogBlock[];

  // Dual-version shape: when present, the post renders an
  // Overview / Extended Deep Dive toggle on the same URL.
  overviewReadTime?: string;
  extendedReadTime?: string;
  overviewBlocks?: BlogBlock[];
  extendedBlocks?: BlogBlock[];

  // Optional custom bottom CTA. Falls back to the standard
  // "Schedule a Cyber Risk Assessment" card when omitted.
  bottomCta?: {
    headline: string;
    body: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel?: string;
    secondaryHref?: string;
  };
}

export const blogBodies: Record<string, BlogBody> = {
  "what-a-cyber-risk-assessment-finds-before-attackers-do": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Most businesses do not discover their cybersecurity gaps during a planning meeting. They discover them during an outage, a phishing incident, a ransomware event, a failed cyber insurance review, or a stressful vendor questionnaire." },
      { kind: "p", text: "A Cyber Risk Assessment is designed to find those issues before attackers, auditors, insurance carriers, or angry clients do." },
      { kind: "p", text: "For Digerati Experts, the assessment is not a scare tactic and it is not a generic checklist. It is the starting point for understanding how your business actually uses technology: who has access, what devices are unmanaged, where sensitive data lives, how email is protected, whether backups can be restored, and whether security alerts are being reviewed." },
      { kind: "p", text: "The assessment helps answer practical questions:" },
      { kind: "ul", items: ["Are former employees fully removed from company systems?","Is multi-factor authentication actually enforced everywhere it should be?","Are admin accounts separated from normal user accounts?","Are laptops, desktops, and servers protected and visible?","Are email domains protected against spoofing?","Are cloud files overshared?","Are backups isolated and tested?","Are security alerts going somewhere meaningful?","Does leadership know what would happen during a ransomware event?"] },
      { kind: "p", text: "The goal is not to overwhelm the business. The goal is to prioritize." },
      { kind: "p", text: "A small business does not need every enterprise security tool on day one. It needs to know which risks are most likely to hurt operations, clients, revenue, insurance, compliance, and recovery. From there, Digerati Experts can recommend the right path: ProActive Ecosystem, Standalone Services, Co-Managed IT, or a focused remediation project." },
      { kind: "p", text: "A Cyber Risk Assessment gives the business a clearer view of risk before money is spent on random tools. It turns uncertainty into a roadmap." },
    ],
    extendedBlocks: [
      { kind: "p", text: "A Cyber Risk Assessment is the difference between guessing and managing risk." },
      { kind: "p", text: "Many Arizona businesses have pieces of cybersecurity in place. They may have antivirus, Microsoft 365 or Google Workspace, a firewall, backups, a password policy, and maybe some cyber insurance. The problem is that individual pieces do not automatically create a security program. Gaps usually appear between the tools." },
      { kind: "p", text: "A user may have MFA on email but not on remote access. Backups may exist but have never been restored. A firewall may be installed but not monitored. Former employees may still have access to cloud applications. An accounting folder may be shared too broadly. Admin accounts may be used for daily work. Security alerts may be sent to someone who does not have time to review them." },
      { kind: "p", text: "A Cyber Risk Assessment looks at the whole operating picture." },
      { kind: "p", text: "For Digerati Experts, the assessment is built around the idea that cybersecurity is not one product. It is a layered operating model that includes identity, devices, email, network access, data protection, backups, monitoring, documentation, response, and leadership decisions." },
      { kind: "p", text: "The first area is identity and access. This includes MFA, password standards, admin rights, onboarding, offboarding, shared accounts, and whether users only have the access they need. Identity is critical because many incidents start with valid credentials. If an attacker logs in as a real user, the business needs controls that limit what can happen next." },
      { kind: "p", text: "The second area is endpoint and device security. The assessment looks for unmanaged machines, missing protection, patching gaps, local admin exposure, stale devices, and visibility issues. A business cannot protect what it cannot see." },
      { kind: "p", text: "The third area is email security. Email is often where phishing, credential theft, invoice fraud, and malware delivery begin. A proper assessment reviews filtering, spoofing protections, user reporting, domain authentication, and whether employees know how to escalate suspicious messages." },
      { kind: "p", text: "The fourth area is network and secure access. This includes firewalls, remote access, segmentation, guest networks, multi-site connectivity, and whether one compromised device could reach too much of the environment." },
      { kind: "p", text: "The fifth area is backup and recovery. This is where many businesses are overconfident. The assessment should ask whether backups are running, whether they are protected from ransomware, whether restore testing happens, and which systems must come back first after a disruption." },
      { kind: "p", text: "The sixth area is security operations and response. Tools only help if someone reviews alerts, documents issues, escalates incidents, and knows who makes decisions in an emergency. The assessment should identify whether the business has an incident response plan, vendor contacts, communication procedures, and recovery priorities." },
      { kind: "p", text: "The seventh area is compliance and business risk. Digerati Experts does not claim that an assessment makes a company compliant. Instead, the assessment helps identify technical controls and documentation gaps that may affect cyber insurance, client requirements, HIPAA, NIST, CMMC, or other obligations depending on the business." },
      { kind: "p", text: "The result should be clear, practical, and prioritized. A good assessment should not leave the business with a giant list of problems and no direction. It should separate urgent risks from improvements, nice-to-have items, and future maturity steps." },
      { kind: "p", text: "That is why Digerati Experts uses the Cyber Risk Assessment as the entry point. It helps determine whether the client needs a full ProActive Ecosystem relationship, a Standalone Service, Co-Managed IT support, or a scoped project." },
      { kind: "p", text: "The value is not just the report. The value is the roadmap that follows." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about what a cyber risk assessment finds before attackers do. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Start Cyber Risk Assessment",
      primaryHref: "/book",
      secondaryLabel: "Explore ProActive Ecosystem",
      secondaryHref: "/services/proactive",
    },
  },
  "multilayer-ransomware-defense-arizona-businesses": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Ransomware is not just a malware problem. It is an identity problem, an email problem, a device problem, a network problem, a backup problem, and a response problem." },
      { kind: "p", text: "That is why one security tool is not enough." },
      { kind: "p", text: "A business may have antivirus but weak passwords. It may have MFA but unmanaged laptops. It may have backups but no restore testing. It may have a firewall but no segmentation. It may have security alerts but no one reviewing them. Ransomware succeeds when enough of these gaps line up." },
      { kind: "p", text: "Digerati Experts approaches ransomware defense as a multilayer system:" },
      { kind: "ul", items: ["Cyber Risk Assessment to identify gaps before an incident","Identity and access controls to limit stolen credential damage","Email security to reduce phishing and impersonation risk","Endpoint protection to detect and isolate device-level threats","Network security and secure access to reduce lateral movement","Data protection to limit unnecessary exposure","Backup and recovery planning to restore operations","Monitoring and escalation to respond faster","Security awareness to help employees report suspicious activity","Documentation and compliance reporting to support decisions"] },
      { kind: "p", text: "The goal is not to promise that an attack can never happen. The goal is to reduce the likelihood, reduce the blast radius, detect issues earlier, and recover more effectively." },
      { kind: "p", text: "For Arizona SMBs, the practical question is not “Do we have ransomware protection?” The better question is:" },
      { kind: "p", text: "Can a single compromised account or device take down the whole business?" },
      { kind: "p", text: "If the answer is unknown, start with an assessment. From there, Digerati Experts can help build a defense model that fits the business instead of forcing a generic security package." },
    ],
    extendedBlocks: [
      { kind: "p", text: "Ransomware defense fails when businesses treat it like a software purchase." },
      { kind: "p", text: "Modern ransomware incidents often involve multiple steps. Attackers may use phishing to steal credentials, log into email or remote access, move through the network, disable security tools, find valuable data, attempt to delete backups, and then encrypt systems. Some attackers also steal data before encryption, creating pressure through operational downtime and possible exposure." },
      { kind: "p", text: "That means ransomware defense has to be layered." },
      { kind: "p", text: "The first layer is assessment. A Cyber Risk Assessment gives the business a realistic picture of current exposure. It helps identify weak identity controls, unmanaged endpoints, missing email protections, backup risk, remote access issues, and gaps in response planning. Without assessment, the business may spend money on tools while leaving the largest risks untouched." },
      { kind: "p", text: "The second layer is identity and access. If an attacker steals a password, MFA, conditional access, device trust, least privilege, and clean offboarding can reduce what that attacker can do. Admin accounts should be limited and separated from daily user activity. Former employee access should be removed quickly. Shared accounts should be eliminated wherever practical." },
      { kind: "p", text: "The third layer is email security. Many attacks begin with a message that looks routine: an invoice, document share, password reset, vendor update, or executive request. Email protection should include phishing filtering, link and attachment controls, impersonation detection, domain authentication, and a simple reporting process for users." },
      { kind: "p", text: "The fourth layer is endpoint protection and device management. Every laptop, desktop, and server is a possible entry point. Protection should include threat detection, patching, device inventory, local admin control, encryption where appropriate, and the ability to isolate a device when something goes wrong." },
      { kind: "p", text: "The fifth layer is network and secure access. Ransomware becomes more damaging when attackers can move freely. Proper segmentation, firewall configuration, secure remote access, and Zero Trust principles help reduce blast radius. Guest networks, server networks, user networks, and sensitive systems should not all behave like one flat environment." },
      { kind: "p", text: "The sixth layer is data protection. Businesses need to know where sensitive data lives, who can access it, and how it is shared. Client files, HR data, financial records, contracts, and regulated information should not be scattered across personal devices and open folders." },
      { kind: "p", text: "The seventh layer is backup and recovery. Backups are not enough unless they are monitored, isolated, and tested. The business should know what is backed up, how often, how quickly it can be restored, and which systems matter first. Endpoint backup, cloud backup, server backup, BCDR, and immutable backup options should be considered based on risk." },
      { kind: "p", text: "The eighth layer is monitoring and response. Alerts need owners. Incidents need escalation paths. Leadership needs a decision process. Employees need to know what to report. Vendors and insurance contacts should be documented before an emergency." },
      { kind: "p", text: "The ninth layer is security awareness. Employees are not the enemy. They are part of the detection system when they are trained, supported, and given clear reporting paths." },
      { kind: "p", text: "This is where Digerati Experts differs from reactive IT support. The goal is not to fix the computer after damage is done. The goal is to build an operating model where cybersecurity, IT management, user support, recovery, and business risk are connected." },
      { kind: "p", text: "Ransomware defense should not begin after the ransom note appears. It should begin with a Cyber Risk Assessment and a roadmap for closing the gaps that matter most." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about how arizona businesses should build a multilayer ransomware defense. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Start Cyber Risk Assessment",
      primaryHref: "/book",
      secondaryLabel: "Explore Backup & Recovery Readiness",
      secondaryHref: "/services/standalone",
    },
  },
  "can-ransomware-encrypt-your-backups": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Yes, ransomware can affect backups if they are reachable, poorly protected, improperly configured, or never tested." },
      { kind: "p", text: "That is the part many businesses miss." },
      { kind: "p", text: "A backup is not automatically a recovery plan. A business may have files syncing to the cloud, a local drive, a server backup, or a backup application and still be unable to recover quickly after ransomware." },
      { kind: "p", text: "The risk depends on how backups are designed:" },
      { kind: "ul", items: ["Are backups isolated from normal user access?","Can an attacker delete or encrypt them?","Are cloud files just syncing encrypted changes?","Are backup jobs monitored for failure?","Has anyone tested a restore recently?","Are critical systems included?","Is there a recovery order?","Is there a recovery time goal?"] },
      { kind: "p", text: "The real question is not “Do we have backups?” The better question is:" },
      { kind: "p", text: "Can we restore operations fast enough to keep the business running?" },
      { kind: "p", text: "Digerati Experts treats backup as part of business continuity, not just storage. Depending on the business, the right approach may include endpoint backup, cloud data backup, server backup, business continuity and disaster recovery, offsite copies, immutable options, and regular restore testing." },
      { kind: "p", text: "Backups are the last line of defense, but they only work when designed before the attack." },
    ],
    extendedBlocks: [
      { kind: "p", text: "Backups are one of the most misunderstood parts of ransomware defense." },
      { kind: "p", text: "Many businesses believe they are safe because someone once installed backup software. Others believe that cloud storage is the same thing as backup. Some assume that if files exist in Microsoft 365, Google Workspace, a shared drive, or a sync folder, recovery will be simple." },
      { kind: "p", text: "That assumption can be dangerous." },
      { kind: "p", text: "Ransomware can affect backups in several ways. If backups are stored on the same network and accessible with the same credentials, an attacker may attempt to delete or encrypt them. If files are synchronized to the cloud, encrypted versions may synchronize too. If backup jobs have been failing silently, the business may not discover the problem until recovery is needed. If no one has tested restores, the business may find that data exists but cannot be restored quickly enough." },
      { kind: "p", text: "That is why Digerati Experts separates “having backups” from “being recoverable.”" },
      { kind: "p", text: "A recoverable business knows what systems are protected, how often backups run, where copies are stored, who can access them, how restores are tested, and what order systems should come back in. It also understands the difference between recovering a few files and restoring an operating business." },
      { kind: "p", text: "The backup layer should be designed around business impact. A company that can tolerate a day of downtime has different needs than a company that must restore critical systems quickly. A simple office file backup may be enough for some data, but not for servers, line-of-business applications, financial systems, or companies that cannot work without their systems." },
      { kind: "p", text: "A stronger backup and recovery strategy may include several layers." },
      { kind: "p", text: "Endpoint backup protects laptops and desktops where users create and store work. Cloud backup protects email, file storage, and collaboration systems. Server backup protects shared infrastructure and applications. Business continuity and disaster recovery planning addresses how the business keeps operating after an outage. Immutable or isolated backups help reduce the chance that attackers can alter or destroy recovery points." },
      { kind: "p", text: "Testing is essential. A backup that has never been restored is an assumption. A tested restore gives the business confidence and exposes problems before the emergency." },
      { kind: "p", text: "Recovery planning should also define priorities. During an incident, not everything can come back at once. Leadership needs to know which systems matter first: email, accounting, phones, client records, production systems, file shares, or remote access. Those decisions should be made before pressure is high." },
      { kind: "p", text: "Digerati Experts evaluates backup as part of the broader Cyber Risk Assessment because backup risk is connected to identity, network, endpoint, and response risk. If admin credentials are weak, backups may be exposed. If the network is flat, backup systems may be easier to reach. If endpoints are unmanaged, ransomware may spread faster. If no response plan exists, even good backups may not prevent confusion." },
      { kind: "p", text: "The goal is not backup for backup’s sake. The goal is business recovery." },
      { kind: "p", text: "When evaluating your current backup strategy, ask: Can attackers reach the backups? Are restores tested? How much data could we lose? How long would we be down? Who decides what comes back first? What would we tell clients and employees during recovery?" },
      { kind: "p", text: "If those answers are unclear, the business needs a backup and recovery readiness review." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about can ransomware encrypt your backups?. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Review Backup & Recovery Readiness",
      primaryHref: "/services/standalone",
      secondaryLabel: "Start Cyber Risk Assessment",
      secondaryHref: "/book",
    },
  },
  "first-24-hours-after-ransomware-attack": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "The first 24 hours after a ransomware attack are not the time to invent your response plan." },
      { kind: "p", text: "The business needs to contain the damage, preserve evidence, protect backups, communicate clearly, and avoid making rushed decisions that create more risk." },
      { kind: "p", text: "The first steps are usually:" },
      { kind: "ul", items: ["Disconnect affected systems from the network without destroying evidence","Stop using compromised accounts","Preserve screenshots, ransom notes, logs, and timelines","Notify the internal decision team","Contact IT/security support","Protect backup systems from further exposure","Avoid paying or negotiating without legal, insurance, and forensic guidance","Document every action taken","Communicate carefully with employees and stakeholders"] },
      { kind: "p", text: "The biggest mistake is panic-clicking through systems, rebooting everything, deleting evidence, or trying random recovery actions before the environment is understood." },
      { kind: "p", text: "A ransomware response should have roles: who decides, who communicates, who talks to insurance, who works with technical teams, who handles legal questions, and who updates employees." },
      { kind: "p", text: "Digerati Experts helps businesses prepare for this before an incident by connecting cybersecurity, backup, documentation, monitoring, and response planning. The goal is to reduce confusion when every hour matters." },
      { kind: "p", text: "If your business does not have a written incident response plan, start before you need one." },
    ],
    extendedBlocks: [
      { kind: "p", text: "A ransomware incident creates pressure immediately. Employees may be locked out, systems may be down, clients may be waiting, and leadership may not know whether data was stolen, encrypted, or both." },
      { kind: "p", text: "The first 24 hours matter because early actions can either limit damage or make recovery harder." },
      { kind: "p", text: "The first priority is containment. If a device appears infected, it should usually be isolated from the network while preserving evidence. That may mean disconnecting network access or disabling Wi-Fi. The business should avoid wiping systems, deleting files, or rebooting everything without guidance because those actions can destroy logs and evidence that may be needed for investigation, insurance, or recovery decisions." },
      { kind: "p", text: "The second priority is account control. If the incident may involve stolen credentials, affected accounts should be disabled or reset through a controlled process. Admin accounts, remote access, email accounts, and service accounts need special attention. If attackers still have valid access, they may continue moving even after one device is isolated." },
      { kind: "p", text: "The third priority is backup protection. Backup systems should be checked and protected from additional exposure. If attackers have access to the environment, they may target backups to increase pressure. Before restoring anything, the business needs to understand whether the recovery source is clean and whether the original entry point is contained." },
      { kind: "p", text: "The fourth priority is documentation. Keep a timeline. Capture ransom notes, filenames, affected systems, error messages, user reports, suspicious emails, login events, and actions taken. This documentation helps technical teams, insurance carriers, legal counsel, and leadership understand what happened." },
      { kind: "p", text: "The fifth priority is communication. Employees need clear instructions: what not to touch, who to report to, whether to disconnect devices, whether to stop using email, and where updates will come from. External communication should be controlled. Clients, vendors, regulators, or insurance carriers may need to be notified depending on the situation, but communication should be accurate and coordinated." },
      { kind: "p", text: "The sixth priority is expert escalation. Depending on severity, the business may need IT/security support, cyber insurance contacts, legal counsel, forensic assistance, law enforcement reporting, and vendor support. Those contacts should be documented before the incident." },
      { kind: "p", text: "The seventh priority is recovery planning. Recovery should not start blindly. The business needs to know what systems are affected, what backups are available, what must be restored first, and whether restored systems will be re-compromised. In many cases, recovery order matters: identity systems, network controls, servers, email, endpoint devices, and business applications may need to be restored in a controlled sequence." },
      { kind: "p", text: "A business that has not prepared may spend the first day asking basic questions: Who owns DNS? Who has admin rights? Where are backups? Who has the cyber insurance policy? Which systems matter most? Who can approve emergency spending? Who should talk to clients?" },
      { kind: "p", text: "That confusion is preventable." },
      { kind: "p", text: "Digerati Experts approaches incident readiness as part of cybersecurity-first managed IT. A Cyber Risk Assessment can identify whether the business has the right controls, documentation, backup strategy, response contacts, monitoring, and recovery procedures before an incident happens." },
      { kind: "p", text: "The first 24 hours after ransomware should be about executing a plan, not inventing one." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about what to do in the first 24 hours after a ransomware attack. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Create an Incident Response Plan",
      primaryHref: "/services/standalone",
      secondaryLabel: "Start Cyber Risk Assessment",
      secondaryHref: "/book",
    },
  },
  "why-mfa-alone-does-not-stop-ransomware": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Multi-factor authentication is one of the most important security controls a business can enable. But MFA alone does not stop ransomware." },
      { kind: "p", text: "MFA helps reduce the risk of stolen passwords being used successfully. That matters. But attackers can still exploit unmanaged devices, weak admin practices, phishing fatigue, stolen session tokens, exposed remote access, excessive permissions, and poor offboarding." },
      { kind: "p", text: "The better goal is identity-first security." },
      { kind: "p", text: "That means:" },
      { kind: "ul", items: ["MFA is enforced consistently","Admin accounts are separate from normal user accounts","Former employees are removed quickly","Users only have the access they need","Devices must be trusted before accessing sensitive systems","Risky sign-ins are reviewed","Remote access is controlled","Shared accounts are reduced or eliminated","Access is documented and reviewed"] },
      { kind: "p", text: "Ransomware often spreads because a compromised user can reach too much. MFA helps at the front door, but the business also needs controls inside the building." },
      { kind: "p", text: "Digerati Experts treats MFA as one layer inside a broader identity and access model. The question is not only “Do users have MFA?” It is “What happens if one account is compromised?”" },
      { kind: "p", text: "If one stolen account can reach email, files, admin tools, backups, and remote access, MFA is not enough." },
    ],
    extendedBlocks: [
      { kind: "p", text: "MFA is essential, but it is often misunderstood." },
      { kind: "p", text: "Many businesses enable MFA and believe the job is done. That is a good start, but ransomware defense requires more than an extra login prompt. MFA reduces the risk of password-only compromise, but it does not solve device security, permissions, admin rights, cloud file sharing, backup exposure, phishing behavior, remote access design, or monitoring." },
      { kind: "p", text: "Attackers adapt to controls. They may target users with repeated approval prompts, trick users into approving access, steal session tokens, compromise devices that are already trusted, exploit applications that do not require MFA, or find old accounts that were never removed. They may also bypass identity entirely by exploiting an exposed system, vulnerable software, or unmanaged endpoint." },
      { kind: "p", text: "That is why Digerati Experts focuses on identity and access as a full layer." },
      { kind: "p", text: "A strong identity program starts with consistent MFA across important systems. Email, remote access, admin portals, cloud apps, and sensitive business platforms should not be protected unevenly. If MFA is enabled for some users but not all, attackers will look for the weakest account." },
      { kind: "p", text: "Next comes least privilege. Users should not have access to everything by default. Access should match job responsibilities. Accounting does not need the same access as operations, sales, HR, or ownership. Admin rights should be restricted, documented, and separated from normal daily work." },
      { kind: "p", text: "Offboarding matters. Former employees, vendors, contractors, and temporary users should be removed quickly and completely. A stale account can become an easy entry point. Offboarding should include email, cloud apps, remote access, shared passwords, devices, phone systems, file access, and business applications." },
      { kind: "p", text: "Device trust also matters. A login from a protected company laptop is not the same risk as a login from an unknown personal device. Businesses should consider whether sensitive systems can only be accessed from approved devices, approved locations, or approved risk conditions." },
      { kind: "p", text: "Monitoring is another important piece. MFA logs, risky sign-ins, impossible travel events, repeated failed attempts, new device registrations, and admin changes can all provide early warning. But logs only help if someone reviews or escalates them." },
      { kind: "p", text: "The business should also consider what a compromised user can reach. If one employee account can access shared drives, finance records, client files, remote access, and backup systems, the blast radius is too large. Ransomware defense improves when access is segmented and sensitive systems require stronger controls." },
      { kind: "p", text: "MFA is still one of the first recommendations for most businesses. It is practical, high-value, and widely expected by insurers, clients, and security frameworks. But it should be implemented as part of a broader identity strategy." },
      { kind: "p", text: "Digerati Experts helps Arizona businesses evaluate MFA, admin access, device trust, user lifecycle management, remote access, and permissions during a Cyber Risk Assessment. The purpose is not to shame the business for missing controls. The purpose is to build an identity foundation that supports the rest of the security program." },
      { kind: "p", text: "The right question is not “Do we have MFA?”" },
      { kind: "p", text: "The better question is “If one user is compromised, how far can the attacker go?”" },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about why mfa alone does not stop ransomware. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Assess Identity & Access Risk",
      primaryHref: "/services/standalone",
      secondaryLabel: "Explore Managed Workplace",
      secondaryHref: "/services/standalone",
    },
  },
  "email-security-more-than-spam-filtering": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Spam filtering is not the same thing as email security." },
      { kind: "p", text: "Spam is annoying. Phishing is dangerous. Impersonation can be expensive. Credential theft can open the door to ransomware, invoice fraud, data exposure, and account takeover." },
      { kind: "p", text: "A strong email security layer should address:" },
      { kind: "ul", items: ["Phishing links","Malicious attachments","Business email compromise","Impersonation attempts","Fake vendor and executive messages","Domain spoofing","User reporting","Security awareness training","MFA for mailbox access","SPF, DKIM, and DMARC alignment"] },
      { kind: "p", text: "Email security is both a technical control and a human process. The filter should block as much as practical, but employees also need a clear way to report suspicious messages without fear or confusion." },
      { kind: "p", text: "Digerati Experts looks at email as part of the full security model. Email connects to identity, endpoint protection, data sharing, financial approvals, and incident response." },
      { kind: "p", text: "The question is not “Are we blocking spam?” The better question is:" },
      { kind: "p", text: "Can a fake email trick our users, steal credentials, impersonate our domain, or start a larger incident?" },
      { kind: "p", text: "If the answer is unknown, email security should be part of your Cyber Risk Assessment." },
    ],
    extendedBlocks: [
      { kind: "p", text: "Email is one of the most important systems in a business because it is where communication, files, invoices, approvals, vendor requests, passwords, and client conversations often converge." },
      { kind: "p", text: "That also makes it a major attack path." },
      { kind: "p", text: "A basic spam filter may reduce junk mail, but modern email threats are more targeted. A phishing email may look like a Microsoft login page, a shared document, a vendor invoice, a bank request, a voicemail, a shipping notice, or a message from leadership. Some messages contain malware. Others do not contain malware at all. They simply trick a user into giving up credentials or changing payment instructions." },
      { kind: "p", text: "That is why email security requires layers." },
      { kind: "p", text: "The first layer is mailbox access security. MFA should be enforced for email accounts, especially for leadership, finance, HR, and admin users. If an attacker compromises a mailbox, they may search old conversations, reset passwords, impersonate the user, and attack clients or vendors." },
      { kind: "p", text: "The second layer is filtering and threat detection. Email security should look for suspicious senders, malicious attachments, unsafe links, impersonation, lookalike domains, and abnormal behavior. This reduces the number of dangerous messages that reach users." },
      { kind: "p", text: "The third layer is domain protection. SPF, DKIM, and DMARC help protect the business domain from being used in spoofing and impersonation attacks. They are not magic, but they are important. A business that does not protect its domain may make it easier for attackers to send messages that appear to come from the company." },
      { kind: "p", text: "The fourth layer is user reporting. Employees need a simple way to report suspicious messages. Reporting should be encouraged, not punished. Fast reporting can give IT or security teams time to remove similar messages from other inboxes or reset exposed accounts." },
      { kind: "p", text: "The fifth layer is security awareness. Users should understand common tricks: fake login pages, urgent payment requests, unexpected attachments, QR-code phishing, vendor impersonation, shared document lures, and executive pressure tactics. Training works best when paired with real controls." },
      { kind: "p", text: "The sixth layer is process control. Email security is not only technical. Finance processes should require verification for payment changes. HR should verify sensitive employee requests. Leadership should avoid creating a culture where speed overrides verification." },
      { kind: "p", text: "The seventh layer is response. If a mailbox is compromised, the business should know how to reset credentials, revoke sessions, review forwarding rules, search for malicious messages, notify affected parties, and preserve evidence." },
      { kind: "p", text: "Digerati Experts includes email security in the broader Cyber Risk Assessment because email touches many other layers. Email compromise can lead to endpoint compromise, cloud data exposure, invoice fraud, remote access abuse, and client trust issues." },
      { kind: "p", text: "A business that only asks “Do we have a spam filter?” is asking too little." },
      { kind: "p", text: "The better question is “How would we know if someone used email to enter, impersonate, steal, or spread?”" },
      { kind: "p", text: "Email security should reduce risk before the click, during the login, after the report, and throughout the response." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about email security 101: why phishing protection requires more than spam filtering. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Start Cyber Risk Assessment",
      primaryHref: "/book",
      secondaryLabel: "Review Email Security Readiness",
      secondaryHref: "/services/standalone",
    },
  },
  "arizona-smb-cybersecurity-checklist": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "A cybersecurity checklist is only useful if it helps the business prioritize." },
      { kind: "p", text: "Many checklists are too long, too technical, or too generic. Arizona SMBs need to know what matters first." },
      { kind: "p", text: "Start here:" },
      { kind: "ul", items: ["Enforce MFA on email, admin accounts, and remote access","Remove former employee access quickly","Protect and monitor all business devices","Patch operating systems and key applications","Use stronger email security and domain authentication","Segment networks where practical","Protect sensitive files and cloud sharing","Back up critical data and test restores","Train employees to report suspicious activity","Document vendors, admin access, and recovery contacts","Create an incident response plan","Review cyber insurance requirements before renewal"] },
      { kind: "p", text: "The point is not to buy every tool immediately. The point is to understand which gaps create the most business risk." },
      { kind: "p", text: "Digerati Experts uses a Cyber Risk Assessment to turn this checklist into a roadmap. Some businesses need identity cleanup first. Others need backup redesign, endpoint protection, email security, network changes, documentation, or response planning." },
      { kind: "p", text: "Cybersecurity works best when it is prioritized, layered, and connected to business operations." },
    ],
    extendedBlocks: [
      { kind: "p", text: "A cybersecurity checklist should help a business make better decisions, not create anxiety." },
      { kind: "p", text: "Many Arizona SMBs are stuck between two bad options. On one side, generic advice says “use strong passwords and antivirus.” On the other side, enterprise guidance assumes the business has a full security team, dedicated compliance staff, and a large budget." },
      { kind: "p", text: "Digerati Experts takes a practical middle path: identify the controls that reduce the most risk first, then build maturity over time." },
      { kind: "p", text: "The first checklist item is identity. Enforce MFA on important systems, especially email, remote access, admin portals, and sensitive applications. Review admin accounts. Remove stale users. Eliminate shared accounts where practical. Use least privilege." },
      { kind: "p", text: "The second item is endpoint visibility. Know which devices are used for business. Protect laptops, desktops, and servers. Keep systems patched. Reduce unnecessary local admin rights. Have a way to isolate or respond to suspicious devices." },
      { kind: "p", text: "The third item is email security. Phishing, impersonation, and credential theft remain major business risks. Use stronger filtering, domain authentication, link and attachment controls, mailbox MFA, and user reporting." },
      { kind: "p", text: "The fourth item is network security. Businesses should know how office networks, guest Wi-Fi, remote access, and multi-site connections are configured. Sensitive systems should not be exposed unnecessarily. Flat networks increase risk because one compromised device may reach too much." },
      { kind: "p", text: "The fifth item is data protection. Identify sensitive data: client records, financial files, HR documents, contracts, regulated information, and intellectual property. Review who can access it, how it is shared, and whether personal devices or personal accounts are involved." },
      { kind: "p", text: "The sixth item is backup and recovery. Confirm that critical systems are backed up, backup jobs are monitored, backups are protected from ransomware, and restores are tested. Define recovery priorities before an incident." },
      { kind: "p", text: "The seventh item is monitoring. Security tools create value when someone reviews alerts and takes action. Decide who owns alerts, which alerts matter, and how escalation works." },
      { kind: "p", text: "The eighth item is employee readiness. Train employees to spot suspicious messages, report quickly, and verify unusual requests. Create simple procedures for payment changes, password resets, and sensitive file sharing." },
      { kind: "p", text: "The ninth item is documentation. Document admin access, vendors, licenses, domains, DNS, backup systems, network equipment, critical applications, and emergency contacts. Documentation reduces chaos during outages and provider transitions." },
      { kind: "p", text: "The tenth item is incident response. Define roles, communication paths, insurance contacts, legal contacts if needed, technical escalation, and recovery priorities." },
      { kind: "p", text: "The eleventh item is cyber insurance and compliance readiness. Many insurers and client contracts now expect reasonable controls. The business should understand requirements before renewal or contract deadlines." },
      { kind: "p", text: "The twelfth item is leadership governance. Cybersecurity is not only an IT task. Ownership, budget, risk tolerance, and priorities should be understood by leadership." },
      { kind: "p", text: "Digerati Experts uses this kind of checklist as a starting point, not the final product. A Cyber Risk Assessment helps determine which gaps are urgent and which can be addressed later." },
      { kind: "p", text: "The goal is not to overwhelm the business. The goal is to move from reactive uncertainty to a practical, layered security roadmap." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about the arizona smb cybersecurity checklist: what actually matters before you buy more tools. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Turn This Checklist Into a Risk Roadmap",
      primaryHref: "/book",
      secondaryLabel: "Explore ProActive Ecosystem",
      secondaryHref: "/services/proactive",
    },
  },
  "cyber-insurance-requirements-small-businesses": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Cyber insurance is not a substitute for cybersecurity." },
      { kind: "p", text: "Insurance may help after an incident, but applications and renewals increasingly ask whether the business has basic controls in place. If the answers are unclear, coverage may become harder, more expensive, or less useful during a claim." },
      { kind: "p", text: "Businesses should be ready to answer questions about:" },
      { kind: "ul", items: ["MFA","Endpoint protection","Email security","Backups and restore testing","Security awareness training","Admin access","Remote access","Patch management","Incident response plans","Data protection","Vendor risk","Monitoring and alert response"] },
      { kind: "p", text: "The biggest mistake is treating the insurance application like paperwork instead of a security review. If a business guesses, overstates controls, or cannot prove what is in place, problems may appear later." },
      { kind: "p", text: "Digerati Experts helps businesses prepare by identifying gaps, documenting controls, and building a roadmap before renewal pressure hits." },
      { kind: "p", text: "We do not claim to make a business insurable or compliant. We help implement, document, monitor, and support the technical controls that cyber insurance programs commonly expect." },
      { kind: "p", text: "Start before the renewal deadline." },
    ],
    extendedBlocks: [
      { kind: "p", text: "Cyber insurance has changed." },
      { kind: "p", text: "In the past, some businesses treated cyber insurance like a backup plan: buy a policy, hope nothing happens, and assume the insurer will help if something goes wrong. That mindset is risky." },
      { kind: "p", text: "Insurers now commonly ask more detailed questions about security controls. They may want to know whether MFA is enforced, whether backups are protected, whether endpoint security is deployed, whether employees receive training, whether remote access is secured, whether admin accounts are controlled, and whether the business has an incident response plan." },
      { kind: "p", text: "Those questions matter because they reveal how prepared the business actually is." },
      { kind: "p", text: "A cyber insurance application should not be completed by guessing. If a business says it has a control but the control is incomplete, inconsistent, undocumented, or not working, that may create problems. The issue is not only approval. It is claim readiness. After an incident, documentation may matter." },
      { kind: "p", text: "The first area to prepare is MFA. Businesses should know where MFA is enabled, which systems are covered, whether admin accounts are protected, and whether any exceptions exist." },
      { kind: "p", text: "The second area is endpoint protection. Insurers may ask whether devices are protected, monitored, and updated. The business should know which laptops, desktops, and servers are included." },
      { kind: "p", text: "The third area is backup. The business should be able to explain what is backed up, how often, where backups are stored, whether backups are isolated, and when restores were last tested." },
      { kind: "p", text: "The fourth area is email security and phishing defense. This may include filtering, user training, reporting, and domain protections." },
      { kind: "p", text: "The fifth area is incident response. A written plan, decision contacts, vendor contacts, insurance contact information, and communication procedures can reduce confusion during an event." },
      { kind: "p", text: "The sixth area is privileged access. Admin accounts should be limited, documented, and separated from regular daily user accounts where practical." },
      { kind: "p", text: "The seventh area is data protection. Businesses should understand where sensitive data lives and who has access. This is especially important for companies handling health, financial, legal, HR, or client-confidential information." },
      { kind: "p", text: "The eighth area is monitoring and alert response. Having tools is different from reviewing alerts. Someone must own escalation." },
      { kind: "p", text: "Digerati Experts can help prepare businesses through a Cyber Risk Assessment and compliance/risk reporting. The goal is to identify gaps before the application, renewal, or incident. If a control is missing, the business can decide whether to implement it, document a compensating process, or plan it for a future phase." },
      { kind: "p", text: "It is important to be precise: Digerati Experts does not guarantee coverage, compliance, or claim outcomes. Insurance decisions belong to carriers and policy terms. Legal interpretations belong to qualified counsel. But DE can help businesses implement, organize, and document the IT and security controls that many insurance conversations depend on." },
      { kind: "p", text: "Cyber insurance works best when paired with real controls, clear documentation, and a practical improvement roadmap." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about cyber insurance requirements small businesses should prepare for. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Prepare for Cyber Insurance Review",
      primaryHref: "/book",
      secondaryLabel: "Start Cyber Risk Assessment",
      secondaryHref: "/book",
    },
  },
  "managed-it-pricing-phoenix-chandler": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Managed IT pricing is not just a per-user number." },
      { kind: "p", text: "For Arizona businesses, pricing depends on users, endpoints, locations, support expectations, cybersecurity needs, backup scope, cloud platforms, compliance requirements, onboarding complexity, and whether the business needs full IT ownership or a targeted service role." },
      { kind: "p", text: "A low price may only include reactive support. A higher price may include security controls, monitoring, documentation, backup, strategic reviews, user lifecycle support, and response planning." },
      { kind: "p", text: "The right questions are:" },
      { kind: "ul", items: ["How many users and devices need support?","Is security included or sold separately?","Are backups included?","Is email security included?","Are SOC/NOC or escalation layers included?","Are multiple locations involved?","Does the business need compliance reporting?","What happens during onboarding?","Are projects billed separately?","What is excluded?"] },
      { kind: "p", text: "Digerati Experts uses assessment-based recommendations because two businesses with the same number of users can have very different risk and support needs." },
      { kind: "p", text: "The Cyber Risk Assessment helps determine whether the business fits ProActive Ecosystem, Standalone Services, Co-Managed IT, or a project-first path." },
      { kind: "p", text: "Do not compare managed IT providers only by price. Compare what is actually included, what risk is reduced, and whether the provider is building a support model or a security-first operating model." },
    ],
    extendedBlocks: [
      { kind: "p", text: "Managed IT pricing can be confusing because providers package services differently." },
      { kind: "p", text: "One company may quote a low monthly support price that mostly covers helpdesk tickets. Another may include endpoint security, email security, backup, monitoring, documentation, vendor management, business reviews, and security operations. A third may separate every service into add-ons." },
      { kind: "p", text: "This makes price comparison difficult unless the scope is clear." },
      { kind: "p", text: "The first pricing factor is users. Per-user pricing is common because each employee usually needs support, identity management, email, cloud access, security awareness, and lifecycle management. But user count alone does not tell the whole story." },
      { kind: "p", text: "The second factor is endpoints. A company with 20 users and 50 devices has a different support and security profile than a company with 20 users and 20 devices. Servers, shared workstations, field devices, and personal devices also affect scope." },
      { kind: "p", text: "The third factor is locations. A single office is different from multiple sites, warehouses, clinics, retail locations, or remote teams. Multi-site environments may need stronger network design, secure access, equipment standards, and monitoring." },
      { kind: "p", text: "The fourth factor is cybersecurity. Some managed IT plans include minimal security. Others are built around layered protection. Digerati Experts positions managed IT as cybersecurity-first, which means identity, endpoints, email, network access, backups, and monitoring are part of the conversation from the beginning." },
      { kind: "p", text: "The fifth factor is backup and recovery. Endpoint backup, cloud backup, server backup, BCDR, and disaster recovery planning are not the same thing. The more the business depends on uptime, the more recovery planning matters." },
      { kind: "p", text: "The sixth factor is support model. Does the plan include service desk support, after-hours support, critical response expectations, vendor coordination, and escalation? Are response targets defined? What is excluded?" },
      { kind: "p", text: "The seventh factor is compliance and reporting. Businesses in healthcare, finance, legal, defense contracting, or other regulated spaces may need stronger documentation, evidence, reporting, access control, and review processes." },
      { kind: "p", text: "The eighth factor is onboarding. A business with poor documentation, unknown admin access, inconsistent devices, old licensing, and backup uncertainty may require stabilization work before managed service can run smoothly. Onboarding should not be ignored; it is where risk is often discovered." },
      { kind: "p", text: "The ninth factor is strategic work. Some businesses only want ticket support. Others need budgeting, roadmap planning, technology reviews, security reviews, and leadership guidance." },
      { kind: "p", text: "Digerati Experts uses the Cyber Risk Assessment to avoid quoting blindly. The assessment helps determine whether a business needs the ProActive Ecosystem, a Standalone Service, Co-Managed IT, or a project-first remediation path." },
      { kind: "p", text: "When comparing providers, ask what the price includes. Is cybersecurity included? Is backup included? Is email protection included? Are admin accounts reviewed? Are endpoints monitored? Are security alerts handled? Are reports provided? Are business reviews included? What happens during a ransomware incident?" },
      { kind: "p", text: "Managed IT pricing should be judged by value, scope, risk reduction, and operational fit—not only by the lowest monthly number." },
      { kind: "p", text: "A lower price that leaves identity, backup, monitoring, and documentation gaps may cost more during an outage or security incident." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about managed it pricing in phoenix and chandler: what arizona businesses should expect. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Compare Your Current IT Coverage",
      primaryHref: "/services/proactive",
      secondaryLabel: "Explore ProActive Ecosystem",
      secondaryHref: "/services/proactive",
    },
  },
  "managed-it-vs-break-fix-it": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Break-fix IT waits until something fails." },
      { kind: "p", text: "That may work for a single home computer. It does not work well for a business that depends on email, cloud systems, devices, networks, security, backups, phones, and client data." },
      { kind: "p", text: "Reactive support gets expensive because the business pays in downtime, emergency labor, lost productivity, poor documentation, repeated issues, and security gaps." },
      { kind: "p", text: "Managed IT is different. It should include:" },
      { kind: "ul", items: ["Device visibility","Patch management","Identity and access control","Helpdesk or service desk support","Monitoring and escalation","Backup and recovery planning","Email and endpoint security","Vendor coordination","Documentation","Strategic reviews"] },
      { kind: "p", text: "Digerati Experts is not built as a break-fix repair shop. DE is a cybersecurity-first IT partner focused on reducing risk and keeping operations stable." },
      { kind: "p", text: "The difference is ownership." },
      { kind: "p", text: "Break-fix asks, “What broke today?”" },
      { kind: "p", text: "Managed IT asks, “How do we prevent, monitor, document, secure, and improve the environment over time?”" },
      { kind: "p", text: "If your business only calls IT during emergencies, it may be time to compare the real cost of reactive support against a managed model." },
    ],
    extendedBlocks: [
      { kind: "p", text: "Break-fix IT is simple: something breaks, the business calls for help, the technician fixes the immediate problem, and the cycle repeats." },
      { kind: "p", text: "That model can be useful for small one-time issues, but it creates problems when the business grows. Modern business technology is not just a collection of computers. It includes cloud accounts, email, security tools, remote access, file sharing, backups, phones, applications, networks, compliance expectations, and vendor relationships." },
      { kind: "p", text: "Reactive IT does not manage the full environment. It usually responds to symptoms." },
      { kind: "p", text: "A user cannot log in. A laptop is slow. Email is not working. Wi-Fi is unstable. A printer fails. A file is missing. A vendor application breaks. The ticket gets fixed, but the root cause may remain." },
      { kind: "p", text: "Managed IT should be more proactive. It should create standards, visibility, documentation, monitoring, support processes, security layers, backup plans, and a roadmap. Instead of only repairing problems, the provider helps reduce recurring issues and improve business resilience." },
      { kind: "p", text: "The first major difference is documentation. Break-fix providers often do not maintain detailed records of systems, vendors, credentials, networks, licenses, and recovery procedures. Without documentation, every issue takes longer and every transition becomes harder." },
      { kind: "p", text: "The second difference is security. Break-fix support may not review MFA, admin access, endpoint protection, email security, backup isolation, or incident response. But attackers do not wait for businesses to feel ready. Cybersecurity has to be part of the daily operating model." },
      { kind: "p", text: "The third difference is monitoring. Managed IT should identify issues before users report them when practical. That may include device health, backup failures, security alerts, network status, and critical service issues." },
      { kind: "p", text: "The fourth difference is user lifecycle. Onboarding and offboarding employees is a major security function. A managed model should standardize access, devices, permissions, MFA, and removal." },
      { kind: "p", text: "The fifth difference is strategy. Businesses need planning: when to replace equipment, how to budget for software, how to reduce risk, how to support growth, how to prepare for insurance, and how to improve operations." },
      { kind: "p", text: "The sixth difference is recovery. Break-fix support may be able to repair devices, but ransomware, server failure, data loss, and outages require preparation. Recovery depends on backups, documentation, access control, vendor contacts, and tested procedures." },
      { kind: "p", text: "Digerati Experts positions managed IT as cybersecurity-first. That means IT support and security are not separate afterthoughts. Identity, endpoint, email, network, backup, monitoring, support, and reporting are all part of the operating model." },
      { kind: "p", text: "For some businesses, a Standalone Service may be enough. For others, Co-Managed IT may support an internal team. For businesses that want broader ownership, the ProActive Ecosystem provides a structured managed IT and security model." },
      { kind: "p", text: "The starting point is a Cyber Risk Assessment. It helps identify whether the business is simply dealing with occasional technical problems or carrying deeper operational and security risk." },
      { kind: "p", text: "Break-fix may feel cheaper because it is only paid when something hurts. But downtime, emergency response, repeated issues, poor security, and lost productivity can make reactive support more expensive than it looks." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about managed it vs break-fix it: why reactive support gets expensive. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Explore ProActive Ecosystem",
      primaryHref: "/services/proactive",
      secondaryLabel: "Compare Your Current IT Coverage",
      secondaryHref: "/services/proactive",
    },
  },
  "co-managed-it-vs-hiring-another-it-employee": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "When an internal IT team is overloaded, leadership often sees two options: hire another employee or outsource everything." },
      { kind: "p", text: "There is a third option: Co-Managed IT." },
      { kind: "p", text: "Co-Managed IT allows the business to keep internal IT while adding outside support, security expertise, monitoring, documentation, project help, helpdesk coverage, backup support, compliance reporting, or escalation capacity." },
      { kind: "p", text: "Hiring another employee may make sense when the business needs dedicated on-site presence, institutional knowledge, and daily internal ownership. Co-managed IT may make more sense when the team needs broader tools, specialized security layers, after-hours coverage, project capacity, or support without adding a full salary and benefits package." },
      { kind: "p", text: "Digerati Experts treats Co-Managed IT as a separate path, not a ProActive Ecosystem tier. It is designed for businesses that already have internal IT but need a cybersecurity-first partner." },
      { kind: "p", text: "The best model depends on the gap:" },
      { kind: "ul", items: ["Too many tickets?","Not enough security expertise?","No SOC/NOC coverage?","Weak backup documentation?","Compliance pressure?","Too many projects?","No vacation coverage?","Need better vendor management?"] },
      { kind: "p", text: "A Cyber Risk Assessment helps define the right co-managed scope without replacing what already works." },
    ],
    extendedBlocks: [
      { kind: "p", text: "Hiring another IT employee and engaging a Co-Managed IT partner solve different problems." },
      { kind: "p", text: "A new employee can be valuable when the business needs a dedicated person who understands internal culture, handles daily requests, works on-site, and owns internal systems. But one person cannot be everywhere, know every specialty, monitor every alert, run every project, cover every vacation, and handle every security requirement." },
      { kind: "p", text: "Co-Managed IT helps fill those gaps without replacing the internal team." },
      { kind: "p", text: "The first advantage is coverage. Internal IT often gets buried in tickets, onboarding, vendor issues, device problems, application requests, and urgent interruptions. A co-managed partner can help absorb helpdesk, monitoring, endpoint management, backup checks, or project work." },
      { kind: "p", text: "The second advantage is specialization. Cybersecurity requires expertise across identity, endpoint, email, network access, backups, monitoring, compliance, and response. An internal generalist may be strong but still need support in areas like security operations, cyber insurance readiness, incident response planning, or compliance evidence." },
      { kind: "p", text: "The third advantage is tool depth. A co-managed partner may bring processes, documentation standards, monitoring tools, service workflows, security controls, and escalation paths that are difficult for a small internal team to build alone." },
      { kind: "p", text: "The fourth advantage is continuity. Internal IT people need vacations, sick days, training time, and focus time. Co-managed support can reduce the single-person dependency that many businesses face." },
      { kind: "p", text: "The fifth advantage is project capacity. Internal IT often delays strategic improvements because daily support consumes the schedule. A partner can help with migrations, security rollouts, backup redesign, device standards, documentation, network upgrades, and policy implementation." },
      { kind: "p", text: "But co-managed IT is not always the right answer. If the business has no internal IT ownership at all and wants one provider to run the full environment, the ProActive Ecosystem may be a better fit. If the business only needs one focused function, a Standalone Service may be enough." },
      { kind: "p", text: "Digerati Experts keeps these paths separate on purpose." },
      { kind: "p", text: "Co-Managed IT is for businesses with internal IT that want additional capability. ProActive Ecosystem is for broader managed IT and security ownership. Standalone Services are for targeted roles such as backup, security awareness, network, compliance reporting, or threat detection." },
      { kind: "p", text: "A good co-managed relationship should clarify roles. Who handles tickets? Who manages devices? Who owns identity? Who approves changes? Who responds to alerts? Who manages vendors? Who documents systems? Who communicates to leadership?" },
      { kind: "p", text: "Without role clarity, co-managed IT can become confusing. With proper structure, it can give internal IT more leverage and give leadership better risk visibility." },
      { kind: "p", text: "Digerati Experts starts with a Cyber Risk Assessment because co-managed work should solve the right problem. If the internal team is struggling with tickets, the solution may be service desk support. If the risk is ransomware, the priority may be identity, backups, endpoint security, and response. If compliance pressure is increasing, reporting and evidence may matter more." },
      { kind: "p", text: "The goal is not to replace internal IT. The goal is to strengthen the team, reduce blind spots, and build a more resilient technology operation." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about co-managed it vs hiring another it employee. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Explore Co-Managed IT",
      primaryHref: "/services/co-managed-it",
      secondaryLabel: "Start Cyber Risk Assessment",
      secondaryHref: "/book",
    },
  },
  "standalone-it-services-vs-full-managed-it-ownership": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Not every business needs the same IT relationship." },
      { kind: "p", text: "Some need one defined service. Some need support for internal IT. Some need a broader partner to own managed IT and cybersecurity." },
      { kind: "p", text: "Digerati Experts separates these paths clearly:" },
      { kind: "p", text: "Standalone Services are targeted service roles. They are for businesses that need one defined function, such as backup, network, security awareness, compliance reporting, threat detection, or managed workplace support." },
      { kind: "p", text: "ProActive Ecosystem is broader IT and security ownership. It is the managed model for businesses that want DE to guide the environment across users, devices, access, security, backup, support, and strategy." },
      { kind: "p", text: "Co-Managed IT is a separate path for companies that already have internal IT but need additional support, security coverage, escalation, or project capacity." },
      { kind: "p", text: "The Cyber Risk Assessment helps determine which path makes sense." },
      { kind: "p", text: "This matters because buying too little creates gaps, and buying the wrong model creates confusion. A business with multiple risks may need more than a standalone service. A business with internal IT may not need full outsourced ownership. A business with one specific gap may not need a full managed package yet." },
      { kind: "p", text: "The right coverage starts with clarity." },
    ],
    extendedBlocks: [
      { kind: "p", text: "One of the easiest ways for a business to make a poor IT decision is to buy the wrong type of service relationship." },
      { kind: "p", text: "A company that only needs backup improvement may not need a full managed IT program immediately. A company with no internal IT and growing security risk may need more than a single service. A company with an internal IT person may need support, not replacement." },
      { kind: "p", text: "Digerati Experts separates service paths to avoid that confusion." },
      { kind: "p", text: "Standalone Services are targeted. They are designed for a defined technology or security role. Examples may include cloud backup, security awareness training, threat detection, compliance reporting, network and secure access, managed workplace, or backup and disaster recovery. A standalone service is appropriate when the business understands the gap and wants Digerati Experts to own or support that specific function." },
      { kind: "p", text: "ProActive Ecosystem is broader. It is for businesses that need managed IT and cybersecurity coverage across the environment. This may include identity, devices, email, network, backup, monitoring, helpdesk, documentation, reviews, and security planning. The ProActive Ecosystem is not just a bundle of tools. It is an operating model." },
      { kind: "p", text: "Co-Managed IT is different from both. It supports businesses with internal IT teams. In that model, Digerati Experts may provide security layers, escalation, monitoring, documentation support, helpdesk overflow, project assistance, backup support, or compliance reporting while the internal team keeps ownership of daily operations." },
      { kind: "p", text: "The Cyber Risk Assessment is the decision tool. It helps identify which path fits the business." },
      { kind: "p", text: "If the assessment shows one clear gap, Standalone Services may be appropriate. If it shows broad risk across identity, endpoint, email, backup, network, and support, ProActive Ecosystem may be better. If the internal team is capable but stretched, Co-Managed IT may be the right structure." },
      { kind: "p", text: "The distinction matters because service confusion creates expectation problems. If a client buys a standalone backup service, that does not mean Digerati Experts owns every IT issue in the environment. If a client buys a full ProActive Ecosystem package, the expectation is broader ownership. If a client chooses Co-Managed IT, responsibilities should be documented between DE and the internal team." },
      { kind: "p", text: "This is also important for pricing. Standalone Services may be priced by company, site, user, endpoint, or scope depending on the service. ProActive Ecosystem is broader and typically tied to users, endpoints, sites, security requirements, backup needs, and support scope. Co-Managed IT depends on the division of labor." },
      { kind: "p", text: "Digerati Experts uses this structure because it matches how businesses actually buy technology help. Not every prospect is ready for the same level of coverage, but every prospect needs clarity." },
      { kind: "p", text: "The right question is not “What package do you sell?”" },
      { kind: "p", text: "The better question is “What responsibility do we need Digerati Experts to own?”" },
      { kind: "p", text: "That answer determines whether the path is Standalone Services, ProActive Ecosystem, Co-Managed IT, or a project-first engagement." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about standalone it services vs full managed it ownership. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Find the Right Coverage Path",
      primaryHref: "/services/proactive",
      secondaryLabel: "Start Cyber Risk Assessment",
      secondaryHref: "/book",
    },
  },
  "questions-before-switching-it-providers": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Switching IT providers can fix problems, but it can also expose hidden risk." },
      { kind: "p", text: "Before moving, a business should ask:" },
      { kind: "ul", items: ["Who controls admin access?","Do we own our domains, DNS, licenses, and cloud tenant?","Are backups working and restorable?","Is documentation current?","What security tools are installed?","Are endpoint agents removable?","Are contracts or cancellation terms involved?","Who has access to passwords?","Are former vendors or users still active?","What happens to email, files, phones, and remote access during transition?","Is there a stabilization plan?"] },
      { kind: "p", text: "The danger is not just choosing the wrong next provider. The danger is discovering during the switch that the business does not control its own technology environment." },
      { kind: "p", text: "Digerati Experts uses onboarding and stabilization to reduce transition risk. The Cyber Risk Assessment can also reveal whether the current setup has identity, endpoint, backup, network, or documentation gaps that need to be handled before a clean handoff." },
      { kind: "p", text: "Do not switch providers based only on frustration. Switch with a plan." },
    ],
    extendedBlocks: [
      { kind: "p", text: "A business usually considers switching IT providers after repeated frustration: slow response, poor communication, unresolved problems, security concerns, unclear invoices, lack of strategy, or loss of trust." },
      { kind: "p", text: "Those are valid reasons to evaluate options. But switching providers should be handled carefully because many businesses do not know how dependent they are on the current provider until the transition begins." },
      { kind: "p", text: "The first question is ownership. Does the business own its domain, DNS, Microsoft or Google tenant, website hosting, phone numbers, firewall configuration, backup accounts, software licenses, and admin credentials? If those items are controlled by the old provider, the transition may be harder." },
      { kind: "p", text: "The second question is documentation. Are network diagrams, device inventories, passwords, license records, vendor contacts, backup settings, firewall rules, and application details documented? Poor documentation can slow onboarding and increase risk." },
      { kind: "p", text: "The third question is backup. Before switching, the business should know whether backups are running, where they are stored, who can access them, and whether restores have been tested. Provider transitions are not the time to discover that recovery assumptions are wrong." },
      { kind: "p", text: "The fourth question is security tools. Endpoint agents, email security, remote access tools, monitoring tools, backup agents, and management software may need to be replaced or removed. The new provider should understand what exists before changing it." },
      { kind: "p", text: "The fifth question is identity and access. Former providers, users, contractors, and service accounts may still have access. Admin accounts should be reviewed during transition." },
      { kind: "p", text: "The sixth question is contract terms. The business should understand cancellation notice, data export rights, equipment ownership, licensing arrangements, and any early termination obligations." },
      { kind: "p", text: "The seventh question is operational timing. Switching email, DNS, phones, remote access, endpoint tools, and firewalls can disrupt operations if handled poorly. A transition plan should reduce downtime." },
      { kind: "p", text: "The eighth question is security during transition. Provider changes can create temporary gaps. Both old and new environments should be monitored carefully, and access should be removed cleanly when the handoff is complete." },
      { kind: "p", text: "The ninth question is communication. Employees should know what is changing, how to request support, what tools are being replaced, and whom to contact during the transition." },
      { kind: "p", text: "Digerati Experts treats switching providers as an onboarding and stabilization process, not just an account transfer. The goal is to gain control, reduce risk, document the environment, and create a cleaner operating model." },
      { kind: "p", text: "A Cyber Risk Assessment can be useful before or during the transition. It helps identify what must be fixed immediately and what can be scheduled later. If backups are weak, that may be urgent. If admin access is messy, that may be urgent. If devices are inconsistent, that may become part of stabilization." },
      { kind: "p", text: "The best provider transition is calm, documented, and controlled. The worst transition is emotional, rushed, and blind." },
      { kind: "p", text: "Before switching IT providers, ask whether the new provider has a plan to protect the business during the handoff." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about the questions every business should ask before switching it providers. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Get a Transition Risk Review",
      primaryHref: "/book",
      secondaryLabel: "Compare Your Current IT Coverage",
      secondaryHref: "/services/proactive",
    },
  },
  "shadow-ai-is-the-new-shadow-it": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Shadow AI happens when employees use AI tools without approval, policy, or visibility." },
      { kind: "p", text: "It may start innocently. Someone pastes a client email into an AI tool. Another uploads a spreadsheet. A manager uses AI to summarize HR notes. A salesperson uses a browser extension. A team adopts an AI note-taker without telling leadership." },
      { kind: "p", text: "The risk is not that AI is bad. The risk is unmanaged use." },
      { kind: "p", text: "Businesses should decide:" },
      { kind: "ul", items: ["Which AI tools are approved?","What data can never be pasted into AI?","Who approves new AI tools?","Are browser extensions allowed?","Can meeting recordings be uploaded?","How are client files handled?","What requires human review?","Where is AI activity documented?","How are employees trained?"] },
      { kind: "p", text: "Digerati Experts helps businesses approach AI the same way they should approach cybersecurity: govern, document, control access, protect data, and keep humans accountable for decisions." },
      { kind: "p", text: "The goal is not to block AI. The goal is to use it safely." },
      { kind: "p", text: "Shadow AI should become managed AI." },
    ],
    extendedBlocks: [
      { kind: "p", text: "Shadow IT has existed for years. Employees adopt tools outside the approved technology environment because they are convenient, fast, or easier than waiting for formal approval." },
      { kind: "p", text: "Shadow AI is the next version of that problem." },
      { kind: "p", text: "Generative AI tools are easy to access and useful. Employees can draft emails, summarize documents, create presentations, analyze spreadsheets, write job descriptions, generate code, and organize notes. That productivity is real. But without governance, the business may not know what data is being shared, where it is stored, who has access, or whether outputs are being reviewed." },
      { kind: "p", text: "The first risk is data leakage. Employees may paste client information, contracts, financial data, HR notes, medical information, credentials, source code, or internal strategy into tools that were never approved for that use." },
      { kind: "p", text: "The second risk is tool sprawl. Browser extensions, AI assistants, note takers, writing tools, and chatbots may be added without review. Some may request broad access to email, calendars, files, or browsers." },
      { kind: "p", text: "The third risk is decision quality. AI outputs can be wrong, biased, incomplete, or outdated. If employees treat AI output as final without human review, mistakes can enter client communication, compliance work, finance, HR, or operations." },
      { kind: "p", text: "The fourth risk is records and accountability. If AI tools are used for business decisions, the company may need to know what was used, why, by whom, and with what data." },
      { kind: "p", text: "The fifth risk is client trust. Clients may expect sensitive information to be handled carefully. Unauthorized AI use can create reputational and contractual concerns." },
      { kind: "p", text: "Digerati Experts recommends a practical AI governance model for SMBs." },
      { kind: "p", text: "Start with an approved tools list. Employees should know which AI tools are allowed and which are not. The business should define whether personal AI accounts can be used for work or whether only business-approved accounts are permitted." },
      { kind: "p", text: "Next, define data rules. Some information should not be entered into public or unapproved AI tools: passwords, confidential client data, regulated data, legal documents, HR records, financial records, proprietary strategy, and security information." },
      { kind: "p", text: "Then define use cases. AI may be appropriate for drafting, brainstorming, summarizing public information, creating internal outlines, or improving writing. It may not be appropriate for final legal, financial, HR, compliance, or security decisions without review." },
      { kind: "p", text: "Add approval workflows. New AI tools should be reviewed for access permissions, data handling, business need, and security risk. Browser extensions deserve special attention because they may see more than users realize." },
      { kind: "p", text: "Train employees. The policy should not be written in legal language nobody reads. It should explain what is safe, what is not, and who to ask." },
      { kind: "p", text: "Monitor and document. The company should know which tools are in use and update the policy as AI adoption grows." },
      { kind: "p", text: "Digerati Experts connects AI governance to managed workplace, data protection, identity, browser controls, and business process. The goal is not to kill productivity. The goal is to prevent uncontrolled AI adoption from becoming the new data exposure problem." },
      { kind: "p", text: "AI should help the business move faster, but not at the cost of client trust, compliance readiness, or security." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about shadow ai is the new shadow it. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Assess AI & Data Exposure",
      primaryHref: "/book",
      secondaryLabel: "Create a Secure AI Use Policy",
      secondaryHref: "/services/standalone",
    },
  },
  "chatgpt-copilot-gemini-claude-business-data-security": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "AI tools can improve productivity, but they need rules." },
      { kind: "p", text: "ChatGPT, Copilot, Gemini, Claude, and other AI platforms can help with writing, summarizing, analysis, research, code, planning, and customer communication. But if employees use them without guidance, company data may be exposed or misused." },
      { kind: "p", text: "A safer AI program should define:" },
      { kind: "ul", items: ["Approved AI tools","Approved use cases","Prohibited data types","Human review requirements","Client data handling rules","Browser extension rules","Meeting transcription rules","Output verification expectations","Access and account standards","Employee training"] },
      { kind: "p", text: "The goal is not to pick one “perfect” AI tool. The goal is to create a business-safe AI operating model." },
      { kind: "p", text: "Digerati Experts helps businesses treat AI as part of the technology environment, not a side experiment. AI governance connects to identity, data protection, browser controls, cloud apps, HR onboarding, policy, and compliance readiness." },
      { kind: "p", text: "Use AI, but do not let every employee invent their own security standard." },
    ],
    extendedBlocks: [
      { kind: "p", text: "Generative AI has moved from experiment to daily work." },
      { kind: "p", text: "Employees use AI to draft emails, summarize calls, rewrite proposals, research topics, generate code, clean up spreadsheets, create job postings, build checklists, and brainstorm decisions. That can save time. It can also create risk when the business has no policy, no approved tools, and no data rules." },
      { kind: "p", text: "The first step is tool approval. The business should decide which AI tools are allowed for work. Some companies may approve a business version of a tool and block personal accounts for company data. Others may approve limited use cases while a policy matures. The important point is that employees should not guess." },
      { kind: "p", text: "The second step is data classification. Employees need clear rules about what can and cannot be entered into AI systems. Public information, internal drafts without sensitive data, and general brainstorming may be acceptable. Client confidential data, regulated data, passwords, security details, HR records, financial records, legal documents, proprietary code, and sensitive contracts may need stricter handling or prohibition." },
      { kind: "p", text: "The third step is use-case clarity. AI is often helpful for drafting, outlining, summarizing non-sensitive notes, creating templates, and improving readability. It should not be treated as the final authority for legal, compliance, medical, financial, HR, or cybersecurity decisions. Human review remains necessary." },
      { kind: "p", text: "The fourth step is account and access control. Business AI tools should be managed like other business applications. Who has access? Is MFA required? Is access removed during offboarding? Are paid accounts controlled by the business? Are browser plugins reviewed?" },
      { kind: "p", text: "The fifth step is meeting and transcription control. AI note-takers can be useful, but they may capture sensitive conversations. The business should define when they are allowed, how consent is handled, where transcripts are stored, and who can access them." },
      { kind: "p", text: "The sixth step is output verification. AI can produce confident but incorrect answers. Employees should be trained to verify facts, avoid unsupported claims, and review outputs before sending them to clients." },
      { kind: "p", text: "The seventh step is documentation. A simple AI acceptable use policy should define approved tools, prohibited data, acceptable use cases, review expectations, and escalation paths." },
      { kind: "p", text: "Digerati Experts sees AI governance as part of cybersecurity-first managed IT because AI touches identity, data, browsers, cloud applications, HR onboarding, employee training, and compliance. If AI tools become part of the workday, they need the same operational discipline as other business systems." },
      { kind: "p", text: "This does not mean the business should avoid AI. Avoidance is usually unrealistic. Employees will use tools that help them. The better path is to create safe defaults, approved options, clear rules, and review processes." },
      { kind: "p", text: "A secure AI program should answer four questions: what tools are allowed, what data is protected, what work requires human approval, and who owns the policy." },
      { kind: "p", text: "If those answers are unclear, start with an AI and data exposure assessment." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about chatgpt, copilot, gemini, and claude for business: how to use ai without leaking company data. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Create a Secure AI Use Policy",
      primaryHref: "/services/standalone",
      secondaryLabel: "Assess AI & Data Exposure",
      secondaryHref: "/book",
    },
  },
  "hipaa-cmmc-nist-cyber-insurance-managed-it-discipline": {
    readTime: "10 min read",
    overviewReadTime: "5 min read",
    extendedReadTime: "10 min read",
    overviewBlocks: [
      { kind: "p", text: "Compliance does not start with paperwork. It starts with operational discipline." },
      { kind: "p", text: "HIPAA, CMMC, NIST alignment, cyber insurance, client questionnaires, and vendor reviews often point back to the same practical controls:" },
      { kind: "ul", items: ["Who has access?","Are users protected with MFA?","Are devices managed?","Are systems patched?","Are backups protected and tested?","Are security events monitored?","Is sensitive data controlled?","Are policies documented?","Are incidents handled consistently?","Can the business show evidence?"] },
      { kind: "p", text: "Digerati Experts does not claim to make a business compliant. Compliance depends on the organization, the applicable rules, legal interpretation, leadership decisions, policies, workforce behavior, and documentation." },
      { kind: "p", text: "What DE can do is help implement, document, monitor, and support the technical controls that compliance and cyber insurance programs often expect." },
      { kind: "p", text: "For many businesses, the gap is not intent. The gap is proof." },
      { kind: "p", text: "Managed IT discipline creates the foundation: identity, endpoints, email, network, backup, monitoring, response, documentation, and reporting. Without that foundation, compliance efforts become stressful and reactive." },
      { kind: "p", text: "Start by understanding your current state, then build the control roadmap." },
    ],
    extendedBlocks: [
      { kind: "p", text: "Compliance conversations can become confusing because every framework has its own language." },
      { kind: "p", text: "HIPAA focuses on protecting health information. CMMC and NIST 800-171 are important for defense contractors and organizations handling controlled unclassified information. NIST Cybersecurity Framework helps organizations manage cybersecurity risk. Cyber insurance applications ask about practical controls and preparedness. Client security questionnaires may combine pieces of all of these." },
      { kind: "p", text: "Despite the differences, many requirements point back to the same operating foundation." },
      { kind: "p", text: "The first foundation is governance. Someone must own the security program, approve policies, understand risk, and make decisions. Cybersecurity cannot be an informal side task forever." },
      { kind: "p", text: "The second foundation is identity and access. Users should have appropriate access, MFA should be enforced where needed, admin rights should be controlled, and offboarding should be consistent. Access reviews create evidence that the business is managing permissions intentionally." },
      { kind: "p", text: "The third foundation is endpoint management. Devices should be inventoried, protected, patched, and monitored. Unknown or unmanaged devices create compliance and security problems." },
      { kind: "p", text: "The fourth foundation is email and communication security. Phishing, impersonation, and mailbox compromise can create serious exposure. Email protections, training, and reporting processes support both security and compliance readiness." },
      { kind: "p", text: "The fifth foundation is data protection. The business should know where sensitive data lives, who can access it, how it is shared, and how it is protected. Sensitive data should not be scattered across personal accounts, unmanaged devices, or open folders." },
      { kind: "p", text: "The sixth foundation is backup and recovery. Compliance and insurance conversations often care about resilience. The business should know whether critical systems are backed up, whether backups are protected, and whether recovery has been tested." },
      { kind: "p", text: "The seventh foundation is monitoring and response. Security events should be reviewed, escalated, and documented. Incident response plans should define roles, communication, containment, recovery, and reporting." },
      { kind: "p", text: "The eighth foundation is documentation and evidence. Policies, access records, training records, backup logs, security reports, risk assessments, and remediation plans help show that controls exist and are being managed." },
      { kind: "p", text: "Digerati Experts helps businesses build this foundation through Cyber Risk Assessments, compliance reporting support, managed IT/security services, and practical roadmaps. DE does not replace legal counsel, auditors, compliance officers, or executive responsibility. DE helps operate and document the technical side." },
      // de-lint-disable-next-line
      { kind: "p", text: "This distinction matters. Promising that an MSP alone makes a business fully compliant is unrealistic and risky. A better statement is that DE helps implement, document, monitor, and support the technical controls that compliance programs, insurance carriers, and client questionnaires often expect." },
      { kind: "p", text: "The right starting point is a current-state assessment. What controls exist today? Where is the evidence? Which gaps are high-risk? Which improvements are required for insurance, client contracts, or regulatory expectations? Which items can be phased?" },
      { kind: "p", text: "Compliance-ready IT is not a one-time scramble before an audit. It is the result of consistent managed IT discipline." },
    ],
    bottomCta: {
      headline: "Ready to turn this into a plan?",
      body: "Talk with Digerati Experts about hipaa, cmmc, nist, and cyber insurance: why compliance starts with managed it discipline. We'll help translate this into a practical, prioritized plan for your business.",
      primaryLabel: "Build a Compliance-Ready IT Foundation",
      primaryHref: "/services/proactive",
      secondaryLabel: "Start Cyber Risk Assessment",
      secondaryHref: "/book",
    },
  },
};
