import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PRIMARY_PHONE } from "@shared/companyContact";
import { ZohoOAuthError } from "./zoho/zohoOAuthErrors";

/**
 * The production failure this guards, seen 2026-09-30 in the DE Desk "Get
 * Support" tab: "We couldn't open the ticket right now." The handler reached
 * Zoho Desk and Zoho refused — most probably an OAuth refresh or scope failure
 * on our side — and the visitor got a message indistinguishable from "your
 * ticket was rejected", with no retry guidance. Zoho itself was healthy (one
 * org, one department), the last widget ticket was 2026-06-01, and nothing
 * on this path had test coverage beyond splitVisitorName.
 *
 * 2026-10-07 (desk-ticket-failover, Joe: "Clients cannot see this at all"):
 * every Desk failure now hands the ticket to the fallback (disk spool, email
 * into the Desk inbox, client acknowledgement) and the visitor sees it
 * received. Only when the fallback holds nothing does the 503 retry remain.
 */

vi.mock("./zoho", () => ({
  zohoClient: {
    isDeskConfigured: vi.fn(() => true),
    getDeskClient: vi.fn(),
  },
  zohoDeskService: {
    createTicket: vi.fn(),
  },
  splitVisitorName: (name: string | undefined, email: string) => {
    const local = email.split("@")[0];
    if (!name) return { firstName: undefined, lastName: local };
    const parts = name.trim().split(/\s+/);
    return parts.length === 1
      ? { firstName: undefined, lastName: parts[0] }
      : { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  },
}));

vi.mock("./storage", () => ({
  storage: {
    createPortalTicket: vi.fn(),
    updatePortalTicket: vi.fn(),
  },
}));

vi.mock("./portalAuthStore", () => ({
  getUser: vi.fn(() => undefined),
}));

vi.mock("./middleware/security", () => ({
  logSecurityEvent: vi.fn(),
}));

const passThrough = (_req: unknown, _res: unknown, next: () => void) => next();

const validTicket = {
  email: "visitor@example.com",
  subject: "Printer offline",
  description: "It stopped after the update.",
  priority: "Medium",
  name: "Sam Visitor",
};

describe("DE Desk widget ticket route", () => {
  let server: Server;
  let baseUrl = "";
  let createTicket: ReturnType<typeof vi.fn>;
  let isDeskConfigured: ReturnType<typeof vi.fn>;
  let getDeskClient: ReturnType<typeof vi.fn>;
  const fallback = vi.fn();

  beforeAll(async () => {
    const { registerWidgetTicketRoute } = await import("./widgetTicketRoute");
    const zoho = await import("./zoho");
    createTicket = zoho.zohoDeskService.createTicket as ReturnType<typeof vi.fn>;
    isDeskConfigured = zoho.zohoClient.isDeskConfigured as ReturnType<typeof vi.fn>;
    getDeskClient = zoho.zohoClient.getDeskClient as ReturnType<typeof vi.fn>;

    const app = express();
    app.use(express.json());
    registerWidgetTicketRoute(app, {
      ticketRateLimiter: passThrough,
      statusRateLimiter: passThrough,
      fallback: (ticket, options) => fallback(ticket, options),
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
    vi.clearAllMocks();
    isDeskConfigured.mockReturnValue(true);
    fallback.mockResolvedValue({ accepted: true, spooled: true, deskEmailed: true, clientAcknowledged: true });
    const { resetDeskStatusCacheForTests } = await import("./widgetTicketRoute");
    resetDeskStatusCacheForTests();
  });

  async function post(body: unknown) {
    const response = await fetch(`${baseUrl}/api/portal/zoho/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as Record<string, unknown> };
  }

  /** The visitor's view of a ticket the Desk API did not take: received, with a reference. */
  function expectQueued(result: { status: number; body: Record<string, unknown> }, reason: string) {
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ success: true, queued: true, message: "Your support request has been received." });
    expect(String(result.body.ticketNumber)).toMatch(/^DE-W-[0-9A-Z]+-[0-9A-F]{6}$/);
    expect(result.body).not.toHaveProperty("zohoTicketId");
    expect(result.body).not.toHaveProperty("error");
    expect(fallback).toHaveBeenCalledTimes(1);
    const [ticket, options] = fallback.mock.calls[0];
    expect(ticket).toMatchObject({
      source: "website-widget",
      email: validTicket.email,
      name: validTicket.name,
      subject: validTicket.subject,
      description: validTicket.description,
      priority: "Medium",
      reason,
      reference: result.body.ticketNumber,
    });
    expect(options).toEqual({ acknowledge: true });
  }

  it("the production failure: a refused Desk token hands the ticket to the fallback and the visitor sees it received", async () => {
    // zohoClient._doRefreshDeskToken throws exactly this when the refresh
    // token is expired, revoked, or lacks Desk scopes.
    createTicket.mockRejectedValueOnce(new Error("Failed to refresh Zoho Desk access token"));
    expectQueued(await post(validTicket), "auth_failed");
  });

  it("typed ZohoOAuthError(invalid_code) goes to the fallback, never a fake Desk ticket id", async () => {
    const { ZohoOAuthError } = await import("./zoho/zohoOAuthErrors");
    createTicket.mockRejectedValueOnce(
      new ZohoOAuthError({
        message: "Failed to refresh Zoho Desk access token",
        code: "invalid_refresh_token",
        product: "desk",
        zohoError: "invalid_code",
      }),
    );
    expectQueued(await post(validTicket), "auth_failed");
  });

  it("a 401 from Zoho goes to the fallback as an auth failure", async () => {
    const err = Object.assign(new Error("Request failed with status code 401"), {
      response: { status: 401, data: { errorCode: "INVALID_OAUTH", message: "The access token is invalid" } },
    });
    createTicket.mockRejectedValueOnce(err);
    expectQueued(await post(validTicket), "auth_failed");
  });

  it("a validation rejection from Zoho goes to the fallback too: the client's ticket is never lost", async () => {
    const err = Object.assign(new Error("Request failed with status code 422"), {
      response: { status: 422, data: { errorCode: "UNPROCESSABLE_ENTITY", message: "Extra field" } },
    });
    createTicket.mockRejectedValueOnce(err);
    expectQueued(await post(validTicket), "rejected");
  });

  it("a Desk answer with no ticket id goes to the fallback, never a success without a reference", async () => {
    createTicket.mockResolvedValueOnce({} as never);
    expectQueued(await post(validTicket), "no_ticket_id");
  });

  it("an unconfigured desk goes straight to the fallback, before any Zoho call", async () => {
    isDeskConfigured.mockReturnValue(false);
    expectQueued(await post(validTicket), "not_configured");
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("keeps the DE Desk session on the fallback ticket so staff can find the chat", async () => {
    createTicket.mockRejectedValueOnce(new Error("Failed to refresh Zoho Desk access token"));
    await post({ ...validTicket, sessionId: "desk-session-42" });
    expect(fallback.mock.calls[0][0].description).toMatch(/DE Desk session: desk-session-42$/);
  });

  it("only when every fallback layer failed does the visitor get the retry message, with the phone number", async () => {
    createTicket.mockRejectedValueOnce(new Error("Failed to refresh Zoho Desk access token"));
    fallback.mockResolvedValueOnce({ accepted: false, spooled: false, deskEmailed: false, clientAcknowledged: false });
    const { status, body } = await post(validTicket);
    expect(status).toBe(503);
    expect(body).toMatchObject({ success: false, code: "desk_unavailable", retryable: true });
    expect(String(body.error)).toContain(PRIMARY_PHONE.display);
  });

  it("a fallback that throws is treated as nothing held: retry message, no false success", async () => {
    createTicket.mockRejectedValueOnce(new Error("Failed to refresh Zoho Desk access token"));
    fallback.mockRejectedValueOnce(new Error("disk full"));
    const { status, body } = await post(validTicket);
    expect(status).toBe(503);
    expect(body.success).toBe(false);
  });

  it("does not touch the fallback when Desk takes the ticket", async () => {
    createTicket.mockResolvedValueOnce({ id: "171003000009999002", ticketNumber: "122" } as never);
    expect((await post(validTicket)).body.ticketNumber).toBe("122");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("reports success only when Zoho returned a ticket, carrying its number", async () => {
    createTicket.mockResolvedValueOnce({ id: "171003000009999001", ticketNumber: "121" } as never);

    const { status, body } = await post(validTicket);

    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.zohoTicketId).toBe("171003000009999001");
    expect(body.ticketNumber).toBe("121");
    expect(createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ email: validTicket.email, subject: validTicket.subject, priority: "Medium" }),
    );
  });

  it("rejects incomplete input before touching Zoho", async () => {
    const { status } = await post({ email: "visitor@example.com" });
    expect(status).toBe(400);
    expect(createTicket).not.toHaveBeenCalled();
  });

  describe("desk status probe", () => {
    it("keeps cached failures at 503 and does not let intermediaries cache them", async () => {
      getDeskClient.mockRejectedValueOnce(new Error("Failed to refresh Zoho Desk access token"));
      for (let i = 0; i < 2; i++) {
        const response = await fetch(`${baseUrl}/api/zoho/desk/status`);
        expect(response.status).toBe(503);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toMatchObject({ connected: false, cached: i === 1 });
      }
      expect(getDeskClient).toHaveBeenCalledTimes(1);
    });

    it("shares one in-flight probe across simultaneous requests", async () => {
      let release!: (value: unknown) => void;
      const get = vi.fn(() => new Promise(resolve => { release = resolve; }));
      getDeskClient.mockResolvedValueOnce({ get });
      const requests = Array.from({ length: 5 }, () => fetch(`${baseUrl}/api/zoho/desk/status`));
      await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1));
      release({ data: { data: [{ id: "org" }] } });
      const responses = await Promise.all(requests);
      expect(responses.every(r => r.status === 200)).toBe(true);
      await Promise.all(responses.map(r => r.json()));
      expect(getDeskClient).toHaveBeenCalledTimes(1);
    });

    it("does not claim connectivity for an empty organization response", async () => {
      getDeskClient.mockResolvedValueOnce({ get: vi.fn(async () => ({ data: { data: [] } })) });
      const response = await fetch(`${baseUrl}/api/zoho/desk/status`);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ connected: false });
    });
    it("is connected when an authenticated Desk read succeeds", async () => {
      getDeskClient.mockResolvedValueOnce({ get: vi.fn(async () => ({ data: { data: [{ id: 641745124 }] } })) });

      const response = await fetch(`${baseUrl}/api/zoho/desk/status`);
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(body.configured).toBe(true);
      expect(body.connected).toBe(true);
    });

    it("names a refresh failure as auth_failed — the gap /api/zoho/status could never show", async () => {
      getDeskClient.mockRejectedValueOnce(new Error("Failed to refresh Zoho Desk access token"));

      const response = await fetch(`${baseUrl}/api/zoho/desk/status`);
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(503);
      expect(body.configured).toBe(true);
      expect(body.connected).toBe(false);
      // A refused credential needs a new token, not a retry; say which.
      expect(body.reason).toBe("auth_failed");
      // Diagnostic, not a credential.
      expect(JSON.stringify(body)).not.toMatch(/token|secret/i);
    });

    it("keeps a network failure as unavailable, distinct from a refused credential", async () => {
      getDeskClient.mockRejectedValueOnce(new Error("connect ECONNRESET 1.2.3.4:443"));

      const response = await fetch(`${baseUrl}/api/zoho/desk/status`);
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(503);
      expect(body.connected).toBe(false);
      expect(body.reason).toBe("unavailable");
    });

    it("reports not configured without calling Zoho", async () => {
      isDeskConfigured.mockReturnValue(false);

      const response = await fetch(`${baseUrl}/api/zoho/desk/status`);
      const body = (await response.json()) as Record<string, unknown>;

      expect(response.status).toBe(503);
      expect(body.reason).toBe("not_configured");
      expect(getDeskClient).not.toHaveBeenCalled();
    });
  });

  it("preserves #290's typed invalid_code failure on #289's extracted route: an auth failure for the fallback", async () => {
    createTicket.mockRejectedValueOnce(new ZohoOAuthError({
      message: "No access token in Zoho Desk response", product: "desk",
      code: "invalid_refresh_token", zohoError: "invalid_code",
    }));
    expectQueued(await post(validTicket), "auth_failed");
  });

  it.each([
    { subject: "   " }, { description: {} }, { subject: ["Printer"] },
    { email: ["visitor@example.com"] }, { priority: "Emergency" },
    { name: "x".repeat(201) }, { sessionId: {} }, { description: "x".repeat(5001) },
  ])("rejects malformed public input %j without calling Zoho", async (bad) => {
    expect((await post({ ...validTicket, ...bad })).status).toBe(400);
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("accepts the support form's Critical priority as Desk Urgent", async () => {
    createTicket.mockResolvedValueOnce({ id: "desk-123" });
    expect((await post({ ...validTicket, priority: "Critical" })).status).toBe(200);
    expect(createTicket).toHaveBeenCalledWith(expect.objectContaining({ priority: "Urgent" }));
  });

  it.each([429, 500, 503])("hands upstream %i to the fallback as unavailable", async (status) => {
    createTicket.mockRejectedValueOnce({ response: { status } });
    expectQueued(await post(validTicket), "unavailable");
  });

  it("uses the real Desk id as a reference when no ticket number is returned", async () => {
    createTicket.mockResolvedValueOnce({ id: "desk-123" });
    expect((await post(validTicket)).body.ticketNumber).toBe("desk-123");
  });
});
