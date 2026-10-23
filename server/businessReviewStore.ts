import { randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { portalBusinessReviews } from "@shared/schema";
import type { BusinessReview, ReviewInput } from "@shared/businessReviews";

/**
 * Business reviews. Postgres when the database is up
 * (migrations/0023_portal_business_reviews.sql, verified not created); memory
 * otherwise. Every read and write is scoped by client id.
 */

const useDb = () => Boolean(dbReady && db);
const mem = new Map<string, BusinessReview>();

export function _resetBusinessReviewMemory() {
  mem.clear();
}

let verified = false;
async function ensureSchema() {
  if (verified || !useDb()) return;
  try {
    const result: any = await db.execute(sql`SELECT to_regclass('public.portal_business_reviews') AS present`);
    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (row && !row.present) {
      console.error("[reviews] table portal_business_reviews is missing; run `npm run db:migrate` (migrations/0023_portal_business_reviews.sql).");
      return;
    }
    verified = true;
  } catch (error: any) {
    console.warn("[reviews] could not verify tables:", error?.message || error);
  }
}

const toIso = (v: unknown): string | null => (v ? new Date(v as string | Date).toISOString() : null);
const toDay = (v: unknown): string => (typeof v === "string" ? v.slice(0, 10) : new Date(v as Date).toISOString().slice(0, 10));

function fromRow(row: any): BusinessReview {
  return {
    id: row.id,
    clientId: row.clientId,
    title: row.title,
    period: row.period ?? null,
    meetingOn: toDay(row.meetingOn),
    status: row.status === "published" ? "published" : "draft",
    summary: row.summary ?? "",
    decisions: Array.isArray(row.decisions) ? row.decisions : [],
    roadmapItemIds: Array.isArray(row.roadmapItemIds) ? row.roadmapItemIds : [],
    fileId: row.fileId ?? null,
    createdByName: row.createdByName ?? "",
    publishedAt: toIso(row.publishedAt),
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
  };
}

export async function listReviews(clientId: string): Promise<BusinessReview[]> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db.select().from(portalBusinessReviews).where(eq(portalBusinessReviews.clientId, clientId));
    return rows.map(fromRow);
  }
  return [...mem.values()].filter((r) => r.clientId === clientId);
}

export async function countPublishedReviews(clientId: string): Promise<number> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(portalBusinessReviews)
      .where(and(eq(portalBusinessReviews.clientId, clientId), eq(portalBusinessReviews.status, "published")));
    return Number(row?.n ?? 0);
  }
  return [...mem.values()].filter((r) => r.clientId === clientId && r.status === "published").length;
}

export async function getReview(clientId: string, id: string): Promise<BusinessReview | null> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db
      .select()
      .from(portalBusinessReviews)
      .where(and(eq(portalBusinessReviews.id, id), eq(portalBusinessReviews.clientId, clientId)))
      .limit(1);
    return row ? fromRow(row) : null;
  }
  const r = mem.get(id);
  return r && r.clientId === clientId ? r : null;
}

export async function saveReview(
  clientId: string,
  id: string | null,
  input: ReviewInput,
  by: { id: string; name: string },
  now: Date,
): Promise<BusinessReview | null> {
  await ensureSchema();
  const current = id ? await getReview(clientId, id) : null;
  if (id && !current) return null;
  // publishedAt marks the first publish; unpublishing clears it.
  const publishedAt = input.status === "published" ? current?.publishedAt ?? now.toISOString() : null;
  const values = {
    clientId,
    title: input.title,
    period: input.period,
    meetingOn: input.meetingOn,
    status: input.status,
    summary: input.summary,
    decisions: input.decisions,
    roadmapItemIds: input.roadmapItemIds,
    fileId: input.fileId,
    publishedAt: publishedAt ? new Date(publishedAt) : null,
    updatedAt: now,
  };
  if (useDb()) {
    if (current) {
      const [row] = await db
        .update(portalBusinessReviews)
        .set(values)
        .where(and(eq(portalBusinessReviews.id, current.id), eq(portalBusinessReviews.clientId, clientId)))
        .returning();
      return row ? fromRow(row) : null;
    }
    const [row] = await db
      .insert(portalBusinessReviews)
      .values({ ...values, createdBy: by.id, createdByName: by.name, createdAt: now })
      .returning();
    return fromRow(row);
  }
  const review = fromRow({
    ...values,
    id: current?.id ?? randomUUID(),
    createdByName: current?.createdByName ?? by.name,
    createdAt: current?.createdAt ?? now,
  });
  mem.set(review.id, review);
  return review;
}

export async function deleteReview(clientId: string, id: string): Promise<boolean> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db
      .delete(portalBusinessReviews)
      .where(and(eq(portalBusinessReviews.id, id), eq(portalBusinessReviews.clientId, clientId)))
      .returning({ id: portalBusinessReviews.id });
    return rows.length > 0;
  }
  const r = mem.get(id);
  if (!r || r.clientId !== clientId) return false;
  return mem.delete(id);
}
