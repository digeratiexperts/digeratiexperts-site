import { randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, dbReady } from "./db";
import { kbArticleRatings, kbArticleSubscriptions, kbArticles } from "@shared/schema";
import { formatKbNumber, readMinutes, type KbArticleSummary, type KbRating } from "@shared/kb";
import { KB_SEED } from "@shared/kbSeed";

/**
 * Knowledge base storage: articles, view counts, star ratings and
 * subscriptions. Postgres when the database is up (migrations/0010, verified
 * not created); memory otherwise. The built-in articles (shared/kbSeed.ts) are
 * inserted by number on first use and never overwritten, so a DE edit to one
 * sticks.
 */

export type StoredKbArticle = {
  id: string;
  number: string;
  title: string;
  summary: string;
  category: string;
  body: string;
  tags: string[];
  audienceClientId: string | null;
  status: "draft" | "published";
  revisedByName: string;
  revisedAt: string;
  views: number;
  createdAt: string;
};

const useDb = () => Boolean(dbReady && db);
const mem = new Map<string, StoredKbArticle>();
const memRatings = new Map<string, Map<string, number>>();
const memSubs = new Map<string, Set<string>>();
let memSeq = 10000;
let seeded = false;
let verified = false;

export function _resetKbMemory() {
  mem.clear();
  memRatings.clear();
  memSubs.clear();
  memSeq = 10000;
  seeded = false;
}

async function ensureSchema() {
  if (verified || !useDb()) return;
  try {
    const result: any = await db.execute(sql`SELECT to_regclass('public.kb_articles') AS present`);
    const row = Array.isArray(result) ? result[0] : result?.rows?.[0];
    if (row && !row.present) {
      console.error("[kb] table kb_articles is missing; run `npm run db:migrate` (migrations/0010_licensing_and_kb.sql).");
      return;
    }
    verified = true;
  } catch (error: any) {
    console.warn("[kb] could not verify tables:", error?.message || error);
  }
}

const iso = (v: unknown) => new Date(v as string).toISOString();

function toStored(r: any): StoredKbArticle {
  return {
    id: r.id,
    number: r.number,
    title: r.title,
    summary: r.summary ?? "",
    category: r.category,
    body: r.body,
    tags: r.tags ?? [],
    audienceClientId: r.audienceClientId ?? null,
    status: r.status === "published" ? "published" : "draft",
    revisedByName: r.revisedByName ?? "",
    revisedAt: iso(r.revisedAt),
    views: Number(r.views ?? 0),
    createdAt: iso(r.createdAt),
  };
}

async function seedOnce() {
  if (seeded) return;
  seeded = true;
  const now = new Date();
  try {
    if (useDb()) {
      for (const s of KB_SEED) {
        await db
          .insert(kbArticles)
          .values({ ...s, status: "published", revisedByName: "Digerati Experts", revisedAt: now })
          .onConflictDoNothing({ target: kbArticles.number });
      }
      return;
    }
    for (const s of KB_SEED) {
      if ([...mem.values()].some((a) => a.number === s.number)) continue;
      const rec: StoredKbArticle = {
        id: randomUUID(),
        ...s,
        audienceClientId: null,
        status: "published",
        revisedByName: "Digerati Experts",
        revisedAt: now.toISOString(),
        views: 0,
        createdAt: now.toISOString(),
      };
      mem.set(rec.id, rec);
    }
  } catch (error: any) {
    seeded = false;
    console.warn("[kb] built-in articles not seeded:", error?.message || error);
  }
}

export async function listKbArticles(): Promise<StoredKbArticle[]> {
  await ensureSchema();
  await seedOnce();
  if (useDb()) return (await db.select().from(kbArticles)).map(toStored);
  return [...mem.values()].map((a) => ({ ...a }));
}

export async function getKbArticleByNumber(number: string): Promise<StoredKbArticle | null> {
  await ensureSchema();
  await seedOnce();
  if (useDb()) {
    const [row] = await db.select().from(kbArticles).where(eq(kbArticles.number, number)).limit(1);
    return row ? toStored(row) : null;
  }
  const a = [...mem.values()].find((x) => x.number === number);
  return a ? { ...a } : null;
}

export async function getKbArticleById(id: string): Promise<StoredKbArticle | null> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db.select().from(kbArticles).where(eq(kbArticles.id, id)).limit(1);
    return row ? toStored(row) : null;
  }
  const a = mem.get(id);
  return a ? { ...a } : null;
}

export type KbArticleInput = {
  title: string;
  summary: string;
  category: string;
  body: string;
  tags: string[];
  audienceClientId: string | null;
  status: "draft" | "published";
};

export async function createKbArticle(input: KbArticleInput, revisedByName: string): Promise<StoredKbArticle> {
  await ensureSchema();
  if (useDb()) {
    const result: any = await db.execute(sql`SELECT nextval('kb_number_seq'::regclass) AS n`);
    const n = Number((Array.isArray(result) ? result[0] : result?.rows?.[0])?.n);
    const [row] = await db
      .insert(kbArticles)
      .values({ ...input, number: formatKbNumber(n), revisedByName, revisedAt: new Date() })
      .returning();
    return toStored(row);
  }
  memSeq += 1;
  const now = new Date().toISOString();
  const rec: StoredKbArticle = { id: randomUUID(), number: formatKbNumber(memSeq), ...input, revisedByName, revisedAt: now, views: 0, createdAt: now };
  mem.set(rec.id, rec);
  return { ...rec };
}

