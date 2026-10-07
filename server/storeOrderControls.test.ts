import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Store order controls over HTTP with memory stores and fake orders. Unpaid
 * orders cancel at once; paid ones become a cancellation request to DE.
 * Amendments are requests (optionally holding fulfilment). Holds pause
 * fulfilment until a date (up to 90 days); orders being provisioned can't be
 * held. The orderer, their leader, the IT contact and DE may act; a colleague
 * may only look; another company gets a 404.
 */

type U = { id: string; clientId: string | null; fullName: string; email: string; isActive: boolean; isCompanyItContact?: boolean };
const USERS: Record<string, U> = {
  "u-ann": { id: "u-ann", clientId: "acme", fullName: "Ann Acme", email: "ann@acme.test", isActive: true },
  "u-bob": { id: "u-bob", clientId: "acme", fullName: "Bob Acme", email: "bob@acme.test", isActive: true },
  "u-ivy": { id: "u-ivy", clientId: "acme", fullName: "Ivy IT", email: "ivy@acme.test", isActive: true, isCompanyItContact: true },
  "u-gus": { id: "u-gus", clientId: "globex", fullName: "Gus Globex", email: "gus@globex.test", isActive: true },
};
const CLIENTS: Record<string, { id: string; companyName: string }> = { acme: { id: "acme", companyName: "Acme Corp" }, globex: { id: "globex", companyName: "Globex" } };
const as = (id: string) => ({ id, role: "user", clientId: USERS[id].clientId });
const ANN = as("u-ann");
const BOB = as("u-bob");
const IVY = as("u-ivy");
const GUS = as("u-gus");
const DE_ADMIN = { id: "u-admin", role: "admin", clientId: null };

type O = { id: string; orderNumber: string; status: string; userId: string | null; clientId: string | null };
const orders = new Map<string, O>();
const notified: string[] = [];

const signedInAs: express.RequestHandler = (req, res, next) => {
  const raw = req.header("x-test-user");
  (req as any).user = raw ? JSON.parse(raw) : undefined;
  if (!(req as any).user) return res.status(401).json({ error: "Sign in" });
  next();
};
const adminOnly: express.RequestHandler = (req, res, next) => ((req as any).user?.role === "admin" ? next() : res.status(403).json({ error: "Admin only" }));

let server: Server;
let baseUrl = "";
const NOW = new Date("2026-10-06T15:00:00Z");

