import type { CuratedDeliveryModel, CuratedSolutionFamily } from "@/data/curatedSolutions";

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
export type SolutionActionIntent = "request" | "quote" | "assessment" | "consultation";

export type SolutionLineItem = {
  label: string;
  quantity: string;
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
    detail: "DE configures and verifies it remotely. First choice wherever the package allows it.",
  },
  self_install: {
    label: "Ship it, set it up yourself",
    detail: "Equipment ships to you with guided self-install; remote help is available if you get stuck.",
  },
  onsite: {
    label: "On-site technician",
    detail: "Truck-Roll, Trip Charge and Tech Labor. Scheduled only when remote setup and shipped equipment cannot do the job.",
  },
};

/** Sort any install-mode list into DE's order of preference. */
export function sortInstallModes(modes: readonly InstallMode[]): InstallMode[] {
  return INSTALL_MODE_ORDER.filter((mode) => modes.includes(mode));
}

/** The default suggestion: the earliest option in DE's order that the package supports. */
export function preferredInstallMode(modes: readonly InstallMode[]): InstallMode | null {
  return sortInstallModes(modes)[0] ?? null;
}

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
  compliance_risk: { assessmentPolicy: "required", ...DIGITAL },
  security_awareness: { assessmentPolicy: "not_required", ...DIGITAL },
  business_communications: { assessmentPolicy: "not_required", ...HYBRID_DELIVERY },
  hardware_lifecycle: {
    assessmentPolicy: "not_required",
    shipmentMode: "physical",
    installModes: ["remote_assist", "self_install", "onsite"],
    technicianPolicy: "available",
  },
  documentation_standards: { assessmentPolicy: "recommended", ...DIGITAL },
  technology_strategy: { assessmentPolicy: "recommended", ...DIGITAL },
};

function cleanCount(value?: string): string {
  const candidate = String(value ?? "").trim();
  return /^\d{1,6}$/.test(candidate) && Number(candidate) > 0 ? candidate : "";
}

function quantityForLine(
  familyId: CuratedSolutionFamily["id"],
  label: string,
  profile: SolutionSizingProfile,
): string {
  const lower = label.toLowerCase();
  const users = cleanCount(profile.userCount);
  const workstations = cleanCount(profile.workstationCount);
  const mobiles = cleanCount(profile.mobileDeviceCount);
  const sites = cleanCount(profile.siteCount);

  if (/site|location|network|internet|wan|office/.test(lower)) {
    return sites ? `${sites} site${sites === "1" ? "" : "s"}` : "Per approved site";
  }

  if (/endpoint|device|workstation|computer|patch|health|inventory/.test(lower)) {
    if (workstations && mobiles) return `${workstations} computers + ${mobiles} mobile`;
    if (workstations) return `${workstations} computers`;
    if (mobiles) return `${mobiles} mobile devices`;
    return "Per approved device";
  }

  if (/user|identity|account|mailbox|training|license|access|mfa|onboarding/.test(lower)) {
    return users ? `${users} user${users === "1" ? "" : "s"}` : "Per covered user";
  }

  if (familyId === "hardware_lifecycle" && workstations) {
    return `${workstations} primary computers`;
  }

  return "Included";
}

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
  return "Handled remotely. An on-site technician is not normally required for this package.";
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
    pricingLabel: standalone ? "Standard standalone pricing" : "Preferred co-managed pricing",
    lineItems: offer.includes.map((label) => ({
      label,
      quantity: quantityForLine(family.id, label, profile),
    })),
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

export function assessmentPolicyLabel(policy: AssessmentPolicy): string {
  if (policy === "required") return "Assessment required before final scope";
  if (policy === "recommended") return "Assessment recommended when risk or complexity warrants it";
  return "No blanket assessment requirement";
}
