import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RepresentationProjection } from "@shared/representation";

/**
 * Hub-defined representatives in the Portal, over HTTP with the memory store.
 * The Hub projection is the authority: a user sees and files for only the
 * groups they live-represent, only within the session's company, only for
 * request kinds their communication scope covers. Everyone else gets nothing.
 */

vi.mock("./integrations/ensureDeSyncSchema", () => ({ ensureDeSyncSchema: async () => undefined }));
vi.mock("./integrations/deSyncOutboxRecovery", () => ({ recoverStaleOutboxLocks: async () => 0 }));

type U = { id: string; clientId: string | null; fullName: string; email: string; isActive: boolean };
const USERS: Record<string, U> = {
  "u-dee": { id: "u-dee", clientId: "acme", fullName: "Dee Plant", email: "dee@acme.test", isActive: true },
  "u-fin": { id: "u-fin", clientId: "acme", fullName: "Fin Lead", email: "FIN@acme.test", isActive: true },
  "u-amy": { id: "u-amy", clientId: "acme", fullName: "Amy Staff", email: "amy@acme.test", isActive: true },
  "u-old": { id: "u-old", clientId: "acme", fullName: "Old Rep", email: "old@acme.test", isActive: false },
  "u-gus": { id: "u-gus", clientId: "globex", fullName: "Gus Globex", email: "gus@globex.test", isActive: true },
};
const CLIENTS: Record<string, { id: string; companyName: string; hubAccountId: string | null }> = {
  acme: { id: "acme", companyName: "Acme Corp", hubAccountId: "250" },
  globex: { id: "globex", companyName: "Globex", hubAccountId: "777" },
  unlinked: { id: "unlinked", companyName: "No Hub", hubAccountId: null },
};

const rep = (extra: Partial<RepresentationProjection["groups"][number]["representatives"][number]>) => ({
  role: "primary" as const,
  displayName: "x",
  email: null,
  portalUserId: null,
  communicationScopes: ["group_requests"],
  responsibilities: [],
  effectiveUntil: null,
  ...extra,
});

const ACME: RepresentationProjection = {
  contract: "client-org-representation/v1",
  accountId: 250,
  model: "hybrid",
  active: true,
  generatedAt: "2026-10-14T00:00:00.000Z",
  groups: [
    {
      scopeKey: "site:11",
      kind: "site",
      name: "Tucson Plant",
      portalRefs: [],
      representatives: [
        rep({ displayName: "Dee Plant", portalUserId: "u-dee", communicationScopes: ["group_requests", "equipment_collection"] }),
        rep({ role: "backup", displayName: "Old Rep", portalUserId: "u-old" }),
      ],
    },
    {
      scopeKey: "unit:5",
      kind: "department",
      name: "Finance",
      portalRefs: ["department:d1"],
      // matched by email (case-insensitive) when the Hub has no Portal user id
      representatives: [rep({ displayName: "Fin Lead", email: "fin@acme.test", communicationScopes: ["technology_assessments"] })],
    },
    {
      scopeKey: "unit:6",
      kind: "department",
      name: "Lapsed",
      portalRefs: [],
      representatives: [rep({ displayName: "Dee Plant", portalUserId: "u-dee", effectiveUntil: "2026-01-01" })],
    },
  ],
};

const PROJECTIONS: Record<string, RepresentationProjection | null> = { "250": ACME, "777": { ...ACME, accountId: 777, groups: [] } };
let hubDown = false;
const fetched: string[] = [];

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
const as = (id: string, extra: Record<string, unknown> = {}) => ({ id, role: "user", clientId: USERS[id]?.clientId ?? null, ...extra });

const deskCalls: Array<{ subject: string; description: string; email: string }> = [];
let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const { registerRepresentationRoutes } = await import("./representationRoutes");
  const app = express();
  app.use(express.json());
  registerRepresentationRoutes(app, {
    guards: [signedInAs],
    getClient: (id) => CLIENTS[id],
    findUser: (id) => USERS[id],
    fetchProjection: async (accountId) => {
      fetched.push(accountId);
      return hubDown ? null : PROJECTIONS[accountId] ?? null;
    },
    createDeskTicket: async (input) => {
      deskCalls.push(input);
      return "desk-77";
    },
    now: () => new Date("2026-10-14T12:00:00Z"),
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
}, 60_000);

afterAll(() => new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve())));

beforeEach(async () => {
  const { _resetGroupRequestMemory } = await import("./groupRequestStore");
  _resetGroupRequestMemory();
  hubDown = false;
  deskCalls.length = 0;
  fetched.length = 0;
});

async function call(method: string, path: string, user: unknown, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as any };
}

const ME = "/api/portal/representation/me";
const REQS = "/api/portal/representation/requests";

