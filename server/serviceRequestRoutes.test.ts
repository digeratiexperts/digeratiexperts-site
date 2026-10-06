import express from "express";
import { createHmac, createHash } from "crypto";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Portal service requests over HTTP, with the request store, manual records
 * and DE-Sync outbox in memory. Covers the tenant rules (another company's
 * request is a 404, Requested for must be in your company), date / LID /
 * asset validation, the basket, requester cancel limits, staff transitions,
 * and the Hub copy: signed delivery to /api/ingest/service-requests, and a
 * Hub that is down leaves the request submitted with hub_sync_status retrying.
 */

vi.mock("./integrations/ensureDeSyncSchema", () => ({ ensureDeSyncSchema: async () => undefined }));
vi.mock("./integrations/deSyncOutboxRecovery", () => ({ recoverStaleOutboxLocks: async () => 0 }));

const USERS = {
  "u-ann": { id: "u-ann", clientId: "acme", fullName: "Ann Acme", email: "ann@acme.test", isActive: true },
  "u-bob": { id: "u-bob", clientId: "acme", fullName: "Bob Acme", email: "bob@acme.test", isActive: true },
  "u-cy": { id: "u-cy", clientId: "acme", fullName: "Cy Acme", email: "cy@acme.test", isActive: true },
  "u-gus": { id: "u-gus", clientId: "globex", fullName: "Gus Globex", email: "gus@globex.test", isActive: true },
} as Record<string, { id: string; clientId: string | null; fullName: string; email: string; isActive: boolean }>;

const CLIENTS = {
  acme: { id: "acme", companyName: "Acme Corp", hubAccountId: "41" },
  globex: { id: "globex", companyName: "Globex", hubAccountId: null },
} as Record<string, { id: string; companyName: string; hubAccountId: string | null }>;

const ANN = { id: "u-ann", role: "user", clientId: "acme" };
const BOB = { id: "u-bob", role: "user", clientId: "acme" };
const CY = { id: "u-cy", role: "user", clientId: "acme" };
const GUS = { id: "u-gus", role: "user", clientId: "globex" };
const DE_ADMIN = { id: "u-admin", role: "admin", clientId: null };

const signedInAs: express.RequestHandler = (req, _res, next) => {
  const raw = req.header("x-test-user");
  (req as express.Request & { user?: unknown }).user = raw ? JSON.parse(raw) : undefined;
  next();
};
const adminOnly: express.RequestHandler = (req, res, next) => {
  if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Admin only" });
  next();
};

// A fixed "today" so date rules are deterministic.
const NOW = new Date("2026-10-06T15:00:00");

let server: Server;
let baseUrl = "";
let siteId = "";
let assetId = "";
const deskCalls: Array<{ subject: string }> = [];

beforeAll(async () => {
  const { registerServiceRequestRoutes, registerHubServiceRequestStatusRoute } = await import("./serviceRequestRoutes");
  const app = express();
  app.use(express.json());
  const deps = {
    guards: [signedInAs],
    adminGuards: [signedInAs, adminOnly],
    getClient: (id: string) => CLIENTS[id],
    findUser: (id: string) => USERS[id],
    listClientUsers: (clientId: string) => Object.values(USERS).filter((u) => u.clientId === clientId),
    createDeskTicket: async (input: { subject: string }) => {
      deskCalls.push(input);
      return "desk-1";
    },
    now: () => NOW,
  };
  registerServiceRequestRoutes(app, deps);
  registerHubServiceRequestStatusRoute(app, deps, (_req, _res, next) => next());
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no test port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  const { createManualRecord } = await import("./portalManualRecords");
  siteId = (
    await createManualRecord({
      clientId: "acme",
      kind: "site",
      data: { code: "AZ76", street: "1 Main St", city: "Glendale", state: "Arizona", country: "United States of America", zip: "85308-9650" },
    })
  ).id;
  await createManualRecord({
    clientId: "globex",
    kind: "site",
    data: { code: "GX1", street: "2 Side St", city: "Springfield", state: "Oregon", country: "United States of America", zip: "97477" },
  });
  assetId = (
    await createManualRecord({ clientId: "acme", kind: "computer_asset", data: { assetTag: "ACME-0042", serialNumber: "SN42", assignedUserId: "u-ann" } })
  ).id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  deskCalls.length = 0;
});

