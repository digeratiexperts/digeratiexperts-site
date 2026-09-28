import { curatedSolutionFamilies, type CuratedSolutionFamily } from "@/data/curatedSolutions";
import { maskEmail, maskPhone } from "@shared/publicContact";
import { getFamilyById } from "@/lib/businessNeeds";
import {
  buildSolutionPackage,
  resolveInstallMode,
  type InstallMode,
  type SolutionPackageView,
} from "@/lib/solutionPackage";

/**
 * The one browser draft behind every Store screen (key de-solution-draft-v2).
 *
 * One concept, one owner (docs/STORE-SOLUTION-ENGINE.md "Cross-layer law"):
 * the profile is asked once, the needs are a set of families, the
 * relationship with DE is ONE global choice (`deliveryPreference`), Delivery &
 * Setup is one buyer preference resolved per package by policy, and intent is
 * derived from policy, never stored as a decision. Source of truth:
 * docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §6.2.
 */

export type DeliveryPreference = "standalone" | "co_managed" | "unsure";
export type DeviceOwnership = "company" | "byod" | "hybrid" | "";
export type InternalItStatus = "yes" | "no" | "unsure" | "";
export type SolutionRequestIntent = "request" | "quote" | "assessment" | "consultation";
export type RemoteSupportPreference = "none" | "as_needed" | "ongoing" | "unsure" | "";
export type InstallationPreference = InstallMode | "unsure" | "";

export type SolutionDraftNeed = {
  familyId: CuratedSolutionFamily["id"];
  /** The scenario starter that composed this need, when one did. */
  source?: string;
};

/**
 * Public business profile. These sizing facts are intentionally collected before
 * the prospect chooses a solution so every downstream package can use one source
 * of truth for quantities and fulfillment.
 */
export type SolutionEnvironment = {
  userCount: string;
  workstationCount: string;
  mobileDeviceCount: string;
  siteCount: string;
  deviceOwnership: DeviceOwnership;
  internalIt: InternalItStatus;
  /** Compatibility fields parsed from older drafts; no public screen asks for them. */
  deviceMix: string;
  complianceNeeds: string;
  currentProvider: string;
  urgency: string;
};

export type SolutionFulfillmentPreference = {
  installation: InstallationPreference;
  remoteSupport: RemoteSupportPreference;
};

/** The last relationship suggestion shown and whether the buyer used it (for the lead DE receives). */
export type SolutionSuggestion = { value: "standalone" | "co_managed"; accepted: boolean } | null;

export type SolutionDraft = {
  version: 2;
  needs: SolutionDraftNeed[];
  /** The single owner of the relationship with DE. */
  deliveryPreference: DeliveryPreference | "";
  environment: SolutionEnvironment;
  fulfillment: SolutionFulfillmentPreference;
  /** Parsed for older drafts only; the live value comes from `recommendedIntent`. */
  intent: SolutionRequestIntent;
  updatedAt: string;
  serverDraftId: string | null;
  serverDurable: boolean | null;
  suggestion: SolutionSuggestion;
  acceptedHints: string[];
  dismissedHints: string[];
};

const STORAGE_KEY = "de-solution-draft-v2";
const LEGACY_V1_KEY = "de-solution-draft-v1";
const LEGACY_CART_KEY = "de-public-solution-cart-v1";
export const SUBMITTED_ARCHIVE_KEY = "de-solution-submitted-v1";
export const SOLUTION_DRAFT_EVENT = "de-solution-draft-change";

/** Derived from the canonical data so the list can never drift from it. */
export const FAMILY_IDS: ReadonlySet<string> = new Set(curatedSolutionFamilies.map((family) => family.id));

export function emptyEnvironment(): SolutionEnvironment {
  return {
    userCount: "",
    workstationCount: "",
    mobileDeviceCount: "",
    siteCount: "",
    deviceOwnership: "",
    internalIt: "",
    deviceMix: "",
    complianceNeeds: "",
    currentProvider: "",
    urgency: "",
  };
}

export function emptyFulfillment(): SolutionFulfillmentPreference {
  return {
    installation: "",
    remoteSupport: "",
  };
}

export function emptyDraft(): SolutionDraft {
  return {
    version: 2,
    needs: [],
    deliveryPreference: "",
    environment: emptyEnvironment(),
    fulfillment: emptyFulfillment(),
    intent: "request",
    updatedAt: "",
    serverDraftId: null,
    serverDurable: null,
    suggestion: null,
    acceptedHints: [],
    dismissedHints: [],
  };
}

