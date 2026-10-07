import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { LicensePolicy } from "@shared/licensing";

/**
 * Licensing over HTTP with memory stores: the company policy is DE admin
 * only and validated; account types are set by the company IT contact for
 * their own company only; a licence request is checked against the policy
 * (automatic licences and ineligible accounts are refused, the group comes
 * from the policy, not the browser) and gets a LIC number.
 */

vi.mock("./integrations/ensureDeSyncSchema", () => ({ ensureDeSyncSchema: async () => undefined }));
vi.mock("./integrations/deSyncOutboxRecovery", () => ({ recoverStaleOutboxLocks: async () => 0 }));

const USERS = {
  "u-ann": { id: "u-ann", clientId: "acme", fullName: "Ann Acme", email: "ann@acme.test", isActive: true },
  "u-fay": { id: "u-fay", clientId: "acme", fullName: "Fay Frontline", email: "fay@acme.test", isActive: true },
  "u-it": { id: "u-it", clientId: "acme", fullName: "Ivy IT", email: "ivy@acme.test", isActive: true },
  "u-gus": { id: "u-gus", clientId: "globex", fullName: "Gus Globex", email: "gus@globex.test", isActive: true },
} as Record<string, { id: string; clientId: string | null; fullName: string; email: string; isActive: boolean }>;
const CLIENTS = {
  acme: { id: "acme", companyName: "Acme Corp", hubAccountId: null },
  globex: { id: "globex", companyName: "Globex", hubAccountId: null },
} as Record<string, { id: string; companyName: string; hubAccountId: string | null }>;

const ANN = { id: "u-ann", role: "user", clientId: "acme" };
const IVY = { id: "u-it", role: "user", clientId: "acme", isCompanyItContact: true };
const GUS_IT = { id: "u-gus", role: "user", clientId: "globex", isCompanyItContact: true };
const DE_ADMIN = { id: "u-admin", role: "admin", clientId: null };

const signedInAs: express.RequestHandler = (req, _res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return _res.status(401).json({ error: "Sign in" });
  next();
};
const adminOnly: express.RequestHandler = (req, res, next) => {
  if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};

const POLICY: LicensePolicy = {
  platforms: [{ platform: "microsoft_commercial", tenantLabel: "" }],
  tiers: ["Executive"],
  baseRules: [
    { platform: "microsoft_commercial", accountType: "standard", tier: null, licenseKey: "ms_m365_e3", assignment: "automatic", group: "LIC-E3" },
    { platform: "microsoft_commercial", accountType: "standard", tier: "Executive", licenseKey: "ms_m365_e5", assignment: "request", group: "LIC-E5" },
    { platform: "microsoft_commercial", accountType: "frontline", tier: null, licenseKey: "ms_m365_f3", assignment: "automatic", group: "LIC-F3" },
    { platform: "microsoft_commercial", accountType: "service", tier: null, licenseKey: "ms_o365_e1", assignment: "request", group: "LIC-E1-SVC" },
  ],
  addons: [{ platform: "microsoft_commercial", licenseKey: "ms_visio_p2", eligibleAccountTypes: ["standard"], group: "LIC-VISIO", approval: "manager" }],
  notes: "",
};

let server: Server;
let baseUrl = "";

