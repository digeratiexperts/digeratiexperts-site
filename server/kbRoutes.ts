import type { Express, Request, RequestHandler, Response } from "express";
import {
  createKbArticle,
  getKbArticleById,
  getKbArticleByNumber,
  incrementKbViews,
  isSubscribed,
  listKbArticles,
  myRating,
  ratingsFor,
  setRating,
  setSubscribed,
  subscriberIds,
  toSummary,
  updateKbArticle,
  type KbArticleInput,
  type StoredKbArticle,
} from "./kbStore";
import { effectiveClientId, type DirectoryUser, type ServiceRequestUser } from "./serviceRequestRoutes";
import { KB_NUMBER_RE, type KbArticle, type KbArticleSummary } from "@shared/kb";

/**
 * Knowledge base.
 *
 *   GET    /api/portal/kb                       published articles the reader may see (old list shape kept, new fields added)
 *   GET    /api/portal/kb/highlights            Most Viewed and Most Useful
 *   GET    /api/portal/kb/:number               one article (counts one view per reader per day)
 *   PUT    /api/portal/kb/:number/rating        { stars: 1-5 }
 *   PUT    /api/portal/kb/:number/subscription  { subscribed: boolean }
 *   GET/POST/PATCH /api/portal/admin/kb[/:id]   DE admin authoring, drafts included
 *
 * An article is for everyone, or for one company (audienceClientId); a
 * company article is invisible to other companies, as a 404.
 */

type AuthedRequest = Request & { user?: ServiceRequestUser };

export type KbRouteDeps = {
  guards: RequestHandler[];
  adminGuards: RequestHandler[];
  findUser: (id: string) => DirectoryUser | undefined;
  getClient: (id: string) => { id: string } | undefined;
  /** Optional: email subscribers when a published article is revised. Must not throw. */
  notifySubscriber?: (input: { email: string; name: string; number: string; title: string; summary: string }) => Promise<unknown>;
};

function visibleTo(a: StoredKbArticle, user: ServiceRequestUser | undefined): boolean {
  if (user?.role === "admin") return true;
  if (a.status !== "published") return false;
  if (!a.audienceClientId) return true;
  return Boolean(user?.clientId) && user!.clientId === a.audienceClientId;
}

/** One view per reader per article per day, in process. */
const seen = new Map<string, string>();
function firstViewToday(articleId: string, userId: string): boolean {
  const key = `${articleId}:${userId}`;
  const day = new Date().toISOString().slice(0, 10);
  if (seen.get(key) === day) return false;
  seen.set(key, day);
  if (seen.size > 50_000) seen.clear();
  return true;
}

function parseInput(body: any, clientExists: (id: string) => boolean): { input?: KbArticleInput; error?: string } {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const title = str(body?.title, 200);
  const category = str(body?.category, 60);
  const text = typeof body?.body === "string" ? body.body.slice(0, 60_000) : "";
  if (!title) return { error: "Title is required" };
  if (!category) return { error: "Category is required" };
  if (!text.trim()) return { error: "Body is required" };
  const audience = typeof body?.audienceClientId === "string" && body.audienceClientId.trim() ? body.audienceClientId.trim() : null;
  if (audience && !clientExists(audience)) return { error: "That company doesn't exist" };
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t: unknown) => typeof t === "string").map((t: string) => t.trim().slice(0, 40)).filter(Boolean).slice(0, 20) : [];
  return {
    input: {
      title,
      summary: str(body?.summary, 400),
      category,
      body: text,
      tags,
      audienceClientId: audience,
      status: body?.status === "published" ? "published" : "draft",
    },
  };
}

