import { curatedSolutionFamilies, type CuratedSolutionFamily } from "@/data/curatedSolutions";
import { getFamilyById } from "@/lib/businessNeeds";
import {
  buildSolutionPackage,
  INSTALL_MODE_LABELS,
  preferredInstallMode,
  type InstallMode,
} from "@/lib/solutionPackage";
import {
  isProfileComplete,
  resolvedPackages,
  type DeliveryPreference,
  type SolutionDraft,
  type SolutionEnvironment,
} from "@/lib/solutionDraft";

type FamilyId = CuratedSolutionFamily["id"];

/* ------------------------------------------------------------------------ */
/* Eight security blocks — coverage as structure, never a score              */
/* ------------------------------------------------------------------------ */

export type SecurityBlockId =
  | "identity_access"
  | "endpoint"
  | "email_collaboration"
  | "browser_web"
  | "network"
  | "detection_response"
  | "human_risk"
  | "risk_exposure";

/**
 * The canonical eight (design/PROOF_SYSTEM.md; docs/CLAIMS-REGISTER.md).
 * Risk & Exposure is the continuous layer beneath and across the other seven
 * and is drawn as a band, not as an eighth identical cell.
 */
export const SECURITY_BLOCKS: ReadonlyArray<{ id: SecurityBlockId; label: string; layer: "block" | "continuous" }> = [
  { id: "identity_access", label: "Identity & Access", layer: "block" },
  { id: "endpoint", label: "Endpoint", layer: "block" },
  { id: "email_collaboration", label: "Email & Collaboration", layer: "block" },
  { id: "browser_web", label: "Browser & Web", layer: "block" },
  { id: "network", label: "Network", layer: "block" },
  { id: "detection_response", label: "Detection & Response", layer: "block" },
  { id: "human_risk", label: "Human Risk", layer: "block" },
  { id: "risk_exposure", label: "Risk & Exposure", layer: "continuous" },
];

/**
 * Which blocks each family genuinely works in. Conservative by design: a
 * family maps to a block only when its public `includes` deliver that block's
 * control. Families outside the eight (operations, communications, hardware,
 * documentation, strategy, continuity) map to nothing and are listed under
 * "Also in this solution". Browser & Web has no standalone family and is
 * pointed at Handle Our IT. Joe approves this map before it renders.
 */
export const FAMILY_SECURITY_BLOCKS: Record<FamilyId, SecurityBlockId[]> = {
  it_operations: [],
  endpoint_devices: ["endpoint"],
  identity_access: ["identity_access"],
  email_collaboration: ["email_collaboration"],
  cybersecurity_operations: ["detection_response"],
  network_connectivity: ["network"],
  backup_continuity: [],
  compliance_risk: ["risk_exposure"],
  security_awareness: ["human_risk"],
  business_communications: [],
  hardware_lifecycle: [],
  documentation_standards: [],
  technology_strategy: [],
};

export type CoverageState = "in_solution" | "available" | "handle_our_it";

export type CoverageCell = {
  id: SecurityBlockId;
  label: string;
  layer: "block" | "continuous";
  state: CoverageState;
  /** Families in the draft that work in this block. */
  coveredBy: FamilyId[];
  /** When `available`: the family whose Add would cover it. */
  addFamilyId?: FamilyId;
};

export type CoverageView = {
  cells: CoverageCell[];
  /** Families in the draft that sit outside the eight blocks. */
  outsideBlocks: FamilyId[];
  /** True only when every block is in the solution — never reachable on Door 2 today (Browser & Web). */
  complete: boolean;
};

function familyCoveringBlock(block: SecurityBlockId): FamilyId | undefined {
  return curatedSolutionFamilies.find((family) => FAMILY_SECURITY_BLOCKS[family.id].includes(block))?.id;
}