function isFamilyId(value: unknown): value is CuratedSolutionFamily["id"] {
  return typeof value === "string" && FAMILY_IDS.has(value);
}

function asDeliveryPreference(value: unknown): DeliveryPreference | undefined {
  if (value === "standalone" || value === "co_managed" || value === "unsure") return value;
  return undefined;
}

function asDeviceOwnership(value: unknown): DeviceOwnership {
  if (value === "company" || value === "byod" || value === "hybrid") return value;
  return "";
}

function asInternalIt(value: unknown): InternalItStatus {
  if (value === "yes" || value === "no" || value === "unsure") return value;
  return "";
}

function asIntent(value: unknown): SolutionRequestIntent {
  if (value === "quote" || value === "assessment" || value === "consultation" || value === "request") {
    return value;
  }
  return "request";
}

function asInstallation(value: unknown): InstallationPreference {
  if (value === "self_install" || value === "remote_assist" || value === "onsite" || value === "unsure") {
    return value;
  }
  return "";
}

function asRemoteSupport(value: unknown): RemoteSupportPreference {
  if (value === "none" || value === "as_needed" || value === "ongoing" || value === "unsure") return value;
  return "";
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function asIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === "string" && /^[a-z0-9-]{1,60}$/.test(entry)) seen.add(entry);
  }
  return [...seen];
}

function asSuggestion(value: unknown): SolutionSuggestion {
  if (!value || typeof value !== "object") return null;
  const input = value as { value?: unknown; accepted?: unknown };
  if (input.value !== "standalone" && input.value !== "co_managed") return null;
  return { value: input.value, accepted: input.accepted === true };
}

export function parseDraft(raw: unknown): SolutionDraft {
  const base = emptyDraft();
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Record<string, unknown>;

  // Older drafts wrote a relationship on each need. There is one owner now:
  // a unanimous per-need value is lifted into the global preference when the
  // global is empty; mixed or partial values are dropped.
  const legacyDeliveries: DeliveryPreference[] = [];
  const needs: SolutionDraftNeed[] = Array.isArray(input.needs)
    ? input.needs.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const familyId = (entry as { familyId?: unknown }).familyId;
        if (!isFamilyId(familyId)) return [];
        const delivery = asDeliveryPreference((entry as { delivery?: unknown }).delivery);
        if (delivery) legacyDeliveries.push(delivery);
        const source = clip((entry as { source?: unknown }).source, 60);
        return source ? [{ familyId, source }] : [{ familyId }];
      })
    : [];
  const seen = new Set<string>();
  const uniqueNeeds = needs.filter((need) => {
    if (seen.has(need.familyId)) return false;
    seen.add(need.familyId);
    return true;
  });
  let deliveryPreference: DeliveryPreference | "" = asDeliveryPreference(input.deliveryPreference) ?? "";
  if (
    !deliveryPreference &&
    uniqueNeeds.length > 0 &&
    legacyDeliveries.length === uniqueNeeds.length &&
    legacyDeliveries.every((value) => value === legacyDeliveries[0])
  ) {
    deliveryPreference = legacyDeliveries[0];
  }

  const environmentInput =
    input.environment && typeof input.environment === "object"
      ? (input.environment as Record<string, unknown>)
      : {};
  const fulfillmentInput =
    input.fulfillment && typeof input.fulfillment === "object"
      ? (input.fulfillment as Record<string, unknown>)
      : {};
  return {
    version: 2,
    needs: uniqueNeeds,
    deliveryPreference,
    intent: asIntent(input.intent),
    environment: {
      userCount: clip(environmentInput.userCount, 12),
      workstationCount: clip(environmentInput.workstationCount, 12),
      mobileDeviceCount: clip(environmentInput.mobileDeviceCount, 12),
      siteCount: clip(environmentInput.siteCount, 12),
      deviceOwnership: asDeviceOwnership(environmentInput.deviceOwnership),
      internalIt: asInternalIt(environmentInput.internalIt),
      deviceMix: clip(environmentInput.deviceMix, 200),
      complianceNeeds: clip(environmentInput.complianceNeeds, 400),
      currentProvider: clip(environmentInput.currentProvider, 200),
      urgency: clip(environmentInput.urgency, 200),
    },
    fulfillment: {
      installation: asInstallation(fulfillmentInput.installation),
      remoteSupport: asRemoteSupport(fulfillmentInput.remoteSupport),
    },
    updatedAt: clip(input.updatedAt, 40),
    serverDraftId: clip(input.serverDraftId, 80) || null,
    serverDurable: input.serverDurable === true ? true : input.serverDurable === false ? false : null,
    suggestion: asSuggestion(input.suggestion),
    acceptedHints: asIdList(input.acceptedHints),
    dismissedHints: asIdList(input.dismissedHints),
  };
}