describe("Hub-defined representation in the Portal", () => {
  it("shows a representative only the live groups they represent, by Portal id or email", async () => {
    const dee = await call("GET", ME, as("u-dee"));
    expect(dee.status).toBe(200);
    expect(dee.body.groups.map((g: any) => g.scopeKey)).toEqual(["site:11"]);
    expect(dee.body.groups[0]).toMatchObject({ myRole: "primary", allowedKinds: ["group_request", "equipment_collection"] });
    // co-representatives by name and role only
    expect(dee.body.groups[0].representatives).toEqual([
      { role: "primary", displayName: "Dee Plant" },
      { role: "backup", displayName: "Old Rep" },
    ]);
    expect(JSON.stringify(dee.body)).not.toContain("@acme.test");
    const fin = await call("GET", ME, as("u-fin"));
    expect(fin.body.groups.map((g: any) => g.scopeKey)).toEqual(["unit:5"]);
    expect(fetched).toEqual(["250", "250"]);
  });

  it("gives non-representatives, inactive users and DE admins no groups", async () => {
    expect((await call("GET", ME, as("u-amy"))).body.groups).toEqual([]);
    expect((await call("GET", ME, as("u-old"))).body.groups).toEqual([]);
    expect((await call("GET", ME, { id: "u-admin", role: "admin", clientId: null, impersonatingCompanyId: "acme" })).body.groups).toEqual([]);
  });

  it("files a request for a represented group, opens a Desk ticket, and lists it", async () => {
    const res = await call("POST", REQS, as("u-dee"), { scopeKey: "site:11", kind: "equipment_collection", subject: "Collect 6 laptops", description: "Six returns waiting at the front desk." });
    expect(res.status).toBe(201);
    expect(res.body.request).toMatchObject({ groupName: "Tucson Plant", kind: "equipment_collection", status: "submitted", submittedByMe: true, hasDeskTicket: true });
    expect(deskCalls[0].subject).toBe("[Tucson Plant] Equipment collection: Collect 6 laptops");
    expect(deskCalls[0].description).toContain("not approval authority");
    expect(deskCalls[0].email).toBe("dee@acme.test");
    const list = await call("GET", REQS, as("u-dee"));
    expect(list.body.requests).toHaveLength(1);
    expect(list.body.requests[0]).not.toHaveProperty("submittedByUserId");
    // a colleague who is not a representative sees none of it
    expect((await call("GET", REQS, as("u-amy"))).body.requests).toEqual([]);
    // another representative of a different group does not see it either
    expect((await call("GET", REQS, as("u-fin"))).body.requests).toEqual([]);
  });

  it("refuses groups the user does not represent, lapsed delegations, and uncovered kinds", async () => {
    const body = { kind: "group_request", subject: "Need help", description: "Please help." };
    expect((await call("POST", REQS, as("u-amy"), { ...body, scopeKey: "site:11" })).status).toBe(403);
    expect((await call("POST", REQS, as("u-dee"), { ...body, scopeKey: "unit:6" })).status).toBe(403);
    expect((await call("POST", REQS, as("u-dee"), { ...body, scopeKey: "unit:5" })).status).toBe(403);
    const uncovered = await call("POST", REQS, as("u-fin"), { ...body, scopeKey: "unit:5" });
    expect(uncovered.status).toBe(403);
    expect(uncovered.body.error).toMatch(/doesn't cover/);
    expect((await call("POST", REQS, as("u-fin"), { ...body, kind: "technology_assessment", scopeKey: "unit:5" })).status).toBe(201);
  });

  it("keeps tenants apart: the company comes from the session, never the body", async () => {
    await call("POST", REQS, as("u-dee"), { scopeKey: "site:11", kind: "group_request", subject: "Acme only", description: "Acme only." });
    const gus = await call("GET", REQS, as("u-gus"));
    expect(gus.body.requests).toEqual([]);
    const spoof = await call("POST", REQS, as("u-gus"), { scopeKey: "site:11", kind: "group_request", subject: "Spoof", description: "Spoof.", clientId: "acme" });
    expect(spoof.status).toBe(400); // strict body: unknown keys are rejected
    const viaGroup = await call("POST", REQS, as("u-gus"), { scopeKey: "site:11", kind: "group_request", subject: "Spoof", description: "Spoof." });
    expect(viaGroup.status).toBe(403);
    expect(fetched.every((id) => id === "250" || id === "777")).toBe(true);
  });

  it("fails closed when the Hub is unavailable or the company is not linked", async () => {
    hubDown = true;
    expect((await call("GET", ME, as("u-dee"))).body).toMatchObject({ available: false, groups: [] });
    expect((await call("POST", REQS, as("u-dee"), { scopeKey: "site:11", kind: "group_request", subject: "Down", description: "Down." })).status).toBe(503);
    hubDown = false;
    const unlinked = await call("POST", REQS, { id: "u-x", role: "user", clientId: "unlinked" }, { scopeKey: "site:11", kind: "group_request", subject: "x y z", description: "x y z" });
    expect(unlinked.status).toBe(409);
  });

  it("requires a signed-in user and a valid body", async () => {
    expect((await call("GET", ME, null)).status).toBe(401);
    expect((await call("POST", REQS, as("u-dee"), { scopeKey: "site:11; drop", kind: "group_request", subject: "x", description: "y" })).status).toBe(400);
  });
});
