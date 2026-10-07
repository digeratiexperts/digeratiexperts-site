import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Knowledge base over HTTP with the memory store: built-in articles appear,
 * a company article is a 404 to other companies, drafts are DE admin only,
 * views count once per reader per day, ratings are 1 to 5, and revising a
 * published article emails its subscribers (never for a draft).
 */

const USERS = {
  "u-ann": { id: "u-ann", clientId: "acme", fullName: "Ann Acme", email: "ann@acme.test", isActive: true },
  "u-gus": { id: "u-gus", clientId: "globex", fullName: "Gus Globex", email: "gus@globex.test", isActive: true },
  "u-admin": { id: "u-admin", clientId: null, fullName: "Dee Admin", email: "dee@de.test", isActive: true },
} as Record<string, { id: string; clientId: string | null; fullName: string; email: string; isActive: boolean }>;

const ANN = { id: "u-ann", role: "user", clientId: "acme" };
const GUS = { id: "u-gus", role: "user", clientId: "globex" };
const DE_ADMIN = { id: "u-admin", role: "admin", clientId: null };

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
const adminOnly: express.RequestHandler = (req, res, next) => {
  if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};

const emails: Array<{ email: string; number: string }> = [];
let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const { registerKbRoutes } = await import("./kbRoutes");
  const app = express();
  app.use(express.json());
  registerKbRoutes(app, {
    guards: [signedInAs],
    adminGuards: [signedInAs, adminOnly],
    findUser: (id) => USERS[id],
    getClient: (id) => (id === "acme" || id === "globex" ? { id } : undefined),
    notifySubscriber: async (input) => {
      emails.push(input);
    },
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const call = (method: string, path: string, user: object | null, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const article = (over: Record<string, unknown> = {}) => ({
  title: "Acme VPN profile",
  summary: "Connect to the Acme VPN.",
  category: "Network",
  tags: ["vpn"],
  body: "# Instructions\n1. Open the app",
  status: "published",
  audienceClientId: "acme",
  ...over,
});

describe("reading", () => {
  it("lists the built-in articles by number for any signed-in client", async () => {
    const res = await call("GET", "/api/portal/kb", ANN);
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.some((a: any) => a.id === "KB0000001" && a.category === "Licensing")).toBe(true);
    expect((await call("GET", "/api/portal/kb", null)).status).toBe(401);
  });

  it("shows a company article to that company only, and a 404 to others", async () => {
    const created = await (await call("POST", "/api/portal/admin/kb", DE_ADMIN, article())).json();
    const number = created.article.number;
    expect(number).toMatch(/^KB\d{7}$/);
    expect((await call("GET", `/api/portal/kb/${number}`, ANN)).status).toBe(200);
    expect((await call("GET", `/api/portal/kb/${number}`, GUS)).status).toBe(404);
    const gusList = await (await call("GET", "/api/portal/kb", GUS)).json();
    expect(gusList.some((a: any) => a.id === number)).toBe(false);
    expect((await call("PUT", `/api/portal/kb/${number}/rating`, GUS, { stars: 5 })).status).toBe(404);
  });

  it("keeps drafts to DE admins", async () => {
    const { article: draft } = await (await call("POST", "/api/portal/admin/kb", DE_ADMIN, article({ status: "draft", audienceClientId: null }))).json();
    expect((await call("GET", `/api/portal/kb/${draft.number}`, ANN)).status).toBe(404);
    expect((await call("GET", `/api/portal/kb/${draft.number}`, DE_ADMIN)).status).toBe(200);
  });

  it("counts one view per reader per day", async () => {
    const first = await (await call("GET", "/api/portal/kb/KB0000003", ANN)).json();
    const again = await (await call("GET", "/api/portal/kb/KB0000003", ANN)).json();
    expect(again.article.views).toBe(first.article.views);
    const other = await (await call("GET", "/api/portal/kb/KB0000003", GUS)).json();
    expect(other.article.views).toBe(first.article.views + 1);
  });

  it("returns 404 for a malformed number", async () => {
    expect((await call("GET", "/api/portal/kb/../../etc", ANN)).status).toBe(404);
    expect((await call("GET", "/api/portal/kb/KB1", ANN)).status).toBe(404);
  });
});

describe("rating and subscribing", () => {
  it("accepts 1 to 5 stars, one rating per reader, and feeds Most Useful", async () => {
    expect((await call("PUT", "/api/portal/kb/KB0000002/rating", ANN, { stars: 0 })).status).toBe(400);
    expect((await call("PUT", "/api/portal/kb/KB0000002/rating", ANN, { stars: 6 })).status).toBe(400);
    expect((await call("PUT", "/api/portal/kb/KB0000002/rating", ANN, { stars: 2.5 })).status).toBe(400);
    await call("PUT", "/api/portal/kb/KB0000002/rating", ANN, { stars: 2 });
    const res = await call("PUT", "/api/portal/kb/KB0000002/rating", ANN, { stars: 4 });
    expect((await res.json()).rating).toEqual({ average: 4, count: 1 });
    const mine = await (await call("GET", "/api/portal/kb/KB0000002", ANN)).json();
    expect(mine.article.myRating).toBe(4);
    const highlights = await (await call("GET", "/api/portal/kb/highlights", ANN)).json();
    expect(highlights.mostUseful[0].number).toBe("KB0000002");
  });

  it("emails subscribers when a published article is revised, not for a draft or when opted out", async () => {
    const { article: a } = await (await call("POST", "/api/portal/admin/kb", DE_ADMIN, article({ audienceClientId: null, title: "Wi-Fi" }))).json();
    expect((await call("PUT", `/api/portal/kb/${a.number}/subscription`, ANN, { subscribed: true })).status).toBe(200);
    expect((await (await call("GET", `/api/portal/kb/${a.number}`, ANN)).json()).article.subscribed).toBe(true);
    emails.length = 0;

    let res = await call("PATCH", `/api/portal/admin/kb/${a.id}`, DE_ADMIN, article({ audienceClientId: null, title: "Wi-Fi (updated)" }));
    expect((await res.json()).notified).toBe(1);
    expect(emails).toEqual([expect.objectContaining({ email: "ann@acme.test", number: a.number })]);

    res = await call("PATCH", `/api/portal/admin/kb/${a.id}`, DE_ADMIN, { ...article({ audienceClientId: null }), notifySubscribers: false });
    expect((await res.json()).notified).toBe(0);

    await call("PATCH", `/api/portal/admin/kb/${a.id}`, DE_ADMIN, article({ audienceClientId: null, status: "draft" }));
    res = await call("PATCH", `/api/portal/admin/kb/${a.id}`, DE_ADMIN, article({ audienceClientId: null, status: "draft" }));
    expect((await res.json()).notified).toBe(0);
  });
});

describe("authoring", () => {
  it("is DE admin only and validates the article", async () => {
    expect((await call("POST", "/api/portal/admin/kb", ANN, article())).status).toBe(403);
    expect((await call("GET", "/api/portal/admin/kb", ANN)).status).toBe(403);
    expect((await call("POST", "/api/portal/admin/kb", DE_ADMIN, article({ title: "" }))).status).toBe(400);
    expect((await call("POST", "/api/portal/admin/kb", DE_ADMIN, article({ audienceClientId: "nope" }))).status).toBe(400);
    expect((await call("PATCH", "/api/portal/admin/kb/missing", DE_ADMIN, article())).status).toBe(404);
  });
});
