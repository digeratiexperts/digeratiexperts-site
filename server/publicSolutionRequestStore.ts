import { createHash, randomUUID } from "crypto";
import { curatedSolutionFamilies, type CuratedDeliveryModel, type CuratedSolutionFamily } from "../client/src/data/curatedSolutions";
import { FAMILY_PACKAGE_POLICY, preferredInstallMode, type InstallMode } from "../client/src/lib/solutionPackage";
import {
  loadPublicSolutionRequestById,
  loadPublicSolutionRequestByReference,
  loadPublicSolutionRequestBySession,
  persistPublicSolutionRequest,
} from "./publicSolutionRequestPersistence";

export type SolutionRequestIntent = "request" | "quote" | "assessment" | "consultation";
export type SolutionRequestStatus = "draft" | "submitted";
export type DeliveryPreference = CuratedDeliveryModel | "unsure";

export type PublicSolutionNeed = {
  familyId: string;
  offerId: string | null;
  deliveryModel: DeliveryPreference;
  /** Scenario starter that composed this need, when one did. */
  source?: string;
  /** The installation this package actually gets, validated against its policy. */
  installation?: InstallMode;
};

export type SolutionNextStep = "quote" | "consultation" | "assessment";
export type SolutionDurability = "database" | "crm" | "memory";

export type PublicSolutionEnvironment = {
  userCount: string;
  workstationCount: string;
  mobileDeviceCount: string;
  siteCount: string;
  deviceOwnership: string;
  deviceMix: string;
  internalIt: string;
  complianceNeeds: string;
  currentProvider: string;
  urgency: string;
};

export type PublicSolutionFulfillment = {
  installation: "self_install" | "remote_assist" | "onsite" | "unsure" | "";
  remoteSupport: "none" | "as_needed" | "ongoing" | "unsure" | "";
};

export type PublicSolutionSuggestion = { value: "standalone" | "co_managed"; accepted: boolean };

export type PublicSolutionRequest = {
  id: string;
  sessionId: string;
  correlationId: string;
  familyId: string | null;
  offerId: string | null;
  deliveryModel: DeliveryPreference;
  deliveryPreference: DeliveryPreference | "";
  selectedNeeds: PublicSolutionNeed[];
  environment: PublicSolutionEnvironment;
  fulfillment: PublicSolutionFulfillment;
  intent: SolutionRequestIntent;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  /** The relationship suggestion the buyer saw on the workspace and whether they used it (lead payload). */
  suggestion: PublicSolutionSuggestion | null;
  status: SolutionRequestStatus;
  crmStatus: "not_requested" | "pending" | "recorded";
  /** Short human reference (DE-XXXXXX), minted when the solution is submitted. Never a bearer for contact details. */
  reference: string | null;
  /** Where the submitted record durably lives, decided by the route after persistence. */
  durable: SolutionDurability | null;
  createdAt: string;
  updatedAt: string;
};

const records = new Map<string, PublicSolutionRequest>();
const idempotency = new Map<string, { id: string; at: number }>();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
/** Submitted records are durable elsewhere; memory keeps them a day for confirmations and replays. */
const SUBMITTED_MEMORY_TTL_MS = 1000 * 60 * 60 * 24;

/**
 * Crockford base32: no I, L, O or U, so a reference read over the phone cannot
 * be misheard, and the six characters come deterministically from the
 * correlation id (first 30 bits of its SHA-256) so a replay after a restart
 * yields the same reference without any shared state.
 */
const REFERENCE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const REFERENCE_PATTERN = /^DE-[0-9A-HJKMNP-TV-Z]{6}$/;

export function makeSolutionReference(seed: string, attempt = 0): string {
  const digest = createHash("sha256").update(attempt ? `${seed}:${attempt}` : seed).digest();
  let bits = 0;
  let acc = 0;
  let out = "DE-";
  for (const byte of digest) {
    acc = ((acc << 8) | byte) >>> 0;
    bits += 8;
    while (bits >= 5 && out.length < 9) {
      bits -= 5;
      out += REFERENCE_ALPHABET[(acc >>> bits) & 31];
    }
    if (out.length >= 9) break;
  }
  return out;
}

