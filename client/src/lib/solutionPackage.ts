import type { CuratedDeliveryModel, CuratedSolutionFamily } from "@/data/curatedSolutions";

/**
 * Public package and fulfillment policy for the Store (Door 2).
 *
 * This module is the only owner of: how a package line is sized from the
 * business profile, whether an assessment is required, what ships, how it is
 * installed, who comes on site, and every customer-facing label for those
 * facts. Screens and the CRM description render from here; no screen may
 * invent a label or size a line on its own. Source of truth:
 * docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §6.3.
 */

export type SolutionSizingProfile = {
  userCount?: string;
  workstationCount?: string;
  mobileDeviceCount?: string;
  siteCount?: string;
};

export type AssessmentPolicy = "required" | "recommended" | "not_required";
export type ShipmentMode = "none" | "conditional" | "physical";
export type TechnicianPolicy = "not_needed" | "available" | "scope_dependent";
export type InstallMode = "self_install" | "remote_assist" | "onsite";
export type RemoteSupportMode = "none" | "as_needed" | "ongoing" | "unsure";
export type SolutionActionIntent = "request" | "quote" | "assessment" | "consultation";

/**
 * How a package line is sized from the one business profile. Explicit per
 * line (LINE_BASIS below) so a label like "Helpdesk intake and triage" is
 * sized per covered user because DE says so, not because a regex happened to
 * match a word in it.
 */
export type LineBasis = "user" | "device" | "computer" | "site" | "once";

export const LINE_BASIS_LABELS: Record<LineBasis, string> = {
  user: "per covered user",
  device: "per approved device",
  computer: "per primary computer",
  site: "per site",
  once: "included once",
};

export type SolutionLineItem = {
  label: string;
  quantity: string;
  basis: LineBasis;
};

export type SolutionPackageView = {
  offerId: string;
  offerName: string;
  relationshipLabel: string;
  relationshipSummary: string;
  pricingPosition: "standard" | "preferred";
  pricingLabel: string;
  lineItems: SolutionLineItem[];
  assessmentPolicy: AssessmentPolicy;
  primaryIntent: SolutionActionIntent;
  shipmentMode: ShipmentMode;
  shipmentCopy: string;
  installModes: InstallMode[];
  technicianPolicy: TechnicianPolicy;
  technicianCopy: string;
  remoteSupportAvailable: boolean;
  remoteSupportCopy: string;
};

type FamilyPolicy = {
  assessmentPolicy: AssessmentPolicy;
  shipmentMode: ShipmentMode;
  installModes: InstallMode[];
  technicianPolicy: TechnicianPolicy;
};

/* ------------------------------------------------------------------------ */
/* DE fulfillment order                                                       */
/* ------------------------------------------------------------------------ */

/**
 * DE fulfillment rule (Joe, 2026-09-27): remote support and shipping come
 * before Truck-Roll, Trip Charge and Tech Labor. This is the order every
 * Delivery & Setup surface lists, defaults and prints installation options in.
 * On-site work is the last resort, chosen only when remote setup and shipped
 * equipment cannot do the job.
 */
export const INSTALL_MODE_ORDER: readonly InstallMode[] = ["remote_assist", "self_install", "onsite"];

export const INSTALL_MODE_LABELS: Record<InstallMode, { label: string; detail: string }> = {
  remote_assist: {
    label: "Remote DE setup",
    detail: "DE does the setup over a secure remote session. First choice wherever the package allows it.",
  },
  self_install: {
    label: "Set it up yourself, DE guides remotely",
    detail: "Your team follows DE's guided setup; remote help is available if you get stuck.",
  },
  onsite: {
    label: "On-site technician",
    detail: "Truck-Roll, Trip Charge and Tech Labor. Only when remote setup and shipped equipment cannot do the job.",
  },
};

/**
 * The install label must say what actually ships. Nothing ships for a digital
 * package, so "self-install" is guided setup there and a shipped box for
 * physical or conditional packages.
 */
export function installModeDetail(mode: InstallMode, shipmentMode: ShipmentMode): { label: string; detail: string } {
  const ships = shipmentMode !== "none";
  if (mode === "self_install") {
    return ships
      ? {
          label: "Shipped to you, set it up yourself",
          detail: "Equipment arrives ready; you plug in with DE on the phone, or DE finishes remotely.",
        }
      : INSTALL_MODE_LABELS.self_install;
  }
  if (mode === "remote_assist" && ships) {
    return {
      label: "Remote DE setup",
      detail: "Equipment ships to you; DE sets it up remotely once it arrives.",
    };
  }
  return INSTALL_MODE_LABELS[mode];
}

