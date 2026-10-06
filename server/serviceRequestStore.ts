import { randomUUID } from "crypto";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { serviceRequestAttachments, serviceRequests } from "@shared/schema";
import {
  formatServiceRequestNumber,
  type ServiceRequestAddress,
  type ServiceRequestRecord,
  type ServiceRequestSite,
  type ServiceRequestStatus,
  type ServiceRequestStatusEvent,
  type ServiceRequestType,
} from "@shared/serviceRequests";

/**
 * Storage for portal service requests. Postgres when the database is up
 * (tables owned by migrations/0009_service_requests.sql, verified here, never
 * created at runtime); an in-process map otherwise, so the dev server's
 * memory mode and the route tests exercise the same flow.
 */

export type StoredServiceRequest = {
  id: string;
  number: string;
  type: ServiceRequestType;
  accountId: string;
  requestedForUserId: string;
  submittedByUserId: string;
  status: ServiceRequestStatus;
  payload: Record<string, unknown>;
  siteId: string | null;
  site: ServiceRequestSite | null;
  customAddress: ServiceRequestAddress | null;
  statusHistory: ServiceRequestStatusEvent[];
  revision: number;
  hubSyncStatus: ServiceRequestRecord["hubSyncStatus"];
  hubSyncedAt: string | null;
  hubLastEventId: string | null;
  deskTicketId: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredAttachment = {
  id: string;
  requestId: string;
  accountId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  uploadedAt: string;
};

const useDb = () => Boolean(dbReady && db);

// ---------- memory mode ----------

const memRequests = new Map<string, StoredServiceRequest>();
const memAttachments = new Map<string, StoredAttachment & { data: Buffer }>();
const memSeq: Record<ServiceRequestType, number> = { loaner_computer: 0, return_computer: 0, license_request: 0 };

export function _resetServiceRequestMemory() {
  memRequests.clear();
  memAttachments.clear();
  memSeq.loaner_computer = 0;
  memSeq.return_computer = 0;
  memSeq.license_request = 0;
}

// ---------- schema check ----------

let schemaVerified = false;

async function ensureSchema() {
  if (schemaVerified || !useDb()) return;
  try {
    const result: any = await db.execute(sql`SELECT to_regclass('public.service_requests') AS present`);
    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (row && !row.present) {
      console.error(
        "[service-requests] required table service_requests is missing; run `npm run db:migrate` (migrations/0009_service_requests.sql).",
      );
      return;
    }
    schemaVerified = true;
  } catch (error: any) {
    console.warn("[service-requests] could not verify service_requests:", error?.message || error);
  }
}

const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);

function toStored(row: any): StoredServiceRequest {
  return {
    id: row.id,
    number: row.number,
    type: row.type,
    accountId: row.accountId,
    requestedForUserId: row.requestedForUserId,
    submittedByUserId: row.submittedByUserId,
    status: row.status,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    siteId: row.siteId ?? null,
    site: (row.site ?? null) as ServiceRequestSite | null,
    customAddress: (row.customAddress ?? null) as ServiceRequestAddress | null,
    statusHistory: (row.statusHistory ?? []) as ServiceRequestStatusEvent[],
    revision: Number(row.revision ?? 1),
    hubSyncStatus: row.hubSyncStatus ?? "not_sent",
    hubSyncedAt: iso(row.hubSyncedAt),
    hubLastEventId: row.hubLastEventId ?? null,
    deskTicketId: row.deskTicketId ?? null,
    submittedAt: iso(row.submittedAt),
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
  };
}

async function nextNumber(type: ServiceRequestType): Promise<string> {
  if (!useDb()) {
    memSeq[type] += 1;
    return formatServiceRequestNumber(type, memSeq[type]);
  }
  const seq = { loaner_computer: "service_request_lnr_seq", return_computer: "service_request_rtn_seq", license_request: "service_request_lic_seq" }[type];
  const result: any = await db.execute(sql`SELECT nextval(${seq}::regclass) AS n`);
  const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
  return formatServiceRequestNumber(type, Number(row?.n));
}

// ---------- requests ----------

