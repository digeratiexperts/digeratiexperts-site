import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { can } from "@shared/permissions";

/**
 * Business reviews over HTTP with memory stores and the real permission rules:
 * DE staff write, publish and unpublish; owners see published reviews of their
 * own company only, with roadmap links and the report resolved from that
 * company's own records; links to another company's records are refused.
 */

const CLIENTS: Record<string, { id: string; companyName: string }> = {
  acme: { id: "acme", companyName: "Acme Corp" },
  globex: { id: "globex", companyName: "Globex" },
};
const USERS: Record<string, { id: string; fullName: string }> = { "u-staff": { id: "u-staff", fullName: "Sam Staff" } };
const FILES: Record<string, Array<{ id: string; originalName: string; fileUrl: string }>> = {
  acme: [{ id: "f-acme", originalName: "Acme Q3 review.pdf", fileUrl: "/files/acme-q3.pdf" }],
  globex: [{ id: "f-globex", originalName: "Globex.pdf", fileUrl: "/files/globex.pdf" }],
};

const OWNER = { id: "u-owner", role: "user", clientId: "acme", clientRoles: ["owner"] };
const PLAIN = { id: "u-plain", role: "user", clientId: "acme" };
const GLOBEX_OWNER = { id: "u-g", role: "user", clientId: "globex", clientRoles: ["owner"] };
const DE_STAFF = { id: "u-staff", role: "staff", clientId: null };

const NOW = new Date("2026-10-23T18:00:00.000Z");

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
const manage = (permission: string): express.RequestHandler => (req, res, next) => {
  if (!can((req as any).user, permission, req.params.companyId)) return res.status(403).json({ error: "Insufficient permissions" });
  next();
};

let server: Server;
let baseUrl = "";
let reset: () => void;
let hasPublished: (id: string) => Promise<boolean>;