/** Sort any install-mode list into DE's order of preference. */
export function sortInstallModes(modes: readonly InstallMode[]): InstallMode[] {
  return INSTALL_MODE_ORDER.filter((mode) => modes.includes(mode));
}

/** The default suggestion: the earliest option in DE's order that the package supports. */
export function preferredInstallMode(modes: readonly InstallMode[]): InstallMode | null {
  return sortInstallModes(modes)[0] ?? null;
}

/**
 * One buyer preference, resolved per package. When a package cannot honour the
 * preference the resolution falls back to that package's own first choice and
 * says why, so a choice made for shipped hardware never dead-ends an advisory
 * package.
 */
export function resolveInstallMode(
  preference: InstallMode | "unsure" | "",
  view: Pick<SolutionPackageView, "installModes">,
): { mode: InstallMode; reason?: string } {
  const preferred = preferredInstallMode(view.installModes) ?? "remote_assist";
  if (!preference || preference === "unsure") return { mode: preferred };
  if (view.installModes.includes(preference)) return { mode: preference };
  const reason =
    preference === "onsite"
      ? "on-site is not offered for this package"
      : preference === "self_install"
        ? "shipping does not apply to this package"
        : "remote setup is not offered for this package";
  return { mode: preferred, reason };
}

/* ------------------------------------------------------------------------ */
/* Family policies                                                            */
/* ------------------------------------------------------------------------ */

const DIGITAL: Pick<FamilyPolicy, "shipmentMode" | "installModes" | "technicianPolicy"> = {
  shipmentMode: "none",
  installModes: ["remote_assist", "self_install"],
  technicianPolicy: "not_needed",
};

const HYBRID_DELIVERY: Pick<FamilyPolicy, "shipmentMode" | "installModes" | "technicianPolicy"> = {
  shipmentMode: "conditional",
  installModes: ["remote_assist", "self_install", "onsite"],
  technicianPolicy: "scope_dependent",
};

/** Advice has nothing to self-install and nothing to ship: remote only. */
const ADVISORY: Pick<FamilyPolicy, "shipmentMode" | "installModes" | "technicianPolicy"> = {
  shipmentMode: "none",
  installModes: ["remote_assist"],
  technicianPolicy: "not_needed",
};

export const FAMILY_PACKAGE_POLICY: Record<CuratedSolutionFamily["id"], FamilyPolicy> = {
  it_operations: {
    assessmentPolicy: "not_required",
    shipmentMode: "none",
    installModes: ["remote_assist", "onsite"],
    technicianPolicy: "available",
  },
  endpoint_devices: { assessmentPolicy: "not_required", ...HYBRID_DELIVERY },
  identity_access: { assessmentPolicy: "recommended", ...DIGITAL },
  email_collaboration: { assessmentPolicy: "not_required", ...DIGITAL },
  cybersecurity_operations: { assessmentPolicy: "required", ...DIGITAL },
  network_connectivity: { assessmentPolicy: "recommended", ...HYBRID_DELIVERY },
  backup_continuity: { assessmentPolicy: "recommended", ...DIGITAL },
  compliance_risk: { assessmentPolicy: "required", ...ADVISORY },
  security_awareness: { assessmentPolicy: "not_required", ...DIGITAL },
  business_communications: { assessmentPolicy: "not_required", ...HYBRID_DELIVERY },
  hardware_lifecycle: {
    assessmentPolicy: "not_required",
    shipmentMode: "physical",
    installModes: ["remote_assist", "self_install", "onsite"],
    technicianPolicy: "available",
  },
  documentation_standards: { assessmentPolicy: "recommended", ...ADVISORY },
  technology_strategy: { assessmentPolicy: "recommended", ...ADVISORY },
};

/* ------------------------------------------------------------------------ */
/* Sizing                                                                     */
/* ------------------------------------------------------------------------ */

/**
 * Sizing basis for every public package line, aligned by index with each
 * offer's `includes` in curatedSolutions.ts (the public API keeps `includes`
 * as plain strings; this table is the policy layer beside it). The table in
 * docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §6.3 is the decided version.
 * Guarded by solutionPackage.sizing.test.ts, which fails when a line is added
 * without a basis or the order drifts.
 */
