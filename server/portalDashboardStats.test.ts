import express from "express";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZohoBillingService } from "./zoho/zohoBilling";
import { ZohoDeskService, STRICT_DESK_TICKET_LIMIT } from "./zoho/zohoDesk";
import { registerPortalDashboardRoute, type DashboardDeps } from "./portalDashboardStats";

/**
 * Provider → adapter → route coverage for the W1 dashboard (PR #850 review).
 * The real ZohoBillingService / ZohoDeskService run against a fake HTTP
 * client; the real route runs behind a stand-in for authMiddleware.
 */

type Reply = { data?: unknown } | Error;
type Handler = (url: string, config: { params?: Record<string, unknown> }) => Reply;

function fakeProvider(handlers: Record<string, Handler>) {
  const calls: Array<{ url: string; params?: Record<string, unknown> }> = [];
  const client = {
    async get(url: string, config: { params?: Record<string, unknown> } = {}) {
      calls.push({ url, params: config.params });
      const key = Object.keys(handlers).find((k) => url === k || url.startsWith(k));
      if (!key) throw new Error(`unexpected ${url}`);
      const reply = handlers[key](url, config);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return { client, calls };
}

const ORG_BILLING: Handler = () => ({ data: { code: 0, organizations: [{ organization_id: "org-1" }] } });
const ORG_DESK: Handler = () => ({ data: { data: [{ id: "desk-org" }] } });
const CUSTOMER_A: Handler = (_u, c) => ({ data: { code: 0, customers: c.params?.email === "a@acme.test" ? [{ customer_id: "cust-a" }] : [] } });
const page = (key: string, rows: unknown[], more = false) => ({ data: { code: 0, [key]: rows, page_context: { page: 1, has_more_page: more } } });
const INVOICES: Handler = () => page("invoices", [
  { invoice_id: "i1", status: "unpaid" },
  { invoice_id: "i2", status: "Overdue" },
  { invoice_id: "i3", status: "paid" },
]);
const SUBS: Handler = () => page("subscriptions", [
  { subscription_id: "s1", status: "live", plan: { name: "Managed Security" }, amount: 99 },
  { subscription_id: "s2", status: "cancelled" },
]);
const CONTACT_A: Handler = (_u, c) => (c.params?.email === "a@acme.test" ? { data: { data: [{ id: "contact-a" }] } } : { data: "" });
const TICKETS: Handler = () => ({ data: { data: [
  { id: "t1", status: "Open", subject: "Printer" },
  { id: "t2", status: "Waiting on customer", subject: "Laptop" },
  { id: "t3", status: "Closed", statusType: "Closed", subject: "VPN" },
] } });

function billingWith(over: Partial<Record<string, Handler>> = {}, getClient?: () => Promise<unknown>) {
  const p = fakeProvider({
    "/billing/v1/organizations": ORG_BILLING,
    "/billing/v1/customers": CUSTOMER_A,
    "/billing/v1/invoices": INVOICES,
    "/billing/v1/subscriptions": SUBS,
    ...over,
  } as Record<string, Handler>);
  const service = new ZohoBillingService({ getClient: (getClient ?? (async () => p.client)) as never });
  return { service, calls: p.calls };
}

function deskWith(over: Partial<Record<string, Handler>> = {}) {
  const p = fakeProvider({ "/organizations": ORG_DESK, "/contacts/search": CONTACT_A, "/contacts/contact-a/tickets": TICKETS, ...over } as Record<string, Handler>);
  return { service: new ZohoDeskService({ getDeskClient: async () => p.client as never }), calls: p.calls };
}

let server: Server | undefined;
async function serve(deps: DashboardDeps, user: { id: string; email: string } | null) {
  const app = express();
  app.use(express.json());
  const auth: express.RequestHandler = (req, res, next) => {
    if (!user) return res.status(401).json({ message: "Unauthorized" });
    (req as express.Request & { user?: unknown; userId?: string }).user = { email: user.email };
    (req as express.Request & { userId?: string }).userId = user.id;
    next();
  };
  registerPortalDashboardRoute(app, auth, deps);
  server = createServer(app);
  await new Promise<void>((r) => server!.listen(0, "127.0.0.1", () => r()));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/portal/dashboard`;
}

afterEach(async () => {
  if (server) await new Promise<void>((r) => server!.close(() => r()));
  server = undefined;
});

let warn: ReturnType<typeof vi.spyOn>;
let err: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { warn.mockRestore(); err.mockRestore(); });

const A = { id: "user-a", email: "a@acme.test" };

function deps(billing: ZohoBillingService, desk: ZohoDeskService, local: DashboardDeps["localTickets"] = async () => []): DashboardDeps {
  return { zohoConfigured: () => true, billing, desk, localTickets: local };
}

async function get(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
}

describe("dashboard billing: strict provider → adapter → route", () => {
  it("complete reads give exact totals with existing status semantics", async () => {
    const b = billingWith(); const d = deskWith();
    const { status, body, cache } = await get(await serve(deps(b.service, d.service), A));
    expect(status).toBe(200);
    expect(cache).toBe("private, no-store");
    expect(body).toMatchObject({ pendingInvoices: 2, activeServices: 1, billingStatus: "ok", openTickets: 1, waitingOnClient: 1, resolvedTickets: 1, ticketSource: "desk" });
    expect(body.services).toEqual([expect.objectContaining({ id: "s1", serviceName: "Managed Security" })]);
  });

  it("1a. invoice HTTP failure → invoices null, subscriptions still usable", async () => {
    const b = billingWith({ "/billing/v1/invoices": () => new Error("HTTP 500 secret-token-xyz") });
    const { body } = await get(await serve(deps(b.service, deskWith().service), A));
    expect(body.pendingInvoices).toBeNull();
    expect(body.activeServices).toBe(1);
    expect(body.billingStatus).toBe("unavailable");
    expect(JSON.stringify(body)).not.toContain("secret-token-xyz");
  });

  it("1b. reverse: subscription failure → services null, invoices still counted", async () => {
    const b = billingWith({ "/billing/v1/subscriptions": () => new Error("HTTP 503") });
    const { body } = await get(await serve(deps(b.service, deskWith().service), A));
    expect(body.activeServices).toBeNull();
    expect(body.services).toEqual([]);
    expect(body.pendingInvoices).toBe(2);
  });

  it("2. both downstream failures → both null, never zero; tickets intact", async () => {
    const b = billingWith({ "/billing/v1/subscriptions": () => new Error("x"), "/billing/v1/invoices": () => new Error("y") });
    const { body } = await get(await serve(deps(b.service, deskWith().service), A));
    expect(body.activeServices).toBeNull();
    expect(body.pendingInvoices).toBeNull();
    expect(body.openTickets).toBe(1);
  });

  it.each([
    ["token failure", { getClient: async () => { throw new Error("token"); } }],
    ["organization failure", { over: { "/billing/v1/organizations": () => ({ data: { code: 0, organizations: [] } }) } }],
    ["customer lookup failure", { over: { "/billing/v1/customers": () => new Error("500") } }],
    ["customer lookup error code", { over: { "/billing/v1/customers": () => ({ data: { code: 57, message: "denied" } }) } }],
  ] as const)("3. %s stops dependent reads and is unavailable, not a no-match", async (_n, cfg) => {
    const b = billingWith((cfg as { over?: Record<string, Handler> }).over ?? {}, (cfg as { getClient?: () => Promise<unknown> }).getClient);
    const { body } = await get(await serve(deps(b.service, deskWith().service), A));
    expect(body).toMatchObject({ pendingInvoices: null, activeServices: null, billingStatus: "unavailable" });
    expect(b.calls.some((c) => c.url.startsWith("/billing/v1/invoices") || c.url.startsWith("/billing/v1/subscriptions"))).toBe(false);
  });

  it("3. a validated no-match is 'not_linked' and makes no list calls", async () => {
    const b = billingWith(); const d = deskWith();
    const { body } = await get(await serve(deps(b.service, d.service), { id: "user-z", email: "nobody@acme.test" }));
    expect(body).toMatchObject({ pendingInvoices: null, activeServices: null, billingStatus: "not_linked" });
    expect(b.calls.filter((c) => c.url === "/billing/v1/invoices")).toHaveLength(0);
  });

  it("4. complete validated empty lists produce zero", async () => {
    const b = billingWith({ "/billing/v1/invoices": () => page("invoices", []), "/billing/v1/subscriptions": () => page("subscriptions", []) });
    const { body } = await get(await serve(deps(b.service, deskWith().service), A));
    expect(body).toMatchObject({ pendingInvoices: 0, activeServices: 0, billingStatus: "ok" });
  });

  it.each([
    ["missing list", () => ({ data: { code: 0, page_context: { has_more_page: false } } })],
    ["null list", () => ({ data: { code: 0, invoices: null, page_context: { has_more_page: false } } })],
    ["non-array list", () => ({ data: { code: 0, invoices: { a: 1 }, page_context: { has_more_page: false } } })],
    ["error code", () => ({ data: { code: 1002, invoices: [], page_context: { has_more_page: false } } })],
    ["null envelope", () => ({ data: null })],
    ["null row", () => page("invoices", [null])],
    ["row without status", () => page("invoices", [{ invoice_id: "i1" }])],
  ] as Array<[string, Handler]>)("5. %s stays unavailable and does not crash", async (_n, h) => {
    const b = billingWith({ "/billing/v1/invoices": h });
    const { status, body } = await get(await serve(deps(b.service, deskWith().service), A));
    expect(status).toBe(200);
    expect(body.pendingInvoices).toBeNull();
    expect(body.activeServices).toBe(1);
  });

  it("6. a partial page is never an exact total; missing page metadata is unknown too", async () => {
    const more = billingWith({ "/billing/v1/invoices": () => page("invoices", [{ invoice_id: "i1", status: "unpaid" }], true) });
    expect((await get(await serve(deps(more.service, deskWith().service), A))).body.pendingInvoices).toBeNull();
    await new Promise<void>((r) => server!.close(() => r())); server = undefined;
    const noMeta = billingWith({ "/billing/v1/subscriptions": () => ({ data: { code: 0, subscriptions: [] } }) });
    expect((await get(await serve(deps(noMeta.service, deskWith().service), A))).body.activeServices).toBeNull();
    expect(noMeta.calls.find((c) => c.url === "/billing/v1/subscriptions")?.params).toMatchObject({ customer_id: "cust-a", per_page: 200 });
  });

  it("7. anonymous is denied; tenant A cannot select tenant B through query or body", async () => {
    const anon = await serve(deps(billingWith().service, deskWith().service), null);
    expect((await fetch(anon)).status).toBe(401);
    await new Promise<void>((r) => server!.close(() => r())); server = undefined;
    const b = billingWith(); const d = deskWith();
    const url = await serve(deps(b.service, d.service), A);
    await get(`${url}?email=b@globex.test&customerId=cust-b&clientId=globex`);
    const emails = [...b.calls, ...d.calls].map((c) => c.params?.email).filter(Boolean);
    expect(new Set(emails)).toEqual(new Set(["a@acme.test"]));
    expect(b.calls.every((c) => c.params?.customer_id === undefined || c.params.customer_id === "cust-a")).toBe(true);
  });

  it("8. legacy callers keep their behavior; failures log no email or provider body", async () => {
    const b = billingWith({ "/billing/v1/invoices": () => new Error("boom") });
    await expect(b.service.getInvoicesByCustomer("cust-a")).resolves.toEqual([]);
    const strict = await b.service.listInvoicesByCustomerStrict("cust-a");
    expect(strict).toEqual({ ok: false });
    await b.service.findCustomerByEmailStrict("a@acme.test");
    for (const call of warn.mock.calls) expect(JSON.stringify(call)).not.toMatch(/a@acme\.test|boom/);
  });
});

describe("dashboard tickets: no sample stands in for a total", () => {
  it("Desk contact lookup failure → ticket counts null, no silent local fallback", async () => {
    const local = vi.fn(async () => [{ id: 1, status: "open", subject: "Local" }]);
    const d = deskWith({ "/contacts/search": () => new Error("desk down") });
    const { body } = await get(await serve(deps(billingWith().service, d.service, local), A));
    expect(body).toMatchObject({ openTickets: null, waitingOnClient: null, resolvedTickets: null, ticketSource: "unavailable", recentTickets: [] });
    expect(local).not.toHaveBeenCalled();
  });

  it("Desk ticket list failure after a contact match → counts null", async () => {
    const d = deskWith({ "/contacts/contact-a/tickets": () => new Error("500") });
    const { body } = await get(await serve(deps(billingWith().service, d.service), A));
    expect(body).toMatchObject({ openTickets: null, waitingOnClient: null, ticketSource: "unavailable" });
  });

  it("a full Desk page (possible more tickets) gives recent rows but no totals", async () => {
    const rows = Array.from({ length: STRICT_DESK_TICKET_LIMIT }, (_, i) => ({ id: `t${i}`, status: "Closed", statusType: "Closed", subject: `S${i}` }));
    const d = deskWith({ "/contacts/contact-a/tickets": () => ({ data: { data: rows } }) });
    const { body } = await get(await serve(deps(billingWith().service, d.service), A));
    expect(body).toMatchObject({ openTickets: null, waitingOnClient: null, resolvedTickets: null, ticketSource: "desk" });
    expect(body.recentTickets).toHaveLength(5);
    expect(d.calls.find((c) => c.url === "/contacts/contact-a/tickets")?.params).toEqual({ limit: STRICT_DESK_TICKET_LIMIT });
  });

  it("malformed Desk rows make the read unavailable instead of crashing", async () => {
    const d = deskWith({ "/contacts/contact-a/tickets": () => ({ data: { data: [null, { id: "t1" }] } }) });
    const { status, body } = await get(await serve(deps(billingWith().service, d.service), A));
    expect(status).toBe(200);
    expect(body.ticketSource).toBe("unavailable");
  });

  it("a validated Desk no-match uses the portal's own tickets; null rows are skipped", async () => {
    const local = vi.fn(async () => [null, { id: 7, status: "pending_client", subject: "Confirm" }, { id: 8, status: "in-progress", subject: null }] as never);
    const { body } = await get(await serve(deps(billingWith().service, deskWith().service, local), { id: "user-z", email: "nobody@acme.test" }));
    expect(local).toHaveBeenCalledWith("user-z");
    expect(body).toMatchObject({ ticketSource: "local", waitingOnClient: 1, openTickets: 1 });
    expect(body.recentTickets.map((t: { id: string }) => t.id)).toEqual(["7", "8"]);
    expect(body.recentTickets[1].subject).toBe("(no subject)");
  });

  it("Desk 204 (empty body) for a contact with no tickets is a complete zero", async () => {
    const d = deskWith({ "/contacts/contact-a/tickets": () => ({ data: "" }) });
    const { body } = await get(await serve(deps(billingWith().service, d.service), A));
    expect(body).toMatchObject({ openTickets: 0, waitingOnClient: 0, resolvedTickets: 0, ticketSource: "desk" });
  });

  it("an unexpected server error answers 500 without provider detail", async () => {
    const d: DashboardDeps = { ...deps(billingWith().service, deskWith().service), zohoConfigured: () => false, localTickets: async () => { throw new Error("db password=hunter2"); } };
    const { status, body } = await get(await serve(d, A));
    expect(status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("hunter2");
    for (const call of err.mock.calls) expect(JSON.stringify(call)).not.toContain("hunter2");
  });
});