export async function createServiceRequest(input: {
  type: ServiceRequestType;
  accountId: string;
  requestedForUserId: string;
  submittedByUserId: string;
  status: ServiceRequestStatus;
  payload: Record<string, unknown>;
  siteId: string | null;
  site: ServiceRequestSite | null;
  customAddress: ServiceRequestAddress | null;
  statusHistory: ServiceRequestStatusEvent[];
  submittedAt: string | null;
}): Promise<StoredServiceRequest> {
  await ensureSchema();
  const number = await nextNumber(input.type);
  if (useDb()) {
    const [row] = await db
      .insert(serviceRequests)
      .values({
        number,
        type: input.type,
        accountId: input.accountId,
        requestedForUserId: input.requestedForUserId,
        submittedByUserId: input.submittedByUserId,
        status: input.status,
        payload: input.payload,
        siteId: input.siteId,
        site: input.site,
        customAddress: input.customAddress,
        statusHistory: input.statusHistory,
        submittedAt: input.submittedAt ? new Date(input.submittedAt) : null,
      })
      .returning();
    return toStored(row);
  }
  const now = new Date().toISOString();
  const rec: StoredServiceRequest = {
    id: randomUUID(),
    number,
    ...input,
    revision: 1,
    hubSyncStatus: "not_sent",
    hubSyncedAt: null,
    hubLastEventId: null,
    deskTicketId: null,
    createdAt: now,
    updatedAt: now,
  };
  memRequests.set(rec.id, rec);
  return { ...rec };
}

export async function getServiceRequest(id: string): Promise<StoredServiceRequest | null> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
    return row ? toStored(row) : null;
  }
  const rec = memRequests.get(id);
  return rec ? { ...rec } : null;
}

/** Requests in one company that the user submitted or that were requested for them. */
export async function listServiceRequestsForUser(accountId: string, userId: string): Promise<StoredServiceRequest[]> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db
      .select()
      .from(serviceRequests)
      .where(
        and(
          eq(serviceRequests.accountId, accountId),
          or(eq(serviceRequests.submittedByUserId, userId), eq(serviceRequests.requestedForUserId, userId)),
        ),
      )
      .orderBy(desc(serviceRequests.createdAt));
    return rows.map(toStored);
  }
  return [...memRequests.values()]
    .filter((r) => r.accountId === accountId && (r.submittedByUserId === userId || r.requestedForUserId === userId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ ...r }));
}

/** DE admin view: every request, or one company's. */
export async function listServiceRequestsForAdmin(accountId?: string | null): Promise<StoredServiceRequest[]> {
  await ensureSchema();
  if (useDb()) {
    const q = db.select().from(serviceRequests);
    const rows = accountId
      ? await q.where(eq(serviceRequests.accountId, accountId)).orderBy(desc(serviceRequests.createdAt))
      : await q.orderBy(desc(serviceRequests.createdAt));
    return rows.map(toStored);
  }
  return [...memRequests.values()]
    .filter((r) => !accountId || r.accountId === accountId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => ({ ...r }));
}

export type ServiceRequestPatch = Partial<
  Pick<StoredServiceRequest, "status" | "statusHistory" | "submittedAt" | "deskTicketId" | "payload">
>;

/**
 * Apply a patch only if the stored revision still equals `expectedRevision`
 * (optimistic concurrency), bumping the revision. Returns null when the row
 * changed underneath, so two staff updates cannot silently overwrite each other.
 */
export async function updateServiceRequest(
  id: string,
  expectedRevision: number,
  patch: ServiceRequestPatch,
): Promise<StoredServiceRequest | null> {
  await ensureSchema();
  if (useDb()) {
    const values: Record<string, unknown> = { revision: expectedRevision + 1, updatedAt: new Date() };
    if (patch.status !== undefined) values.status = patch.status;
    if (patch.statusHistory !== undefined) values.statusHistory = patch.statusHistory;
    if (patch.submittedAt !== undefined) values.submittedAt = patch.submittedAt ? new Date(patch.submittedAt) : null;
    if (patch.deskTicketId !== undefined) values.deskTicketId = patch.deskTicketId;
    if (patch.payload !== undefined) values.payload = patch.payload;
    const [row] = await db
      .update(serviceRequests)
      .set(values)
      .where(and(eq(serviceRequests.id, id), eq(serviceRequests.revision, expectedRevision)))
      .returning();
    return row ? toStored(row) : null;
  }
  const rec = memRequests.get(id);
  if (!rec || rec.revision !== expectedRevision) return null;
  Object.assign(rec, patch, { revision: expectedRevision + 1, updatedAt: new Date().toISOString() });
  return { ...rec };
}