export function coverageForFamilies(familyIds: readonly string[]): CoverageView {
  const selected = familyIds.filter((id): id is FamilyId => id in FAMILY_SECURITY_BLOCKS);
  const cells = SECURITY_BLOCKS.map<CoverageCell>((block) => {
    const coveredBy = selected.filter((id) => FAMILY_SECURITY_BLOCKS[id].includes(block.id));
    if (coveredBy.length > 0) return { ...block, state: "in_solution", coveredBy };
    const addFamilyId = familyCoveringBlock(block.id);
    if (!addFamilyId) return { ...block, state: "handle_our_it", coveredBy: [] };
    return { ...block, state: "available", coveredBy: [], addFamilyId };
  });
  return {
    cells,
    outsideBlocks: selected.filter((id) => FAMILY_SECURITY_BLOCKS[id].length === 0),
    complete: cells.every((cell) => cell.state === "in_solution"),
  };
}

/* ------------------------------------------------------------------------ */
/* Relationship suggestion — from the profile, shown with its reason         */
/* ------------------------------------------------------------------------ */

export type RelationshipSuggestion = {
  value: Exclude<DeliveryPreference, "unsure">;
  reason: string;
};

/**
 * Suggests Standalone or Co-Managed from the one profile fact that decides it.
 * Never applied without a click; the chooser shows "Suggested from your
 * profile" and the reason. `null` means "no suggestion — Help me choose".
 */
export function suggestRelationship(environment: SolutionEnvironment): RelationshipSuggestion | null {
  if (environment.internalIt === "yes") {
    return {
      value: "co_managed",
      reason:
        "You have an internal IT team. Co-Managed extends it with defined shared responsibilities and can carry preferred pricing where the relationship lowers delivery effort.",
    };
  }
  if (environment.internalIt === "no") {
    return {
      value: "standalone",
      reason:
        "You told us there is no internal IT team to share the work with. Standalone gives you the packaged DE solution; you or your IT provider run it day to day.",
    };
  }
  return null;
}

/* ------------------------------------------------------------------------ */
/* "DE recommends next" hints — derived from prerequisites and boundaries    */
/* ------------------------------------------------------------------------ */

export type HintAction =
  | { type: "add_family"; familyId: FamilyId }
  | { type: "set_relationship"; value: DeliveryPreference }
  | { type: "set_setup"; familyId: FamilyId; value: InstallMode }
  | { type: "edit_profile" }
  | { type: "none" };

export type SolutionHint = {
  id: string;
  kind: "add_family" | "relationship" | "assessment" | "setup" | "profile";
  title: string;
  /** Quotes or paraphrases the family prerequisite/boundary the hint comes from. */
  reason: string;
  /** Family whose public copy the reason is drawn from. */
  sourceFamilyId?: FamilyId;
  action: HintAction;
  /** Label for the action button; absent when the hint is explanation only. */
  actionLabel?: string;
};

function has(draft: SolutionDraft, familyId: FamilyId): boolean {
  return draft.needs.some((need) => need.familyId === familyId);
}

function familyLabel(id: FamilyId): string {
  return getFamilyById(id)?.label ?? id;
}

type HintRule = {
  id: string;
  when: (draft: SolutionDraft) => boolean;
  build: (draft: SolutionDraft) => SolutionHint;
};

const addFamilyRule = (
  id: string,
  present: FamilyId,
  missing: FamilyId,
  sourceFamilyId: FamilyId,
  reason: string,
): HintRule => ({
  id,
  when: (draft) => has(draft, present) && !has(draft, missing),
  build: () => ({
    id,
    kind: "add_family",
    title: `Add ${familyLabel(missing)}?`,
    reason,
    sourceFamilyId,
    action: { type: "add_family", familyId: missing },
    actionLabel: `Add ${familyLabel(missing)}`,
  }),
});

