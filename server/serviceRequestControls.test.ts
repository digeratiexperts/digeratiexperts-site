import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Hold, resume, amend and cancel for service requests, over HTTP with memory
 * stores. A hold lasts until a date (1 to 180 days) and resumes by itself on
 * that date to the status it was held from. The requester, their site leader,
 * the IT contact, DE and the Hub may hold; another company gets a 404. Amend
 * works until the work is under way, and a change that needs approval goes
 * back to the approver.
 */

vi.mock("./integrations/ensureDeSyncSchema", () => ({ ensureDeSyncSchema: async () => undefined }));
vi.mock("./integrations/deSyncOutboxRecovery", () => ({ recoverStaleOutboxLocks: async () => 0 }));

type U = { id: string; clientId: string | null; fullName: string; email: string; isActive: boolean; isCompanyItContact?: boolean };
const USERS: Record<string, U> = {
  "u-ann": { id: "u-ann", clientId: "acme", fullName: "Ann Acme", email: "ann@acme.test", isActive: true },
  "u-bob": { id: "u-bob", clientId: "acme", fullName: "Bob Acme", email: "bob@acme.test", isActive: true },
  "u-lee": { id: "u-lee", clientId: "acme", fullName: "Lee Leader", email: "lee@acme.test", isActive: true },
  "u-ivy": { id: "u-ivy", clientId: "acme", fullName: "Ivy IT", email: "ivy@acme.test", isActive: true, isCompanyItContact: true },
  "u-gus": { id: "u-gus", clientId: "globex", fullName: "Gus Globex", email: "gus@globex.test", isActive: true },
};
const CLIENTS: Record<string, { id: string; companyName: string; hubAccountId: string | null }> = {
  acme: { id: "acme", companyName: "Acme Corp", hubAccountId: null },
  globex: { id: "globex", companyName: "Globex", hubAccountId: null },
};
const as = (id: string) => ({ id, role: "user", clientId: USERS[id].clientId, isCompanyItContact: Boolean(USERS[id].isCompanyItContact) });
const ANN = as("u-ann");
const BOB = as("u-bob");
const LEE = as("u-lee");
const IVY = as("u-ivy");
const GUS = as("u-gus");
const DE_ADMIN = { id: "u-admin", role: "admin", clientId: null, impersonatingCompanyId: "acme" };

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
const adminOnly: express.RequestHandler = (req, res, next) => ((req as any).user?.role === "admin" ? next() : res.status(403).json({ error: "Admin only" }));

let clock = new Date("2026-10-06T15:00:00Z");
const deskCalls: string[] = [];
let server: Server;
let baseUrl = "";
let siteId = "";
let deps: any;

beforeAll(async () => {
  const { registerServiceRequestRoutes, registerHubServiceRequestStatusRoute } = await import("./serviceRequestRoutes");
  const { registerOrgDirectoryRoutes } = await import("./orgDirectoryRoutes");
  const app = express();
  app.use(express.json());
  const directory = {
    getClient: (id: string) => CLIENTS[id],
    findUser: (id: string) => USERS[id],
    listClientUsers: (clientId: string) => Object.values(USERS).filter((u) => u.clientId === clientId),
  };
  deps = {
    ...directory,
    guards: [signedInAs],
    adminGuards: [signedInAs, adminOnly],
    createDeskTicket: async ({ subject }: { subject: string }) => {
      deskCalls.push(subject);
      return "desk-1";
    },
    now: () => clock,
  };
  registerServiceRequestRoutes(app, deps);
  registerHubServiceRequestStatusRoute(app, deps, (_req, _res, next) => next());
  registerOrgDirectoryRoutes(app, { ...directory, guards: [signedInAs], canManage: (u: any) => u?.role === "admin" || Boolean(u?.isCompanyItContact), now: () => clock });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  baseUrl = `http://127.0.0.1:${address.port}`;
  const { createManualRecord } = await import("./portalManualRecords");
  siteId = (await createManualRecord({ clientId: "acme", kind: "site", data: { code: "AZ76", street: "1 Main St", city: "Glendale", state: "Arizona", country: "United States of America", zip: "85308" } })).id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  clock = new Date("2026-10-06T15:00:00Z");
  deskCalls.length = 0;
  const { _resetOrgDirectoryMemory } = await import("./orgDirectoryStore");
  _resetOrgDirectoryMemory();
});

