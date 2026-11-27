import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const secret = "synthetic-portal-submission-test-signing-secret";
const customer = { id: "customer", email: "customer@example.invalid", role: "user", clientId: "client-one", clientRoles: ["buyer"] };
const staff = { id: "staff", email: "staff@example.invalid", role: "staff", clientId: null, clientRoles: [] };
let liveCustomer = { ...customer };
const record = vi.hoisted(() => vi.fn(async () => ({ lines: [] })));
const audit = vi.hoisted(() => vi.fn(async () => undefined));
const desk = vi.hoisted(() => ({
  getContactByEmail: vi.fn(async () => null),
  createTicket: vi.fn(async () => ({ id: "40001" })),
  addTicketComment: vi.fn(async () => ({})),
  uploadTicketAttachment: vi.fn(async () => ({})),
}));
vi.mock("./zoho/zohoDesk", () => ({ zohoDeskService: desk }));
vi.mock("./zoho/zohoClient", () => ({ zohoClient: { isConfigured: () => true } }));
vi.mock("./warehouseStockStore", () => ({ listWarehouseStock: vi.fn(), recordWarehouseMovement: record }));
vi.mock("./portalAccessStore", async (original) => ({ ...await original<object>(), writeAudit: audit }));
vi.mock("./db", () => ({
  db: null, dbReady: false, initPromise: Promise.resolve(false),
  getDatabaseStatus: () => ({ connected: false, type: "memory" }),
}));
vi.mock("./portalAuthStore", async (original) => ({
  ...await original<object>(),
  getUser: (email: string) => email === staff.email ? staff : email === customer.email ? liveCustomer : null,
  getClient: (id: string) => id === customer.clientId ? { id, companyName: "Synthetic Client" } : undefined,
}));
vi.mock("./portalOrg", async (original) => ({
  ...await original<object>(),
  findUserById: (id: string) => id === staff.id ? staff : id === customer.id ? liveCustomer : null,
}));

let server: Server;
let base: string;
const mutate = vi.fn();
const ticket = "/api/portal/tickets";
function token(user = customer, serial = "first") {
  return jwt.sign({ email: user.email, userId: user.id, jti: serial }, secret, { expiresIn: "1h" });
}
function cookie(jwtValue: string, session?: string) {
  return `portalAuth=${jwtValue}${session ? `; sessionId=${session}` : ""}`;
}
function request(path: string, headers: Record<string, string>, method = "GET") {
  return fetch(base + path, { method, headers });
}
async function issue(session: string, path = "/api/portal/me") {
  const response = await request(path, { cookie: session, "X-DE-CSRF-Request": "1" });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toMatch(/no-store/);
  const proof = response.headers.get("X-DE-CSRF-Token");
  const context = response.headers.get("X-DE-CSRF-Context");
  expect(proof).toMatch(/^[0-9a-f]{64}$/);
  expect(context).toMatch(/^[0-9a-f]{64}$/);
  expect(proof).not.toEqual(context);
  return { proof: proof!, context: context! };
}

beforeAll(async () => {
  vi.stubEnv("JWT_SECRET", secret);
  vi.stubEnv("PORTAL_DESK_TICKET_SYNC_MS", "0");
  vi.stubEnv("TICKETS_SOURCE", "desk");
  const { resetRevocationsForTests } = await import("./portalSessionRevocation");
  resetRevocationsForTests({ loadState: "ready" });
  const { authMiddleware, registerRoutes } = await import("./routes");
  const { registerWarehouseGates } = await import("./warehouseRoutes");
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  registerWarehouseGates(app);
  await registerRoutes(app);
  // Instrument an arbitrary future handler in addition to the real ticket routes.
  app.all(["/api/zoho/example", "/api/future-feature"],
    authMiddleware, (_req, res) => { mutate(); res.status(204).end(); });
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  base = `http://127.0.0.1:${address.port}`;
}, 60_000);
beforeEach(() => {
  vi.clearAllMocks();
  liveCustomer = { ...customer };
});
afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  vi.unstubAllEnvs();
});