export const LINE_BASIS: Record<string, readonly LineBasis[]> = {
  "de-it-operations-standalone": ["user", "computer", "device", "once"],
  "de-it-operations-co-managed": ["user", "user", "device", "once"],
  "de-endpoint-standalone": ["device", "device", "device", "once"],
  "de-endpoint-co-managed": ["device", "device", "once", "once"],
  "de-identity-standalone": ["user", "once", "user", "once"],
  "de-identity-co-managed": ["user", "once", "user", "once"],
  "de-collaboration-standalone": ["once", "user", "once", "user"],
  "de-collaboration-co-managed": ["once", "user", "once", "once"],
  "de-cybersecurity-standalone": ["device", "device", "once", "once"],
  "de-cybersecurity-co-managed": ["device", "once", "once", "once"],
  "de-network-standalone": ["site", "site", "site", "once"],
  "de-network-co-managed": ["site", "site", "once", "once"],
  "de-continuity-standalone": ["computer", "once", "once", "once"],
  "de-continuity-co-managed": ["computer", "once", "once", "once"],
  "de-compliance-standalone": ["once", "once", "once", "once"],
  "de-compliance-co-managed": ["once", "once", "once", "once"],
  "de-awareness-standalone": ["user", "user", "user", "once"],
  "de-awareness-co-managed": ["user", "user", "once", "once"],
  "de-communications-standalone": ["once", "site", "user", "user"],
  "de-communications-co-managed": ["user", "site", "user", "once"],
  "de-hardware-standalone": ["once", "computer", "site", "computer"],
  "de-hardware-co-managed": ["once", "computer", "site", "computer"],
  "de-documentation-standalone": ["once", "site", "once", "once"],
  "de-documentation-co-managed": ["once", "once", "once", "once"],
  "de-strategy-standalone": ["once", "once", "once", "once"],
  "de-strategy-co-managed": ["once", "once", "once", "once"],
};

function cleanCount(value?: string): string {
  const candidate = String(value ?? "").trim();
  return /^\d{1,6}$/.test(candidate) && Number(candidate) > 0 ? candidate : "";
}

