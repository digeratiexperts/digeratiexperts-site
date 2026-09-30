import { randomUUID } from "crypto";
import { db } from "../db";
import { syncConflicts, syncFailures, syncInbox, syncOutbox, publicCatalogSnapshots, syncProjections } from "@shared/schema";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import type { DeSyncEnvelope, DeSyncEventType, DeSyncSource } from "./deSyncContract";
import { createDeSyncEnvelope, type DeSyncPayload } from "./deSyncContract";

const RETRY_DELAYS_MS = [30_000, 120_000, 300_000, 900_000, 3_600_000, 14_400_000];

export type OutboxStatus = "pending" | "delivering" | "delivered" | "failed";

export interface SyncOutboxRecord {
  id: string;
  eventId: string;
  eventType: DeSyncEventType;
  version: number;
  source: DeSyncSource;
  destination: "hub" | "website" | "portal";
  occurredAt: Date;
  correlationId: string | null;
  entityType: string;
  entityId: string;
  canonicalAccountId: string | null;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attemptCount: number;
  nextAttemptAt: Date;
  lastError: string | null;
  lockedAt: Date | null;
  createdAt: Date;
  deliveredAt: Date | null;
}

export interface SyncInboxRecord {
  id: string;
  eventId: string;
  eventType: string;
  source: string;
  canonicalAccountId: string | null;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  receivedAt: Date;
  appliedAt: Date | null;
}

export interface SyncFailureRecord {
  id: string;
  eventId: string;
  direction: string;
  eventType: string;
  lastError: string;
  attemptCount: number;
  payload: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncConflictRecord {
  id: string;
  canonicalAccountId: string | null;
  entityType: string;
  entityId: string;
  field: string;
  hubValue: unknown;
  peerValue: unknown;
  resolution: string;
  createdAt: Date;
}

const memoryOutbox = new Map<string, SyncOutboxRecord>();
const memoryInbox = new Map<string, SyncInboxRecord>();
const memoryFailures = new Map<string, SyncFailureRecord>();
const memoryConflicts = new Map<string, SyncConflictRecord>();
const memoryCatalog = new Map<string, { snapshot: Record<string, unknown>; publishedAt: Date; sourceVersion: string | null }>();

export interface HubProjectionRecord {
  entityType: string;
  entityId: string;
  canonicalAccountId: string | null;
  eventType: string;
  eventId: string;
  payload: Record<string, unknown>;
  updatedAt: Date;
}

const memoryProjections = new Map<string, HubProjectionRecord>();

export function projectionKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

/** An event applies when it is the first copy or its occurredAt is not older than the stored row. */
export function isNewerProjection(existingUpdatedAt: Date | null, occurredAt: string): boolean {
  if (!existingUpdatedAt) return true;
  const incoming = Date.parse(occurredAt);
  if (!Number.isFinite(incoming)) return false;
  return incoming >= existingUpdatedAt.getTime();
}

function useMemory(): boolean {
  return !process.env.DATABASE_URL || !db;
}

function nextDelay(attemptCount: number): number {
  return RETRY_DELAYS_MS[Math.min(attemptCount, RETRY_DELAYS_MS.length - 1)];
}

export function isTerminalFailed(attemptCount: number): boolean {
  return attemptCount >= RETRY_DELAYS_MS.length;
}

export async function enqueueOutbox(input: {
  eventType: DeSyncEventType;
  source: DeSyncSource;
  destination: "hub" | "website" | "portal";
  entityType: string;
  entityId?: string;
  canonicalAccountId?: string | null;
  correlationId?: string;
  payload: DeSyncPayload;
}): Promise<DeSyncEnvelope> {
  const envelope = createDeSyncEnvelope({
    eventType: input.eventType,
    source: input.source,
    entityType: input.entityType,
    entityId: input.entityId,
    canonicalAccountId: input.canonicalAccountId,
    correlationId: input.correlationId,
    payload: input.payload,
  });

  const record: SyncOutboxRecord = {
    id: randomUUID(),
    eventId: envelope.eventId,
    eventType: envelope.eventType,
    version: envelope.version,
    source: envelope.source,
    destination: input.destination,
    occurredAt: new Date(envelope.occurredAt),
    correlationId: envelope.correlationId ?? null,
    entityType: envelope.entityType,
    entityId: envelope.entityId,
    canonicalAccountId: envelope.canonicalAccountId ?? null,
    payload: envelope.payload,
    status: "pending",
    attemptCount: 0,
    nextAttemptAt: new Date(),
    lastError: null,
    lockedAt: null,
    createdAt: new Date(),
    deliveredAt: null,
  };

  if (useMemory()) {
    memoryOutbox.set(record.eventId, record);
    return envelope;
  }

  await db.insert(syncOutbox).values({
    eventId: record.eventId,
    eventType: record.eventType,
    version: record.version,
    source: record.source,
    destination: record.destination,
    occurredAt: record.occurredAt,
    correlationId: record.correlationId,
    entityType: record.entityType,
    entityId: record.entityId,
    canonicalAccountId: record.canonicalAccountId,
    payload: record.payload,
    status: record.status,
    attemptCount: 0,
    nextAttemptAt: record.nextAttemptAt,
  });
  return envelope;
}

export async function claimPendingOutbox(limit = 10): Promise<SyncOutboxRecord[]> {
  const now = new Date();
  if (useMemory()) {
    const claimed: SyncOutboxRecord[] = [];
    for (const rec of Array.from(memoryOutbox.values())) {
      if (rec.status !== "pending" || rec.nextAttemptAt > now) continue;
      rec.status = "delivering";
      rec.lockedAt = now;
      claimed.push({ ...rec });
      if (claimed.length >= limit) break;
    }
    return claimed;
  }

  const rows = await db
    .select()
    .from(syncOutbox)
    .where(and(eq(syncOutbox.status, "pending"), lt(syncOutbox.nextAttemptAt, now)))
    .orderBy(asc(syncOutbox.nextAttemptAt))
    .limit(limit);

  const claimed: SyncOutboxRecord[] = [];
  for (const row of rows) {
    const updated = await db
      .update(syncOutbox)
      .set({ status: "delivering", lockedAt: now })
      .where(and(eq(syncOutbox.id, row.id), eq(syncOutbox.status, "pending")))
      .returning();
    if (updated[0]) claimed.push(rowToOutbox(updated[0]));
  }
  return claimed;
}

function rowToOutbox(row: typeof syncOutbox.$inferSelect): SyncOutboxRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    eventType: row.eventType as DeSyncEventType,
    version: row.version,
    source: row.source as DeSyncSource,
    destination: row.destination as SyncOutboxRecord["destination"],
    occurredAt: row.occurredAt,
    correlationId: row.correlationId,
    entityType: row.entityType,
    entityId: row.entityId,
    canonicalAccountId: row.canonicalAccountId,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    status: row.status as OutboxStatus,
    attemptCount: row.attemptCount,
    nextAttemptAt: row.nextAttemptAt,
    lastError: row.lastError,
    lockedAt: row.lockedAt,
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt,
  };
}

