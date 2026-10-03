/**
 * Anonymous operating situation — the facts a public form may remember
 * across doors. Never identity.
 *
 * Source is the Store Solution Draft (`de-solution-draft-v2`). The Hub / CRM
 * receives this payload only on submit. The browser never stores name, email,
 * phone, or company as part of this object.
 *
 * Extra keys (including obvious identity fields) are dropped on parse, even
 * if a client or attacker posts them.
 */

export const ANONYMOUS_SITUATION_VERSION = 1 as const;

export const SITUATION_FAMILY_IDS = [
  "it_operations",
  "endpoint_devices",
  "identity_access",
  "email_collaboration",
  "cybersecurity_operations",
  "network_connectivity",
  "backup_continuity",
  "compliance_risk",
  "security_awareness",
  "business_communications",
  "hardware_lifecycle",
  "documentation_standards",
  "technology_strategy",
] as const;

export type SituationFamilyId = (typeof SITUATION_FAMILY_IDS)[number];

/** Public family labels — kept here so server CRM copy does not import client data. */
export const SITUATION_FAMILY_LABELS: Record<SituationFamilyId, string> = {
  it_operations: "IT Operations & Support",
  endpoint_devices: "Endpoint & Device Management",
  identity_access: "Identity & Access",
  email_collaboration: "Email & Collaboration",
  cybersecurity_operations: "Cybersecurity Operations",
  network_connectivity: "Network & Connectivity",
  backup_continuity: "Backup & Business Continuity",
  compliance_risk: "Compliance & Risk Readiness",
  security_awareness: "Security Awareness & Human Risk",
  business_communications: "Business Communications",
  hardware_lifecycle: "Hardware & Lifecycle",
  documentation_standards: "Documentation & Standards",
  technology_strategy: "Technology Strategy & Advisory",
};

const FAMILY_ID_SET: ReadonlySet<string> = new Set(SITUATION_FAMILY_IDS);

export type SituationRelationship = "standalone" | "co_managed" | "unsure" | "";
export type SituationOwnership = "company" | "byod" | "hybrid" | "";
export type SituationInternalIt = "yes" | "no" | "unsure" | "";
export type SituationIntent = "request" | "quote" | "assessment" | "consultation" | "";
export type SituationInstallation = "self_install" | "remote_assist" | "onsite" | "unsure" | "";
export type SituationRemoteSupport = "none" | "as_needed" | "ongoing" | "unsure" | "";

export type AnonymousSituationNeed = {
  familyId: SituationFamilyId;
  /** Scenario starter id, when one composed this need. Never free text. */
  source?: string;
};

export type AnonymousSituation = {
  version: typeof ANONYMOUS_SITUATION_VERSION;
  users: string;
  workstations: string;
  mobiles: string;
  sites: string;
  deviceOwnership: SituationOwnership;
  internalIt: SituationInternalIt;
  needs: AnonymousSituationNeed[];
  relationship: SituationRelationship;
  installation: SituationInstallation;
  remoteSupport: SituationRemoteSupport;
  intent: SituationIntent;
};

/** Keys that must never survive parse, even if a client posts them. */
export const SITUATION_IDENTITY_KEYS = [
  "name",
  "fullName",
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "organization",
  "organizationName",
  "contactName",
  "contactEmail",
  "contactPhone",
  "address",
  "website",
  "ip",
  "userAgent",
  "message",
] as const;

const OWNERSHIP: ReadonlySet<string> = new Set(["company", "byod", "hybrid"]);
const INTERNAL_IT: ReadonlySet<string> = new Set(["yes", "no", "unsure"]);
const RELATIONSHIP: ReadonlySet<string> = new Set(["standalone", "co_managed", "unsure"]);
const INTENT: ReadonlySet<string> = new Set(["request", "quote", "assessment", "consultation"]);
const INSTALLATION: ReadonlySet<string> = new Set(["self_install", "remote_assist", "onsite", "unsure"]);
const REMOTE_SUPPORT: ReadonlySet<string> = new Set(["none", "as_needed", "ongoing", "unsure"]);