export function registerKbRoutes(app: Express, deps: KbRouteDeps): void {
  async function visibleSummaries(user: ServiceRequestUser | undefined): Promise<KbArticleSummary[]> {
    const all = (await listKbArticles()).filter((a) => a.status === "published" && visibleTo(a, user));
    const ratings = await ratingsFor(all.map((a) => a.id));
    return all.map((a) => toSummary(a, ratings.get(a.id)));
  }

  app.get("/api/portal/kb", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const list = await visibleSummaries(req.user);
    list.sort((a, b) => b.revisedAt.localeCompare(a.revisedAt));
    // Old fields (id, content, excerpt, readTime, updatedAt) kept for existing callers.
    res.json(
      list.map((a) => ({
        ...a,
        id: a.number,
        articleId: a.id,
        content: a.summary,
        excerpt: a.summary,
        readTime: `${a.readMinutes} min`,
        updatedAt: a.revisedAt,
      })),
    );
  });

  app.get("/api/portal/kb/highlights", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const list = await visibleSummaries(req.user);
    const mostViewed = [...list].sort((a, b) => b.views - a.views || b.revisedAt.localeCompare(a.revisedAt)).slice(0, 6);
    const mostUseful = [...list]
      .filter((a) => a.rating.count > 0)
      .sort((a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count)
      .slice(0, 6);
    res.json({ success: true, mostViewed, mostUseful });
  });

  app.get("/api/portal/kb/:number", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const number = String(req.params.number).toUpperCase();
    if (!KB_NUMBER_RE.test(number)) return res.status(404).json({ error: "Article not found" });
    const a = await getKbArticleByNumber(number);
    if (!a || !visibleTo(a, req.user)) return res.status(404).json({ error: "Article not found" });
    if (a.status === "published" && firstViewToday(a.id, req.user!.id)) {
      await incrementKbViews(a.id);
      a.views += 1;
    }
    const ratings = await ratingsFor([a.id]);
    const article: KbArticle = {
      ...toSummary(a, ratings.get(a.id)),
      body: a.body,
      myRating: await myRating(a.id, req.user!.id),
      subscribed: await isSubscribed(a.id, req.user!.id),
    };
    res.json({ success: true, article });
  });

  app.put("/api/portal/kb/:number/rating", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const a = await getKbArticleByNumber(String(req.params.number).toUpperCase());
    if (!a || a.status !== "published" || !visibleTo(a, req.user)) return res.status(404).json({ error: "Article not found" });
    const stars = Number(req.body?.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) return res.status(400).json({ error: "Stars must be 1 to 5" });
    await setRating(a.id, req.user!.id, stars);
    const rating = (await ratingsFor([a.id])).get(a.id) ?? { average: stars, count: 1 };
    res.json({ success: true, myRating: stars, rating });
  });

  app.put("/api/portal/kb/:number/subscription", ...deps.guards, async (req: AuthedRequest, res: Response) => {
    const a = await getKbArticleByNumber(String(req.params.number).toUpperCase());
    if (!a || a.status !== "published" || !visibleTo(a, req.user)) return res.status(404).json({ error: "Article not found" });
    const on = req.body?.subscribed !== false;
    await setSubscribed(a.id, req.user!.id, on);
    res.json({ success: true, subscribed: on });
  });

  // ----- DE admin authoring -----

  app.get("/api/portal/admin/kb", ...deps.adminGuards, async (_req: Request, res: Response) => {
    const all = await listKbArticles();
    const ratings = await ratingsFor(all.map((a) => a.id));
    res.json({
      success: true,
      articles: all
        .map((a) => ({ ...toSummary(a, ratings.get(a.id)), body: a.body, audienceClientId: a.audienceClientId }))
        .sort((a, b) => a.number.localeCompare(b.number)),
    });
  });

  app.post("/api/portal/admin/kb", ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const parsed = parseInput(req.body, (id) => Boolean(deps.getClient(id)));
    if (!parsed.input) return res.status(400).json({ error: parsed.error });
    const by = deps.findUser(req.user!.id)?.fullName || req.user?.fullName || "Digerati Experts";
    const a = await createKbArticle(parsed.input, by);
    res.status(201).json({ success: true, article: { ...toSummary(a, undefined), body: a.body, audienceClientId: a.audienceClientId } });
  });

  app.patch("/api/portal/admin/kb/:id", ...deps.adminGuards, async (req: AuthedRequest, res: Response) => {
    const before = await getKbArticleById(req.params.id);
    if (!before) return res.status(404).json({ error: "Article not found" });
    const parsed = parseInput(req.body, (id) => Boolean(deps.getClient(id)));
    if (!parsed.input) return res.status(400).json({ error: parsed.error });
    const by = deps.findUser(req.user!.id)?.fullName || req.user?.fullName || "Digerati Experts";
    const a = await updateKbArticle(req.params.id, parsed.input, by);
    if (!a) return res.status(404).json({ error: "Article not found" });

    // Subscribers hear about revisions to a published article, never about drafts.
    let notified = 0;
    if (a.status === "published" && before.status === "published" && deps.notifySubscriber && req.body?.notifySubscribers !== false) {
      for (const userId of await subscriberIds(a.id)) {
        const u = deps.findUser(userId);
        if (!u?.email) continue;
        if (a.audienceClientId && u.clientId !== a.audienceClientId) continue;
        try {
          await deps.notifySubscriber({ email: u.email, name: u.fullName, number: a.number, title: a.title, summary: a.summary });
          notified += 1;
        } catch {
          /* one failed email never fails the save */
        }
      }
    }
    res.json({ success: true, notified, article: { ...toSummary(a, undefined), body: a.body, audienceClientId: a.audienceClientId } });
  });
}
