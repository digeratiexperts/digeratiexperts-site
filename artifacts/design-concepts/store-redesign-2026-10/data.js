// Real Store copy, transcribed from client/src/data/curatedSolutions.ts, solutionScenarios.ts,
// client/src/lib/businessNeeds.ts and client/src/pages/solutions/BusinessNeedsIndex.tsx.
window.STORE = {
  phone: "325-480-9870",
  hero: {
    eyebrow: "Solve a business need",
    h1a: "Start with your business.",
    h1b: "Then solve what hurts.",
    lede: "Tell us what you have once. Pick what needs attention. DE sizes a solution you can send for a real quote. No payment here.",
  },
  doors: [
    { k: "A", t: "Handle Our IT", d: "One accountable team for the technology." },
    { k: "B", t: "Solve a Business Need", d: "Something specific is in the way. A package with a start and an end.", here: true },
    { k: "C", t: "Client Marketplace", d: "Already a client? Continue in the Client Marketplace." },
  ],
  steps: ["Profile", "Pain or need", "Relationship", "Package", "Delivery & Setup", "Contact"],
  profile: [
    { k: "Users", i: "users" }, { k: "Computers", i: "monitor" }, { k: "Mobile devices", i: "smartphone" }, { k: "Sites", i: "map-pin" },
  ],
  families: {
    it_operations: { l: "IT Operations & Support", i: "headphones", d: "Reliable day-to-day support, maintenance, monitoring, and operating discipline.", o: "A dependable support path for employees" },
    endpoint_devices: { l: "Endpoint & Device Management", i: "server", d: "Managed computers and mobile devices with defined ownership, standards, and lifecycle controls.", o: "Consistent device health and maintenance" },
    identity_access: { l: "Identity & Access", i: "key-round", d: "Secure sign-ins, access governance, account lifecycle, and administrative control.", o: "Stronger authentication and reduced account risk" },
    email_collaboration: { l: "Email & Collaboration", i: "mail", d: "Secure, supportable email, productivity, meetings, file collaboration, and administration.", o: "Reliable communication and collaboration" },
    cybersecurity_operations: { l: "Cybersecurity Operations", i: "shield", d: "Layered prevention, detection, investigation, response coordination, and security improvement.", o: "Earlier detection and containment of threats" },
    network_connectivity: { l: "Network & Connectivity", i: "network", d: "Reliable, secure networks across offices, remote users, internet connections, and cloud access.", o: "Improved network reliability and visibility" },
    backup_continuity: { l: "Backup & Business Continuity", i: "refresh-cw", d: "Protected data, tested recovery, continuity planning, and incident-ready recovery decisions.", o: "Recoverable business data and systems" },
    compliance_risk: { l: "Compliance & Risk Readiness", i: "file-text", d: "Risk assessment, control planning, evidence, policies, and readiness support without unsupported certification claims.", o: "Clear gaps and prioritized remediation" },
    security_awareness: { l: "Security Awareness & Human Risk", i: "graduation-cap", d: "Practical employee education, phishing resilience, onboarding, and measurable behavior improvement.", o: "Improved employee security decisions" },
    business_communications: { l: "Business Communications", i: "phone", d: "Business calling, messaging, meetings, call flows, number transitions, and communications support.", o: "Reliable business calling and collaboration" },
    hardware_lifecycle: { l: "Hardware & Lifecycle", i: "hard-drive", d: "Approved business hardware, secure provisioning, deployment, replacement planning, and lifecycle control.", o: "Consistent, business-ready equipment" },
    documentation_standards: { l: "Documentation & Standards", i: "briefcase", d: "Operational documentation, diagrams, inventories, standards, runbooks, and accountable maintenance.", o: "Current, usable environment knowledge" },
    technology_strategy: { l: "Technology Strategy & Advisory", i: "shield-alert", d: "Roadmaps, budgets, risk decisions, standards, projects, and accountable technology planning.", o: "Prioritized technology and security roadmap" },
  },
  goals: [
    { id: "productive", l: "Keep my team productive", f: ["it_operations", "endpoint_devices"] },
    { id: "protect", l: "Protect the business", f: ["identity_access", "email_collaboration", "cybersecurity_operations", "backup_continuity"] },
    { id: "requirements", l: "Meet requirements", f: ["compliance_risk", "documentation_standards", "security_awareness"] },
    { id: "connect", l: "Connect my people & locations", f: ["network_connectivity", "business_communications"] },
    { id: "modernize", l: "Equip & modernize", f: ["hardware_lifecycle", "technology_strategy"] },
  ],
  // Group headings are proposed copy (option E, picked by Joe 2026-10-03).
  groups: [
    { k: "now", h: "Something just happened", sub: "Urgent. Call if it is happening right now.", i: "triangle-alert" },
    { k: "grow", h: "We're growing or changing", sub: "New people, new places, new phones.", i: "trending-up" },
    { k: "prove", h: "We have to prove it or keep up", sub: "Insurers, auditors and an IT team out of hours.", i: "clipboard-check" },
  ],
  scenarios: [
    { t: "A phishing or spoofed email got through", p: "Someone clicked, or a client got mail pretending to be us.", f: ["security_awareness", "email_collaboration", "identity_access"], g: "now", inc: 1 },
    { t: "Our only IT person just left", p: "The passwords, the diagrams and the vendor logins walked out with them.", f: ["it_operations", "documentation_standards", "endpoint_devices"], g: "now", inc: 1 },
    { t: "We don't know if we'd recover from ransomware", p: "There is a backup somewhere; nobody has restored from it.", f: ["backup_continuity", "cybersecurity_operations", "endpoint_devices"], g: "now", inc: 1 },
    { t: "We're opening a second office", p: "Day one needs internet, phones and working computers, and nobody has done this before.", f: ["network_connectivity", "business_communications", "hardware_lifecycle"], g: "grow" },
    { t: "New hires need laptops and accounts fast", p: "People start Monday and the last onboarding took two weeks and three vendors.", f: ["hardware_lifecycle", "endpoint_devices", "identity_access"], g: "grow" },
    { t: "Half the team works from home on their own devices", p: "Company data lives on personal laptops and phones nobody manages.", f: ["endpoint_devices", "identity_access", "email_collaboration"], g: "grow" },
    { t: "Our phone system is old and the contract is ending", p: "Numbers have to move without dropping a call, and the network has to carry them.", f: ["business_communications", "network_connectivity"], g: "grow" },
    { t: "Cyber-insurance renewal sent a questionnaire we can't answer", p: "The form asks about MFA, backups and evidence, and the answers have to be true.", f: ["compliance_risk", "identity_access", "backup_continuity"], g: "prove" },
    { t: "A client or auditor asked for our policies and evidence", p: "A contract or an audit wants documents that do not exist yet.", f: ["compliance_risk", "documentation_standards", "technology_strategy"], g: "prove" },
    { t: "Our internal IT team is stretched thin", p: "Tickets pile up, patches slip, and security is whoever has time this week.", f: ["it_operations", "cybersecurity_operations", "endpoint_devices"], g: "prove" },
  ],
};
window.ic = (n, s = 20) => (window.ICONS[n] || "").replace(/width="20" height="20"/, `width="${s}" height="${s}"`);