const call = (method: string, path: string, user: object | null, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const loanerFields = (over: Record<string, unknown> = {}) => ({
  requestedForUserId: "u-ann",
  contactPhone: "(602) 555-0100",
  deviceKind: "laptop",
  neededFrom: "2026-10-07",
  loanUntil: "2026-10-21",
  siteId,
  addressNotClientLocation: false,
  reason: "Laptop in for repair",
  ...over,
});

const returnFields = (over: Record<string, unknown> = {}) => ({
  requestedForUserId: "u-ann",
  contactPhone: "602-555-0100",
  returnReason: "user_leaving",
  assetId,
  assetNotListed: false,
  accessories: "Charger, dock",
  siteId,
  addressNotClientLocation: false,
  ...over,
});

const submit = (user: object, type: string, fields: object, mode = "submit") =>
  call("POST", "/api/portal/service-requests", user, { type, mode, fields });

describe("submitting requests", () => {
  it("submits a loaner request with an LNR number, a site snapshot, a Desk ticket and a queued Hub copy", async () => {
    const res = await submit(ANN, "loaner_computer", loanerFields());
    expect(res.status).toBe(201);
    const { request } = await res.json();
    expect(request.number).toMatch(/^LNR-\d{6}$/);
    expect(request.status).toBe("submitted");
    expect(request.site.code).toBe("AZ76");
    expect(request.accountName).toBe("Acme Corp");
    expect(request.deskTicketId).toBe("desk-1");
    expect(request.hubSyncStatus).toBe("queued");
    expect(deskCalls[0].subject).toContain(request.number);
  });

  it("submits a return request with an RTN number and the assigned asset", async () => {
    const res = await submit(ANN, "return_computer", returnFields());
    expect(res.status).toBe(201);
    const { request } = await res.json();
    expect(request.number).toMatch(/^RTN-\d{6}$/);
    expect(request.payload.asset.assetTag).toBe("ACME-0042");
  });

  it("refuses a Needed from date in the past and a Loan until before it", async () => {
    let res = await submit(ANN, "loaner_computer", loanerFields({ neededFrom: "2026-10-05" }));
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.neededFrom).toMatch(/today or later/);
    res = await submit(ANN, "loaner_computer", loanerFields({ neededFrom: "2026-10-10", loanUntil: "2026-10-09" }));
    expect((await res.json()).fieldErrors.loanUntil).toMatch(/on or after/);
    res = await submit(ANN, "loaner_computer", loanerFields({ neededFrom: "2026-13-40" }));
    expect((await res.json()).fieldErrors.neededFrom).toMatch(/YYYY-MM-DD/);
  });

  it("requires an LID unless the address is not a company location, then requires the address", async () => {
    let res = await submit(ANN, "loaner_computer", loanerFields({ siteId: null }));
    expect((await res.json()).fieldErrors.siteId).toBeTruthy();
    res = await submit(ANN, "loaner_computer", loanerFields({ siteId: null, addressNotClientLocation: true, customAddress: { street: "9 Elm", city: "Mesa", state: "Arizona", country: "United States of America", zip: "8520" } }));
    expect((await res.json()).fieldErrors["customAddress.zip"]).toMatch(/ZIP/);
    res = await submit(ANN, "loaner_computer", loanerFields({ siteId: null, addressNotClientLocation: true, customAddress: { street: "9 Elm", city: "Mesa", state: "Arizona", country: "United States of America", zip: "85201" } }));
    expect(res.status).toBe(201);
    expect((await res.json()).request.customAddress.city).toBe("Mesa");
  });

  it("refuses another company's LID", async () => {
    const globexSites = await (await call("GET", "/api/portal/service-requests/context", GUS)).json();
    const res = await submit(ANN, "loaner_computer", loanerFields({ siteId: globexSites.sites[0].id }));
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.siteId).toBeTruthy();
  });

  it("refuses Requested for a person in another company", async () => {
    const res = await submit(ANN, "loaner_computer", loanerFields({ requestedForUserId: "u-gus" }));
    expect(res.status).toBe(400);
    expect((await res.json()).fieldErrors.requestedForUserId).toBeTruthy();
  });

  it("refuses a computer not assigned to the Requested for person, and accepts a manual one", async () => {
    let res = await submit(BOB, "return_computer", returnFields({ requestedForUserId: "u-bob" }));
    expect((await res.json()).fieldErrors.assetId).toBeTruthy();
    res = await submit(BOB, "return_computer", returnFields({ requestedForUserId: "u-bob", assetId: null, assetNotListed: true, manualAsset: {} }));
    expect((await res.json()).fieldErrors["manualAsset.assetTag"]).toBeTruthy();
    res = await submit(BOB, "return_computer", returnFields({ requestedForUserId: "u-bob", assetId: null, assetNotListed: true, manualAsset: { serialNumber: "XYZ" } }));
    expect(res.status).toBe(201);
  });

  it("ignores a clientId in the body: the company comes from the session", async () => {
    const res = await call("POST", "/api/portal/service-requests", ANN, { type: "loaner_computer", clientId: "globex", fields: loanerFields() });
    expect((await res.json()).request.accountId).toBe("acme");
  });
});