/** Accepts what a buyer types or reads back: lower case, missing hyphen, I/L for 1, O for 0. */
export function normalizeSolutionReference(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let cleaned = value.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!cleaned.startsWith("DE")) return null;
  cleaned = `DE-${cleaned.slice(2).replace(/[IL]/g, "1").replace(/O/g, "0")}`;
  return REFERENCE_PATTERN.test(cleaned) ? cleaned : null;
}

/* ------------------------------------------------------------------------ */
/* Policy derivations the server recomputes rather than trusts               */
/* ------------------------------------------------------------------------ */

function familyPolicyFor(familyId: string) {
  return familyId in FAMILY_PACKAGE_POLICY ? FAMILY_PACKAGE_POLICY[familyId as CuratedSolutionFamily["id"]] : null;
}

/** Intent is policy: an assessment if any package requires one; DE's recommendation when the relationship was left with DE; otherwise a quote. */
export function deriveSolutionIntent(record: Pick<PublicSolutionRequest, "selectedNeeds" | "deliveryPreference">): SolutionRequestIntent {
  if (record.selectedNeeds.some((need) => familyPolicyFor(need.familyId)?.assessmentPolicy === "required")) return "assessment";
  if (record.selectedNeeds.length > 0 && record.deliveryPreference === "unsure") return "consultation";
  if (record.selectedNeeds.length > 0) return "quote";
  return "request";
}

export function nextStepFor(record: Pick<PublicSolutionRequest, "selectedNeeds" | "deliveryPreference">): SolutionNextStep {
  const intent = deriveSolutionIntent(record);
  return intent === "assessment" || intent === "consultation" ? intent : "quote";
}

const COUNT_RE = /^\d{1,6}$/;

function countReady(value: string, allowZero = false): boolean {
  if (!COUNT_RE.test(String(value ?? "").trim())) return false;
  return allowZero ? Number(value) >= 0 : Number(value) > 0;
}

/** The same six facts the client requires before it lets a buyer continue. */
export function isPublicProfileComplete(environment: PublicSolutionEnvironment): boolean {
  return (
    countReady(environment.userCount) &&
    countReady(environment.workstationCount, true) &&
    countReady(environment.mobileDeviceCount, true) &&
    countReady(environment.siteCount) &&
    ["company", "byod", "hybrid"].includes(environment.deviceOwnership) &&
    ["yes", "no", "unsure"].includes(environment.internalIt)
  );
}

/**
 * Checks a submission body before anything is persisted: at least one real
 * need and a complete profile. Contact details are validated by the route.
 */
export type SubmissionProblemCode = "NEEDS_REQUIRED" | "PROFILE_INCOMPLETE" | "RELATIONSHIP_REQUIRED";

export function submissionProblem(input: {
  selectedNeeds?: unknown;
  familyId?: unknown;
  environment?: unknown;
  deliveryPreference?: unknown;
}): { code: SubmissionProblemCode; error: string } | null {
  const needs = parseSelectedNeeds(input.selectedNeeds, []);
  const familyId = clip(input.familyId, 80);
  if (needs.length === 0 && !(familyId && publicFamilyExists(familyId))) {
    return { code: "NEEDS_REQUIRED", error: "Select at least one business need before submitting." };
  }
  if (!isPublicProfileComplete(parseEnvironment(input.environment, emptyEnvironment()))) {
    return {
      code: "PROFILE_INCOMPLETE",
      error: "Finish the business profile (users, computers, mobile devices, sites, device ownership, internal IT) before submitting.",
    };
  }
  // "Help me choose" (unsure) is submittable; only an unmade choice is not.
  if (!asDelivery(input.deliveryPreference)) {
    return { code: "RELATIONSHIP_REQUIRED", error: "Choose Standalone, Co-Managed, or Help me choose before submitting." };
  }
  return null;
}

export function publicFamilyExists(familyId: string): boolean {
  return curatedSolutionFamilies.some((family) => family.id === familyId);
}