export async function markOutboxDelivered(eventId: string): Promise<void> {
  const now = new Date();
  if (useMemory()) {
    const rec = memoryOutbox.get(eventId);
    if (rec) {
      rec.status = "delivered";
      rec.deliveredAt = now;
      rec.lockedAt = null;
      rec.lastError = null;
    }
    return;
  }
  await db
    .update(syncOutbox)
    .set({ status: "delivered", deliveredAt: now, lockedAt: null, lastError: null })
    .where(eq(syncOutbox.eventId, eventId));
}

export async function markOutboxRetry(eventId: string, error: string): Promise<"retry" | "dlq"> {
  const rec = useMemory() ? memoryOutbox.get(eventId) : undefined;
  const attemptCount = (rec?.attemptCount ?? 0) + 1;
  const failed = isTerminalFailed(attemptCount);
  const nextAttemptAt = new Date(Date.now() + nextDelay(attemptCount - 1));

  if (useMemory()) {
    if (rec) {
      rec.attemptCount = attemptCount;
      rec.lastError = error;
      rec.lockedAt = null;
      rec.status = failed ? "failed" : "pending";
      rec.nextAttemptAt = nextAttemptAt;
    }
  } else {
    const [row] = await db.select().from(syncOutbox).where(eq(syncOutbox.eventId, eventId)).limit(1);
    const nextCount = (row?.attemptCount ?? 0) + 1;
    const terminal = isTerminalFailed(nextCount);
    await db
      .update(syncOutbox)
      .set({
        attemptCount: nextCount,
        lastError: error,
        lockedAt: null,
        status: terminal ? "failed" : "pending",
        nextAttemptAt: new Date(Date.now() + nextDelay(nextCount - 1)),
      })
      .where(eq(syncOutbox.eventId, eventId));
    if (terminal) {
      await recordFailure({
        eventId,
        direction: `site→${row?.destination ?? "hub"}`,
        eventType: row?.eventType ?? "unknown",
        lastError: error,
        attemptCount: nextCount,
        payload: (row?.payload as Record<string, unknown>) ?? null,
      });
      return "dlq";
    }
    return "retry";
  }

  if (failed && rec) {
    await recordFailure({
      eventId,
      direction: `site→${rec.destination}`,
      eventType: rec.eventType,
      lastError: error,
      attemptCount,
      payload: rec.payload,
    });
    return "dlq";
  }
  return "retry";
}