function count(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^\d{1,6}$/.test(trimmed) ? trimmed : "";
}

function asEnum<T extends string>(value: unknown, allowed: ReadonlySet<string>): T | "" {
  return typeof value === "string" && allowed.has(value) ? (value as T) : "";
}

function asFamilyId(value: unknown): SituationFamilyId | null {
  return typeof value === "string" && FAMILY_ID_SET.has(value) ? (value as SituationFamilyId) : null;
}

function asSource(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clipped = value.trim().slice(0, 60);
  return /^[a-z0-9-]{1,60}$/.test(clipped) ? clipped : undefined;
}

export function emptyAnonymousSituation(): AnonymousSituation {
  return {
    version: ANONYMOUS_SITUATION_VERSION,
    users: "",
    workstations: "",
    mobiles: "",
    sites: "",
    deviceOwnership: "",
    internalIt: "",
    needs: [],
    relationship: "",
    installation: "",
    remoteSupport: "",
    intent: "",
  };
}

/**
 * True when there is at least one operating fact a downstream form can use.
 * An empty object is not a situation.
 */
export function hasUsableSituation(situation: AnonymousSituation | null | undefined): situation is AnonymousSituation {
  if (!situation) return false;
  return (
    situation.users !== "" ||
    situation.workstations !== "" ||
    situation.mobiles !== "" ||
    situation.sites !== "" ||
    situation.deviceOwnership !== "" ||
    situation.internalIt !== "" ||
    situation.needs.length > 0 ||
    situation.relationship !== ""
  );
}

/**
 * Strict allow-list parse. Unknown keys and identity fields are dropped.
 * Returns null when nothing usable remains.
 */
export function parseAnonymousSituation(raw: unknown): AnonymousSituation | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Record<string, unknown>;
  const needsInput = Array.isArray(input.needs) ? input.needs : [];
  const seen = new Set<SituationFamilyId>();
  const needs: AnonymousSituationNeed[] = [];
  for (const entry of needsInput) {
    if (!entry || typeof entry !== "object") continue;
    const familyId = asFamilyId((entry as { familyId?: unknown }).familyId);
    if (!familyId || seen.has(familyId)) continue;
    seen.add(familyId);
    const source = asSource((entry as { source?: unknown }).source);
    needs.push(source ? { familyId, source } : { familyId });
  }

  const situation: AnonymousSituation = {
    version: ANONYMOUS_SITUATION_VERSION,
    users: count(input.users),
    workstations: count(input.workstations),
    mobiles: count(input.mobiles),
    sites: count(input.sites),
    deviceOwnership: asEnum<SituationOwnership>(input.deviceOwnership, OWNERSHIP),
    internalIt: asEnum<SituationInternalIt>(input.internalIt, INTERNAL_IT),
    needs,
    relationship: asEnum<SituationRelationship>(input.relationship, RELATIONSHIP),
    installation: asEnum<SituationInstallation>(input.installation, INSTALLATION),
    remoteSupport: asEnum<SituationRemoteSupport>(input.remoteSupport, REMOTE_SUPPORT),
    intent: asEnum<SituationIntent>(input.intent, INTENT),
  };
  return hasUsableSituation(situation) ? situation : null;
}

function countPhrase(value: string, singular: string, plural: string): string | null {
  if (!value) return null;
  return `${Number(value)} ${Number(value) === 1 ? singular : plural}`;
}

function ownershipPhrase(value: SituationOwnership): string | null {
  if (value === "company") return "company-owned devices";
  if (value === "byod") return "BYOD";
  if (value === "hybrid") return "hybrid device ownership";
  return null;
}

function itPhrase(value: SituationInternalIt): string | null {
  if (value === "yes") return "internal IT team";
  if (value === "no") return "no internal IT";
  if (value === "unsure") return "internal IT not sure";
  return null;
}