export function publicOfferInFamily(
  familyId: string,
  offerId: string,
  delivery: CuratedDeliveryModel,
): boolean {
  const family = curatedSolutionFamilies.find((entry) => entry.id === familyId);
  return !!family?.offers.some((offer) => offer.id === offerId && offer.deliveryModel === delivery);
}

function emptyEnvironment(): PublicSolutionEnvironment {
  return {
    userCount: "",
    workstationCount: "",
    mobileDeviceCount: "",
    siteCount: "",
    deviceOwnership: "",
    deviceMix: "",
    internalIt: "",
    complianceNeeds: "",
    currentProvider: "",
    urgency: "",
  };
}

function emptyFulfillment(): PublicSolutionFulfillment {
  return { installation: "", remoteSupport: "" };
}

function expireDrafts() {
  const now = Date.now();
  for (const [id, record] of records) {
    const age = now - new Date(record.updatedAt).getTime();
    if (record.status === "submitted" ? age > SUBMITTED_MEMORY_TTL_MS : age > SESSION_TTL_MS) records.delete(id);
  }
  for (const [key, entry] of idempotency) {
    if (now - entry.at > SUBMITTED_MEMORY_TTL_MS) idempotency.delete(key);
  }
}

export function createPublicSolutionRequest(sessionId: string): PublicSolutionRequest {
  expireDrafts();
  const now = new Date().toISOString();
  const record: PublicSolutionRequest = {
    id: randomUUID(),
    sessionId,
    correlationId: randomUUID(),
    familyId: null,
    offerId: null,
    deliveryModel: "unsure",
    deliveryPreference: "",
    selectedNeeds: [],
    environment: emptyEnvironment(),
    fulfillment: emptyFulfillment(),
    intent: "request",
    organizationName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    notes: "",
    suggestion: null,
    status: "draft",
    crmStatus: "not_requested",
    reference: null,
    durable: null,
    createdAt: now,
    updatedAt: now,
  };
  records.set(record.id, record);
  return cloneRequest(record);
}

export function findPublicSolutionRequestByReference(reference: string): PublicSolutionRequest | undefined {
  const normalized = normalizeSolutionReference(reference);
  if (!normalized) return undefined;
  for (const record of records.values()) {
    if (record.status === "submitted" && record.reference === normalized) return cloneRequest(record);
  }
  return undefined;
}

export function findPublicSolutionRequest(sessionId: string): PublicSolutionRequest | undefined {
  expireDrafts();
  const matches = [...records.values()]
    .filter((record) => record.sessionId === sessionId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return matches[0] ? cloneRequest(matches[0]) : undefined;
}

export function getPublicSolutionRequest(id: string): PublicSolutionRequest | undefined {
  const record = records.get(id);
  return record ? cloneRequest(record) : undefined;
}

function cloneRequest(record: PublicSolutionRequest): PublicSolutionRequest {
  return {
    ...record,
    selectedNeeds: record.selectedNeeds.map((need) => ({ ...need })),
    environment: { ...record.environment },
    fulfillment: { ...record.fulfillment },
  };
}

function asIntent(value: unknown): SolutionRequestIntent {
  if (value === "quote" || value === "assessment" || value === "consultation" || value === "request") return value;
  return "request";
}

function asDelivery(value: unknown): DeliveryPreference | "" {
  if (value === "co_managed" || value === "standalone" || value === "unsure") return value;
  return "";
}

function asSuggestion(value: unknown): PublicSolutionSuggestion | null {
  if (!value || typeof value !== "object") return null;
  const suggestion = value as { value?: unknown; accepted?: unknown };
  if (suggestion.value !== "standalone" && suggestion.value !== "co_managed") return null;
  return { value: suggestion.value, accepted: suggestion.accepted === true };
}

function asInstallation(value: unknown): PublicSolutionFulfillment["installation"] {
  if (value === "self_install" || value === "remote_assist" || value === "onsite" || value === "unsure") return value;
  return "";
}

function asRemoteSupport(value: unknown): PublicSolutionFulfillment["remoteSupport"] {
  if (value === "none" || value === "as_needed" || value === "ongoing" || value === "unsure") return value;
  return "";
}

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseEnvironment(value: unknown, fallback: PublicSolutionEnvironment): PublicSolutionEnvironment {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    userCount: clip(input.userCount ?? fallback.userCount, 12),
    workstationCount: clip(input.workstationCount ?? fallback.workstationCount, 12),
    mobileDeviceCount: clip(input.mobileDeviceCount ?? fallback.mobileDeviceCount, 12),
    siteCount: clip(input.siteCount ?? fallback.siteCount, 12),
    deviceOwnership: clip(input.deviceOwnership ?? fallback.deviceOwnership, 24),
    deviceMix: clip(input.deviceMix ?? fallback.deviceMix, 200),
    internalIt: clip(input.internalIt ?? fallback.internalIt, 24),
    complianceNeeds: clip(input.complianceNeeds ?? fallback.complianceNeeds, 400),
    currentProvider: clip(input.currentProvider ?? fallback.currentProvider, 200),
    urgency: clip(input.urgency ?? fallback.urgency, 200),
  };
}

