import { randomUUID } from "crypto";
import { desc, eq, isNull, or, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { portalStatusNotices } from "@shared/schema";
import type { NoticeInput, NoticeUpdate, StatusNotice } from "@shared/statusNotices";

/**
 * System Status notices. Postgres when the database is up
 * (migrations/0021_portal_status_notices.sql, verified not created); memory
 * otherwise, for the dev server and route tests.
 */

const useDb = () => Boolean(dbReady && db);
const mem = new Map<string, StatusNotice>();

export function _resetStatusNoticeMemory() {
  mem.clear();
}

let verified = false;
async function ensureSchema() {
  if (verified || !useDb()) return;
  try {
    const result: any = await db.execute(sql`SELECT to_regclass('public.portal_status_notices') AS present`);
    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (row && !row.present) {
      console.error("[status] table portal_status_notices is missing; run `npm run db:migrate` (migrations/0021_portal_status_notices.sql).");
      return;
    }
    verified = true;
  } catch (error: any) {
    console.warn("[status] could not verify tables:", error?.message || error);
  }
}

const toIso = (v: unknown): string | null => (v ? new Date(v as string | Date).toISOString() : null);

function fromRow(row: any): StatusNotice {
  return {
    id: row.id,
    clientId: row.clientId ?? null,
    kind: row.kind,
    severity: row.severity,
    title: row.title,
    body: row.body ?? "",
    affectedServices: Array.isArray(row.affectedServices) ? row.affectedServices : [],
    startsAt: toIso(row.startsAt)!,
    endsAt: toIso(row.endsAt),
    resolvedAt: toIso(row.resolvedAt),
    updates: Array.isArray(row.updates) ? row.updates : [],
    createdByName: row.createdByName ?? "",
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
  };
}

/** Notices one company sees: its own plus the ones for every client. */
export async function listNoticesForCompany(clientId: string | null): Promise<StatusNotice[]> {
  await ensureSchema();
  if (useDb()) {
    const where = clientId
      ? or(isNull(portalStatusNotices.clientId), eq(portalStatusNotices.clientId, clientId))
      : isNull(portalStatusNotices.clientId);
    const rows = await db.select().from(portalStatusNotices).where(where).orderBy(desc(portalStatusNotices.startsAt)).limit(500);
    return rows.map(fromRow);
  }
  return [...mem.values()].filter((n) => n.clientId === null || n.clientId === clientId);
}

/** Every notice, for the DE admin list. */
export async function listAllNotices(): Promise<StatusNotice[]> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db.select().from(portalStatusNotices).orderBy(desc(portalStatusNotices.startsAt)).limit(1000);
    return rows.map(fromRow);
  }
  return [...mem.values()].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt));
}

export async function getNotice(id: string): Promise<StatusNotice | null> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db.select().from(portalStatusNotices).where(eq(portalStatusNotices.id, id)).limit(1);
    return row ? fromRow(row) : null;
  }
  return mem.get(id) ?? null;
}

export async function createNotice(input: NoticeInput, by: { id: string; name: string }, now: Date): Promise<StatusNotice> {
  await ensureSchema();
  const values = {
    clientId: input.clientId,
    kind: input.kind,
    severity: input.severity,
    title: input.title,
    body: input.body,
    affectedServices: input.affectedServices,
    startsAt: new Date(input.startsAt),
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    resolvedAt: null,
    updates: [] as NoticeUpdate[],
    createdBy: by.id,
    createdByName: by.name,
    createdAt: now,
    updatedAt: now,
  };
  if (useDb()) {
    const [row] = await db.insert(portalStatusNotices).values(values).returning();
    return fromRow(row);
  }
  const notice = fromRow({ ...values, id: randomUUID() });
  mem.set(notice.id, notice);
  return notice;
}

type Patch = Partial<Omit<NoticeInput, "clientId">> & { clientId?: string | null; resolvedAt?: string | null; updates?: NoticeUpdate[] };

export async function updateNotice(id: string, patch: Patch, now: Date): Promise<StatusNotice | null> {
  await ensureSchema();
  const current = await getNotice(id);
  if (!current) return null;
  const next: StatusNotice = {
    ...current,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    updatedAt: now.toISOString(),
  } as StatusNotice;
  if (useDb()) {
    const [row] = await db
      .update(portalStatusNotices)
      .set({
        clientId: next.clientId,
        kind: next.kind,
        severity: next.severity,
        title: next.title,
        body: next.body,
        affectedServices: next.affectedServices,
        startsAt: new Date(next.startsAt),
        endsAt: next.endsAt ? new Date(next.endsAt) : null,
        resolvedAt: next.resolvedAt ? new Date(next.resolvedAt) : null,
        updates: next.updates,
        updatedAt: now,
      })
      .where(eq(portalStatusNotices.id, id))
      .returning();
    return row ? fromRow(row) : null;
  }
  mem.set(id, next);
  return next;
}

export async function deleteNotice(id: string): Promise<boolean> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db.delete(portalStatusNotices).where(eq(portalStatusNotices.id, id)).returning({ id: portalStatusNotices.id });
    return rows.length > 0;
  }
  return mem.delete(id);
}