const call = (method: string, path: string, user: object | null, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const loanerFields = (over: Record<string, unknown> = {}) => ({
  requestedForUserId: "u-ann",
  contactPhone: "602-555-0100",
  deviceKind: "laptop",
  neededFrom: "2026-10-07",
  loanUntil: "2026-10-21",
  siteId,
  addressNotClientLocation: false,
  reason: "Repair",
  ...over,
});
const submit = async (user: object, fields = loanerFields()) => (await (await call("POST", "/api/portal/service-requests", user, { type: "loaner_computer", mode: "submit", fields })).json()).request;

async function leaderSetUp(approval = false) {
  await call("PUT", "/api/portal/directory/profile", IVY, {
    profile: { structure: "site", idScheme: "de", idPrefix: "ACME", companyIdLabel: "Employee ID", companyIdPattern: "", vipSkipsApproval: true, approvalRequiredFor: approval ? ["loaner_computer"] : [] },
  });
  await call("PUT", "/api/portal/directory/leaders", IVY, { unitKind: "site", unitId: siteId, leaderUserId: "u-lee", backupUserId: null, ccLeader: true });
  await call("PUT", "/api/portal/directory/people/u-ann", IVY, { siteId });
}

describe("hold and resume", () => {
  it("holds until a date, then resumes by itself to the status it was held from", async () => {
    const r = await submit(ANN);
    const held = await (await call("POST", `/api/portal/service-requests/${r.id}/hold`, ANN, { until: "2026-10-13", reason: "Travelling this week" })).json();
    expect(held.request.status).toBe("on_hold");
    expect(held.request.payload.hold).toMatchObject({ until: "2026-10-13", resumeStatus: "submitted", by: { userId: "u-ann", role: "requester" } });

    clock = new Date("2026-10-12T15:00:00Z");
    expect((await (await call("GET", `/api/portal/service-requests/${r.id}`, ANN)).json()).request.status).toBe("on_hold");
    clock = new Date("2026-10-13T08:00:00Z");
    const after = (await (await call("GET", `/api/portal/service-requests/${r.id}`, ANN)).json()).request;
    expect(after.status).toBe("submitted");
    expect(after.statusHistory.at(-1)).toMatchObject({ status: "submitted", note: "Hold ended (2026-10-13)" });
    expect(after.payload.hold).toBeUndefined();
  });

  it("checks the length and the reason", async () => {
    const r = await submit(ANN);
    expect((await call("POST", `/api/portal/service-requests/${r.id}/hold`, ANN, { until: "2026-10-06", reason: "x" })).status).toBe(400);
    expect((await call("POST", `/api/portal/service-requests/${r.id}/hold`, ANN, { until: "2027-06-01", reason: "x" })).status).toBe(400);
    expect((await call("POST", `/api/portal/service-requests/${r.id}/hold`, ANN, { until: "2026-10-10", reason: "" })).status).toBe(400);
  });

  it("lets the site leader and the IT contact hold, not a colleague or another company", async () => {
    await leaderSetUp();
    const r = await submit(ANN);
    expect((await call("POST", `/api/portal/service-requests/${r.id}/hold`, BOB, { until: "2026-10-10", reason: "x" })).status).toBe(404);
    expect((await call("POST", `/api/portal/service-requests/${r.id}/hold`, GUS, { until: "2026-10-10", reason: "x" })).status).toBe(404);
    const byLeader = await (await call("POST", `/api/portal/service-requests/${r.id}/hold`, LEE, { until: "2026-10-10", reason: "Team offsite" })).json();
    expect(byLeader.request.payload.hold.by.role).toBe("leader");
    const resumed = await (await call("POST", `/api/portal/service-requests/${r.id}/resume`, IVY, {})).json();
    expect(resumed.request.status).toBe("submitted");
    expect((await call("POST", `/api/portal/service-requests/${r.id}/resume`, IVY, {})).status).toBe(409);
  });

  it("shows leaders and the IT contact their team's requests", async () => {
    await leaderSetUp();
    const r = await submit(ANN);
    expect((await (await call("GET", "/api/portal/service-requests/team", LEE)).json()).requests.map((x: any) => x.id)).toContain(r.id);
    expect((await (await call("GET", "/api/portal/service-requests/team", IVY)).json()).requests.map((x: any) => x.id)).toContain(r.id);
    expect((await (await call("GET", "/api/portal/service-requests/team", BOB)).json()).requests).toEqual([]);
  });

  it("lets DE and the Hub hold through the status route, and resume to the held-from status", async () => {
    const r = await submit(ANN);
    const path = `/api/integrations/v1/hub/service-requests/${r.id}/status`;
    expect((await call("POST", path, null, { status: "on_hold" })).status).toBe(400);
    const held = await (await call("POST", path, null, { status: "on_hold", holdUntil: "2026-10-20", note: "Waiting on stock" })).json();
    expect(held.request.payload.hold).toMatchObject({ until: "2026-10-20", reason: "Waiting on stock", by: { role: "hub" } });
    expect((await call("POST", path, null, { status: "device_assigned" })).status).toBe(409);
    const resumed = await (await call("POST", path, null, { status: "submitted" })).json();
    expect(resumed.request.status).toBe("submitted");
  });

  it("allows cancelling a held request that was cancellable when held", async () => {
    const r = await submit(ANN);
    await call("POST", `/api/portal/service-requests/${r.id}/hold`, ANN, { until: "2026-10-10", reason: "x" });
    expect((await (await call("POST", `/api/portal/service-requests/${r.id}/cancel`, ANN, {})).json()).request.status).toBe("cancelled");
  });
});

describe("amend", () => {
  it("changes the details and records what changed, without a second Desk ticket", async () => {
    const r = await submit(ANN);
    expect(deskCalls).toHaveLength(1);
    const res = await (await call("PATCH", `/api/portal/service-requests/${r.id}`, ANN, { fields: loanerFields({ deviceKind: "desktop", loanUntil: "2026-10-28" }), revision: r.revision })).json();
    expect(res.request.payload).toMatchObject({ deviceKind: "desktop", loanUntil: "2026-10-28" });
    expect(res.request.status).toBe("submitted");
    expect(res.request.statusHistory.at(-1).note).toMatch(/Amended: device kind, loan until/);
    expect(deskCalls).toHaveLength(1);
  });

  it("validates like a new request and refuses a stale revision", async () => {
    const r = await submit(ANN);
    const bad = await call("PATCH", `/api/portal/service-requests/${r.id}`, ANN, { fields: loanerFields({ loanUntil: "2026-10-01" }) });
    expect(bad.status).toBe(400);
    expect((await bad.json()).fieldErrors.loanUntil).toBeTruthy();
    expect((await call("PATCH", `/api/portal/service-requests/${r.id}`, ANN, { fields: loanerFields(), revision: 1 })).status).toBe(409);
    const same = await (await call("PATCH", `/api/portal/service-requests/${r.id}`, ANN, { fields: loanerFields() })).json();
    expect(same.unchanged).toBe(true);
  });

  it("sends an amended request back for approval, unless the approver amends it", async () => {
    await leaderSetUp(true);
    const r = await submit(ANN);
    expect(r.status).toBe("pending_approval");
    const approved = await (await call("POST", `/api/portal/service-requests/${r.id}/approval`, LEE, { decision: "approve" })).json();
    expect(approved.request.status).toBe("submitted");

    const amended = await (await call("PATCH", `/api/portal/service-requests/${r.id}`, ANN, { fields: loanerFields({ reason: "Repair, longer" }) })).json();
    expect(amended.request.status).toBe("pending_approval");
    expect(amended.request.statusHistory.at(-1).note).toMatch(/Needs approval again/);

    const byLeader = await (await call("PATCH", `/api/portal/service-requests/${r.id}`, LEE, { fields: loanerFields({ reason: "Repair, two weeks" }) })).json();
    expect(byLeader.request.status).toBe("submitted");
    expect(deskCalls).toHaveLength(1);
  });

  it("stops once the work is under way", async () => {
    const r = await submit(ANN);
    await call("POST", `/api/portal/admin/service-requests/${r.id}/status`, DE_ADMIN, { status: "device_assigned" });
    expect((await call("PATCH", `/api/portal/service-requests/${r.id}`, ANN, { fields: loanerFields({ reason: "Other" }) })).status).toBe(409);
  });
});
