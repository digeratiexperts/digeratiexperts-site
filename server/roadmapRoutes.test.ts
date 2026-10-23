import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { can } from "@shared/permissions";

/**
 * IT Roadmap over HTTP with the memory store and the real permission rules
 * (shared/permissions/lane-c.ts): DE staff write a company's roadmap; that
 * company's owners read it, comment, and approve or decline; other users and
 * other companies get nothing.
 */

const CLIENTS: Record<string, { id: string; companyName: string }> = {
  acme: { id: "acme", companyName: "Acme Corp" },
  globex: { id: "globex", companyName: "Globex" },
};
const USERS: Record<string, { id: string; fullName: string }> = {
  "u-owner": { id: "u-owner", fullName: "Olive Owner" },
  "u-it": { id: "u-it", fullName: "Ivy IT" },
  "u-staff": { id: "u-staff", fullName: "Sam Staff" },
};

const OWNER = { id: "u-owner", role: "user", clientId: "acme", clientRoles: ["owner"] };
const IT_CONTACT = { id: "u-it", role: "user", clientId: "acme", orgRole: "company_it_contact", isCompanyItContact: true };
const PLAIN = { id: "u-plain", role: "user", clientId: "acme" };
const GLOBEX_OWNER = { id: "u-g", role: "user", clientId: "globex", clientRoles: ["owner"] };
const DE_STAFF = { id: "u-staff", role: "staff", clientId: null };
const DE_ADMIN = { id: "u-admin", role: "admin", clientId: null };
const DE_AS_ACME = { ...DE_ADMIN, impersonatingCompanyId: "acme" };

const NOW = new Date("2026-10-23T18:00:00.000Z");

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
/** Same rule the server wires: roadmap.manage on the company in the path. */
const manage: express.RequestHandler = (req, res, next) => {
  if (!can((req as any).user, "roadmap.manage", req.params.companyId)) return res.status(403).json({ error: "Insufficient permissions" });
  next();
};

let server: Server;
let baseUrl = "";
let resetMemory: () => void;
let hasRoadmap: (id: string) => Promise<boolean>;