describe("visibility", () => {
  it("shows a request to the requester and the requested-for person only, and 404s it across companies", async () => {
    const { request } = await (await submit(ANN, "loaner_computer", loanerFields({ requestedForUserId: "u-bob" }))).json();
    expect((await call("GET", `/api/portal/service-requests/${request.id}`, ANN)).status).toBe(200);
    expect((await call("GET", `/api/portal/service-requests/${request.id}`, BOB)).status).toBe(200);
    expect((await call("GET", `/api/portal/service-requests/${request.id}`, CY)).status).toBe(404);
    expect((await call("GET", `/api/portal/service-requests/${request.id}`, GUS)).status).toBe(404);
    const gusList = await (await call("GET", "/api/portal/service-requests", GUS)).json();
    expect(gusList.requests.find((r: any) => r.id === request.id)).toBeUndefined();
    const bobList = await (await call("GET", "/api/portal/service-requests", BOB)).json();
    expect(bobList.requests.find((r: any) => r.id === request.id)).toBeTruthy();
  });

  it("lists only same-company people for Requested for", async () => {
    const { people } = await (await call("GET", "/api/portal/service-requests/people", ANN)).json();
    expect(people.map((p: any) => p.userId).sort()).toEqual(["u-ann", "u-bob", "u-cy"]);
  });

  it("refuses another company's person when listing assets", async () => {
    expect((await call("GET", "/api/portal/service-requests/assets?userId=u-gus", ANN)).status).toBe(404);
  });
});

describe("basket", () => {
  it("adds to the basket without submitting or syncing, then submits the basket together", async () => {
    const a = await (await submit(CY, "loaner_computer", loanerFields({ requestedForUserId: "u-cy" }), "basket")).json();
    const b = await (await submit(CY, "return_computer", returnFields({ requestedForUserId: "u-cy", assetId: null, assetNotListed: true, manualAsset: { assetTag: "OLD-1" } }), "basket")).json();
    expect(a.request.status).toBe("in_basket");
    expect(a.request.hubSyncStatus).toBe("not_sent");
    const basket = await (await call("GET", "/api/portal/service-requests/basket", CY)).json();
    expect(basket.requests).toHaveLength(2);
    const res = await call("POST", "/api/portal/service-requests/basket/submit", CY, {});
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.requests.map((r: any) => r.status)).toEqual(["submitted", "submitted"]);
    expect(out.requests.every((r: any) => r.hubSyncStatus === "queued")).toBe(true);
    expect((await (await call("GET", "/api/portal/service-requests/basket", CY)).json()).requests).toHaveLength(0);
    void b;
  });

  it("keeps basket items private to the person who added them", async () => {
    const { request } = await (await submit(CY, "loaner_computer", loanerFields({ requestedForUserId: "u-ann" }), "basket")).json();
    expect((await call("GET", `/api/portal/service-requests/${request.id}`, ANN)).status).toBe(404);
    expect((await call("POST", `/api/portal/service-requests/${request.id}/cancel`, ANN, {})).status).toBe(404);
    expect((await call("POST", `/api/portal/service-requests/${request.id}/cancel`, CY, {})).status).toBe(200);
  });
});

