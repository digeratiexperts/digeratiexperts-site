import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signDeSyncRequest } from "./integrations/deSyncAuth";
import type { TicketReconciliationEntry, TicketsSource } from "./ticketsSource";

/**
 * The website "Get Support" widget with TICKETS_SOURCE=hub, over real HTTP,
 * with the Hub mocked at fetch and the Desk mocked at the service.
 *
 * Hub first (Joe, 2026-11-05): the Hub takes the ticket and Desk is not
 * called; Desk gets it later through the Hub sync. When the Hub cannot take
 * it, the ticket continues down the unchanged Desk path and a reconciliation
 * note records the miss, so nothing is lost. TICKETS_SOURCE=desk never
 * touches the Hub.
 */

vi.mock("./zoho", () => ({
  zohoClient: { isDeskConfigured: vi.fn(() => true), getDeskClient: vi.fn() },
  zohoDeskService: { createTicket: vi.fn() },
  splitVisitorName: () => ({ firstName: "Sam", lastName: "Visitor" }),
}));

vi.mock("./storage", () => ({
  storage: { createPortalTicket: vi.fn(async () => ({ id: "local-1" })), updatePortalTicket: vi.fn() },
}));

vi.mock("./portalAuthStore", () => ({
  getUser: vi.fn(() => undefined),
  getClient: vi.fn(() => undefined),
  setClient: vi.fn(),
}));

vi.mock("./middleware/security", () => ({ logSecurityEvent: vi.fn() }));

const passThrough = (_req: unknown, _res: unknown, next: () => void) => next();
const SECRET = "widget-hub-secret";

const validTicket = {
  email: "visitor@example.com",
  subject: "Printer offline",
  description: "It stopped after the update.",
  priority: "High",
  name: "Sam Visitor",
};

const hubTicket = {
  id: 77,
  number: "DE-1077",
  subject: "Printer offline",
  description: "It stopped after the update.",
  status: "open",
  priority: "high",
  requesterEmail: "visitor@example.com",
  requesterName: "Sam Visitor",
  homeSystem: "hub",
  deskTicketId: null,
  createdAt: "2026-11-06T10:00:00.000Z",
  updatedAt: "2026-11-06T10:00:00.000Z",
};