export async function updateKbArticle(id: string, input: KbArticleInput, revisedByName: string): Promise<StoredKbArticle | null> {
  await ensureSchema();
  if (useDb()) {
    const [row] = await db.update(kbArticles).set({ ...input, revisedByName, revisedAt: new Date() }).where(eq(kbArticles.id, id)).returning();
    return row ? toStored(row) : null;
  }
  const a = mem.get(id);
  if (!a) return null;
  Object.assign(a, input, { revisedByName, revisedAt: new Date().toISOString() });
  return { ...a };
}

export async function incrementKbViews(id: string): Promise<void> {
  if (useDb()) {
    await db.update(kbArticles).set({ views: sql`${kbArticles.views} + 1` }).where(eq(kbArticles.id, id));
    return;
  }
  const a = mem.get(id);
  if (a) a.views += 1;
}

export async function ratingsFor(ids: string[]): Promise<Map<string, KbRating>> {
  const out = new Map<string, KbRating>();
  if (!ids.length) return out;
  if (useDb()) {
    const rows: any = await db.execute(
      sql`SELECT article_id, AVG(stars)::float AS avg, COUNT(*)::int AS n FROM kb_article_ratings GROUP BY article_id`,
    );
    for (const r of Array.isArray(rows) ? rows : rows?.rows ?? []) {
      out.set(r.article_id, { average: Math.round(Number(r.avg) * 10) / 10, count: Number(r.n) });
    }
    return out;
  }
  for (const id of ids) {
    const m = memRatings.get(id);
    if (!m?.size) continue;
    const vals = [...m.values()];
    out.set(id, { average: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10, count: vals.length });
  }
  return out;
}

export async function myRating(articleId: string, userId: string): Promise<number | null> {
  if (useDb()) {
    const [row] = await db
      .select({ stars: kbArticleRatings.stars })
      .from(kbArticleRatings)
      .where(and(eq(kbArticleRatings.articleId, articleId), eq(kbArticleRatings.userId, userId)))
      .limit(1);
    return row?.stars ?? null;
  }
  return memRatings.get(articleId)?.get(userId) ?? null;
}

export async function setRating(articleId: string, userId: string, stars: number): Promise<void> {
  if (useDb()) {
    await db.execute(
      sql`INSERT INTO kb_article_ratings (article_id, user_id, stars) VALUES (${articleId}, ${userId}, ${stars})
          ON CONFLICT (article_id, user_id) DO UPDATE SET stars = EXCLUDED.stars, rated_at = now()`,
    );
    return;
  }
  if (!memRatings.has(articleId)) memRatings.set(articleId, new Map());
  memRatings.get(articleId)!.set(userId, stars);
}

export async function isSubscribed(articleId: string, userId: string): Promise<boolean> {
  if (useDb()) {
    const [row] = await db
      .select({ a: kbArticleSubscriptions.articleId })
      .from(kbArticleSubscriptions)
      .where(and(eq(kbArticleSubscriptions.articleId, articleId), eq(kbArticleSubscriptions.userId, userId)))
      .limit(1);
    return Boolean(row);
  }
  return memSubs.get(articleId)?.has(userId) ?? false;
}

export async function setSubscribed(articleId: string, userId: string, on: boolean): Promise<void> {
  if (useDb()) {
    if (on) {
      await db.execute(
        sql`INSERT INTO kb_article_subscriptions (article_id, user_id) VALUES (${articleId}, ${userId}) ON CONFLICT DO NOTHING`,
      );
    } else {
      await db
        .delete(kbArticleSubscriptions)
        .where(and(eq(kbArticleSubscriptions.articleId, articleId), eq(kbArticleSubscriptions.userId, userId)));
    }
    return;
  }
  if (!memSubs.has(articleId)) memSubs.set(articleId, new Set());
  if (on) memSubs.get(articleId)!.add(userId);
  else memSubs.get(articleId)!.delete(userId);
}

export async function subscriberIds(articleId: string): Promise<string[]> {
  if (useDb()) {
    const rows = await db.select({ u: kbArticleSubscriptions.userId }).from(kbArticleSubscriptions).where(eq(kbArticleSubscriptions.articleId, articleId));
    return rows.map((r: any) => r.u);
  }
  return [...(memSubs.get(articleId) ?? [])];
}

export function toSummary(a: StoredKbArticle, rating: KbRating | undefined): KbArticleSummary {
  return {
    id: a.id,
    number: a.number,
    title: a.title,
    summary: a.summary,
    category: a.category,
    tags: a.tags,
    status: a.status,
    audience: a.audienceClientId ? "company" : "all",
    revisedByName: a.revisedByName,
    revisedAt: a.revisedAt,
    views: a.views,
    rating: rating ?? { average: 0, count: 0 },
    readMinutes: readMinutes(a.body),
  };
}