function plural(count: string, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === "1" ? singular : pluralForm}`;
}

/** Formats a line quantity from its basis and the profile; honest basis phrases when a count is not set yet. */
export function formatQuantity(basis: LineBasis, profile: SolutionSizingProfile): string {
  const users = cleanCount(profile.userCount);
  const workstations = cleanCount(profile.workstationCount);
  const mobiles = cleanCount(profile.mobileDeviceCount);
  const sites = cleanCount(profile.siteCount);
  switch (basis) {
    case "user":
      return users ? plural(users, "user") : "Per covered user";
    case "device":
      if (workstations && mobiles) return `${plural(workstations, "computer")} + ${plural(mobiles, "mobile device")}`;
      if (workstations) return plural(workstations, "computer");
      if (mobiles) return plural(mobiles, "mobile device");
      return "Per approved device";
    case "computer":
      return workstations ? plural(workstations, "computer") : "Per primary computer";
    case "site":
      return sites ? plural(sites, "site") : "Per site";
    case "once":
    default:
      return "Included once";
  }
}

/** Fallback for a line that has no entry in LINE_BASIS (future data); the table is the truth. */
function inferBasis(familyId: CuratedSolutionFamily["id"], label: string): LineBasis {
  const lower = label.toLowerCase();
  if (/site|location|network|internet|wan|office/.test(lower)) return "site";
  if (/endpoint|device|workstation|computer|patch|health|inventory/.test(lower)) return "device";
  if (/user|identity|account|mailbox|training|license|access|mfa|onboarding/.test(lower)) return "user";
  if (familyId === "hardware_lifecycle") return "computer";
  return "once";
}

export function lineBasisFor(offerId: string, familyId: CuratedSolutionFamily["id"], index: number, label: string): LineBasis {
  return LINE_BASIS[offerId]?.[index] ?? inferBasis(familyId, label);
}

/* ------------------------------------------------------------------------ */
/* Labels — the only place an enum becomes words                             */
/* ------------------------------------------------------------------------ */

export const RELATIONSHIP_LABELS: Record<CuratedDeliveryModel | "unsure" | "", string> = {
  standalone: "Standalone",
  co_managed: "Co-Managed",
  unsure: "Left with DE to recommend",
  "": "Not chosen yet",
};

export const PRICING_LABELS: Record<"standard" | "preferred" | "unsure", string> = {
  standard: "Standard price",
  preferred: "Preferred pricing",
  unsure: "DE confirms",
};

export const SUPPORT_LABELS: Record<RemoteSupportMode | "", { label: string; detail: string }> = {
  none: { label: "Just this setup", detail: "DE hands it over; you or your IT provider take it from there." },
  as_needed: { label: "When something breaks", detail: "Remote help as needed, without converting the package into managed IT." },
  ongoing: { label: "Ongoing", detail: "Remote implementation and escalation support inside the shared delivery plan." },
  unsure: { label: "Not sure yet", detail: "DE recommends a support level with the package." },
  "": { label: "Not chosen yet", detail: "" },
};

export function assessmentPolicyLabel(policy: AssessmentPolicy): string {
  if (policy === "required") return "Assessment required before final scope";
  if (policy === "recommended") return "Assessment recommended when risk or complexity warrants it";
  return "No blanket assessment requirement";
}

export const ASSESSMENT_LABELS: Record<AssessmentPolicy, string> = {
  required: assessmentPolicyLabel("required"),
  recommended: assessmentPolicyLabel("recommended"),
  not_required: assessmentPolicyLabel("not_required"),
};

/**
 * Remote support after setup: all four options are always selectable; the
 * suggestion follows the relationship and is pre-checked with "Suggested".
 */
export function remoteSupportOptions(delivery: CuratedDeliveryModel | "unsure" | ""): {
  options: readonly RemoteSupportMode[];
  suggested: RemoteSupportMode;
} {
  const options: readonly RemoteSupportMode[] = ["none", "as_needed", "ongoing", "unsure"];
  if (delivery === "co_managed") return { options, suggested: "ongoing" };
  if (delivery === "standalone") return { options, suggested: "as_needed" };
  return { options, suggested: "unsure" };
}

/* ------------------------------------------------------------------------ */
/* Copy derived from policy                                                   */
/* ------------------------------------------------------------------------ */

function shipmentCopy(mode: ShipmentMode): string {
  if (mode === "physical") {
    return "Equipment shipment timing is confirmed after model, inventory, scope, and delivery destination are approved.";
  }
  if (mode === "conditional") {
    return "If equipment is included, shipment timing is confirmed after inventory and scope approval. Digital setup can begin separately.";
  }
  return "No physical shipment is normally required. Digital provisioning begins after scope approval.";
}

function technicianCopy(policy: TechnicianPolicy): string {
  if (policy === "available") {
    return "Remote setup and shipped equipment come first. An on-site technician (Truck-Roll, Trip Charge and Tech Labor) is scheduled only when hands-on work cannot be done remotely.";
  }
  if (policy === "scope_dependent") {
    return "Remote setup and shipped equipment come first. On-site work (Truck-Roll, Trip Charge and Tech Labor) is added only when the approved design needs hands-on installation.";
  }
  return "No on-site visit is offered for this package; everything is done remotely.";
}

function primaryIntent(policy: AssessmentPolicy): SolutionActionIntent {
  if (policy === "required") return "assessment";
  return "quote";
}

export function buildSolutionPackage(
  family: CuratedSolutionFamily,
  delivery: CuratedDeliveryModel,
  profile: SolutionSizingProfile = {},
): SolutionPackageView {
  const offer = family.offers.find((entry) => entry.deliveryModel === delivery) ?? family.offers[0];
  const policy = FAMILY_PACKAGE_POLICY[family.id];
  const standalone = delivery === "standalone";

  return {
    offerId: offer.id,
    offerName: standalone ? `${family.label} — Standalone` : offer.name,
    relationshipLabel: standalone ? "Standalone solution" : "Co-managed solution",
    relationshipSummary: standalone
      ? "You buy the preconfigured DE solution without joining DE's managed-services operating model. Your business or existing IT provider owns implementation and ongoing operation unless you add DE implementation or support."
      : "Your team and DE share defined responsibilities for this solution. Co-managed offers can receive preferred pricing where the ongoing relationship reduces delivery effort or creates shared operational value.",
    pricingPosition: standalone ? "standard" : "preferred",
    pricingLabel: standalone ? PRICING_LABELS.standard : PRICING_LABELS.preferred,
    lineItems: offer.includes.map((label, index) => {
      const basis = lineBasisFor(offer.id, family.id, index, label);
      return { label, quantity: formatQuantity(basis, profile), basis };
    }),
    assessmentPolicy: policy.assessmentPolicy,
    primaryIntent: primaryIntent(policy.assessmentPolicy),
    shipmentMode: policy.shipmentMode,
    shipmentCopy: shipmentCopy(policy.shipmentMode),
    installModes: sortInstallModes(policy.installModes),
    technicianPolicy: policy.technicianPolicy,
    technicianCopy: technicianCopy(policy.technicianPolicy),
    remoteSupportAvailable: true,
    remoteSupportCopy: standalone
      ? "Remote implementation assistance can be added without converting the package into managed IT."
      : "Remote implementation and escalation support are part of the shared delivery plan when included in scope.",
  };
}
