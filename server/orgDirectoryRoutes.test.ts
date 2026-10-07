import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Company structure, people directory and leader approvals over HTTP, with
 * memory stores. Leaders and IDs are the company IT contact's to set, for
 * their own company only. A request that needs approval waits for the site
 * leader (then backup, then IT contact) with no Desk ticket; one approver
 * decides. VIPs get direct support (no leader copy or fallback) and, by
 * default, skip approval. An approver filing for their team approves by filing.
 */

vi.mock("./integrations/ensureDeSyncSchema", () => ({ ensureDeSyncSchema: async () => undefined }));
vi.mock("./integrations/deSyncOutboxRecovery", () => ({ recoverStaleOutboxLocks: async () => 0 }));

type U = { id: string; clientId: string | null; fullName: string; email: string; isActive: boolean; isCompanyItContact?: boolean; managerUserId?: string | null };
const USERS: Record<string, U> = {
  "u-ann": { id: "u-ann", clientId: "acme", fullName: "Ann Acme", email: "ann@acme.test", isActive: true },
  "u-lee": { id: "u-lee", clientId: "acme", fullName: "Lee Leader", email: "lee@acme.test", isActive: true },
  "u-bea": { id: "u-bea", clientId: "acme", fullName: "Bea Backup", email: "bea@acme.test", isActive: true },
  "u-ivy": { id: "u-ivy", clientId: "acme", fullName: "Ivy IT", email: "ivy@acme.test", isActive: true, isCompanyItContact: true },
  "u-vic": { id: "u-vic", clientId: "acme", fullName: "Vic VIP", email: "vic@acme.test", isActive: true },
  "u-gus": { id: "u-gus", clientId: "globex", fullName: "Gus Globex", email: "gus@globex.test", isActive: true, isCompanyItContact: true },
};
const CLIENTS: Record<string, { id: string; companyName: string; hubAccountId: string | null }> = {
  acme: { id: "acme", companyName: "Acme Corp", hubAccountId: null },
  globex: { id: "globex", companyName: "Globex", hubAccountId: null },
};

const as = (id: string, extra: Record<string, unknown> = {}) => ({ id, role: "user", clientId: USERS[id].clientId, isCompanyItContact: Boolean(USERS[id].isCompanyItContact), ...extra });
const ANN = as("u-ann");
const LEE = as("u-lee");
const IVY = as("u-ivy");
const VIC = as("u-vic");
const GUS = as("u-gus");
const DE_ADMIN = { id: "u-admin", role: "admin", clientId: null, impersonatingCompanyId: "acme" };

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
const adminOnly: express.RequestHandler = (req, res, next) => ((req as any).user?.role === "admin" ? next() : res.status(403).json({ error: "Admin only" }));

const NOW = new Date("2026-10-06T15:00:00");
const deskCalls: string[] = [];
const approvalEmails: Array<{ number: string; to: string[] }> = [];
const leaderCopies: Array<{ number: string; to: string[] }> = [];

let server: Server;
let baseUrl = "";
let siteId = "";