/** Hub delivery bookkeeping; does not bump the revision (it is not a change to the request). */
export async function setServiceRequestHubSync(
  id: string,
  status: StoredServiceRequest["hubSyncStatus"],
  eventId?: string | null,
): Promise<void> {
  await ensureSchema();
  const syncedAt = status === "synced" ? new Date() : undefined;
  if (useDb()) {
    const values: Record<string, unknown> = { hubSyncStatus: status };
    if (syncedAt) values.hubSyncedAt = syncedAt;
    if (eventId !== undefined) values.hubLastEventId = eventId;
    const where =
      eventId === undefined || status === "queued"
        ? eq(serviceRequests.id, id)
        : // Only the latest queued event may move the status, so a slow delivery of
          // an older revision cannot mark a newer, still-pending one as synced.
          and(eq(serviceRequests.id, id), eq(serviceRequests.hubLastEventId, eventId as string));
    await db.update(serviceRequests).set(values).where(where);
    return;
  }
  const rec = memRequests.get(id);
  if (!rec) return;
  if (eventId !== undefined && status !== "queued" && rec.hubLastEventId !== eventId) return;
  rec.hubSyncStatus = status;
  if (syncedAt) rec.hubSyncedAt = syncedAt.toISOString();
  if (eventId !== undefined) rec.hubLastEventId = eventId;
}

// ---------- attachments ----------

export async function addServiceRequestAttachment(input: {
  requestId: string;
  accountId: string;
  fileName: string;
  contentType: string;
  data: Buffer;
  uploadedBy: string;
}): Promise<StoredAttachment> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db
      .insert(serviceRequestAttachments)
      .values({ ...input, sizeBytes: input.data.length })
      .returning({
        id: serviceRequestAttachments.id,
        requestId: serviceRequestAttachments.requestId,
        accountId: serviceRequestAttachments.accountId,
        fileName: serviceRequestAttachments.fileName,
        contentType: serviceRequestAttachments.contentType,
        sizeBytes: serviceRequestAttachments.sizeBytes,
        uploadedBy: serviceRequestAttachments.uploadedBy,
        uploadedAt: serviceRequestAttachments.uploadedAt,
      });
    return { ...row, uploadedAt: iso(row.uploadedAt)! };
  }
  const rec = {
    id: randomUUID(),
    ...input,
    sizeBytes: input.data.length,
    uploadedAt: new Date().toISOString(),
  };
  memAttachments.set(rec.id, rec);
  const { data: _data, ...meta } = rec;
  return meta;
}

export async function listServiceRequestAttachments(requestId: string): Promise<StoredAttachment[]> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db
      .select({
        id: serviceRequestAttachments.id,
        requestId: serviceRequestAttachments.requestId,
        accountId: serviceRequestAttachments.accountId,
        fileName: serviceRequestAttachments.fileName,
        contentType: serviceRequestAttachments.contentType,
        sizeBytes: serviceRequestAttachments.sizeBytes,
        uploadedBy: serviceRequestAttachments.uploadedBy,
        uploadedAt: serviceRequestAttachments.uploadedAt,
      })
      .from(serviceRequestAttachments)
      .where(eq(serviceRequestAttachments.requestId, requestId));
    return rows.map((r: any) => ({ ...r, uploadedAt: iso(r.uploadedAt)! }));
  }
  return [...memAttachments.values()]
    .filter((a) => a.requestId === requestId)
    .map(({ data: _data, ...meta }) => meta);
}

export async function getServiceRequestAttachment(
  id: string,
): Promise<(StoredAttachment & { data: Buffer }) | null> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db.select().from(serviceRequestAttachments).where(eq(serviceRequestAttachments.id, id)).limit(1);
    return row ? { ...(row as any), uploadedAt: iso(row.uploadedAt)!, data: Buffer.from(row.data as any) } : null;
  }
  return memAttachments.get(id) ?? null;
}