function parseFulfillment(value: unknown, fallback: PublicSolutionFulfillment): PublicSolutionFulfillment {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    installation: asInstallation(input.installation ?? fallback.installation),
    remoteSupport: asRemoteSupport(input.remoteSupport ?? fallback.remoteSupport),
  };
}

function asInstallMode(value: unknown): InstallMode | null {
  return value === "remote_assist" || value === "self_install" || value === "onsite" ? value : null;
}

function parseNeed(value: unknown): PublicSolutionNeed | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const familyId = clip(input.familyId, 80);
  if (!publicFamilyExists(familyId)) return null;
  const delivery = asDelivery(input.deliveryModel) || "unsure";
  const offerId = clip(input.offerId, 80);
  const offerOk =
    offerId && (delivery === "standalone" || delivery === "co_managed")
      ? publicOfferInFamily(familyId, offerId, delivery)
      : false;
  const source = clip(input.source, 60);
  // An installation the package does not offer is replaced by the package's
  // own first choice (DE order: remote, shipped, on-site last), never trusted.
  const policy = familyPolicyFor(familyId);
  const requested = asInstallMode(input.installation);
  const installation = policy
    ? requested && policy.installModes.includes(requested)
      ? requested
      : (preferredInstallMode(policy.installModes) ?? undefined)
    : undefined;
  return {
    familyId,
    offerId: offerOk ? offerId : null,
    deliveryModel: delivery || "unsure",
    ...(/^[a-z0-9-]+$/.test(source) ? { source } : {}),
    ...(installation ? { installation } : {}),
  };
}

function parseSelectedNeeds(value: unknown, fallback: PublicSolutionNeed[]): PublicSolutionNeed[] {
  if (!Array.isArray(value)) return fallback.map((need) => ({ ...need }));
  const seen = new Set<string>();
  const needs: PublicSolutionNeed[] = [];
  for (const entry of value.slice(0, 13)) {
    const need = parseNeed(entry);
    if (!need || seen.has(need.familyId)) continue;
    seen.add(need.familyId);
    needs.push(need);
  }
  return needs;
}

function synthesizeNeed(
  familyId: string | null,
  offerId: string | null,
  deliveryModel: DeliveryPreference,
): PublicSolutionNeed[] {
  if (!familyId || !publicFamilyExists(familyId)) return [];
  const offerOk =
    offerId && (deliveryModel === "standalone" || deliveryModel === "co_managed")
      ? publicOfferInFamily(familyId, offerId, deliveryModel)
      : false;
  return [{ familyId, offerId: offerOk ? offerId : null, deliveryModel }];
}