beforeAll(async () => {
  const mod = await import("./roadmapRoutes");
  hasRoadmap = mod.companyHasRoadmap;
  resetMemory = (await import("./roadmapStore"))._resetRoadmapMemory;
  const app = express();
  app.use(express.json());
  mod.registerRoadmapRoutes(app, {
    guards: [signedInAs],
    adminGuards: [signedInAs, manage],
    getClient: (id) => CLIENTS[id],
    findUser: (id) => USERS[id],
    now: () => NOW,
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
beforeEach(() => resetMemory());

async function call(method: string, path: string, user?: object, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

const item = (over: Record<string, unknown> = {}) => ({
  title: "Replace the office firewall",
  rationale: "The current unit stops receiving security updates in June.",
  category: "security",
  priority: "high",
  targetQuarter: "2027-Q1",
  estimateLow: 2500,
  estimateHigh: 4000,
  costBasis: "one_time",
  ...over,
});
const add = (companyId: string, over: Record<string, unknown> = {}, user: object = DE_STAFF) =>
  call("POST", `/api/portal/admin/companies/${companyId}/roadmap`, user, item(over));

describe("IT Roadmap: who can do what", () => {
  it("lets DE staff and the break-glass account write a roadmap; nobody else", async () => {
    expect((await add("acme")).status).toBe(201);
    expect((await add("acme", {}, DE_ADMIN)).status).toBe(201);
    for (const user of [OWNER, IT_CONTACT, PLAIN, GLOBEX_OWNER]) {
      expect((await add("acme", {}, user)).status, (user as any).id).toBe(403);
    }
    expect((await call("GET", "/api/portal/admin/companies/acme/roadmap", OWNER)).status).toBe(403);
  });

  it("shows the roadmap to the company's owners and IT contacts, not to other users", async () => {
    await add("acme");
    const owner = await call("GET", "/api/portal/roadmap", OWNER);
    expect(owner.status).toBe(200);
    expect(owner.body.items).toHaveLength(1);
    expect(owner.body.canDecide).toBe(true);
    expect((await call("GET", "/api/portal/roadmap", IT_CONTACT)).body.items).toHaveLength(1);
    expect((await call("GET", "/api/portal/roadmap", PLAIN)).status).toBe(403);
  });

  it("never shows one company another company's roadmap", async () => {
    const acmeId = (await add("acme")).body.item.id;
    await add("globex", { title: "Globex plan" });
    const g = await call("GET", "/api/portal/roadmap", GLOBEX_OWNER);
    expect(g.body.items.map((i: any) => i.title)).toEqual(["Globex plan"]);
    // Not by id either.
    expect((await call("POST", `/api/portal/roadmap/${acmeId}/decision`, GLOBEX_OWNER, { decision: "approved" })).status).toBe(404);
    expect((await call("POST", `/api/portal/roadmap/${acmeId}/comments`, GLOBEX_OWNER, { body: "hi" })).status).toBe(404);
    expect((await call("PATCH", `/api/portal/admin/companies/globex/roadmap/${acmeId}`, DE_STAFF, { title: "x" })).status).toBe(404);
    expect((await call("DELETE", `/api/portal/admin/companies/globex/roadmap/${acmeId}`, DE_STAFF)).status).toBe(404);
  });

  it("asks a DE admin with no company open to choose one, and serves the company they opened", async () => {
    await add("acme");
    expect((await call("GET", "/api/portal/roadmap", DE_ADMIN)).body.code).toBe("COMPANY_CONTEXT_REQUIRED");
    expect((await call("GET", "/api/portal/roadmap", DE_AS_ACME)).body.items).toHaveLength(1);
  });
});

describe("IT Roadmap: decisions and comments", () => {
  it("lets an owner approve with a note, then change their mind, until DE starts the work", async () => {
    const id = (await add("acme")).body.item.id;
    const approved = await call("POST", `/api/portal/roadmap/${id}/decision`, OWNER, { decision: "approved", note: "Go ahead in January." });
    expect(approved.status).toBe(200);
    expect(approved.body.item).toMatchObject({ status: "approved", decisionNote: "Go ahead in January.", decidedByName: "Olive Owner", decidedAt: NOW.toISOString() });
    expect((await call("POST", `/api/portal/roadmap/${id}/decision`, OWNER, { decision: "declined" })).body.item.status).toBe("declined");

    await call("PATCH", `/api/portal/admin/companies/acme/roadmap/${id}`, DE_STAFF, { status: "in_progress" });
    const late = await call("POST", `/api/portal/roadmap/${id}/decision`, OWNER, { decision: "declined" });
    expect(late.status).toBe(409);
  });

  it("clears an old decision when DE puts the item back to proposed", async () => {
    const id = (await add("acme")).body.item.id;
    await call("POST", `/api/portal/roadmap/${id}/decision`, OWNER, { decision: "declined", note: "Too costly" });
    const back = await call("PATCH", `/api/portal/admin/companies/acme/roadmap/${id}`, DE_STAFF, { status: "proposed", estimateHigh: 3000 });
    expect(back.body.item).toMatchObject({ status: "proposed", decisionNote: "", decidedByName: null, decidedAt: null, estimateHigh: 3000 });
  });

  it("threads comments from the owner and from DE, marking which is which", async () => {
    const id = (await add("acme")).body.item.id;
    await call("POST", `/api/portal/roadmap/${id}/comments`, OWNER, { body: "Can this wait until Q2?" });
    await call("POST", `/api/portal/admin/companies/acme/roadmap/${id}/comments`, DE_STAFF, { body: "Yes, the old unit is covered until June." });
    const list = (await call("GET", "/api/portal/roadmap", OWNER)).body.items[0].comments;
    expect(list).toEqual([
      { at: NOW.toISOString(), byName: "Olive Owner", fromDe: false, body: "Can this wait until Q2?" },
      { at: NOW.toISOString(), byName: "Sam Staff", fromDe: true, body: "Yes, the old unit is covered until June." },
    ]);
    expect((await call("POST", `/api/portal/roadmap/${id}/comments`, OWNER, { body: "  " })).status).toBe(400);
  });
});

describe("IT Roadmap: validation, figures and the nav signal", () => {
  it("rejects a bad quarter, a missing title, an inverted estimate and an unknown company", async () => {
    expect((await add("acme", { targetQuarter: "Q1 2027" })).body.fieldErrors.targetQuarter).toBe("Use a quarter like 2027-Q1");
    expect((await add("acme", { title: "" })).body.fieldErrors.title).toBe("Title is required");
    expect((await add("acme", { estimateLow: 5000, estimateHigh: 100 })).body.fieldErrors.estimateHigh).toBeTruthy();
    expect((await add("acme", { category: "vibes" })).status).toBe(400);
    expect((await add("nope")).status).toBe(404);
  });

  it("sorts by quarter then priority, and totals only approved and in-progress work", async () => {
    await add("acme", { title: "B later", targetQuarter: "2027-Q3", priority: "high", estimateLow: 100, estimateHigh: 100 });
    const a = (await add("acme", { title: "A soon low", targetQuarter: "2027-Q1", priority: "low", estimateLow: 1000, estimateHigh: 2000 })).body.item.id;
    const c = (await add("acme", { title: "C soon high", targetQuarter: "2027-Q1", priority: "high", costBasis: "yearly", estimateLow: 600, estimateHigh: 600 })).body.item.id;
    await call("POST", `/api/portal/roadmap/${a}/decision`, OWNER, { decision: "approved" });
    await call("PATCH", `/api/portal/admin/companies/acme/roadmap/${c}`, DE_STAFF, { status: "in_progress" });
    const body = (await call("GET", "/api/portal/roadmap", OWNER)).body;
    expect(body.items.map((i: any) => i.title)).toEqual(["C soon high", "A soon low", "B later"]);
    expect(body.summary.counts).toMatchObject({ proposed: 1, approved: 1, in_progress: 1 });
    expect(body.summary.committed).toEqual({ oneTimeLow: 1000, oneTimeHigh: 2000, yearlyLow: 600, yearlyHigh: 600 });
  });

  it("reports whether a company has a roadmap, for the IT plan menu item", async () => {
    expect(await hasRoadmap("acme")).toBe(false);
    const id = (await add("acme")).body.item.id;
    expect(await hasRoadmap("acme")).toBe(true);
    expect(await hasRoadmap("globex")).toBe(false);
    await call("DELETE", `/api/portal/admin/companies/acme/roadmap/${id}`, DE_STAFF);
    expect(await hasRoadmap("acme")).toBe(false);
  });
});