export async function recordInbox(envelope: DeSyncEnvelope): Promise<{ duplicate: boolean }> {
  if (useMemory()) {
    if (memoryInbox.has(envelope.eventId)) return { duplicate: true };
    memoryInbox.set(envelope.eventId, {
      id: randomUUID(),
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      source: envelope.source,
      canonicalAccountId: envelope.canonicalAccountId ?? null,
      entityType: envelope.entityType,
      entityId: envelope.entityId,
      payload: envelope.payload,
      receivedAt: new Date(),
      appliedAt: new Date(),
    });
    return { duplicate: false };
  }

  try {
    await db.insert(syncInbox).values({
      eventId: envelope.eventId,
      eventType: envelope.eventType,
      source: envelope.source,
      canonicalAccountId: envelope.canonicalAccountId ?? null,
      entityType: envelope.entityType,
      entityId: envelope.entityId,
      payload: envelope.payload,
      appliedAt: new Date(),
    });
    return { duplicate: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("unique") || message.includes("duplicate")) {
      return { duplicate: true };
    }
    throw error;
  }
}

export async function recordFailure(input: {
  eventId: string;
  direction: string;
  eventType: string;
  lastError: string;
  attemptCount: number;
  payload: Record<string, unknown> | null;
}): Promise<void> {
  const now = new Date();
  if (useMemory()) {
    const existing = memoryFailures.get(input.eventId);
    memoryFailures.set(input.eventId, {
      id: existing?.id ?? randomUUID(),
      eventId: input.eventId,
      direction: input.direction,
      eventType: input.eventType,
      lastError: input.lastError,
      attemptCount: input.attemptCount,
      payload: input.payload,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    return;
  }

  const [existing] = await db.select().from(syncFailures).where(eq(syncFailures.eventId, input.eventId)).limit(1);
  if (existing) {
    await db
      .update(syncFailures)
      .set({
        lastError: input.lastError,
        attemptCount: input.attemptCount,
        payload: input.payload,
        updatedAt: now,
      })
      .where(eq(syncFailures.eventId, input.eventId));
    return;
  }
  await db.insert(syncFailures).values({
    eventId: input.eventId,
    direction: input.direction,
    eventType: input.eventType,
    lastError: input.lastError,
    attemptCount: input.attemptCount,
    payload: input.payload,
  });
}

export async function recordConflict(input: {
  canonicalAccountId?: string | null;
  entityType: string;
  entityId: string;
  field: string;
  hubValue: unknown;
  peerValue: unknown;
}): Promise<void> {
  const rec: SyncConflictRecord = {
    id: randomUUID(),
    canonicalAccountId: input.canonicalAccountId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    field: input.field,
    hubValue: input.hubValue,
    peerValue: input.peerValue,
    resolution: "hub_wins",
    createdAt: new Date(),
  };
  if (useMemory()) {
    memoryConflicts.set(rec.id, rec);
    return;
  }
  await db.insert(syncConflicts).values({
    canonicalAccountId: rec.canonicalAccountId,
    entityType: rec.entityType,
    entityId: rec.entityId,
    field: rec.field,
    hubValue: rec.hubValue,
    peerValue: rec.peerValue,
    resolution: rec.resolution,
  });
}

export async function saveCatalogSnapshot(snapshot: Record<string, unknown>, sourceVersion?: string): Promise<void> {
  if (useMemory()) {
    memoryCatalog.set("public", { snapshot, publishedAt: new Date(), sourceVersion: sourceVersion ?? null });
    return;
  }
  await db
    .insert(publicCatalogSnapshots)
    .values({
      id: "public",
      snapshot,
      sourceVersion: sourceVersion ?? null,
      publishedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: publicCatalogSnapshots.id,
      set: {
        snapshot,
        sourceVersion: sourceVersion ?? null,
        publishedAt: new Date(),
      },
    });
}

export async function getHubProjectionRecord(
  entityType: string,
  entityId: string,
): Promise<HubProjectionRecord | null> {
  const id = projectionKey(entityType, entityId);
  if (useMemory()) return memoryProjections.get(id) ?? null;
  const [row] = await db.select().from(syncProjections).where(eq(syncProjections.id, id)).limit(1);
  if (!row) return null;
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    canonicalAccountId: row.canonicalAccountId,
    eventType: row.eventType,
    eventId: row.eventId,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    updatedAt: row.updatedAt,
  };
}

export async function saveHubProjection(record: HubProjectionRecord): Promise<void> {
  const id = projectionKey(record.entityType, record.entityId);
  if (useMemory()) {
    memoryProjections.set(id, record);
    return;
  }
  await db
    .insert(syncProjections)
    .values({
      id,
      entityType: record.entityType,
      entityId: record.entityId,
      canonicalAccountId: record.canonicalAccountId,
      eventType: record.eventType,
      eventId: record.eventId,
      payload: record.payload,
      updatedAt: record.updatedAt,
    })
    .onConflictDoUpdate({
      target: syncProjections.id,
      set: {
        canonicalAccountId: record.canonicalAccountId,
        eventType: record.eventType,
        eventId: record.eventId,
        payload: record.payload,
        updatedAt: record.updatedAt,
      },
    });
}

export async function getCatalogSnapshot(): Promise<{
  snapshot: Record<string, unknown>;
  publishedAt: Date;
  sourceVersion: string | null;
} | null> {
  if (useMemory()) {
    return memoryCatalog.get("public") ?? null;
  }
  const [row] = await db.select().from(publicCatalogSnapshots).where(eq(publicCatalogSnapshots.id, "public")).limit(1);
  if (!row) return null;
  return {
    snapshot: (row.snapshot ?? {}) as Record<string, unknown>,
    publishedAt: row.publishedAt,
    sourceVersion: row.sourceVersion,
  };
}

export async function getOldestPendingAgeMs(): Promise<number | null> {
  const now = Date.now();
  if (useMemory()) {
    let oldest: number | null = null;
    for (const rec of Array.from(memoryOutbox.values())) {
      if (rec.status === "pending" || rec.status === "delivering") {
        const age = now - rec.createdAt.getTime();
        if (oldest === null || age > oldest) oldest = age;
      }
    }
    return oldest;
  }
  const [row] = await db
    .select({ createdAt: syncOutbox.createdAt })
    .from(syncOutbox)
    .where(sql`${syncOutbox.status} in ('pending', 'delivering')`)
    .orderBy(asc(syncOutbox.createdAt))
    .limit(1);
  return row ? now - row.createdAt.getTime() : null;
}

export async function listOutbox(status?: OutboxStatus): Promise<SyncOutboxRecord[]> {
  if (useMemory()) {
    return Array.from(memoryOutbox.values()).filter((r) => !status || r.status === status);
  }
  const rows = status
    ? await db.select().from(syncOutbox).where(eq(syncOutbox.status, status))
    : await db.select().from(syncOutbox);
  return rows.map(rowToOutbox);
}

export async function listFailures(): Promise<SyncFailureRecord[]> {
  if (useMemory()) return Array.from(memoryFailures.values());
  const rows = await db.select().from(syncFailures);
  return rows.map((row: typeof syncFailures.$inferSelect) => ({
    id: row.id,
    eventId: row.eventId,
    direction: row.direction,
    eventType: row.eventType,
    lastError: row.lastError,
    attemptCount: row.attemptCount,
    payload: (row.payload ?? null) as Record<string, unknown> | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function listConflicts(): Promise<SyncConflictRecord[]> {
  if (useMemory()) return Array.from(memoryConflicts.values());
  const rows = await db.select().from(syncConflicts);
  return rows.map((row: typeof syncConflicts.$inferSelect) => ({
    id: row.id,
    canonicalAccountId: row.canonicalAccountId,
    entityType: row.entityType,
    entityId: row.entityId,
    field: row.field,
    hubValue: row.hubValue,
    peerValue: row.peerValue,
    resolution: row.resolution,
    createdAt: row.createdAt,
  }));
}

export async function retryFailed(eventId?: string): Promise<number> {
  if (useMemory()) {
    let count = 0;
    for (const rec of Array.from(memoryOutbox.values())) {
      if (rec.status !== "failed") continue;
      if (eventId && rec.eventId !== eventId) continue;
      rec.status = "pending";
      rec.nextAttemptAt = new Date();
      rec.lastError = null;
      count += 1;
    }
    return count;
  }
  const where = eventId
    ? and(eq(syncOutbox.status, "failed"), eq(syncOutbox.eventId, eventId))
    : eq(syncOutbox.status, "failed");
  const updated = await db
    .update(syncOutbox)
    .set({ status: "pending", nextAttemptAt: new Date(), lastError: null })
    .where(where)
    .returning({ id: syncOutbox.id });
  return updated.length;
}

export function clearMemoryProjections(): void {
  memoryProjections.clear();
}

/** Test helper — reset in-memory stores. */
export function resetDeSyncMemory(): void {
  memoryOutbox.clear();
  memoryInbox.clear();
  memoryFailures.clear();
  memoryConflicts.clear();
  memoryCatalog.clear();
  memoryProjections.clear();
}