export function upsertPublicSolutionRequest(input: {
  sessionId: string;
  id?: string;
  familyId?: string | null;
  offerId?: string | null;
  deliveryModel?: unknown;
  deliveryPreference?: unknown;
  selectedNeeds?: unknown;
  environment?: unknown;
  fulfillment?: unknown;
  intent?: unknown;
  organizationName?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  contactPhone?: unknown;
  notes?: unknown;
  suggestion?: unknown;
}): PublicSolutionRequest {
  expireDrafts();
  const existing =
    (input.id ? records.get(input.id) : undefined) ??
    [...records.values()].find((record) => record.sessionId === input.sessionId && record.status === "draft");
  const base = existing ?? createPublicSolutionRequest(input.sessionId);
  // An explicit "" is the buyer un-choosing (a kept local copy over DE's); an absent field keeps what DE holds.
  const deliveryPreference =
    input.deliveryPreference === "" ? "" : asDelivery(input.deliveryPreference) || asDelivery(input.deliveryModel) || base.deliveryPreference;
  const selectedNeeds = parseSelectedNeeds(input.selectedNeeds, base.selectedNeeds);
  const familyId = clip(input.familyId, 80) || selectedNeeds[0]?.familyId || base.familyId;
  const deliveryModel =
    asDelivery(input.deliveryModel) || selectedNeeds[0]?.deliveryModel || deliveryPreference || base.deliveryModel || "unsure";
  const offerId = clip(input.offerId, 80) || selectedNeeds[0]?.offerId || base.offerId;
  const nextNeeds = selectedNeeds.length > 0
    ? selectedNeeds
    : synthesizeNeed(
        familyId && publicFamilyExists(familyId) ? familyId : null,
        offerId,
        deliveryModel || "unsure",
      );
  const next: PublicSolutionRequest = {
    ...base,
    sessionId: input.sessionId,
    familyId: nextNeeds[0]?.familyId ?? null,
    offerId: nextNeeds[0]?.offerId ?? null,
    deliveryModel: nextNeeds[0]?.deliveryModel || deliveryModel || "unsure",
    deliveryPreference,
    selectedNeeds: nextNeeds,
    environment: parseEnvironment(input.environment, base.environment),
    fulfillment: parseFulfillment(input.fulfillment, base.fulfillment),
    // Intent is recomputed from policy on every write; a body value never overrides it.
    intent: deriveSolutionIntent({ selectedNeeds: nextNeeds, deliveryPreference }),
    organizationName: clip(input.organizationName ?? base.organizationName, 200),
    contactName: clip(input.contactName ?? base.contactName, 120),
    contactEmail: clip(input.contactEmail ?? base.contactEmail, 200).toLowerCase(),
    contactPhone: clip(input.contactPhone ?? base.contactPhone, 40),
    notes: clip(input.notes ?? base.notes, 2000),
    suggestion: input.suggestion === undefined ? base.suggestion : asSuggestion(input.suggestion),
    updatedAt: new Date().toISOString(),
  };
  records.set(next.id, next);
  return cloneRequest(next);
}

export function submitPublicSolutionRequest(
  record: PublicSolutionRequest,
  contact: { name: string; email: string; phone?: string; organizationName?: string },
  idempotencyKey?: string,
): { record: PublicSolutionRequest; replayed: boolean } {
  // The in-memory idempotency Map only catches a replay within the same
  // process. A retry that arrives after a restart recovers this same
  // durable record via upsert-durable first, so if it already reads back as
  // submitted, that alone is proof of an earlier successful submit —
  // treat it as a replay regardless of whether the key map survived.
  if (record.status === "submitted") {
    return { record: cloneRequest(record), replayed: true };
  }
  const composedKey = record.selectedNeeds.map((need) => need.familyId).sort().join(",");
  const key =
    idempotencyKey?.trim().slice(0, 200) ||
    `${contact.email.trim().toLowerCase()}|${composedKey || record.familyId || ""}|${record.deliveryPreference || record.deliveryModel}|${record.intent}`;
  const existing = idempotency.get(key);
  if (existing) {
    const prior = records.get(existing.id);
    if (prior) return { record: cloneRequest(prior), replayed: true };
  }

  let attempt = 0;
  let reference = makeSolutionReference(record.correlationId, attempt);
  // A collision is astronomically unlikely (32^6) but a duplicate reference is
  // a confused customer, so mint again if this process already knows it.
  while (findPublicSolutionRequestByReference(reference)) {
    attempt += 1;
    reference = makeSolutionReference(record.correlationId, attempt);
  }

  const submitted: PublicSolutionRequest = {
    ...record,
    reference,
    contactName: contact.name.trim().slice(0, 120),
    contactEmail: contact.email.trim().toLowerCase().slice(0, 200),
    contactPhone: (contact.phone || "").trim().slice(0, 40),
    organizationName: (contact.organizationName || record.organizationName).trim().slice(0, 200),
    status: "submitted",
    crmStatus: "pending",
    updatedAt: new Date().toISOString(),
  };
  records.set(submitted.id, submitted);
  idempotency.set(key, { id: submitted.id, at: Date.now() });
  return { record: cloneRequest(submitted), replayed: false };
}