/** Ordered by priority; the UI shows at most MAX_HINTS after dismissals. */
export const HINT_RULES: HintRule[] = [
  {
    id: "profile-incomplete",
    when: (draft) => draft.needs.length > 0 && !isProfileComplete(draft.environment),
    build: (draft) => ({
      id: "profile-incomplete",
      kind: "profile",
      title: "Add your counts to size every package",
      reason: `${draft.needs.length} package${draft.needs.length === 1 ? "" : "s"} will show quantities the moment users, computers, mobile devices and sites are set.`,
      action: { type: "edit_profile" },
      actionLabel: "Finish the profile",
    }),
  },
  {
    id: "co-managed-without-internal-it",
    when: (draft) => draft.deliveryPreference === "co_managed" && draft.environment.internalIt === "no",
    build: () => ({
      id: "co-managed-without-internal-it",
      kind: "relationship",
      title: "Co-Managed needs an internal IT owner",
      reason:
        "Co-Managed packages start from a named internal IT owner and an approved responsibility matrix. You told us there is no internal IT team — Standalone may fit, or leave the choice with DE.",
      sourceFamilyId: "it_operations",
      action: { type: "set_relationship", value: "unsure" },
      actionLabel: "Let DE recommend",
    }),
  },
  {
    id: "assessment-required",
    when: (draft) => resolvedPackages(draft).some((entry) => entry.policyView.assessmentPolicy === "required"),
    build: (draft) => {
      const families = resolvedPackages(draft)
        .filter((entry) => entry.policyView.assessmentPolicy === "required")
        .map((entry) => entry.family.label);
      return {
        id: "assessment-required",
        kind: "assessment",
        title: "An assessment comes before final scope",
        reason: `${families.join(" and ")} start from a cyber risk assessment and an approved remediation baseline. DE routes it after you submit; nothing else waits on it.`,
        sourceFamilyId: "cybersecurity_operations",
        action: { type: "none" },
      };
    },
  },
  {
    id: "onsite-chosen-when-remote-available",
    when: (draft) =>
      draft.fulfillment.installation === "onsite" &&
      resolvedPackages(draft).some((entry) => preferredInstallMode(entry.policyView.installModes) !== "onsite"),
    build: (draft) => {
      const entry = resolvedPackages(draft).find((candidate) => preferredInstallMode(candidate.policyView.installModes) !== "onsite")!;
      const family = entry.family;
      const preferred = preferredInstallMode(entry.policyView.installModes) ?? "remote_assist";
      return {
        id: "onsite-chosen-when-remote-available",
        kind: "setup",
        title: `${INSTALL_MODE_LABELS[preferred].label} is available for ${family.label}`,
        reason:
          "On-site work is the last resort — Truck-Roll, Trip Charge and Tech Labor apply, and it is scheduled only when remote setup and shipped equipment cannot do the job.",
        sourceFamilyId: family.id,
        action: { type: "set_setup", familyId: family.id, value: preferred },
        actionLabel: `Use ${INSTALL_MODE_LABELS[preferred].label}`,
      };
    },
  },
  addFamilyRule(
    "it-ops-excludes-security",
    "it_operations",
    "cybersecurity_operations",
    "it_operations",
    "IT Operations & Support excludes security operations, projects, compliance, backup and strategy unless separately approved.",
  ),
  addFamilyRule(
    "it-ops-excludes-backup",
    "it_operations",
    "backup_continuity",
    "it_operations",
    "IT Operations & Support excludes backup unless separately approved; Backup & Business Continuity adds tested recovery.",
  ),
  addFamilyRule(
    "cyber-without-recovery",
    "cybersecurity_operations",
    "backup_continuity",
    "cybersecurity_operations",
    "Cybersecurity Operations detects and responds; it never promises that nothing gets through. Backup & Business Continuity is the recovery half of the same decision.",
  ),
  addFamilyRule(
    "awareness-without-email-controls",
    "security_awareness",
    "email_collaboration",
    "security_awareness",
    "Training reduces risk but does not replace technical security controls. Email & Collaboration adds the email protection baseline.",
  ),
  addFamilyRule(
    "hardware-without-endpoint",
    "hardware_lifecycle",
    "endpoint_devices",
    "hardware_lifecycle",
    "New equipment follows the approved order scope; Endpoint & Device Management keeps it enrolled, patched and inventoried afterwards.",
  ),
  addFamilyRule(
    "communications-without-network",
    "business_communications",
    "network_connectivity",
    "business_communications",
    "Business Communications starts from a connectivity and emergency-calling assessment; Network & Connectivity is what the calls ride on.",
  ),
  addFamilyRule(
    "compliance-without-documentation",
    "compliance_risk",
    "documentation_standards",
    "compliance_risk",
    "Evidence and policy readiness points at inventories, diagrams and runbooks; Documentation & Standards produces them.",
  ),
  {
    id: "standalone-with-internal-it",
    when: (draft) => draft.deliveryPreference === "standalone" && draft.environment.internalIt === "yes",
    build: () => ({
      id: "standalone-with-internal-it",
      kind: "relationship",
      title: "Co-Managed is built for teams like yours",
      reason:
        "Standalone is a fine choice. With an internal IT team, Co-Managed shares defined responsibilities and can carry preferred pricing where that lowers delivery effort, never a blanket price cut.",
      sourceFamilyId: "it_operations",
      action: { type: "set_relationship", value: "co_managed" },
      actionLabel: "Compare Co-Managed",
    }),
  },
];