/* ------------------------------------------------------------------------ */
/* Pure transforms                                                            */
/* ------------------------------------------------------------------------ */

export function upsertNeed(draft: SolutionDraft, need: SolutionDraftNeed): SolutionDraft {
  const existing = draft.needs.find((entry) => entry.familyId === need.familyId);
  const next: SolutionDraftNeed = existing
    ? { ...existing, ...(need.source ? { source: need.source } : {}) }
    : need.source
      ? { familyId: need.familyId, source: need.source }
      : { familyId: need.familyId };
  return {
    ...draft,
    needs: existing
      ? draft.needs.map((entry) => (entry.familyId === need.familyId ? next : entry))
      : [...draft.needs, next],
  };
}

export function removeNeed(draft: SolutionDraft, familyId: string): SolutionDraft {
  return {
    ...draft,
    needs: draft.needs.filter((entry) => entry.familyId !== familyId),
  };
}

export function toggleNeed(draft: SolutionDraft, familyId: CuratedSolutionFamily["id"]): SolutionDraft {
  if (draft.needs.some((entry) => entry.familyId === familyId)) {
    return removeNeed(draft, familyId);
  }
  return upsertNeed(draft, { familyId });
}

export function setDeliveryPreference(
  draft: SolutionDraft,
  deliveryPreference: DeliveryPreference | "",
): SolutionDraft {
  return { ...draft, deliveryPreference };
}

export function patchEnvironment(
  draft: SolutionDraft,
  patch: Partial<SolutionEnvironment>,
): SolutionDraft {
  return {
    ...draft,
    environment: { ...draft.environment, ...patch },
  };
}

export function patchFulfillment(
  draft: SolutionDraft,
  patch: Partial<SolutionFulfillmentPreference>,
): SolutionDraft {
  return {
    ...draft,
    fulfillment: { ...draft.fulfillment, ...patch },
  };
}

function countReady(value: string, allowZero = false): boolean {
  if (!/^\d{1,6}$/.test(value.trim())) return false;
  const count = Number(value);
  return allowZero ? count >= 0 : count > 0;
}

export function isProfileComplete(environment: SolutionEnvironment): boolean {
  return profileGaps(environment).length === 0;
}

/** What is still missing from the profile, in the buyer's words, in the order the strip asks. */
export function profileGaps(environment: SolutionEnvironment): string[] {
  const gaps: string[] = [];
  if (!countReady(environment.userCount)) gaps.push("users");
  if (!countReady(environment.workstationCount, true)) gaps.push("computers");
  if (!countReady(environment.mobileDeviceCount, true)) gaps.push("mobile devices");
  if (!countReady(environment.siteCount)) gaps.push("sites");
  if (!environment.deviceOwnership) gaps.push("device ownership");
  if (!environment.internalIt) gaps.push("internal IT");
  return gaps;
}

function countPhrase(value: string, singular: string, pluralForm = `${singular}s`, unset: string): string {
  if (!/^\d{1,6}$/.test(value.trim())) return unset;
  return `${Number(value)} ${Number(value) === 1 ? singular : pluralForm}`;
}

/** "25 users · 32 computers · 18 mobile devices · 2 sites", with honest gaps. */
export function profileSummary(environment: SolutionEnvironment): string {
  return [
    countPhrase(environment.userCount, "user", "users", "users not set"),
    countPhrase(environment.workstationCount, "computer", "computers", "computers not set"),
    countPhrase(environment.mobileDeviceCount, "mobile device", "mobile devices", "mobile not set"),
    countPhrase(environment.siteCount, "site", "sites", "sites not set"),
  ].join(" · ");
}

/* ------------------------------------------------------------------------ */
/* Derivations — one place every screen reads the same answer from           */
/* ------------------------------------------------------------------------ */

export type ResolvedPackage = {
  need: SolutionDraftNeed;
  family: CuratedSolutionFamily;
  /** One view when the relationship is chosen; both when it is unsure or unchosen. */
  package: SolutionPackageView | { standalone: SolutionPackageView; coManaged: SolutionPackageView };
  /** The view used for policy decisions (assessment, install modes): the chosen one, else Standalone. */
  policyView: SolutionPackageView;
};