function relationshipPhrase(value: SituationRelationship): string | null {
  if (value === "standalone") return "Standalone";
  if (value === "co_managed") return "Co-Managed";
  if (value === "unsure") return "relationship left with DE";
  return null;
}

/** Short public line for UI strips and Ask DE. Public words only. */
export function situationPublicLine(situation: AnonymousSituation): string {
  const counts = [
    countPhrase(situation.users, "user", "users"),
    countPhrase(situation.workstations, "computer", "computers"),
    countPhrase(situation.mobiles, "mobile device", "mobile devices"),
    countPhrase(situation.sites, "site", "sites"),
  ].filter(Boolean);
  const profileBits = [...counts, ownershipPhrase(situation.deviceOwnership), itPhrase(situation.internalIt)].filter(
    Boolean,
  ) as string[];
  const families = situation.needs.map((need) => SITUATION_FAMILY_LABELS[need.familyId]);
  const parts: string[] = [];
  if (profileBits.length > 0) parts.push(profileBits.join(" · "));
  if (families.length > 0) parts.push(families.join(", "));
  const relationship = relationshipPhrase(situation.relationship);
  if (relationship) parts.push(relationship);
  return parts.join(" — ");
}

function installationPhrase(value: SituationInstallation): string | null {
  if (value === "remote_assist") return "Remote DE setup";
  if (value === "self_install") return "Ship and self-install";
  if (value === "onsite") return "On-site technician requested";
  if (value === "unsure") return "Installation left with DE";
  return null;
}

function remotePhrase(value: SituationRemoteSupport): string | null {
  if (value === "none") return "No remote support requested";
  if (value === "as_needed") return "Remote support as needed";
  if (value === "ongoing") return "Ongoing remote support";
  if (value === "unsure") return "Remote support left with DE";
  return null;
}

function intentPhrase(value: SituationIntent): string | null {
  if (value === "assessment") return "Assessment";
  if (value === "quote") return "Quote";
  if (value === "consultation") return "Consultation";
  if (value === "request") return "Request";
  return null;
}

/**
 * CRM / Hub description block. Public words only. Never includes identity.
 * Clip is applied by the caller if the host field has a limit.
 */
export function formatSituationForCrm(situation: AnonymousSituation): string {
  const lines = ["Store situation (anonymous, no contact fields):"];
  const line = situationPublicLine(situation);
  if (line) lines.push(line);
  const extras = [
    installationPhrase(situation.installation),
    remotePhrase(situation.remoteSupport),
    intentPhrase(situation.intent) ? `Derived next step: ${intentPhrase(situation.intent)}` : null,
  ].filter(Boolean) as string[];
  if (extras.length > 0) lines.push(extras.join(" · "));
  for (const need of situation.needs) {
    if (need.source) lines.push(`Started from situation: ${need.source}`);
  }
  return lines.join("\n");
}

/** Append the situation block to a CRM description without duplicating blanks. */
export function appendSituationToDescription(base: string, situation: AnonymousSituation | null, max = 4000): string {
  const body = (base || "").trim();
  if (!situation) return body.slice(0, max);
  const block = formatSituationForCrm(situation);
  const joined = body ? `${body}\n\n${block}` : block;
  return joined.slice(0, max);
}

/** Contact "Service Interested In" value when the situation makes one obvious. Empty if mixed. */
export function suggestedContactService(situation: AnonymousSituation): string {
  const ids = new Set(situation.needs.map((need) => need.familyId));
  if (situation.intent === "assessment") return "assessment";
  if (ids.has("compliance_risk") && ids.size === 1) return "compliance";
  const security = ["cybersecurity_operations", "identity_access", "backup_continuity", "security_awareness"] as const;
  if (security.some((id) => ids.has(id)) && ![...ids].some((id) => id === "it_operations" || id === "endpoint_devices")) {
    return "managed-security";
  }
  if ((ids.has("it_operations") || ids.has("endpoint_devices")) && !security.some((id) => ids.has(id))) {
    return "managed-it";
  }
  return "";
}