beforeAll(async () => {
  const { registerServiceRequestRoutes } = await import("./serviceRequestRoutes");
  const { registerLicensingRoutes } = await import("./licensingRoutes");
  const app = express();
  app.use(express.json());
  const deps = {
    guards: [signedInAs],
    adminGuards: [signedInAs, adminOnly],
    getClient: (id: string) => CLIENTS[id],
    findUser: (id: string) => USERS[id],
    listClientUsers: (clientId: string) => Object.values(USERS).filter((u) => u.clientId === clientId),
    createDeskTicket: async () => "desk-1",
  };
  registerServiceRequestRoutes(app, deps);
  registerLicensingRoutes(app, { ...deps, canManagePeople: (u: any) => u?.role === "admin" || Boolean(u?.isCompanyItContact) });
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

beforeEach(async () => {
  const { _resetLicensingMemory } = await import("./licensingStore");
  _resetLicensingMemory();
  const res = await call("PUT", "/api/portal/admin/licensing/policy?clientId=acme", DE_ADMIN, { policy: POLICY });
  expect(res.status).toBe(200);
});

describe("company policy", () => {
  it("is DE admin only to change", async () => {
    expect((await call("PUT", "/api/portal/admin/licensing/policy?clientId=acme", IVY, { policy: POLICY })).status).toBe(403);
    expect((await call("GET", "/api/portal/admin/licensing/policy?clientId=acme", ANN)).status).toBe(403);
  });

  it("refuses an inconsistent policy with the problems listed", async () => {
    const res = await call("PUT", "/api/portal/admin/licensing/policy?clientId=acme", DE_ADMIN, {
      policy: { ...POLICY, baseRules: [{ ...POLICY.baseRules[0], licenseKey: "gcc_m365_g5" }] },
    });
    expect(res.status).toBe(400);
    expect((await res.json()).problems[0]).toMatch(/not a base licence/);
  });

  it("shows a client their own company's policy and licences, never another's", async () => {
    const mine = await (await call("GET", "/api/portal/licensing", ANN)).json();
    expect(mine.company.id).toBe("acme");
    expect(mine.me.accountType).toBe("standard");
    expect(mine.me.licenses[0]).toMatchObject({ licenseKey: "ms_m365_e3", assignment: "automatic" });
    expect(mine.canManagePeople).toBe(false);
    const theirs = await (await call("GET", "/api/portal/licensing", GUS_IT)).json();
    expect(theirs.policy.baseRules).toEqual([]);
  });
});

describe("account types", () => {
  it("lets the company IT contact classify people in their own company only", async () => {
    expect((await call("PUT", "/api/portal/licensing/people/u-fay", ANN, { accountType: "frontline" })).status).toBe(403);
    expect((await call("PUT", "/api/portal/licensing/people/u-fay", GUS_IT, { accountType: "frontline" })).status).toBe(404);
    expect((await call("PUT", "/api/portal/licensing/people/u-fay", IVY, { accountType: "robot" })).status).toBe(400);
    expect((await call("PUT", "/api/portal/licensing/people/u-fay", IVY, { accountType: "standard", tier: "Board" })).status).toBe(400);
    const res = await call("PUT", "/api/portal/licensing/people/u-fay", IVY, { accountType: "frontline" });
    expect(res.status).toBe(200);
    const people = await (await call("GET", "/api/portal/licensing/people", IVY)).json();
    const fay = people.people.find((p: any) => p.userId === "u-fay");
    expect(fay).toMatchObject({ accountType: "frontline", assigned: true, base: [{ license: "Microsoft 365 F3", assignment: "automatic" }] });
    expect(people.people.some((p: any) => p.userId === "u-gus")).toBe(false);
    expect((await call("GET", "/api/portal/licensing/people", ANN)).status).toBe(403);
  });

  it("answers entitlements for a person in the company only", async () => {
    expect((await call("GET", "/api/portal/licensing/entitlements?accountKind=person&userId=u-gus", ANN)).status).toBe(404);
    const svc = await (await call("GET", "/api/portal/licensing/entitlements?accountKind=service", ANN)).json();
    // Add-ons are listed too, marked not eligible, so the form can say why they can't be picked.
    expect(svc.licenses).toEqual([
      expect.objectContaining({ licenseKey: "ms_o365_e1", kind: "base", assignment: "request" }),
      expect.objectContaining({ licenseKey: "ms_visio_p2", kind: "addon", assignment: "not_eligible" }),
    ]);
  });
});

const licence = (over: Record<string, unknown> = {}) => ({
  accountKind: "person",
  requestedForUserId: "u-ann",
  platform: "microsoft_commercial",
  licenseKey: "ms_visio_p2",
  operation: "add",
  businessJustification: "Floor plans for the new office",
  ...over,
});
const submit = (user: object, fields: object) => call("POST", "/api/portal/service-requests", user, { type: "license_request", mode: "submit", fields });

describe("licence requests", () => {
  it("submits an eligible add-on with a LIC number, and takes the group and approval from the policy", async () => {
    const res = await submit(ANN, licence({ group: "Domain Admins", approval: "none" }));
    expect(res.status).toBe(201);
    const { request } = await res.json();
    expect(request.number).toMatch(/^LIC-\d{6}$/);
    expect(request.payload).toMatchObject({ licenseName: "Visio Plan 2", licenseKind: "addon", group: "LIC-VISIO", approval: "manager", accountType: "standard" });
  });

  it("refuses a licence the account already gets automatically", async () => {
    const res = await submit(ANN, licence({ licenseKey: "ms_m365_e3" }));
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.licenseKey).toMatch(/automatically/);
  });

  it("refuses an add-on the account type isn't eligible for, using the person's stored type", async () => {
    await call("PUT", "/api/portal/licensing/people/u-fay", IVY, { accountType: "frontline" });
    const res = await submit(ANN, licence({ requestedForUserId: "u-fay" }));
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.licenseKey).toMatch(/eligible/);
  });

  it("refuses a licence the policy doesn't offer, and a person in another company", async () => {
    expect((await submit(ANN, licence({ licenseKey: "ms_copilot" }))).status).toBe(400);
    const res = await submit(ANN, licence({ requestedForUserId: "u-gus" }));
    expect((await res.json()).fieldErrors.requestedForUserId).toBeTruthy();
  });

  it("requires an account name for a service account and resolves its licence by account type", async () => {
    let res = await submit(ANN, licence({ accountKind: "service", licenseKey: "ms_o365_e1" }));
    expect((await res.json()).fieldErrors.accountName).toBeTruthy();
    res = await submit(ANN, licence({ accountKind: "service", accountName: "scanner@acme.test", licenseKey: "ms_o365_e1" }));
    expect(res.status).toBe(201);
    expect((await res.json()).request.payload).toMatchObject({ accountType: "service", group: "LIC-E1-SVC", accountName: "scanner@acme.test" });
  });

  it("lets staff approve and then mark the licence assigned", async () => {
    const { request } = await (await submit(ANN, licence())).json();
    let res = await call("POST", `/api/portal/admin/service-requests/${request.id}/status`, DE_ADMIN, { status: "approved" });
    expect(res.status).toBe(200);
    res = await call("POST", `/api/portal/admin/service-requests/${request.id}/status`, DE_ADMIN, { status: "fulfilled" });
    expect((await res.json()).request.status).toBe("fulfilled");
    res = await call("POST", `/api/portal/admin/service-requests/${request.id}/status`, DE_ADMIN, { status: "device_assigned" });
    expect(res.status).toBe(409);
  });
});