export function resolvedPackages(draft: SolutionDraft): ResolvedPackage[] {
  return draft.needs.flatMap((need): ResolvedPackage[] => {
    const family = getFamilyById(need.familyId);
    if (!family) return [];
    if (draft.deliveryPreference === "standalone" || draft.deliveryPreference === "co_managed") {
      const view = buildSolutionPackage(family, draft.deliveryPreference, draft.environment);
      return [{ need, family, package: view, policyView: view }];
    }
    const standalone = buildSolutionPackage(family, "standalone", draft.environment);
    const coManaged = buildSolutionPackage(family, "co_managed", draft.environment);
    return [{ need, family, package: { standalone, coManaged }, policyView: standalone }];
  });
}

/**
 * Intent is policy, derived: an assessment if any package requires one;
 * DE's recommendation when the relationship was left with DE; otherwise a quote.
 */
export function recommendedIntent(draft: SolutionDraft): SolutionRequestIntent {
  const packages = resolvedPackages(draft);
  if (packages.some((entry) => entry.policyView.assessmentPolicy === "required")) return "assessment";
  if (packages.length > 0 && draft.deliveryPreference === "unsure") return "consultation";
  if (packages.length > 0) return "quote";
  return "request";
}

export const derivePrimaryIntent = recommendedIntent;

export type PublicSolutionNeedPayload = {
  familyId: string;
  offerId: string | null;
  deliveryModel: DeliveryPreference;
  source?: string;
  /** The installation this package will actually get, resolved from the buyer's one preference. */
  installation?: InstallMode;
};

export function toRequestNeeds(draft: SolutionDraft): PublicSolutionNeedPayload[] {
  const preference = draft.deliveryPreference || "unsure";
  return resolvedPackages(draft).map(({ need, family, policyView }) => {
    const concrete = preference === "standalone" || preference === "co_managed";
    const offer = concrete ? family.offers.find((entry) => entry.deliveryModel === preference) ?? null : null;
    return {
      familyId: need.familyId,
      offerId: offer?.id ?? null,
      deliveryModel: concrete ? preference : "unsure",
      ...(need.source ? { source: need.source } : {}),
      installation: resolveInstallMode(draft.fulfillment.installation, policyView).mode,
    };
  });
}

/* ------------------------------------------------------------------------ */
/* Storage                                                                    */
/* ------------------------------------------------------------------------ */

function migrateLegacyCart(): SolutionDraftNeed[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(LEGACY_CART_KEY) || "[]");
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => (isFamilyId(item?.familyId) ? [{ familyId: item.familyId }] : []));
  } catch {
    return [];
  }
}

function readStoredDraft(): SolutionDraft | null {
  if (typeof window === "undefined") return null;
  const current = window.localStorage.getItem(STORAGE_KEY);
  if (current) return parseDraft(JSON.parse(current));
  const legacyV1 = window.localStorage.getItem(LEGACY_V1_KEY);
  if (legacyV1) return parseDraft(JSON.parse(legacyV1));
  return null;
}

export function readSolutionDraft(): SolutionDraft {
  if (typeof window === "undefined") return emptyDraft();
  try {
    const stored = readStoredDraft();
    if (stored) {
      if (!window.localStorage.getItem(STORAGE_KEY)) writeSolutionDraft(stored);
      return stored;
    }
    const migrated = migrateLegacyCart();
    if (migrated.length === 0) return emptyDraft();
    const draft = { ...emptyDraft(), needs: migrated };
    writeSolutionDraft(draft);
    window.localStorage.removeItem(LEGACY_CART_KEY);
    return draft;
  } catch {
    return emptyDraft();
  }
}

export function writeSolutionDraft(draft: SolutionDraft): SolutionDraft {
  const next = parseDraft({ ...draft, updatedAt: new Date().toISOString() });
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.localStorage.removeItem(LEGACY_V1_KEY);
    } catch {
      // Storage may be blocked (private mode, quota). The page keeps working from memory.
    }
    window.dispatchEvent(new CustomEvent(SOLUTION_DRAFT_EVENT));
  }
  return next;
}

export function addDraftNeed(need: SolutionDraftNeed): SolutionDraft {
  return writeSolutionDraft(upsertNeed(readSolutionDraft(), need));
}

export function removeDraftNeed(familyId: string): SolutionDraft {
  return writeSolutionDraft(removeNeed(readSolutionDraft(), familyId));
}

export function toggleDraftNeed(familyId: CuratedSolutionFamily["id"]): SolutionDraft {
  return writeSolutionDraft(toggleNeed(readSolutionDraft(), familyId));
}

export function patchSolutionDraft(patch: Partial<SolutionDraft>): SolutionDraft {
  return writeSolutionDraft({ ...readSolutionDraft(), ...patch });
}

export function clearSolutionDraft(): SolutionDraft {
  return writeSolutionDraft(emptyDraft());
}

