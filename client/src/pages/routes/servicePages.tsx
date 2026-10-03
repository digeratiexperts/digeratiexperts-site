import { getCyberFact, toDisplayStat } from "@/data/cyberAwarenessFacts";

export const servicePageData = {
  'ProActive-Ecosystem-Packages': {
    title: "ProActive Ecosystem Packages",
    subtitle: "Four fit-based operating models — IT, Office, Business, Enterprise",
    description: "The ProActive Ecosystem is the umbrella operating model, not a single Office package. IT, Office, Business, and Enterprise are matched to how your environment actually runs. Final scope is confirmed after a Cyber Risk Assessment.",
    features: [
      { title: "Managed Helpdesk & Support", description: "DE ticketing + remote/onsite support with response SLAs and vendor coordination" },
      { title: "Core Security Baseline", description: "Endpoint EDR, email security, MFA enforcement, and basic cloud security" },
      { title: "Identity & Access Management", description: "DE IAM with SSO, MFA, and automated provisioning/deprovisioning for users and apps" },
      { title: "Continuous Maintenance", description: "Proactive patching, hardening, updates, and least-privilege enforcement" },
      { title: "Cloud Backup & Recovery", description: "DE cloud backups with secure storage, verified recovery testing, and restore readiness" },
      { title: "Documentation & Visibility", description: "DE inventory, network and SaaS app maps, and 'known good config' snapshots" }
    ],
    benefits: [
      "Predictable monthly costs with no surprises",
      "Zero internal IT staff required",
      "24/7 security baseline built into every plan",
      "Vendor coordination handled—no more vendor juggling",
      "Compliance optional: add modules only when needed",
      "Monthly service summaries and quarterly business reviews available"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    recommendedTier: "office" as const,
  },
  'managed-it-support': {
    title: "Managed IT Support",
    subtitle: "Fast, proactive help anchored to the DE stack",
    description: "Managed IT Support is not generic helpdesk—it's support built on our proven DE stack. We handle remote troubleshooting, endpoint remediation, user onboarding, SaaS provisioning, and device basics. Support for everything you've deployed with DE; out-of-scope items are escalated or handled via education.",
    features: [
      { title: "Service Desk Coverage", description: "Fast response to user issues with clear resolution pathways and SLAs" },
      { title: "Remote Troubleshooting", description: "Secure remote access for quick diagnosis and remediation of endpoint issues" },
      { title: "User Lifecycle Support", description: "Onboarding/offboarding with IAM, device setup, and app provisioning" },
      { title: "Password & Login Management", description: "Self-service resets via SSO, MFA issues resolved by our team" },
      { title: "Basic Onsite Support", description: "Walk-in visits, printer/cabling/hardware basics per plan agreement" },
      { title: "Repeat Issue Reduction", description: "Tracking and follow-up to reduce repeat incidents over time" }
    ],
    benefits: [
      "Published SLA response targets by priority: 15 minutes for critical incidents",
      "Reduced repeat incident rate",
      "Users guided toward solutions, not band-aids",
      "Vendor issues resolved—we handle ISPs, SaaS vendors, hardware vendors",
      "Stack-native support: we built these tools",
      "Help + education: users learn safer behaviors"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    recommendedTier: "office" as const,
  },
  'managed-workplace': {
    title: "Managed Workplace",
    subtitle: "End-to-end employee digital experience management",
    description: "Managed Workplace is your digital employee lifecycle engine. We manage identity, apps, devices, email, voice, and workflow automation—everything employees need to work productively and securely. New hires productive in one day, not a week. Your environment stays standardized, secure, and compliant.",
    features: [
      { title: "Identity Lifecycle Management", description: "DE cloud directory with SSO, MFA, conditional access, and automated provisioning to all SaaS" },
      { title: "Business App Management", description: "SaaS licensing management, app onboarding, role mapping, shadow IT discovery, and access reviews" },
      { title: "Email & Collaboration", description: "M365 or Google Workspace admin, Teams/Drive structure, message hygiene, and retention policies" },
      { title: "Voice & Unified Communications", description: "Teams Voice, Zoom UCaaS, or VoIP integration; conference room provisioning and device enrollment" },
      { title: "Device & Mobile Management", description: "Windows/macOS baseline policies via DE IAM; MDM for iOS/Android available" },
      { title: "HR-to-IAM Workflows", description: "Onboarding automation: HR system → identity → device → SaaS app provisioning" }
    ],
    benefits: [
      "New hires productive in one day with full app access",
      "Consistent access control across all employee tools",
      "Seamless hybrid and remote work enablement",
      "Reduced license waste and SaaS sprawl",
      "Zero-Trust identity posture at every login",
      "Automated offboarding: revoked access in minutes, not hours"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    recommendedTier: "office" as const
  },
  'cloud-backup': {
    title: "Cloud Backup",
    subtitle: "Baseline data protection with verified recovery",
    description: "Cloud Backup is your minimum continuity layer. Automated encryption-at-rest and in-transit protection for endpoints, servers, and cloud data (M365/Google). We verify monthly that restores actually work—because a backup that doesn't restore is worthless.",
    features: [
      { title: "Automated Encrypted Backups", description: "DE continuous backup of endpoints, servers, and M365/Google data with AES-256 encryption" },
      { title: "Backup Health Monitoring", description: "Automated monitoring with alerts when backup jobs fail or fall behind" },
      { title: "Verified Restore Testing", description: "Monthly restore verification to confirm backups are recoverable and complete" },
      { title: "DE Cloud Storage", description: "Cost-effective, secure cloud storage with enterprise-grade durability guarantee" },
      { title: "Exception Reporting", description: "Clear visibility on backup health and any issues requiring attention" },
      { title: "Ransomware Defense", description: "Immutable backup copies protect against ransomware encryption" }
    ],
    benefits: [
      "Protection against ransomware and data loss",
      "Accidental deletion recovery in minutes",
      "Hardware failure doesn't mean business loss",
      "Monthly proof that restores work",
      "Compliance-grade encryption audit trail",
      "Peace of mind: tested backups, not just 'set and forget'"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    stat: { value: "54%", label: "used backups to restore encrypted data (lowest in 6 years)", source: "Sophos 2025" },
    recommendedTier: "office" as const,
  },
  'security-awareness': {
    title: "Security Awareness Training",
    subtitle: "Turn staff into a security layer, not a liability",
    description: "Security Awareness is human-risk hardening. Your employees are your first line of defense—or your biggest vulnerability. We train, test, and coach your team so people stop being the weakest link. Phishing simulations, targeted campaigns, and ongoing coaching reduce incidents and change culture.",
    features: [
      { title: "Video Training Campaigns", description: "Engaging micro-learning lessons on phishing, malware, data handling, and real threats your org faces" },
      { title: "Phishing Simulations", description: "Regular simulated phishing attacks with automatic remedial training for repeat offenders" },
      { title: "Risk Scoring & Metrics", description: "Department-level risk scoring, participation rates, and phish-failure trend analysis" },
      { title: "Executive Reporting", description: "Board-ready reporting on security culture maturity and employee readiness" },
      { title: "Compliance Integration", description: "Training logs stored for audits; maps to HIPAA, GDPR, FTC control requirements (with Compliance modules)" },
      { title: "Behavioral Coaching", description: "Targeted follow-ups for high-risk users and departments" }
    ],
    benefits: [
      "Reduced phishing and social engineering incidents",
      "Measurable shift in employee security behavior",
      "Stronger security culture across the organization",
      "Compliance evidence for audits and insurance",
      "Reduced support tickets from malware/ransomware",
      "Lower breach risk from insider mistakes"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    stat: toDisplayStat(getCyberFact("dbir-human-element-2026")),
    recommendedTier: "business" as const,
  },
  'co-managed-it': {
    title: "Co-Managed IT",
    subtitle: "Augment your internal IT team with DE expertise and stack",
    description: "Already have internal IT? Co-Managed IT partners with your team to fill skill gaps, provide 24/7 coverage, and add specialized muscle. You keep control; we provide stack, automation, security maturity, and Tier 2/3 escalation. Avoid burnout and tap into deep expertise.",
    features: [
      { title: "Shared Tooling Platform", description: "Access to DE security and management platform with full visibility into your environment" },
      { title: "Responsibility Matrix", description: "Clear SOW defining who owns onboarding, patching, vendor comms, and incidents" },
      { title: "Tier 2/3 Escalation", description: "Expert escalation for complex issues, security incidents, and strategic decisions" },
      { title: "24/7 Monitoring & Response", description: "After-hours and weekend coverage so your team doesn't burn out" },
      { title: "Quarterly Posture Meetings", description: "Regular check-ins with your IT lead on stack optimization and roadmap" },
      { title: "Specialized Expertise", description: "Security, compliance, infrastructure, and cloud experts available on demand" }
    ],
    benefits: [
      "Fill critical skill gaps without hiring full-time",
      "Extended coverage beyond your current staff hours",
      "Reduced IT team burnout and turnover",
      "Cost-effective expertise scaling",
      "Strategic IT planning and technology roadmap alignment",
      "Your IT team + DE stack = higher maturity without hiring"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    recommendedTier: "business" as const
  },
  'threat-detection': {
    title: "Threat Detection & Response",
    subtitle: "24/7 security monitoring and real incident response",
    description: "Threat Detection & Response is detection + triage + containment + guided recovery. We monitor endpoints, cloud apps, email, and network events 24/7 for threats. When we see something, we investigate, contain (isolate endpoints, reset credentials), and walk you through recovery. Not just alerts—real response.",
    features: [
      { title: "24/7 Telemetry Monitoring", description: "Real-time monitoring of endpoints, cloud apps, email, and gateway security events" },
      { title: "Advanced Endpoint Detection", description: "DE EDR detects suspicious behavior, lateral movement, and advanced techniques" },
      { title: "Automated Containment", description: "Safe automated actions like endpoint isolation, credential reset, and session termination" },
      { title: "Incident Runbooks", description: "Documented response playbooks maintained in DE documentation platform, customized to your environment" },
      { title: "Monthly Threat Reports", description: "Trend analysis, incident summaries, and 'mean time to contain' metrics" },
      { title: "DE SIEM Integration", description: "Deeper log correlation and retention for complex organizations" }
    ],
    benefits: [
      "Real-time threat detection 24/7/365",
      "15-minute response for critical incidents, per our published SLA",
      "Automated containment stops spread in seconds",
      "Forensic investigation and root cause analysis",
      "Compliance-ready incident documentation",
      "24/7 detection + real response, not 'good luck with alerts'"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    stat: toDisplayStat(getCyberFact("dbir-smb-ransomware-victims-2026")),
    recommendedTier: "business" as const,
  },
  'security-operations': {
    title: "Security Operations (SOC-as-a-Service)",
    subtitle: "Full SOC without hiring a SOC team",
    description: "Security Operations is Threat Detection & Response plus threat hunting, policy tuning, and continuous optimization. We run the security room. Includes detection, triage, response, plus proactive hunting, policy refinement, log correlation, and longer retention. Enterprise-grade security maturity.",
    features: [
      { title: "Threat Hunting Cycles", description: "Proactive investigation for advanced threats, unusual patterns, and insider risk" },
      { title: "Policy Tuning & Optimization", description: "Continuous refinement of EDR, email, cloud, and access control policies based on threats and trends" },
      { title: "Log Correlation & Analytics", description: "DE SIEM with deeper telemetry retention for pattern detection and forensics" },
      { title: "Security Change Management", description: "Documented policy changes with rationale and testing before deployment" },
      { title: "SOC Monthly Report", description: "Hunt findings, policy changes, incident trends, and audit-support packets" },
      { title: "Escalation & IR Coordination", description: "Full incident response coordination and external comms when needed" }
    ],
    benefits: [
      "Proactive threat discovery before breaches happen",
      "Continuously improving security posture",
      "Reduced vulnerability dwell time",
      "Stronger incident response and containment",
      "Compliance evidence and audit readiness",
      "Full SOC maturity without hiring SOC analysts"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    recommendedTier: "business" as const,
  },
  'backup-disaster-recovery': {
    title: "Backup & Disaster Recovery (BCDR)",
    subtitle: "Tested recovery with agreed targets—business won't stay down",
    description: "BCDR is tested continuity, not just 'we have backups.' Agreed RPO/RTO targets, image-based backups, scheduled restore tests, and DR runbooks. Your business comes back up on a timeline you define—not when backups finally work.",
    stat: { value: "$1.53M", label: "average ransomware recovery cost (excluding ransom)", source: "Sophos 2025" },
    features: [
      { title: "Agreed RPO/RTO Targets", description: "Contract-defined recovery time and data-loss objectives with SLA backing" },
      { title: "Image-Based Backups", description: "DE Server/VM backup features for full-system restore, not file-by-file recovery" },
      { title: "Scheduled Restore Tests", description: "Regular failover drills to confirm your systems can actually be restored" },
      { title: "DR Runbooks & Tabletop Exercises", description: "Documented recovery procedures with periodic team exercises" },
      { title: "Priority Restore Paths", description: "Defined restore sequencing so critical systems come back first" },
      { title: "Optional Warm Standby", description: "Cloud failover or secondary site options for maximum availability" }
    ],
    benefits: [
      "Restore your entire business, not just files",
      "Predictable recovery with agreed targets",
      "Tested and verified recovery procedures",
      "Reduced downtime and business impact",
      "Compliance-ready DR documentation",
      "Peace of mind: proven recovery capabilities"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    recommendedTier: "enterprise" as const
  },
  'vcio-strategy': {
    title: "vCIO & Strategy",
    subtitle: "Executive IT guidance aligned to business and compliance",
    description: "vCIO & Strategy is where we become your IT leadership function. Quarterly Technology Business Reviews, risk registers, budget forecasting, vendor rationalization, and roadmap planning. We align technology to your business goals and compliance requirements.",
    features: [
      { title: "Quarterly Technology Business Reviews", description: "Executive-level reviews of IT performance, spend, and strategic priorities" },
      { title: "Risk Register & Prioritization", description: "Documented risks with prioritized mitigation roadmap" },
      { title: "Budget Forecasting & Roadmap", description: "Multi-year technology budget and capital planning with business alignment" },
      { title: "Vendor Rationalization", description: "Eliminate shadow IT, optimize vendor stack, reduce tool sprawl" },
      { title: "Compliance Planning", description: "Roadmap for compliance modules and audit readiness aligned to your framework" },
      { title: "Tech Points & Prevention Incentives", description: "Track and reward prevention behaviors that reduce risk and cost" }
    ],
    benefits: [
      "Executive visibility into IT strategy and risk",
      "Reduced technology spend through consolidation",
      "Business-aligned IT roadmap",
      "Proactive compliance planning",
      "Reduced surprise costs and projects",
      "IT becomes a strategic business partner, not a cost center"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    recommendedTier: "enterprise" as const,
  },
  'data-encryption': {
    title: "Data Encryption & Control",
    subtitle: "Stop data leakage and risky browsing at the source",
    description: "Data Encryption & Control uses browser-layer security to protect data even if endpoints are compromised. DLP policies, anti-phishing, DNS filtering, and secure browsing controls at the gateway. Data governance happens inside the browser—the last place hackers look.",
    features: [
      { title: "Browser-Layer DLP", description: "Stop mass downloads, clipboard theft, and data exfiltration at the browser boundary" },
      { title: "Anti-Phishing & Anti-Malware", description: "In-browser threat detection and blocking before users click malicious links" },
      { title: "DNS Filtering & Blacklist/Whitelist", description: "Block malicious domains at the DNS level; whitelist approved resources only" },
      { title: "Secure Autofill & Password Protection", description: "Prevent credential theft through password masking and secure form handling" },
      { title: "Data Activity Insights", description: "Monitoring and analytics of web and data activity for insider risk detection" },
      { title: "Policy Enforcement & Compliance", description: "Enforce data handling policies with audit logs for compliance frameworks" }
    ],
    benefits: [
      "Stop data leakage from careless employees",
      "Protection even if endpoint malware compromises the device",
      "Reduced risk of credential theft and phishing success",
      "Compliance-ready audit trails for data handling",
      "Default for healthcare, finance, and legal verticals",
      "Works alongside endpoint security, not instead of it"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    recommendedTier: "business" as const,
  },
  'compliance-reports': {
    title: "Compliance & Risk Reports",
    subtitle: "Audit-grade reporting and proof mapped to your framework",
    description: "Compliance & Risk Reports is where DE becomes audit-ready. We map our stack to your framework (HIPAA, GDPR, FTC Safeguards, CIS, Cyber-Insurance), retain evidence (training logs, access reviews, baselines, incident trails), and produce board-ready compliance posture reports.",
    features: [
      { title: "Framework Mapping", description: "Control mapping of DE stack to HIPAA, GDPR, FTC, CIS, and insurance control sets" },
      { title: "Evidence Retention", description: "Automated collection and storage of training logs, access reviews, configuration baselines, and incident trails" },
      { title: "Risk Scoring & Gap Tracking", description: "Continuous risk assessment with gap identification and remediation tracking" },
      { title: "Monthly Compliance Report", description: "Executive posture report showing compliance progress and remaining gaps" },
      { title: "Audit Packet on Demand", description: "Fast-turnaround compliance evidence packets for auditors and insurance carriers" },
      { title: "Board-Level Reporting", description: "Owner/board communication on compliance readiness and risk trends" }
    ],
    benefits: [
      "Pass audits with comprehensive documented evidence",
      "Faster audit cycles with pre-compiled packets",
      "Reduced audit costs and surprise findings",
      "Insurance premium justification and optimization",
      "Regulatory confidence: proactive, not reactive",
      "Clear roadmap to full compliance certification"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    recommendedTier: "enterprise" as const,
  },
  'unified-security': {
    title: "Unified Security Posture",
    subtitle: "Comprehensive managed security—not a pile of tools",
    description: "Unified Security Posture is DE's highest security promise: identity, endpoint, cloud, email, network, and incident response fully integrated and continuously governed. Single pane of glass. One cohesive security strategy, not a collection of disconnected tools.",
    features: [
      { title: "IAM Spine + Zero Trust", description: "DE Prime identity with Zero Trust enforcement across all access" },
      { title: "Integrated Endpoint-Cloud-Email Security", description: "DE unified threat detection across all surfaces aligned to policy" },
      { title: "Security Awareness Tied to Risk", description: "Training + phishing simulations linked to actual threat trends and risk scores" },
      { title: "Backup/BCDR Linked to IR", description: "Recovery procedures integrated with incident response playbooks" },
      { title: "Drift Detection & Correction", description: "Continuous monitoring for configuration drift with automated correction" },
      { title: "Central Unified Reporting", description: "Single dashboard showing control health, human risk, incidents, and recovery readiness" }
    ],
    benefits: [
      "Single-pane security visibility across entire environment",
      "Faster incident detection and response",
      "Reduced 'blind spots' between tools",
      "Coordinated security strategy, not siloed tactics",
      "Measurable risk reduction over time",
      "Compliance readiness score when modules active"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]",
    recommendedTier: "enterprise" as const,
  }
};

/**
 * Only 'professional-services' actually renders: App.tsx declares dedicated
 * routes for accounting-finance, real-estate, and nonprofits earlier in its
 * <Switch>, which shadow any same-keyed entry here (wouter renders only the
 * first matching <Route>). Those three keys were removed 2026-08 — the live
 * pages are pages/industries/{Accounting,RealEstate,Nonprofits}.tsx.
 */
export const industryPageData = {
  'professional-services': {
    title: "IT Solutions for Professional Services",
    subtitle: "Secure client data and streamline operations",
    description: "Professional services firms—consultants, architects, engineers, and advisors—handle sensitive client data and intellectual property. Our tailored IT solutions protect confidential information while enabling seamless collaboration and mobile productivity.",
    features: [
      { title: "Client Data Protection", description: "Encrypt and secure sensitive client files and communications" },
      { title: "Secure Collaboration", description: "Enable team collaboration without compromising security" },
      { title: "Mobile Productivity", description: "Work securely from anywhere with managed devices" }
    ],
    benefits: [
      "Client confidentiality assured",
      "Secure remote access for field work",
      "Professional email and communication",
      "Document version control",
      "Compliance support for industry regulations"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]"
  }
};

/**
 * Only 'system-status' actually renders: App.tsx declares dedicated routes
 * for remote-support, pay-invoice, and knowledge-base earlier in its
 * <Switch>, which shadow any same-keyed entry here (wouter renders only the
 * first matching <Route>). Those three keys were removed 2026-08 — the live
 * pages are pages/support/{RemoteSupport,PayInvoice,KnowledgeBase}.tsx.
 * Note: '/support/system-status' itself has no inbound links anywhere in
 * the app (nav/footer point "Status" at /trust/trust-center instead) — see
 * the overnight mission report's page audit for the orphan classification.
 */
export const supportPageData = {
  'system-status': {
    title: "System Status",
    subtitle: "Real-time service status and incident updates",
    description: "Check the current status of all our services and view any ongoing incidents or scheduled maintenance.",
    features: [
      { title: "Real-Time Status", description: "Live status of all services" },
      { title: "Incident History", description: "View past incidents and resolutions" },
      { title: "Status Notifications", description: "Subscribe to status updates via email or SMS" }
    ],
    benefits: [
      "Real-time monitoring",
      "Incident notifications",
      "Maintenance schedules",
      "Uptime reports",
      "SLA tracking"
    ],
    gradientColors: "from-[#050312] via-[#0a0a0a] to-[#050312]"
  }
};