beforeAll(async () => {
  const { registerServiceRequestRoutes } = await import("./serviceRequestRoutes");
  const { registerOrgDirectoryRoutes } = await import("./orgDirectoryRoutes");
  const app = express();
  app.use(express.json());
  const directory = {
    getClient: (id: string) => CLIENTS[id],
    findUser: (id: string) => USERS[id],
    listClientUsers: (clientId: string) => Object.values(USERS).filter((u) => u.clientId === clientId),
  };
  registerServiceRequestRoutes(app, {
    ...directory,
    guards: [signedInAs],
    adminGuards: [signedInAs, adminOnly],
    createDeskTicket: async ({ subject }) => {
      deskCalls.push(subject);
      return "desk-1";
    },
    notify: {
      approvalNeeded: async (i) => approvalEmails.push({ number: i.number, to: i.to.map((t) => t.userId) }),
      leaderCopy: async (i) => leaderCopies.push({ number: i.number, to: i.to.map((t) => t.userId) }),
    },
    now: () => NOW,
  });
  registerOrgDirectoryRoutes(app, {
    ...directory,
    guards: [signedInAs],
    canManage: (u: any) => u?.role === "admin" || Boolean(u?.isCompanyItContact),
    now: () => NOW,
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  const { createManualRecord } = await import("./portalManualRecords");
  siteId = (
    await createManualRecord({ clientId: "acme", kind: "site", data: { code: "AZ76", street: "1 Main St", city: "Glendale", state: "Arizona", country: "United States of America", zip: "85308" } })
  ).id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  const { _resetOrgDirectoryMemory } = await import("./orgDirectoryStore");
  _resetOrgDirectoryMemory();
  deskCalls.length = 0;
  approvalEmails.length = 0;
  leaderCopies.length = 0;
});

const call = (method: string, path: string, user: object | null, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const profile = (over: Record<string, unknown> = {}) => ({
  structure: "site",
  idScheme: "de",
  idPrefix: "ACME",
  companyIdLabel: "Employee ID",
  companyIdPattern: "",
  vipSkipsApproval: true,
  approvalRequiredFor: [],
  ...over,
});

async function setUp(over: Record<string, unknown> = {}) {
  expect((await call("PUT", "/api/portal/directory/profile", IVY, { profile: profile(over) })).status).toBe(200);
  expect((await call("PUT", "/api/portal/directory/leaders", IVY, { unitKind: "site", unitId: siteId, leaderUserId: "u-lee", backupUserId: "u-bea", ccLeader: true })).status).toBe(200);
  for (const id of ["u-ann", "u-vic"]) expect((await call("PUT", `/api/portal/directory/people/${id}`, IVY, { siteId })).status).toBe(200);
  expect((await call("PUT", "/api/portal/directory/people/u-vic", IVY, { supportTier: "vip" })).status).toBe(200);
}

const loaner = (requestedForUserId = "u-ann") => ({
  type: "loaner_computer",
  mode: "submit",
  fields: { requestedForUserId, contactPhone: "602-555-0100", deviceKind: "laptop", neededFrom: "2026-10-07", loanUntil: "2026-10-21", siteId, addressNotClientLocation: false, reason: "Repair" },
});

describe("directory", () => {
  it("gives everyone a permanent DE ID and shows their leader", async () => {
    await setUp();
    const me = await (await call("GET", "/api/portal/directory/me", ANN)).json();
    expect(me.me.dePersonId).toMatch(/^ACME-\d{5}$/);
    expect(me.me.personId).toBe(me.me.dePersonId);
    expect(me.unit).toMatchObject({ kind: "site", id: siteId, name: "AZ76" });
    expect(me.leader).toMatchObject({ userId: "u-lee" });
    expect(me.canManage).toBe(false);
    const again = await (await call("GET", "/api/portal/directory/me", ANN)).json();
    expect(again.me.dePersonId).toBe(me.me.dePersonId);
    const lee = await (await call("GET", "/api/portal/directory/me", LEE)).json();
    expect(lee.leads).toEqual([expect.objectContaining({ unitId: siteId, role: "leader" })]);
  });

  it("keeps management to the company IT contact, inside their own company", async () => {
    expect((await call("GET", "/api/portal/directory", ANN)).status).toBe(403);
    expect((await call("PUT", "/api/portal/directory/profile", ANN, { profile: profile() })).status).toBe(403);
    expect((await call("PUT", "/api/portal/directory/people/u-ann", GUS, { supportTier: "vip" })).status).toBe(404);
    expect((await call("PUT", "/api/portal/directory/leaders", GUS, { unitKind: "site", unitId: siteId, leaderUserId: "u-gus" })).status).toBe(404);
    const dir = await (await call("GET", "/api/portal/directory", DE_ADMIN)).json();
    expect(dir.people.map((p: any) => p.userId)).not.toContain("u-gus");
  });

  it("lets a DE admin with the company open manage it without being one of its people", async () => {
    const me = await (await call("GET", "/api/portal/directory/me", DE_ADMIN)).json();
    expect(me).toMatchObject({ success: true, me: null, leads: [], canManage: true });
    const none = await call("GET", "/api/portal/directory/me", { ...DE_ADMIN, impersonatingCompanyId: null });
    expect(none.status).toBe(400);
    expect((await none.json()).error).toMatch(/open a company/i);
  });

  it("validates leaders", async () => {
    const put = (body: object) => call("PUT", "/api/portal/directory/leaders", IVY, { unitKind: "site", unitId: siteId, ...body });
    expect((await put({ leaderUserId: "u-gus" })).status).toBe(400);
    expect((await put({ leaderUserId: "u-lee", backupUserId: "u-lee" })).status).toBe(400);
    expect((await put({ leaderUserId: null, backupUserId: "u-bea" })).status).toBe(400);
    expect((await call("PUT", "/api/portal/directory/leaders", IVY, { unitKind: "site", unitId: "nope", leaderUserId: "u-lee" })).status).toBe(404);
  });

  it("shows company IDs when the company uses its own scheme, following its naming rule, unique per company", async () => {
    await setUp({ idScheme: "company", companyIdPattern: "E#####" });
    expect((await call("PUT", "/api/portal/directory/people/u-ann", IVY, { companyPersonId: "123" })).status).toBe(400);
    expect((await call("PUT", "/api/portal/directory/people/u-ann", IVY, { companyPersonId: "E00001" })).status).toBe(200);
    expect((await call("PUT", "/api/portal/directory/people/u-lee", IVY, { companyPersonId: "e00001" })).status).toBe(400);
    const dir = await (await call("GET", "/api/portal/directory", IVY)).json();
    expect(dir.people.find((p: any) => p.userId === "u-ann").personId).toBe("E00001");
    // A rule that existing IDs don't follow is refused.
    expect((await call("PUT", "/api/portal/directory/profile", IVY, { profile: profile({ companyIdPattern: "AA###" }) })).status).toBe(400);
    expect((await call("PUT", "/api/portal/directory/profile", IVY, { profile: profile({ idPrefix: "a1" }) })).status).toBe(400);
  });

  it("previews an import and applies only a clean file", async () => {
    await setUp({ companyIdPattern: "E#####" });
    const bad = await (await call("POST", "/api/portal/directory/import", IVY, { csv: "Email,Employee ID,Site,VIP\nann@acme.test,E00010,AZ76,no\nghost@acme.test,E00011,,", apply: true })).json();
    expect(bad.applied).toBe(0);
    expect(bad.canApply).toBe(false);
    expect(bad.rows[1].errors[0]).toMatch(/No portal user/);
    const csv = "Email,Employee ID,Site,VIP\nann@acme.test,E00010,AZ76,no\nlee@acme.test,E00011,AZ76,yes";
    const preview = await (await call("POST", "/api/portal/directory/import", IVY, { csv })).json();
    expect(preview).toMatchObject({ applied: 0, canApply: true });
    const done = await (await call("POST", "/api/portal/directory/import", IVY, { csv, apply: true })).json();
    expect(done.applied).toBe(2);
    const dir = await (await call("GET", "/api/portal/directory", IVY)).json();
    expect(dir.people.find((p: any) => p.userId === "u-lee")).toMatchObject({ companyPersonId: "E00011", supportTier: "vip", siteId });
  });

  it("lets a person mark themselves away, not in the past", async () => {
    expect((await call("PUT", "/api/portal/directory/me/availability", ANN, { awayUntil: "2026-10-01" })).status).toBe(400);
    expect((await (await call("PUT", "/api/portal/directory/me/availability", ANN, { awayUntil: "2026-10-09" })).json()).awayUntil).toBe("2026-10-09");
    expect((await (await call("PUT", "/api/portal/directory/me/availability", ANN, { awayUntil: null })).json()).awayUntil).toBeNull();
  });
});

describe("approvals and contact routing", () => {
  it("parks a request for the site leader, then sends it to DE once approved, copying the leader", async () => {
    await setUp({ approvalRequiredFor: ["loaner_computer"] });
    const created = await (await call("POST", "/api/portal/service-requests", ANN, loaner())).json();
    const r = created.request;
    expect(r.status).toBe("pending_approval");
    expect(r.payload.approvalFlow.approvers.map((a: any) => a.userId)).toEqual(["u-lee", "u-bea", "u-ivy"]);
    expect(r.payload.contactPlan).toMatchObject({ supportTier: "standard", fallback: { userId: "u-lee" } });
    expect(deskCalls).toEqual([]);
    expect(approvalEmails).toEqual([{ number: r.number, to: ["u-lee", "u-bea", "u-ivy"] }]);

    // The requester can't approve their own request; another company can't see it.
    expect((await call("POST", `/api/portal/service-requests/${r.id}/approval`, ANN, { decision: "approve" })).status).toBe(403);
    expect((await call("POST", `/api/portal/service-requests/${r.id}/approval`, GUS, { decision: "approve" })).status).toBe(404);

    const queue = await (await call("GET", "/api/portal/service-requests/approvals", LEE)).json();
    expect(queue.pending.map((x: any) => x.id)).toEqual([r.id]);
    expect((await call("GET", `/api/portal/service-requests/${r.id}`, LEE)).status).toBe(200);
    expect((await call("POST", `/api/portal/service-requests/${r.id}/approval`, LEE, { decision: "reject" })).status).toBe(400);

    const approved = await (await call("POST", `/api/portal/service-requests/${r.id}/approval`, LEE, { decision: "approve", note: "OK" })).json();
    expect(approved.request.status).toBe("submitted");
    expect(approved.request.payload.approvalFlow).toMatchObject({ state: "approved", decidedBy: { userId: "u-lee", role: "leader" } });
    expect(deskCalls).toHaveLength(1);
    expect(leaderCopies).toEqual([{ number: r.number, to: ["u-lee"] }]);
    expect((await call("POST", `/api/portal/service-requests/${r.id}/approval`, IVY, { decision: "approve" })).status).toBe(409);
  });

  it("records a rejection with its reason and never opens a Desk ticket", async () => {
    await setUp({ approvalRequiredFor: ["loaner_computer"] });
    const { request } = await (await call("POST", "/api/portal/service-requests", ANN, loaner())).json();
    const res = await (await call("POST", `/api/portal/service-requests/${request.id}/approval`, IVY, { decision: "reject", note: "Use the spare in the office" })).json();
    expect(res.request.status).toBe("rejected");
    expect(res.request.statusHistory.at(-1)).toMatchObject({ status: "rejected", note: "Use the spare in the office" });
    expect(deskCalls).toEqual([]);
  });

  it("gives a VIP direct support: no approval, no leader copy, no fallback", async () => {
    await setUp({ approvalRequiredFor: ["loaner_computer"] });
    const { request } = await (await call("POST", "/api/portal/service-requests", VIC, loaner("u-vic"))).json();
    expect(request.status).toBe("submitted");
    expect(request.payload.contactPlan).toMatchObject({ supportTier: "vip", fallback: null, cc: [] });
    expect(leaderCopies).toEqual([]);
    expect(deskCalls).toHaveLength(1);
  });

  it("treats a request filed by the leader for their team member as approved", async () => {
    await setUp({ approvalRequiredFor: ["loaner_computer"] });
    const { request } = await (await call("POST", "/api/portal/service-requests", LEE, loaner("u-ann"))).json();
    expect(request.status).toBe("submitted");
    expect(request.payload.approvalFlow).toMatchObject({ state: "approved", decidedBy: { userId: "u-lee", role: "requester" } });
  });

  it("skips an away leader, and lets the requester cancel while waiting", async () => {
    await setUp({ approvalRequiredFor: ["loaner_computer"] });
    await call("PUT", "/api/portal/directory/me/availability", LEE, { awayUntil: "2026-10-20" });
    const { request } = await (await call("POST", "/api/portal/service-requests", ANN, loaner())).json();
    expect(request.payload.approvalFlow.approvers.map((a: any) => a.userId)).toEqual(["u-bea", "u-ivy"]);
    expect(request.payload.contactPlan.fallback).toMatchObject({ userId: "u-bea", role: "backup_leader" });
    const cancelled = await (await call("POST", `/api/portal/service-requests/${request.id}/cancel`, ANN, {})).json();
    expect(cancelled.request.status).toBe("cancelled");
  });

  it("sends requests that need no approval straight to DE", async () => {
    await setUp();
    const { request } = await (await call("POST", "/api/portal/service-requests", ANN, loaner())).json();
    expect(request.status).toBe("submitted");
    expect(request.payload.approvalFlow.required).toBe(false);
    expect(leaderCopies).toEqual([{ number: request.number, to: ["u-lee"] }]);
  });
});
