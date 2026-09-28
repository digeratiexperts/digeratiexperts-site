import type { CuratedSolutionFamily } from "@/data/curatedSolutions";

/**
 * Scenario starters for the public Store (Door 2).
 *
 * A scenario is a real SMB situation that composes a solution from the 13
 * canonical families — nothing else. It is guidance, not a product: tapping
 * one adds its families to Your Solution (with Undo), optionally suggests a
 * relationship with the reason shown, and never sets anything the buyer
 * cannot change. Every `why` line is drawn from the family's own public copy
 * in curatedSolutions.ts so the Store never claims more than the package does.
 *
 * Joe approves this list before it renders publicly (it is a public claim
 * about what DE would recommend for a situation).
 */
export type ScenarioRelationshipHint =
  | { suggest: "profile" }
  | { suggest: "standalone" | "co_managed"; reason: string };

export type SolutionScenario = {
  /** Stable id; used in `needs[].source` and the CRM description. */
  id: string;
  /** The situation in the buyer's words. Shown as the tile title. */
  title: string;
  /** One sentence of pressure, buyer voice. */
  pressure: string;
  /** Families this situation composes, primary first. 2–3, unique, canonical. */
  familyIds: CuratedSolutionFamily["id"][];
  /** One line per family, drawn from that family's public copy. */
  why: Record<string, string>;
  /** Whether the situation itself implies a relationship, or the profile decides. */
  relationship: ScenarioRelationshipHint;
};