describe("status authority", () => {
  it("lets the requester cancel before a device is assigned, but not after", async () => {
    const { request } = await (await submit(ANN, "loaner_computer", loanerFields())).json();
    let res = await call("POST", `/api/portal/admin/service-requests/${request.id}/status`, DE_ADMIN, { status: "device_assigned" });
    expect(res.status).toBe(200);
    res = await call("POST", `/api/portal/service-requests/${request.id}/cancel`, ANN, {});
    expect(res.status).toBe(409);

    const second = (await (await submit(ANN, "loaner_computer", loanerFields())).json()).request;
    res = await call("POST", `/api/portal/service-requests/${second.id}/cancel`, ANN, {});
    expect(res.status).toBe(200);
    expect((await res.json()).request.status).toBe("cancelled");
  });

  it("refuses staff routes to client users and refuses jumps outside the lifecycle", async () => {
    const { request } = await (await submit(ANN, "return_computer", returnFields())).json();
    expect((await call("POST", `/api/portal/admin/service-requests/${request.id}/status`, ANN, { status: "received" })).status).toBe(403);
    const jump = await call("POST", `/api/portal/admin/service-requests/${request.id}/status`, DE_ADMIN, { status: "restocked" });
    expect(jump.status).toBe(409);
    const ok = await call("POST", `/api/portal/admin/service-requests/${request.id}/status`, DE_ADMIN, { status: "pickup_scheduled", note: "Courier Thursday" });
    const body = await ok.json();
    expect(body.request.status).toBe("pickup_scheduled");
    expect(body.request.statusHistory.at(-1)).toMatchObject({ status: "pickup_scheduled", by: "staff", note: "Courier Thursday" });
    expect(body.request.revision).toBe(request.revision + 1);
  });

  it("treats a repeated Hub status write-back as a no-op and rejects a stale revision", async () => {
    const { request } = await (await submit(ANN, "loaner_computer", loanerFields())).json();
    const path = `/api/integrations/v1/hub/service-requests/${request.id}/status`;
    const first = await call("POST", path, null, { status: "under_review" });
    expect(first.status).toBe(200);
    const again = await call("POST", path, null, { status: "under_review" });
    expect((await again.json()).unchanged).toBe(true);
    const stale = await call("POST", path, null, { status: "device_assigned", revision: request.revision });
    expect(stale.status).toBe(409);
  });
});