beforeAll(async () => {
  const { registerStoreOrderControlRoutes } = await import("./storeOrderControls");
  const app = express();
  app.use(express.json());
  registerStoreOrderControlRoutes(app, {
    guards: [signedInAs],
    adminGuards: [signedInAs, adminOnly],
    getClient: (id) => CLIENTS[id],
    findUser: (id) => USERS[id],
    listClientUsers: (clientId) => Object.values(USERS).filter((u) => u.clientId === clientId),
    getOrder: async (id) => orders.get(id),
    cancelUnpaidOrder: async (id) => {
      const o = orders.get(id);
      if (!o || !["pending", "quote_requested", "quote_sent", "awaiting_payment"].includes(o.status)) return false;
      o.status = "cancelled";
      return true;
    },
    notifyDe: async (r) => notified.push(`${r.kind}:${r.orderNumber}`),
    now: () => NOW,
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

beforeEach(async () => {
  const { _resetStoreOrderControlsMemory } = await import("./storeOrderControls");
  _resetStoreOrderControlsMemory();
  orders.clear();
  notified.length = 0;
  for (const [id, status] of [["o-unpaid", "awaiting_payment"], ["o-paid", "paid"], ["o-prov", "provisioning"], ["o-done", "completed"]]) {
    orders.set(id, { id, orderNumber: `ORD-${id}`, status, userId: "u-ann", clientId: "acme" });
  }
});

const call = (method: string, path: string, user: object | null, body?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { "x-test-user": JSON.stringify(user) } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe("cancel", () => {
  it("cancels an unpaid order at once", async () => {
    const res = await (await call("POST", "/api/portal/orders/o-unpaid/cancel", ANN, { reason: "Ordered twice" })).json();
    expect(res.cancelled).toBe(true);
    expect(orders.get("o-unpaid")!.status).toBe("cancelled");
    expect(notified).toEqual([]);
  });

  it("turns a paid order's cancellation into a request to DE, once", async () => {
    const res = await call("POST", "/api/portal/orders/o-paid/cancel", ANN, { reason: "No longer needed" });
    expect(res.status).toBe(201);
    expect((await res.json()).request).toMatchObject({ kind: "cancel", status: "open", requestedBy: { role: "orderer" } });
    expect(orders.get("o-paid")!.status).toBe("paid");
    expect(notified).toEqual(["cancel:ORD-o-paid"]);
    expect((await call("POST", "/api/portal/orders/o-paid/cancel", ANN, { reason: "Again" })).status).toBe(409);
  });

  it("needs a reason and refuses closed orders", async () => {
    expect((await call("POST", "/api/portal/orders/o-paid/cancel", ANN, { reason: "" })).status).toBe(400);
    expect((await call("POST", "/api/portal/orders/o-done/cancel", ANN, { reason: "x" })).status).toBe(409);
  });
});

describe("who may act", () => {
  it("lets the IT contact act, a colleague only look, and hides the order from other companies", async () => {
    expect((await call("GET", "/api/portal/orders/o-paid/controls", GUS)).status).toBe(404);
    const colleague = await (await call("GET", "/api/portal/orders/o-paid/controls", BOB)).json();
    expect(colleague.canAct).toBe(false);
    expect(colleague.can.hold).toBe(false);
    expect((await call("POST", "/api/portal/orders/o-paid/hold", BOB, { until: "2026-10-10", reason: "x" })).status).toBe(403);
    expect((await call("POST", "/api/portal/orders/o-paid/hold", IVY, { until: "2026-10-10", reason: "Office move" })).status).toBe(200);
  });
});

describe("hold", () => {
  it("pauses fulfilment until the date, then lets it carry on", async () => {
    const { isStoreOrderHeld } = await import("./storeOrderControls");
    const res = await (await call("POST", "/api/portal/orders/o-paid/hold", ANN, { until: "2026-10-13", reason: "Office closed" })).json();
    expect(res.hold).toMatchObject({ until: "2026-10-13", reason: "Office closed", by: { role: "orderer" } });
    expect(res.can).toMatchObject({ hold: false, resume: true });
    expect(await isStoreOrderHeld("o-paid", new Date("2026-10-12T12:00:00Z"))).toBe(true);
    expect(await isStoreOrderHeld("o-paid", new Date("2026-10-13T00:30:00Z"))).toBe(false);
    expect(await isStoreOrderHeld("o-unpaid")).toBe(false);
  });

  it("can be lifted early", async () => {
    await call("POST", "/api/portal/orders/o-paid/hold", ANN, { until: "2026-10-13", reason: "x" });
    const res = await (await call("POST", "/api/portal/orders/o-paid/resume", ANN, {})).json();
    expect(res.hold).toBeNull();
    expect((await call("POST", "/api/portal/orders/o-paid/resume", ANN, {})).status).toBe(409);
  });

  it("refuses orders being provisioned and holds over 90 days", async () => {
    expect((await call("POST", "/api/portal/orders/o-prov/hold", ANN, { until: "2026-10-10", reason: "x" })).status).toBe(409);
    expect((await call("POST", "/api/portal/orders/o-paid/hold", ANN, { until: "2027-02-01", reason: "x" })).status).toBe(400);
  });
});

describe("amend and DE review", () => {
  it("records a change request, optionally holding the order, and DE resolves it", async () => {
    const res = await call("POST", "/api/portal/orders/o-paid/change-request", ANN, { details: "Make it 3 laptops, not 2", holdUntil: "2026-10-16" });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.hold.until).toBe("2026-10-16");
    expect(notified).toEqual(["amend:ORD-o-paid"]);

    expect((await call("GET", "/api/portal/admin/order-requests", ANN)).status).toBe(403);
    const list = await (await call("GET", "/api/portal/admin/order-requests", DE_ADMIN)).json();
    expect(list.requests).toHaveLength(1);
    const id = list.requests[0].id;
    expect((await call("POST", `/api/portal/admin/order-requests/${id}`, DE_ADMIN, { decision: "declined" })).status).toBe(400);
    const done = await (await call("POST", `/api/portal/admin/order-requests/${id}`, DE_ADMIN, { decision: "done", note: "Updated; new invoice sent" })).json();
    expect(done.request).toMatchObject({ status: "done", resolutionNote: "Updated; new invoice sent" });
    expect((await call("POST", `/api/portal/admin/order-requests/${id}`, DE_ADMIN, { decision: "done" })).status).toBe(404);
    const controls = await (await call("GET", "/api/portal/orders/o-paid/controls", ANN)).json();
    expect(controls.changeRequests[0].status).toBe("done");
  });

  it("can ask for a change on an order being provisioned, without a hold", async () => {
    const res = await call("POST", "/api/portal/orders/o-prov/change-request", ANN, { details: "Ship to the new office", holdUntil: "2026-10-16" });
    expect(res.status).toBe(201);
    expect((await res.json()).hold).toBeNull();
  });
});