/** Everything but the profile: what "Start another solution" does. */
export function resetSolutionKeepingProfile(): SolutionDraft {
  const current = readSolutionDraft();
  return writeSolutionDraft({ ...emptyDraft(), environment: current.environment });
}

export function dismissHint(id: string): SolutionDraft {
  const current = readSolutionDraft();
  if (current.dismissedHints.includes(id)) return current;
  return writeSolutionDraft({ ...current, dismissedHints: [...current.dismissedHints, id] });
}

export function acceptHint(id: string): SolutionDraft {
  const current = readSolutionDraft();
  if (current.acceptedHints.includes(id)) return current;
  return writeSolutionDraft({ ...current, acceptedHints: [...current.acceptedHints, id] });
}

/* ------------------------------------------------------------------------ */
/* The held record after submit                                              */
/* ------------------------------------------------------------------------ */

export type SubmittedPackageSummary = {
  familyId: string;
  familyLabel: string;
  offerName: string;
  pricingLabel: string;
  assessmentPolicy: SolutionPackageView["assessmentPolicy"];
  lineItems: SolutionPackageView["lineItems"];
  installation: InstallMode;
  shipmentMode: SolutionPackageView["shipmentMode"];
};

export type SubmittedSolutionArchive = {
  version: 1;
  reference: string;
  correlationId: string;
  submittedAt: string;
  durable: "database" | "crm" | "memory";
  nextStep: "quote" | "consultation" | "assessment";
  replayed: boolean;
  relationship: DeliveryPreference | "";
  environment: SolutionEnvironment;
  remoteSupport: RemoteSupportPreference;
  packages: SubmittedPackageSummary[];
  /** Masked before the write: the raw email and phone never reach storage (§6.2). */
  contact: { organizationName: string; contactName: string; emailMasked: string; phoneLast4: string };
};

export function summarizeForArchive(
  draft: SolutionDraft,
  contact: { organizationName: string; contactName: string; contactEmail: string; contactPhone: string },
  response: Pick<SubmittedSolutionArchive, "reference" | "correlationId" | "durable" | "nextStep" | "replayed"> & {
    submittedAt?: string;
  },
): SubmittedSolutionArchive {
  return {
    version: 1,
    reference: response.reference,
    correlationId: response.correlationId,
    submittedAt: response.submittedAt || new Date().toISOString(),
    durable: response.durable,
    nextStep: response.nextStep,
    replayed: response.replayed,
    relationship: draft.deliveryPreference,
    environment: draft.environment,
    remoteSupport: draft.fulfillment.remoteSupport,
    packages: resolvedPackages(draft).map(({ need, family, policyView }) => ({
      familyId: need.familyId,
      familyLabel: family.label,
      offerName: policyView.offerName,
      pricingLabel: draft.deliveryPreference === "unsure" || !draft.deliveryPreference ? "DE confirms" : policyView.pricingLabel,
      assessmentPolicy: policyView.assessmentPolicy,
      lineItems: policyView.lineItems,
      installation: resolveInstallMode(draft.fulfillment.installation, policyView).mode,
      shipmentMode: policyView.shipmentMode,
    })),
    contact: {
      organizationName: contact.organizationName,
      contactName: contact.contactName,
      emailMasked: maskEmail(contact.contactEmail),
      phoneLast4: maskPhone(contact.contactPhone),
    },
  };
}

/**
 * On a successful submit: write the held record, then clear everything except
 * the profile so the buyer can start another solution without retyping it.
 */
export function archiveSubmittedDraft(archive: SubmittedSolutionArchive): SubmittedSolutionArchive {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SUBMITTED_ARCHIVE_KEY, JSON.stringify(archive));
    } catch {
      // The confirmation still renders from memory; only the refresh loses the summary.
    }
  }
  resetSolutionKeepingProfile();
  return archive;
}

export function readSubmittedArchive(): SubmittedSolutionArchive | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SUBMITTED_ARCHIVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SubmittedSolutionArchive;
    if (parsed?.version !== 1 || typeof parsed.reference !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSubmittedArchive(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SUBMITTED_ARCHIVE_KEY);
  } catch {
    // nothing to clear
  }
}

/* ------------------------------------------------------------------------ */
/* Compatibility shims for the pre-redesign screens. Removed with them.      */
/* ------------------------------------------------------------------------ */

/** @deprecated The relationship has one owner: `draft.deliveryPreference`. */
export function resolvedNeedDelivery(_need: SolutionDraftNeed, preference: DeliveryPreference | ""): DeliveryPreference | "" {
  return preference || "";
}