export const solutionScenarios: SolutionScenario[] = [
  {
    id: "phishing-close-call",
    title: "A phishing email almost worked",
    pressure: "Someone clicked, or nearly did, and nobody is sure what else got through.",
    familyIds: ["security_awareness", "email_collaboration", "identity_access"],
    why: {
      security_awareness: "Phishing resilience and measurable behavior improvement for the people who got the email.",
      email_collaboration: "An email protection baseline so fewer of them arrive.",
      identity_access: "Stronger authentication so a stolen password is not enough.",
    },
    relationship: { suggest: "profile" },
  },
  {
    id: "insurance-questionnaire",
    title: "Cyber-insurance renewal sent a questionnaire we can't answer",
    pressure: "The form asks about MFA, backups and evidence, and the answers have to be true.",
    familyIds: ["compliance_risk", "identity_access", "backup_continuity"],
    why: {
      compliance_risk: "Risk and gap assessment, a control roadmap, and organized evidence for an insurer's requirements.",
      identity_access: "Multi-factor authentication policy and privileged-access review — the questions insurers ask first.",
      backup_continuity: "Restore testing and documented recovery expectations, not a backup checkbox.",
    },
    relationship: { suggest: "profile" },
  },
  {
    id: "second-location",
    title: "We're opening a second office",
    pressure: "Day one needs internet, phones and working computers, and nobody has done this before.",
    familyIds: ["network_connectivity", "business_communications", "hardware_lifecycle"],
    why: {
      network_connectivity: "Reliable, secure networks across offices, remote users and internet connections.",
      business_communications: "Number and call-flow planning so the new site rings on the first morning.",
      hardware_lifecycle: "Business-ready equipment with secure provisioning and deployment coordination.",
    },
    relationship: { suggest: "profile" },
  },
  {
    id: "it-person-left",
    title: "Our only IT person just left",
    pressure: "The passwords, the diagrams and the vendor logins walked out with them.",
    familyIds: ["it_operations", "documentation_standards", "endpoint_devices"],
    why: {
      it_operations: "A dependable support path for employees with routine issues resolved through documented escalation.",
      documentation_standards: "Current, usable environment knowledge instead of undocumented tribal knowledge.",
      endpoint_devices: "Consistent device health and maintenance while there is no one inside to do it.",
    },
    relationship: {
      suggest: "standalone",
      reason:
        "With no internal IT team left to share the work with, Standalone gives you the packaged solution now; you can move to Co-Managed when you hire.",
    },
  },
  {
    id: "internal-it-stretched",
    title: "Our internal IT team is stretched thin",
    pressure: "Tickets pile up, patches slip, and security is whoever has time this week.",
    familyIds: ["it_operations", "cybersecurity_operations", "endpoint_devices"],
    why: {
      it_operations: "Shared helpdesk, overflow and escalation capacity without replacing your team.",
      cybersecurity_operations: "Monitoring, investigation and escalation that augments internal staff.",
      endpoint_devices: "Unified endpoint visibility and a reduced maintenance burden for internal IT.",
    },
    relationship: {
      suggest: "co_managed",
      reason:
        "You have internal IT leadership: Co-Managed extends the team with defined shared responsibilities and can carry preferred pricing where that lowers delivery effort.",
    },
  },
  {
    id: "new-hires-fast",
    title: "New hires need laptops and accounts fast",
    pressure: "People start Monday and the last onboarding took two weeks and three vendors.",
    familyIds: ["hardware_lifecycle", "endpoint_devices", "identity_access"],
    why: {
      hardware_lifecycle: "Requirements-based selection and secure provisioning so the equipment arrives business-ready.",
      endpoint_devices: "Endpoint enrollment and baseline configuration on every new device.",
      identity_access: "Consistent joiner, mover and leaver handling so accounts exist on day one and close on the last.",
    },
    relationship: { suggest: "profile" },
  },
  {
    id: "auditor-evidence",
    title: "A client or auditor asked for our policies and evidence",
    pressure: "A contract or an audit wants documents that do not exist yet.",
    familyIds: ["compliance_risk", "documentation_standards", "technology_strategy"],
    why: {
      compliance_risk: "Requirements scoping, a control roadmap and evidence and policy readiness for the named obligation.",
      documentation_standards: "Asset and service inventory, diagrams, configuration standards and runbooks the evidence points to.",
      technology_strategy: "Standards, risk decisions and an accountable plan for the gaps the audit finds.",
    },
    relationship: { suggest: "profile" },
  },
  {
    id: "ransomware-recovery",
    title: "We don't know if we'd recover from ransomware",
    pressure: "There is a backup somewhere; nobody has restored from it.",
    familyIds: ["backup_continuity", "cybersecurity_operations", "endpoint_devices"],
    why: {
      backup_continuity: "Tested recovery, recovery-objective design and incident-ready recovery decisions.",
      cybersecurity_operations: "Earlier detection and containment of threats with documented incident coordination.",
      endpoint_devices: "Patch and health monitoring so the entry points are closed.",
    },
    relationship: { suggest: "profile" },
  },
  {
    id: "hybrid-byod",
    title: "Half the team works from home on their own devices",
    pressure: "Company data lives on personal laptops and phones nobody manages.",
    familyIds: ["endpoint_devices", "identity_access", "email_collaboration"],
    why: {
      endpoint_devices: "Defined company, personal and hybrid device handling with lifecycle controls.",
      identity_access: "Secure sign-ins and access governance from anywhere.",
      email_collaboration: "Collaboration policy and reduced mailbox, sharing and account risk.",
    },
    relationship: { suggest: "profile" },
  },
  {
    id: "phone-contract-ending",
    title: "Our phone system is old and the contract is ending",
    pressure: "Numbers have to move without dropping a call, and the network has to carry them.",
    familyIds: ["business_communications", "network_connectivity"],
    why: {
      business_communications: "Business calling, call flows, number transitions and communications support.",
      network_connectivity: "The connectivity the calls ride on, monitored and documented.",
    },
    relationship: { suggest: "profile" },
  },
];

export function getScenarioById(id: string): SolutionScenario | null {
  return solutionScenarios.find((scenario) => scenario.id === id) ?? null;
}

/**
 * What tapping a scenario would do to a draft, before it does it — so the tile
 * can say "Add these 3" or "2 of 3 already in" and the action stays honest.
 */
export function composeScenario(
  scenario: SolutionScenario,
  existingFamilyIds: readonly string[],
): { add: CuratedSolutionFamily["id"][]; alreadyIn: CuratedSolutionFamily["id"][] } {
  const existing = new Set(existingFamilyIds);
  return {
    add: scenario.familyIds.filter((id) => !existing.has(id)),
    alreadyIn: scenario.familyIds.filter((id) => existing.has(id)),
  };
}