export function markPublicSolutionRequestDurability(id: string, durable: SolutionDurability): PublicSolutionRequest | undefined {
  const record = records.get(id);
  if (!record) return undefined;
  const next = { ...record, durable };
  records.set(id, next);
  return cloneRequest(next);
}

/**
 * Roll a submission back to a draft when it could not be made durable. Without
 * this, a 503'd submit would leave a memory record in status "submitted" and
 * the visitor's retry would be treated as a replay of a success that never
 * happened.
 */
export function unsubmitPublicSolutionRequest(id: string): PublicSolutionRequest | undefined {
  const record = records.get(id);
  if (!record || record.status !== "submitted") return record ? cloneRequest(record) : undefined;
  for (const [key, value] of idempotency.entries()) {
    if (value.id === id) idempotency.delete(key);
  }
  const next: PublicSolutionRequest = {
    ...record,
    status: "draft",
    crmStatus: "not_requested",
    reference: null,
    durable: null,
    updatedAt: new Date().toISOString(),
  };
  records.set(id, next);
  return cloneRequest(next);
}

export function markPublicSolutionRequestCrm(
  id: string,
  crmStatus: "pending" | "recorded",
): PublicSolutionRequest | undefined {
  const record = records.get(id);
  if (!record) return undefined;
  const next = { ...record, crmStatus, updatedAt: new Date().toISOString() };
  records.set(id, next);
  return cloneRequest(next);
}

/**
 * A draft as GET and PUT return it: never the contact fields, so a resume link
 * (or a session re-pointed by one) cannot read what a rolled-back submit left
 * on the record. The full view is the submitter's own POST answer.
 */
export function publicSolutionDraftView(record: PublicSolutionRequest) {
  const { organizationName: _organizationName, contactName: _contactName, contactEmail: _contactEmail, contactPhone: _contactPhone, notes: _notes, ...view } =
    publicSolutionRequestView(record);
  return view;
}

export function publicSolutionRequestView(record: PublicSolutionRequest) {
  return {
    id: record.id,
    correlationId: record.correlationId,
    familyId: record.familyId,
    offerId: record.offerId,
    deliveryModel: record.deliveryModel,
    deliveryPreference: record.deliveryPreference,
    selectedNeeds: record.selectedNeeds,
    environment: record.environment,
    fulfillment: record.fulfillment,
    intent: record.intent,
    organizationName: record.organizationName,
    contactName: record.contactName,
    contactEmail: record.contactEmail,
    contactPhone: record.contactPhone,
    notes: record.notes,
    suggestion: record.suggestion,
    status: record.status,
    crmStatus: record.crmStatus,
    reference: record.reference,
    nextStep: nextStepFor(record),
    updatedAt: record.updatedAt,
  };
}

/**
 * What a confirmation page may learn from a reference alone: the state of the
 * request and the shape of the solution, never who submitted it. Contact
 * details render from the submitter's own device (the archived draft), so a
 * reference typed by someone else reveals no PII.
 */
export function publicSolutionStatusView(record: PublicSolutionRequest) {
  return {
    reference: record.reference,
    status: record.status,
    submittedAt: record.updatedAt,
    durable: record.durable === "database" || record.durable === "crm",
    nextStep: nextStepFor(record),
  };
}

/** Test helper — not used by routes. */
export function resetPublicSolutionRequestsForTests() {
  records.clear();
  idempotency.clear();
}

// --- Durable (Postgres-backed when available) wrappers — #120 -------------
//
// Memory stays the fast path and the fallback when DATABASE_URL is unset or
// unreachable. These wrappers add a DB round trip on top so a draft survives
// a server restart and can resume on a different device, without changing
// any of the synchronous behavior above.

