import {
  curatedSolutionFamilies,
  type CuratedDeliveryModel,
  type CuratedSolutionFamily,
  type CuratedSolutionOffer,
} from "../data/curatedSolutions";
import { buildSolutionPackage } from "./solutionPackage";

export type { CuratedDeliveryModel, CuratedSolutionFamily, CuratedSolutionOffer };

export const BUSINESS_NEEDS_INDEX_PATH = "/store";
export const SOLUTION_WORKSPACE_PATH = "/store/solution";
export const SOLUTION_REQUEST_PATH = "/solutions/request";
export const SOLUTION_SUBMITTED_PATH = "/store/solution/submitted";

/** The confirmation page for a submitted solution, keyed by its short human reference (DE-XXXXXX). */
export function submittedPath(reference: string): string {
  return `${SOLUTION_SUBMITTED_PATH}/${encodeURIComponent(reference)}`;
}

/**
 * The one journey. Six concepts, one constant: every step label, the journey
 * rail, the rail status lines and the docs read from here (source of truth
 * §6.1). `sr` is the screen-reader form the leakage locks string-check.
 */
export const STORE_STEPS = [
  { n: "01", id: "profile", label: "Profile", sr: "Step 1 · Profile" },
  { n: "02", id: "need", label: "Pain or need", sr: "Step 2 · Pain or need" },
  { n: "03", id: "relationship", label: "Relationship", sr: "Step 3 · Relationship" },
  { n: "04", id: "package", label: "Package", sr: "Step 4 · Package" },
  { n: "05", id: "delivery", label: "Delivery & Setup", sr: "Step 5 · Delivery & Setup" },
  { n: "06", id: "contact", label: "Contact", sr: "Step 6 · Contact" },
] as const;

export type StoreStepId = (typeof STORE_STEPS)[number]["id"];

/**
 * The journey as one sentence, derived from the constant so it can never drift
 * from the steps: "Profile → pain or need → relationship → package → delivery & setup → contact".
 * It is the JourneyRail's accessible name and a leakage lock (§6.1).
 */
export const STORE_JOURNEY_SENTENCE = STORE_STEPS.map((step, index) => (index === 0 ? step.label : step.label.toLowerCase())).join(" → ");

export const BUSINESS_GOALS = [
  { id: "productive", label: "Keep my team productive", familyIds: ["it_operations", "endpoint_devices"] },
  { id: "protect", label: "Protect the business", familyIds: ["identity_access", "email_collaboration", "cybersecurity_operations", "backup_continuity"] },
  { id: "requirements", label: "Meet requirements", familyIds: ["compliance_risk", "documentation_standards", "security_awareness"] },
  { id: "connect", label: "Connect my people & locations", familyIds: ["network_connectivity", "business_communications"] },
  { id: "modernize", label: "Equip & modernize", familyIds: ["hardware_lifecycle", "technology_strategy"] },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  familyIds: CuratedSolutionFamily["id"][];
}>;

export type BusinessGoalId = (typeof BUSINESS_GOALS)[number]["id"];

export function familyToSlug(id: CuratedSolutionFamily["id"]): string {
  return id.replaceAll("_", "-");
}

export function slugToFamilyId(slug: string): CuratedSolutionFamily["id"] | null {
  const normalized = slug.trim().toLowerCase().replaceAll("-", "_");
  const family = curatedSolutionFamilies.find((entry) => entry.id === normalized);
  return family?.id ?? null;
}

export function getFamilyBySlug(slug: string): CuratedSolutionFamily | null {
  const id = slugToFamilyId(slug);
  if (!id) return null;
  return curatedSolutionFamilies.find((entry) => entry.id === id) ?? null;
}

export function getFamilyById(id: string): CuratedSolutionFamily | null {
  return curatedSolutionFamilies.find((entry) => entry.id === id) ?? null;
}

export function offerForDelivery(
  family: CuratedSolutionFamily,
  delivery: CuratedDeliveryModel,
): CuratedSolutionOffer {
  return family.offers.find((offer) => offer.deliveryModel === delivery) ?? family.offers[0];
}

export function parseDeliveryPreference(
  value: string | null | undefined,
): "standalone" | "co_managed" | "unsure" | "" {
  if (value === "standalone" || value === "co_managed" || value === "unsure") return value;
  return "";
}

function publicOfferView(family: CuratedSolutionFamily, offer: CuratedSolutionOffer) {
  const packageView = buildSolutionPackage(family, offer.deliveryModel, {});
  const standalone = offer.deliveryModel === "standalone";
  return {
    id: offer.id,
    name: packageView.offerName,
    deliveryModel: offer.deliveryModel,
    summary: standalone ? packageView.relationshipSummary : offer.summary,
    audience: standalone
      ? "Organizations that want this capability as a packaged solution without enrolling in DE's managed-services operating model."
      : offer.audience,
    outcomes: offer.outcomes,
    includes: offer.includes,
    prerequisites: offer.prerequisites,
    boundaries: offer.boundaries,
    serviceLevel: standalone
      ? "DE provides the approved package and any separately selected implementation or support. Ongoing operation remains with the customer or its existing IT provider unless Co-Managed is selected."
      : offer.serviceLevel,
    commercialModel: packageView.pricingLabel,
    nextStep:
      packageView.assessmentPolicy === "required"
        ? "Assessment required before final scope"
        : "Package review and scope confirmation",
    package: {
      pricingPosition: packageView.pricingPosition,
      lineItems: packageView.lineItems,
      assessmentPolicy: packageView.assessmentPolicy,
      shipmentMode: packageView.shipmentMode,
      shipmentCopy: packageView.shipmentCopy,
      installModes: packageView.installModes,
      technicianPolicy: packageView.technicianPolicy,
      technicianCopy: packageView.technicianCopy,
      remoteSupportAvailable: packageView.remoteSupportAvailable,
      remoteSupportCopy: packageView.remoteSupportCopy,
      primaryIntent: packageView.primaryIntent,
    },
  };
}

/** Public wire contract. Keep internal catalog and commercial-private data out of this object. */
export function toPublicFamily(family: CuratedSolutionFamily) {
  return {
    id: family.id,
    slug: familyToSlug(family.id),
    label: family.label,
    description: family.description,
    offers: family.offers.map((offer) => publicOfferView(family, offer)),
  };
}

export function publicSolutionFamilies() {
  return curatedSolutionFamilies.map(toPublicFamily);
}

/**
 * The contact step. `?family=` may seed an EMPTY draft from a deep link;
 * `?intent=` is gone: intent is policy, derived on both sides, never a URL.
 */
export function requestPath(opts?: {
  family?: CuratedSolutionFamily["id"] | string;
  delivery?: CuratedDeliveryModel | "unsure";
}): string {
  const params = new URLSearchParams();
  if (opts?.family) params.set("family", familyToSlug(opts.family as CuratedSolutionFamily["id"]));
  if (opts?.delivery) params.set("delivery", opts.delivery);
  const query = params.toString();
  return query ? `${SOLUTION_REQUEST_PATH}?${query}` : SOLUTION_REQUEST_PATH;
}

export function familyPath(id: CuratedSolutionFamily["id"]): string {
  return `${BUSINESS_NEEDS_INDEX_PATH}/solutions/${familyToSlug(id)}`;
}
