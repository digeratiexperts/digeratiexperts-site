import { randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { portalRoadmapItems } from "@shared/schema";
import type { RoadmapComment, RoadmapItem, RoadmapItemInput } from "@shared/roadmap";

/**
 * IT Roadmap items. Postgres when the database is up
 * (migrations/0022_portal_roadmap_items.sql, verified not created); memory
 * otherwise, for the dev server and route tests. Every read and write is
 * scoped by client id.
 */

const useDb = () => Boolean(dbReady && db);
const mem = new Map<string, RoadmapItem>();

export function _resetRoadmapMemory() {
  mem.clear();
}

let verified = false;
async function ensureSchema() {
  if (verified || !useDb()) return;
  try {
    const result: any = await db.execute(sql`SELECT to_regclass('public.portal_roadmap_items') AS present`);
    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (row && !row.present) {
      console.error("[roadmap] table portal_roadmap_items is missing; run `npm run db:migrate` (migrations/0022_portal_roadmap_items.sql).");
      return;
    }
    verified = true;
  } catch (error: any) {
    console.warn("[roadmap] could not verify tables:", error?.message || error);
  }
}

const toIso = (v: unknown): string | null => (v ? new Date(v as string | Date).toISOString() : null);

function fromRow(row: any): RoadmapItem {
  return {
    id: row.id,
    clientId: row.clientId,
    title: row.title,
    rationale: row.rationale ?? "",
    category: row.category,
    priority: row.priority,
    targetQuarter: row.targetQuarter,
    estimateLow: row.estimateLow ?? null,
    estimateHigh: row.estimateHigh ?? null,
    costBasis: row.costBasis === "yearly" ? "yearly" : "one_time",
    status: row.status,
    decisionNote: row.decisionNote ?? "",
    decidedByName: row.decidedByName ?? null,
    decidedAt: toIso(row.decidedAt),
    comments: Array.isArray(row.comments) ? row.comments : [],
    createdByName: row.createdByName ?? "",
    createdAt: toIso(row.createdAt)!,
    updatedAt: toIso(row.updatedAt)!,
  };
}

export async function listRoadmap(clientId: string): Promise<RoadmapItem[]> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db.select().from(portalRoadmapItems).where(eq(portalRoadmapItems.clientId, clientId));
    return rows.map(fromRow);
  }
  return [...mem.values()].filter((i) => i.clientId === clientId);
}

export async function countRoadmap(clientId: string): Promise<number> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(portalRoadmapItems).where(eq(portalRoadmapItems.clientId, clientId));
    return Number(row?.n ?? 0);
  }
  return [...mem.values()].filter((i) => i.clientId === clientId).length;
}

/** One item, only if it belongs to this company. */
export async function getRoadmapItem(clientId: string, id: string): Promise<RoadmapItem | null> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db
      .select()
      .from(portalRoadmapItems)
      .where(and(eq(portalRoadmapItems.id, id), eq(portalRoadmapItems.clientId, clientId)))
      .limit(1);
    return row ? fromRow(row) : null;
  }
  const item = mem.get(id);
  return item && item.clientId === clientId ? item : null;
}

export async function createRoadmapItem(clientId: string, input: RoadmapItemInput, by: { id: string; name: string }, now: Date): Promise<RoadmapItem> {
  await ensureSchema();
  const values = {
    clientId,
    ...input,
    decisionNote: "",
    decidedByName: null,
    decidedAt: null,
    comments: [] as RoadmapComment[],
    createdBy: by.id,
    createdByName: by.name,
    createdAt: now,
    updatedAt: now,
  };
  if (useDb()) {
    const [row] = await db.insert(portalRoadmapItems).values(values).returning();
    return fromRow(row);
  }
  const item = fromRow({ ...values, id: randomUUID() });
  mem.set(item.id, item);
  return item;
}

export type RoadmapPatch = Partial<RoadmapItemInput> & {
  decisionNote?: string;
  decidedByName?: string | null;
  decidedAt?: string | null;
  comments?: RoadmapComment[];
};

export async function updateRoadmapItem(clientId: string, id: string, patch: RoadmapPatch, now: Date): Promise<RoadmapItem | null> {
  const current = await getRoadmapItem(clientId, id);
  if (!current) return null;
  const next: RoadmapItem = {
    ...current,
    ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
    updatedAt: now.toISOString(),
  } as RoadmapItem;
  if (useDb()) {
    const [row] = await db
      .update(portalRoadmapItems)
      .set({
        title: next.title,
        rationale: next.rationale,
        category: next.category,
        priority: next.priority,
        targetQuarter: next.targetQuarter,
        estimateLow: next.estimateLow,
        estimateHigh: next.estimateHigh,
        costBasis: next.costBasis,
        status: next.status,
        decisionNote: next.decisionNote,
        decidedByName: next.decidedByName,
        decidedAt: next.decidedAt ? new Date(next.decidedAt) : null,
        comments: next.comments,
        updatedAt: now,
      })
      .where(and(eq(portalRoadmapItems.id, id), eq(portalRoadmapItems.clientId, clientId)))
      .returning();
    return row ? fromRow(row) : null;
  }
  mem.set(id, next);
  return next;
}

export async function deleteRoadmapItem(clientId: string, id: string): Promise<boolean> {
  await ensureSchema();
  if (useDb()) {
    const rows = await db
      .delete(portalRoadmapItems)
      .where(and(eq(portalRoadmapItems.id, id), eq(portalRoadmapItems.clientId, clientId)))
      .returning({ id: portalRoadmapItems.id });
    return rows.length > 0;
  }
  const item = mem.get(id);
  if (!item || item.clientId !== clientId) return false;
  return mem.delete(id);
}