describe("attachments", () => {
  it("accepts an allowed file from the requester and refuses other types and other people", async () => {
    const { request } = await (await submit(ANN, "loaner_computer", loanerFields())).json();
    const up = (user: object, name: string) =>
      fetch(`${baseUrl}/api/portal/service-requests/${request.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "x-filename": name, "x-test-user": JSON.stringify(user) },
        body: Buffer.from("hello"),
      });
    expect((await up(ANN, "repair-ticket.pdf")).status).toBe(201);
    expect((await up(ANN, "payload.exe")).status).toBe(400);
    expect((await up(BOB, "x.pdf")).status).toBe(404);
    const detail = await (await call("GET", `/api/portal/service-requests/${request.id}`, ANN)).json();
    expect(detail.request.attachments[0].fileName).toBe("repair-ticket.pdf");
  });
});

describe("Hub delivery", () => {
  it("signs and delivers to /api/ingest/service-requests, then marks the request synced", async () => {
    const received: Array<{ path: string; headers: Record<string, string>; body: string }> = [];
    const hub = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        received.push({ path: req.url || "", headers: req.headers as Record<string, string>, body });
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      });
    });
    await new Promise<void>((resolve) => hub.listen(0, "127.0.0.1", resolve));
    const addr = hub.address() as { port: number };
    process.env.TECHSALES_HUB_URL = `http://127.0.0.1:${addr.port}`;
    process.env.PORTAL_TO_HUB_SECRET = "portal-to-hub-test-secret";
    try {
      const { request } = await (await submit(ANN, "loaner_computer", loanerFields())).json();
      const { processDeSyncOutbox } = await import("./integrations/deSyncWorker");
      await processDeSyncOutbox(100);
      const mine = received.find((r) => JSON.parse(r.body).entityId === request.id);
      expect(mine?.path).toBe("/api/ingest/service-requests");
      const envelope = JSON.parse(mine!.body);
      expect(envelope.eventType).toBe("service_request.upserted");
      expect(envelope.source).toBe("portal");
      expect(envelope.canonicalAccountId).toBe("41");
      expect(envelope.payload).toMatchObject({ contractVersion: 1, requestId: request.id, number: request.number, status: "submitted", revision: request.revision });
      expect(mine!.headers["x-de-event-id"]).toBe(envelope.eventId);
      const bodyHash = createHash("sha256").update(mine!.body).digest("hex");
      const expected = createHmac("sha256", "portal-to-hub-test-secret")
        .update(["POST", "/api/ingest/service-requests", mine!.headers["x-de-timestamp"], envelope.eventId, bodyHash].join("\n"))
        .digest("hex");
      expect(mine!.headers["x-de-signature"]).toBe(expected);
      const detail = await (await call("GET", `/api/portal/service-requests/${request.id}`, ANN)).json();
      expect(detail.request.hubSyncStatus).toBe("synced");
    } finally {
      await new Promise<void>((resolve) => hub.close(() => resolve()));
    }
  });

  it("keeps the request submitted and marks it retrying when the Hub is unreachable", async () => {
    process.env.TECHSALES_HUB_URL = "http://127.0.0.1:1";
    process.env.PORTAL_TO_HUB_SECRET = "portal-to-hub-test-secret";
    const res = await submit(ANN, "return_computer", returnFields());
    expect(res.status).toBe(201);
    const { request } = await res.json();
    const { processDeSyncOutbox } = await import("./integrations/deSyncWorker");
    const result = await processDeSyncOutbox(100);
    expect(result.retried).toBeGreaterThan(0);
    const detail = await (await call("GET", `/api/portal/service-requests/${request.id}`, ANN)).json();
    expect(detail.request.status).toBe("submitted");
    expect(detail.request.hubSyncStatus).toBe("retrying");
  });
});

describe("self-service announcements", () => {
  it("shows a company's own active announcements first, never another company's, then the DE slides", async () => {
    const { createManualRecord } = await import("./portalManualRecords");
    await createManualRecord({
      clientId: "acme",
      kind: "announcement",
      data: { title: "Acme office move", body: "We move on Friday.", ctaLabel: "Details", ctaHref: "/portal/kb?q=move" },
    });
    await createManualRecord({
      clientId: "acme",
      kind: "announcement",
      data: { title: "Phishy", body: "Click here.", ctaLabel: "Go", ctaHref: "https://evil.example" },
    });
    const acme = await (await call("GET", "/api/portal/self-service/announcements", ANN)).json();
    expect(acme.announcements[0]).toMatchObject({ title: "Acme office move", source: "company" });
    expect(acme.announcements.some((a: any) => a.title === "Phishy")).toBe(false);
    expect(acme.announcements.some((a: any) => a.source === "de")).toBe(true);
    const globex = await (await call("GET", "/api/portal/self-service/announcements", GUS)).json();
    expect(globex.announcements.some((a: any) => a.title === "Acme office move")).toBe(false);
  });
});