/** The one dismissible suggestion id shared by every screen that shows the relationship suggestion. */
export const RELATIONSHIP_SUGGESTION_HINT = "relationship-suggestion";

export const MAX_HINTS = 3;

export function nextHints(draft: SolutionDraft, dismissed: readonly string[] = []): SolutionHint[] {
  const skip = new Set(dismissed);
  const hints: SolutionHint[] = [];
  for (const rule of HINT_RULES) {
    if (hints.length >= MAX_HINTS) break;
    if (skip.has(rule.id) || !rule.when(draft)) continue;
    hints.push(rule.build(draft));
  }
  return hints;
}

/* ------------------------------------------------------------------------ */
/* Ask DE seeding — the one advisor, seeded with the solution                */
/* ------------------------------------------------------------------------ */

const RELATIONSHIP_WORDS: Record<DeliveryPreference | "", string> = {
  standalone: "Standalone",
  co_managed: "Co-Managed",
  unsure: "relationship left with DE to recommend",
  "": "relationship not chosen yet",
};

/**
 * Builds the seed message for the existing DE Desk advisor. Public words only:
 * family labels, the relationship, the profile counts, and — after submit —
 * the reference. Never an enum, never an offer id.
 */
export function solutionAdvisorSeed(
  draft: SolutionDraft,
  options: { familyLabel?: string; reference?: string; question?: string } = {},
): string {
  const families = draft.needs.map((need) => familyLabel(need.familyId));
  const profile = [
    draft.environment.userCount && `${draft.environment.userCount} users`,
    draft.environment.siteCount && `${draft.environment.siteCount} site${draft.environment.siteCount === "1" ? "" : "s"}`,
    draft.environment.internalIt === "yes" && "internal IT team",
    draft.environment.internalIt === "no" && "no internal IT",
  ].filter(Boolean);
  const parts: string[] = [];
  if (options.reference) {
    parts.push(`I submitted solution ${options.reference} in the DE Store.`);
  } else if (options.familyLabel) {
    parts.push(`I'm looking at ${options.familyLabel} in the DE Store.`);
  } else {
    parts.push("I'm building a solution in the DE Store.");
  }
  if (families.length > 0) parts.push(`Your Solution so far: ${families.join(", ")} (${RELATIONSHIP_WORDS[draft.deliveryPreference]}).`);
  if (profile.length > 0) parts.push(`Profile: ${profile.join(", ")}.`);
  parts.push(options.question ?? "Can you help me decide what fits?");
  return parts.join(" ");
}