beforeAll(async () => {
  const reviews = await import("./businessReviewRoutes");
  const roadmap = await import("./roadmapRoutes");
  hasPublished = reviews.companyHasPublishedReview;
  const r1 = (await import("./businessReviewStore"))._resetBusinessReviewMemory;
  const r2 = (await import("./roadmapStore"))._resetRoadmapMemory;
  reset = () => {
    r1();
    r2();
  };
  const app = express();
  app.use(express.json());
  const common = { guards: [signedInAs], getClient: (id: string) => CLIENTS[id], findUser: (id: string) => USERS[id], now: () => NOW };
  roadmap.registerRoadmapRoutes(app, { ...common, adminGuards: [signedInAs, manage("roadmap.manage")] });
  reviews.registerBusinessReviewRoutes(app, {
    ...common,
    adminGuards: [signedInAs, manage("reviews.manage")],
    listCompanyFiles: async (id) => FILES[id] ?? [],
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => reset());

async function call(method: string, path: string, user?: object, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

const review = (over: Record<string, unknown> = {}) => ({
  title: "Q3 2026 business review",
  period: "2026-Q3",
  meetingOn: "2026-10-15",
  status: "published",
  summary: "Backups are healthy; the firewall is due for replacement.",
  decisions: ["Replace the firewall in Q1", "Add Microsoft 365 backup"],
  roadmapItemIds: [],
  fileId: "f-acme",
  ...over,
});
const add = (companyId: string, over: Record<string, unknown> = {}, user: object = DE_STAFF) =>
  call("POST", `/api/portal/admin/companies/${companyId}/business-reviews`, user, review(over));
const roadmapItem = async (companyId: string) =>
  (
    await call("POST", `/api/portal/admin/companies/${companyId}/roadmap`, DE_STAFF, {
      title: `${companyId} firewall`,
      category: "security",
      priority: "high",
      targetQuarter: "2027-Q1",
    })
  ).body.item.id as string;

describe("Business reviews: access and isolation", () => {
  it("lets only DE write; owners read; plain users are refused", async () => {
    expect((await add("acme")).status).toBe(201);
    for (const user of [OWNER, PLAIN, GLOBEX_OWNER]) expect((await add("acme", {}, user)).status).toBe(403);
    expect((await call("GET", "/api/portal/business-reviews", OWNER)).body.reviews).toHaveLength(1);
    expect((await call("GET", "/api/portal/business-reviews", PLAIN)).status).toBe(403);
  });

  it("never shows one company another company's reviews", async () => {
    await add("acme");
    await add("globex", { title: "Globex review", fileId: "f-globex" });
    const g = (await call("GET", "/api/portal/business-reviews", GLOBEX_OWNER)).body.reviews;
    expect(g.map((r: any) => r.title)).toEqual(["Globex review"]);
    expect(JSON.stringify(g)).not.toContain("acme");
  });

  it("keeps drafts from owners until DE publishes, and hides them again on unpublish", async () => {
    const id = (await add("acme", { status: "draft" })).body.review.id;
    expect((await call("GET", "/api/portal/business-reviews", OWNER)).body.reviews).toEqual([]);
    const pub = await call("PATCH", `/api/portal/admin/companies/acme/business-reviews/${id}`, DE_STAFF, { status: "published" });
    expect(pub.body.review.publishedAt).toBe(NOW.toISOString());
    expect((await call("GET", "/api/portal/business-reviews", OWNER)).body.reviews).toHaveLength(1);
    await call("PATCH", `/api/portal/admin/companies/acme/business-reviews/${id}`, DE_STAFF, { status: "draft" });
    expect((await call("GET", "/api/portal/business-reviews", OWNER)).body.reviews).toEqual([]);
  });
});

describe("Business reviews: links", () => {
  it("resolves the company's own roadmap items and report file for owners", async () => {
    const item = await roadmapItem("acme");
    await add("acme", { roadmapItemIds: [item] });
    const [r] = (await call("GET", "/api/portal/business-reviews", OWNER)).body.reviews;
    expect(r.roadmapItems).toEqual([{ id: item, title: "acme firewall", status: "proposed" }]);
    expect(r.report).toEqual({ fileName: "Acme Q3 review.pdf", url: "/files/acme-q3.pdf" });
    expect(r).not.toHaveProperty("fileId");
    expect(r).not.toHaveProperty("clientId");
  });

  it("refuses links to another company's roadmap item or file", async () => {
    const globexItem = await roadmapItem("globex");
    expect((await add("acme", { roadmapItemIds: [globexItem] })).body.fieldErrors.roadmapItemIds).toBeTruthy();
    expect((await add("acme", { fileId: "f-globex" })).body.fieldErrors.fileId).toBe("Choose a file shared with this company");
  });

  it("drops a link whose roadmap item was later deleted instead of failing", async () => {
    const item = await roadmapItem("acme");
    await add("acme", { roadmapItemIds: [item], fileId: null });
    await call("DELETE", `/api/portal/admin/companies/acme/roadmap/${item}`, DE_STAFF);
    const [r] = (await call("GET", "/api/portal/business-reviews", OWNER)).body.reviews;
    expect(r.roadmapItems).toEqual([]);
    expect(r.report).toBeNull();
  });
});

describe("Business reviews: validation, order, delete and the nav signal", () => {
  it("rejects a missing title, a bad meeting date, a bad period and an unknown company", async () => {
    expect((await add("acme", { title: "" })).body.fieldErrors.title).toBe("Title is required");
    expect((await add("acme", { meetingOn: "15/10/2026" })).body.fieldErrors.meetingOn).toBeTruthy();
    expect((await add("acme", { period: "Q3" })).body.fieldErrors.period).toBe("Use a quarter like 2026-Q3");
    expect((await add("nope")).status).toBe(404);
  });

  it("lists newest meeting first and deletes", async () => {
    await add("acme", { title: "Older", meetingOn: "2026-04-10" });
    const newer = (await add("acme", { title: "Newer", meetingOn: "2026-10-15" })).body.review.id;
    expect((await call("GET", "/api/portal/business-reviews", OWNER)).body.reviews.map((r: any) => r.title)).toEqual(["Newer", "Older"]);
    expect((await call("DELETE", `/api/portal/admin/companies/acme/business-reviews/${newer}`, DE_STAFF)).status).toBe(200);
    expect((await call("DELETE", `/api/portal/admin/companies/globex/business-reviews/${newer}`, DE_STAFF)).status).toBe(404);
  });

  it("counts only published reviews for the IT plan menu item", async () => {
    await add("acme", { status: "draft" });
    expect(await hasPublished("acme")).toBe(false);
    await add("acme");
    expect(await hasPublished("acme")).toBe(true);
    expect(await hasPublished("globex")).toBe(false);
  });
});