function hydrateFromDb(record: PublicSolutionRequest | null): PublicSolutionRequest | undefined {
  if (!record) return undefined;
  records.set(record.id, record);
  return cloneRequest(record);
}

/** Cross-restart/cross-device continuation for an anonymous session cookie. */
export async function findPublicSolutionRequestDurable(sessionId: string): Promise<PublicSolutionRequest | undefined> {
  const memory = findPublicSolutionRequest(sessionId);
  if (memory) return memory;
  return hydrateFromDb(await loadPublicSolutionRequestBySession(sessionId));
}

/** Continuation by the draft's own id (e.g. a bookmarked/shared "resume" link). */
export async function getPublicSolutionRequestDurable(id: string): Promise<PublicSolutionRequest | undefined> {
  const memory = getPublicSolutionRequest(id);
  if (memory) return memory;
  return hydrateFromDb(await loadPublicSolutionRequestById(id));
}

/** A submitted solution by its short reference (confirmation page after a refresh, restart or on another device). */
export async function getPublicSolutionRequestByReferenceDurable(reference: string): Promise<PublicSolutionRequest | undefined> {
  const normalized = normalizeSolutionReference(reference);
  if (!normalized) return undefined;
  const memory = findPublicSolutionRequestByReference(normalized);
  if (memory) return memory;
  return hydrateFromDb(await loadPublicSolutionRequestByReference(normalized));
}

export async function upsertPublicSolutionRequestDurable(
  input: Parameters<typeof upsertPublicSolutionRequest>[0],
  options: { forkSubmitted?: boolean } = {},
): Promise<{ record: PublicSolutionRequest; persisted: boolean; forked: boolean; previousReference: string | null }> {
  // A returning visitor may still own a durable draft that isn't in this
  // process's memory (server restart, new instance). Recover it first so
  // upsert updates that same row instead of silently forking a duplicate
  // that shadows it. Prefer the client's own remembered draft id; fall back
  // to the session cookie if it has none yet.
  const recovered = input.id
    ? await getPublicSolutionRequestDurable(input.id)
    : await findPublicSolutionRequestDurable(input.sessionId);
  // A submitted solution is a record, not a draft. A save (PUT) that lands on
  // one forks a fresh draft for the session instead of mutating what DE
  // already has. A submit (POST) that lands on one is a retry: it gets the
  // submitted record back untouched so the submit step sees the replay.
  let forked = false;
  let previousReference: string | null = null;
  let effective = input;
  if (recovered?.status === "submitted") {
    if (!options.forkSubmitted) {
      return { record: recovered, persisted: false, forked: false, previousReference: recovered.reference };
    }
    forked = true;
    previousReference = recovered.reference;
    effective = { ...input, id: createPublicSolutionRequest(input.sessionId).id };
  }
  const record = upsertPublicSolutionRequest(effective);
  const persisted = await persistPublicSolutionRequest(record);
  return { record, persisted, forked, previousReference };
}

export async function markPublicSolutionRequestDurabilityDurable(
  id: string,
  durable: SolutionDurability,
): Promise<PublicSolutionRequest | undefined> {
  const next = markPublicSolutionRequestDurability(id, durable);
  if (next) await persistPublicSolutionRequest(next);
  return next;
}

export async function submitPublicSolutionRequestDurable(
  record: PublicSolutionRequest,
  contact: { name: string; email: string; phone?: string; organizationName?: string },
  idempotencyKey?: string,
): Promise<{ record: PublicSolutionRequest; replayed: boolean; persisted: boolean }> {
  const result = submitPublicSolutionRequest(record, contact, idempotencyKey);
  // The route decides what a non-durable submit means (see publicSolutionRoutes.ts);
  // the store only reports it instead of swallowing it.
  const persisted = await persistPublicSolutionRequest(result.record);
  return { ...result, persisted };
}

export async function markPublicSolutionRequestCrmDurable(
  id: string,
  crmStatus: "pending" | "recorded",
): Promise<PublicSolutionRequest | undefined> {
  const next = markPublicSolutionRequestCrm(id, crmStatus);
  if (next) await persistPublicSolutionRequest(next);
  return next;
}
