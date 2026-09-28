import { randomUUID } from "crypto";
import { curatedSolutionFamilies, type CuratedDeliveryModel } from "../client/src/data/curatedSolutions";
import {
  loadPublicSolutionRequestById,
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
};

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
  status: SolutionRequestStatus;
  crmStatus: "not_requested" | "pending" | "recorded";
  createdAt: string;
  updatedAt: string;
};

const records = new Map<string, PublicSolutionRequest>();
const idempotency = new Map<string, string>();
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

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
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, record] of records) {
    if (record.status === "submitted") continue;
    if (new Date(record.updatedAt).getTime() < cutoff) records.delete(id);
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
    status: "draft",
    crmStatus: "not_requested",
    createdAt: now,
    updatedAt: now,
  };
  records.set(record.id, record);
  return cloneRequest(record);
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
  return {
    familyId,
    offerId: offerOk ? offerId : null,
    deliveryModel: delivery || "unsure",
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
}): PublicSolutionRequest {
  expireDrafts();
  const existing =
    (input.id ? records.get(input.id) : undefined) ??
    [...records.values()].find((record) => record.sessionId === input.sessionId && record.status === "draft");
  const base = existing ?? createPublicSolutionRequest(input.sessionId);
  const deliveryPreference = asDelivery(input.deliveryPreference) || asDelivery(input.deliveryModel) || base.deliveryPreference;
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
    intent: asIntent(input.intent ?? base.intent),
    organizationName: clip(input.organizationName ?? base.organizationName, 200),
    contactName: clip(input.contactName ?? base.contactName, 120),
    contactEmail: clip(input.contactEmail ?? base.contactEmail, 200).toLowerCase(),
    contactPhone: clip(input.contactPhone ?? base.contactPhone, 40),
    notes: clip(input.notes ?? base.notes, 2000),
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
  const existingId = idempotency.get(key);
  if (existingId) {
    const prior = records.get(existingId);
    if (prior) return { record: cloneRequest(prior), replayed: true };
  }

  const submitted: PublicSolutionRequest = {
    ...record,
    contactName: contact.name.trim().slice(0, 120),
    contactEmail: contact.email.trim().toLowerCase().slice(0, 200),
    contactPhone: (contact.phone || "").trim().slice(0, 40),
    organizationName: (contact.organizationName || record.organizationName).trim().slice(0, 200),
    status: "submitted",
    crmStatus: "pending",
    updatedAt: new Date().toISOString(),
  };
  records.set(submitted.id, submitted);
  idempotency.set(key, submitted.id);
  return { record: cloneRequest(submitted), replayed: false };
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
    if (value === id) idempotency.delete(key);
  }
  const next: PublicSolutionRequest = {
    ...record,
    status: "draft",
    crmStatus: "not_requested",
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
    status: record.status,
    crmStatus: record.crmStatus,
    updatedAt: record.updatedAt,
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

export async function upsertPublicSolutionRequestDurable(
  input: Parameters<typeof upsertPublicSolutionRequest>[0],
): Promise<PublicSolutionRequest> {
  // A returning visitor may still own a durable draft that isn't in this
  // process's memory (server restart, new instance). Recover it first so
  // upsert updates that same row instead of silently forking a duplicate
  // that shadows it. Prefer the client's own remembered draft id; fall back
  // to the session cookie if it has none yet.
  if (input.id) {
    await getPublicSolutionRequestDurable(input.id);
  } else {
    await findPublicSolutionRequestDurable(input.sessionId);
  }
  const record = upsertPublicSolutionRequest(input);
  await persistPublicSolutionRequest(record);
  return record;
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