describe("widget ticket with TICKETS_SOURCE", () => {
  let server: Server;
  let baseUrl = "";
  let source: TicketsSource = "hub";
  let hubReply: { status: number; body: unknown } | Error = { status: 201, body: {} };
  const hubCalls: Array<{ url: string; init: any }> = [];
  const notes: TicketReconciliationEntry[] = [];
  let createTicket: ReturnType<typeof vi.fn>;
  let getUser: ReturnType<typeof vi.fn>;
  let getClient: ReturnType<typeof vi.fn>;
  let storage: { createPortalTicket: ReturnType<typeof vi.fn>; updatePortalTicket: ReturnType<typeof vi.fn> };

  beforeAll(async () => {
    const { registerWidgetTicketRoute } = await import("./widgetTicketRoute");
    const { createHubTicketClient } = await import("./integrations/hubTicketClient");
    createTicket = (await import("./zoho")).zohoDeskService.createTicket as ReturnType<typeof vi.fn>;
    const auth = await import("./portalAuthStore");
    getUser = auth.getUser as unknown as ReturnType<typeof vi.fn>;
    getClient = auth.getClient as unknown as ReturnType<typeof vi.fn>;
    storage = (await import("./storage")).storage as never;

    const app = express();
    app.use(express.json());
    registerWidgetTicketRoute(app, {
      ticketRateLimiter: passThrough,
      statusRateLimiter: passThrough,
      fallback: async () => ({ accepted: true, spooled: true, deskEmailed: true, clientAcknowledged: true }),
      ticketsSource: () => source,
      hubTickets: createHubTicketClient({
        base: () => "https://hub.example.test/api",
        secret: () => SECRET,
        timeoutMs: 1000,
        fetch: (async (url: any, init: any) => {
          hubCalls.push({ url: String(url), init });
          if (hubReply instanceof Error) throw hubReply;
          return new Response(JSON.stringify(hubReply.body), { status: hubReply.status, headers: { "Content-Type": "application/json" } });
        }) as typeof fetch,
      }),
      reconciliation: { write: (e) => (notes.push(e), true), now: () => new Date("2026-11-06T12:00:00Z") },
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

  beforeEach(() => {
    vi.clearAllMocks();
    hubCalls.length = 0;
    notes.length = 0;
    source = "hub";
    getUser.mockReturnValue(undefined);
    getClient.mockReturnValue(undefined);
    createTicket.mockResolvedValue({ id: "9001", ticketNumber: "1234" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  async function post(body: unknown) {
    const response = await fetch(`${baseUrl}/api/portal/zoho/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  it("hub: the Hub takes the ticket, Desk is not called, and the visitor gets the Hub number", async () => {
    hubReply = { status: 201, body: { contract: "de.hub.portal-tickets/v1", created: true, ticket: hubTicket } };
    const res = await post(validTicket);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, ticketNumber: "DE-1077", hubTicketId: 77 });
    expect(createTicket).not.toHaveBeenCalled();
    expect(notes).toHaveLength(0);

    const call = hubCalls[0];
    expect(call.url).toBe("https://hub.example.test/api/webhooks/portal/tickets");
    const sent = JSON.parse(call.init.body);
    expect(sent).toMatchObject({ channel: "website_widget", priority: "high", requesterEmail: "visitor@example.com", requesterName: "Sam Visitor" });
    // Scoped HMAC over path + exact body; never a bearer copy of a secret.
    expect(call.init.headers.Authorization).toBeUndefined();
    expect(
      signDeSyncRequest({
        method: "POST",
        path: "/api/webhooks/portal/tickets",
        timestamp: call.init.headers["X-DE-Timestamp"],
        eventId: call.init.headers["X-DE-Event-ID"],
        body: call.init.body,
        secret: SECRET,
      }),
    ).toBe(call.init.headers["X-DE-Signature"]);
  });

  it("hub: a portal user's ticket names their Hub account and is mirrored to the portal as hub:<id>", async () => {
    getUser.mockReturnValue({ id: "user-1", clientId: "client-1" });
    getClient.mockReturnValue({ id: "client-1", hubAccountId: "41" });
    hubReply = { status: 201, body: { contract: "de.hub.portal-tickets/v1", created: true, ticket: hubTicket } };
    await post(validTicket);
    expect(hubCalls[0].url).toBe("https://hub.example.test/api/webhooks/portal/tickets?accountId=41&portalClientId=client-1");
    expect(storage.createPortalTicket).toHaveBeenCalledWith(expect.objectContaining({ clientId: "client-1", ticketNumber: "DE-1077" }));
    expect(storage.updatePortalTicket).toHaveBeenCalledWith("local-1", { assignedTo: "hub:77" });
  });

  it("hub unreachable: the ticket goes to Desk as before and a reconciliation note records the miss", async () => {
    hubReply = new TypeError("fetch failed");
    const res = await post(validTicket);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, zohoTicketId: "9001" });
    expect(createTicket).toHaveBeenCalledTimes(1);
    expect(notes).toHaveLength(1);
    expect(notes[0].record).toMatchObject({ kind: "create", channel: "website_widget", hubReason: "unreachable", handedTo: "desk", requesterEmail: "visitor@example.com" });
  });

  it("hub refuses (e.g. 409 account has no Hub client): Desk path, note keeps the status and code", async () => {
    hubReply = { status: 409, body: { error: "x", code: "client_mapping_required" } };
    const res = await post(validTicket);
    expect(res.body).toMatchObject({ success: true, zohoTicketId: "9001" });
    expect(notes[0].record).toMatchObject({ hubReason: "refused", hubStatus: 409, hubCode: "client_mapping_required" });
  });

  it("desk: the Hub is never called", async () => {
    source = "desk";
    const res = await post(validTicket);
    expect(res.body).toMatchObject({ success: true, zohoTicketId: "9001" });
    expect(hubCalls).toHaveLength(0);
    expect(notes).toHaveLength(0);
  });
});