describe("Portal session-bound browser submissions", () => {
  it("issues only after authentication and explicit opt-in; ordinary reads and bearer clients retain their behavior", async () => {
    expect((await request("/api/portal/me", { "X-DE-CSRF-Request": "1" })).status).toBe(401);
    const credential = token();
    expect((await request("/api/portal/me", { cookie: cookie(credential) })).headers.has("X-DE-CSRF-Token")).toBe(false);
    expect((await request("/api/portal/me", { Authorization: `Bearer ${credential}`, "X-DE-CSRF-Request": "1" })).headers.has("X-DE-CSRF-Token")).toBe(false);
    expect((await request("/api/future-feature", { Authorization: `Bearer ${credential}` }, "POST")).status).toBe(204);
  });
  it("rejects absent or stale proof before side effects across current and future cookie-authenticated writes", async () => {
    const session = cookie(token(), "first-session");
    for (const [method, path] of [["POST", ticket], ["POST", ticket + "/1/comments"], ["POST", ticket + "/1/attachments"], ["PATCH", "/api/zoho/example"], ["PUT", "/api/future-feature"], ["DELETE", "/api/future-feature"]]) {
      const response = await request(path, { cookie: session, "X-CSRF-Token": "1" }, method);
      expect(response.status).toBe(403);
      expect(response.headers.get("X-DE-CSRF-Status")).toBe("mismatch");
      expect((await response.json()).code).toBe("CSRF_TOKEN_MISMATCH");
    }
    expect((await request(ticket, { cookie: session, Authorization: `Bearer ${token()}` }, "POST")).status).toBe(403);
    expect(mutate).not.toHaveBeenCalled();
  });
  it("keeps multiple tabs usable, supports legacy sessions, and binds proof to the current credential and tenant", async () => {
    const credential = token();
    const current = cookie(credential);
    const first = await issue(current);
    expect(await issue(current)).toEqual(first);
    expect((await request("/api/future-feature", { cookie: current, "X-CSRF-Token": first.proof }, "POST")).status).toBe(204);
    // With a current proof, the actual create/reply/upload handlers reach their
    // normal input/ownership checks. No ticket, comment or file is created.
    const headers = { cookie: current, "X-CSRF-Token": first.proof, "Content-Type": "application/json" };
    const create = await fetch(base + ticket, { method: "POST", headers, body: "{}" });
    expect(create.status).toBe(400);
    expect((await create.json()).error).toBe("Subject and description are required");
    const reply = await fetch(base + ticket + "/missing/comments", { method: "POST", headers, body: "{}" });
    expect(reply.status).toBe(400);
    expect((await reply.json()).error).toBe("Content is required");
    expect((await request(ticket + "/missing/attachments", headers, "POST")).status).toBe(404);
    for (const changed of [cookie(credential, "second-session"), cookie(token(customer, "renewed"))]) {
      const next = await issue(changed);
      expect(next.context).toBe(first.context);
      expect(next.proof).not.toBe(first.proof);
      expect((await request(ticket, { cookie: changed, "X-CSRF-Token": first.proof }, "POST")).status).toBe(403);
    }
    liveCustomer = { ...customer, clientId: "new-company" };
    expect((await issue(current)).context).not.toBe(first.context);
    expect((await request(ticket, { cookie: current, "X-CSRF-Token": first.proof }, "POST")).status).toBe(403);
    liveCustomer = { ...customer, clientRoles: ["approver"] };
    expect((await issue(current)).context).not.toBe(first.context);
    expect((await request(ticket, { cookie: current, "X-CSRF-Token": first.proof }, "POST")).status).toBe(403);
    expect(mutate).toHaveBeenCalledTimes(1);
  });
  it("rejects foreign origins at issuance and submission even if the proof matches", async () => {
    const session = cookie(token(), "session");
    const { proof } = await issue(session);
    for (const metadata of [{ Origin: "https://elsewhere.invalid" }, { Origin: "null" }, { "Sec-Fetch-Site": "same-site" }, { Referer: "https://elsewhere.invalid/" }]) {
      const denied = await request("/api/portal/me", { cookie: session, "X-DE-CSRF-Request": "1", ...metadata });
      expect(denied.status).toBe(403);
      expect(denied.headers.has("X-DE-CSRF-Token")).toBe(false);
      expect((await request(ticket, { cookie: session, "X-CSRF-Token": proof, ...metadata }, "POST")).status).toBe(403);
    }
    expect(mutate).not.toHaveBeenCalled();
  });
  it("creates one ticket, adds a reply, and uploads a text attachment with the same proof", async () => {
    const session = cookie(token(), "one-session");
    const { proof } = await issue(session);
    const headers = { cookie: session, "X-CSRF-Token": proof, "Content-Type": "application/json" };
    const body = JSON.stringify({ subject: "Synthetic ticket", description: "Local regression fixture" });
    const stale = await fetch(base + ticket, { method: "POST", headers: { ...headers, "X-CSRF-Token": "1" }, body });
    expect(stale.status).toBe(403);
    expect(desk.createTicket).not.toHaveBeenCalled();
    const created = await fetch(base + ticket, { method: "POST", headers, body });
    expect(created.status).toBe(201);
    const { ticket: row } = await created.json();
    expect(row.clientId).toBe(customer.clientId);
    const path = base + ticket + "/" + row.id;
    const replied = await fetch(path + "/comments", { method: "POST", headers, body: JSON.stringify({ content: "Synthetic reply" }) });
    expect(replied.status).toBe(200);
    const attached = await fetch(path + "/attachments", {
      method: "POST", headers: { ...headers, "Content-Type": "text/plain", "X-Filename": "diagnostic.txt" }, body: "Local test",
    });
    expect(attached.status).toBe(200);
    expect(desk.createTicket).toHaveBeenCalledOnce();
    expect(desk.addTicketComment).toHaveBeenCalledOnce();
    expect(desk.uploadTicketAttachment).toHaveBeenCalledOnce();
  });
  it("requires staff authority and a current proof before writing stock or recording a staff audit", async () => {
    const staffCredential = jwt.sign({ email: staff.email, userId: staff.id }, secret, { expiresIn: "1h" });
    const staffSession = cookie(staffCredential, "staff-session");
    const stock = "/api/internal/warehouse/stock/receive";
    expect((await request(stock, {}, "POST")).status).toBe(404);
    expect((await request(stock, { cookie: staffSession }, "POST")).status).toBe(403);
    expect(audit).not.toHaveBeenCalled();
    const customerSession = cookie(token());
    const customerProof = (await issue(customerSession)).proof;
    expect((await request(stock, { cookie: customerSession, authorization: `Bearer ${staffCredential}`, "X-CSRF-Token": customerProof }, "POST")).status).toBe(404);
    expect(record).not.toHaveBeenCalled();
    const warehouseSession = "/api/internal/warehouse/session";
    expect((await request(warehouseSession, { cookie: customerSession, "X-DE-CSRF-Request": "1" })).status).toBe(404);
    const staffProof = (await issue(staffSession, warehouseSession)).proof;
    expect(staffProof).toBe((await issue(staffSession)).proof);
    expect((await request(stock, { cookie: staffSession, "X-CSRF-Token": staffProof }, "POST")).status).toBe(200);
    expect(record).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledOnce();
  });
});
