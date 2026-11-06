/**
 * TICKETS_SOURCE=desk|hub: the switch, the Hub ticket client (Hub mocked), and
 * how Hub tickets merge into the portal list. Contract pins live in
 * integrations/deSyncContract.parity.test.ts (reads.portalTickets).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { signDeSyncRequest } from "./integrations/deSyncAuth";
import { createHubTicketClient, type HubTicketClientDeps } from "./integrations/hubTicketClient";
import type { HubTicket } from "./integrations/hubTicketsContract";
import {
  canSeeHubTicket,
  hubAssignedTo,
  hubIdempotencyKey,
  hubPortalTicketId,
  mergePortalAndHubTickets,
  parseHubAssignedTo,
  parseHubPortalTicketId,
  recordTicketReconciliation,
  ticketsSource,
  type TicketReconciliationEntry,
} from "./ticketsSource";

const fixture = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "integrations/deSyncContract.fixture.json"), "utf8"),
) as { reads: { portalTickets: { ticketFields: string[]; messageFields: string[] } } };

const SECRET = "portal-tickets-fixture-secret";

function hubTicket(over: Partial<HubTicket> = {}): HubTicket {
  return {
    id: 41,
    number: "DE-1041",
    subject: "Printer offline",
    description: "Front desk printer",
    status: "open",
    priority: "high",
    requesterEmail: "sam@example.com",
    requesterName: "Sam",
    homeSystem: "hub",
    deskTicketId: null,
    createdAt: "2026-11-06T10:00:00.000Z",
    updatedAt: "2026-11-06T11:00:00.000Z",
    ...over,
  };
}

type Captured = { url: string; method: string; headers: Record<string, string>; body: string };

function mockedHub(reply: { status: number; body: unknown } | Error) {
  const calls: Captured[] = [];
  const deps: HubTicketClientDeps = {
    base: () => "https://hub.example.test/api",
    secret: () => SECRET,
    timeoutMs: 1000,
    fetch: vi.fn(async (url: any, init: any) => {
      calls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body ?? "{}" });
      if (reply instanceof Error) throw reply;
      return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "Content-Type": "application/json" } });
    }) as unknown as typeof fetch,
  };
  return { client: createHubTicketClient(deps), calls, deps };
}

function expectSignedAsSent(call: Captured) {
  const u = new URL(call.url);
  expect(call.headers["X-DE-Source"]).toBe("portal");
  expect(call.headers.Authorization).toBeUndefined();
  expect(
    signDeSyncRequest({
      method: call.method,
      path: `${u.pathname}${u.search}`,
      timestamp: call.headers["X-DE-Timestamp"],
      eventId: call.headers["X-DE-Event-ID"],
      body: call.body,
      secret: SECRET,
    }),
  ).toBe(call.headers["X-DE-Signature"]);
}

const createBody = {
  idempotencyKey: "portal-TKT-ABC-123",
  channel: "client_portal" as const,
  subject: "Printer offline",
  description: "Front desk printer",
  priority: "high" as const,
  requesterEmail: "sam@example.com",
  requesterName: "Sam",
  portalReference: "TKT-ABC-123",
};

describe("TICKETS_SOURCE", () => {
  it("is desk unless it says exactly hub", () => {
    expect(ticketsSource({})).toBe("desk");
    expect(ticketsSource({ TICKETS_SOURCE: "desk" })).toBe("desk");
    expect(ticketsSource({ TICKETS_SOURCE: " HUB " })).toBe("hub");
    expect(ticketsSource({ TICKETS_SOURCE: "hubb" })).toBe("desk");
  });
});

describe("Hub ticket ids", () => {
  it("round-trips list ids and portal row links, and refuses anything else", () => {
    expect(parseHubPortalTicketId(hubPortalTicketId(41))).toBe(41);
    expect(parseHubPortalTicketId("desk-41")).toBeNull();
    expect(parseHubPortalTicketId("hub-41x")).toBeNull();
    expect(parseHubAssignedTo(hubAssignedTo(7))).toBe(7);
    expect(parseHubAssignedTo("zoho:7")).toBeNull();
  });

  it("makes keys the Hub accepts", () => {
    expect(hubIdempotencyKey("portal", "TKT-ABC 123")).toBe("portal-TKT-ABC123");
    expect(hubIdempotencyKey("widget")).toMatch(/^widget-[a-f0-9]{18}$/);
    expect(hubIdempotencyKey("reply", "c1")).toMatch(/^[A-Za-z0-9._:-]{8,100}$/);
  });
});

describe("Hub ticket client (Hub mocked)", () => {
  it("creates with the scoped secret, signing path, query and the exact body", async () => {
    const { client, calls } = mockedHub({ status: 201, body: { contract: "de.hub.portal-tickets/v1", created: true, ticket: hubTicket() } });
    const res = await client.create({ accountId: "41", portalClientId: "client-1" }, createBody);
    expect(res.ok).toBe(true);
    expect(calls[0].url).toBe("https://hub.example.test/api/webhooks/portal/tickets?accountId=41&portalClientId=client-1");
    expect(JSON.parse(calls[0].body)).toEqual(createBody);
    expectSignedAsSent(calls[0]);
  });

  it("creates a widget ticket with no account in the query", async () => {
    const { client, calls } = mockedHub({ status: 201, body: { contract: "de.hub.portal-tickets/v1", created: true, ticket: hubTicket() } });
    await client.create(null, { ...createBody, channel: "website_widget" });
    expect(calls[0].url).toBe("https://hub.example.test/api/webhooks/portal/tickets");
  });

  it("is not_configured without the scoped secret, and never calls the Hub", async () => {
    const { deps, calls } = mockedHub({ status: 201, body: {} });
    const client = createHubTicketClient({ ...deps, secret: () => "" });
    expect(await client.list({ accountId: "41" })).toEqual({ ok: false, reason: "not_configured" });
    expect(calls).toHaveLength(0);
  });

  it("reads a network error or a 5xx as unreachable", async () => {
    expect(await mockedHub(new TypeError("fetch failed")).client.list({ accountId: "41" })).toMatchObject({ ok: false, reason: "unreachable" });
    expect(await mockedHub({ status: 503, body: { error: "x" } }).client.list({ accountId: "41" })).toMatchObject({ ok: false, reason: "unreachable", status: 503 });
  });

  it("keeps a refusal's status and code", async () => {
    const res = await mockedHub({ status: 409, body: { error: "x", code: "client_mapping_required" } }).client.create({ accountId: "41" }, createBody);
    expect(res).toEqual({ ok: false, reason: "refused", status: 409, code: "client_mapping_required" });
  });

  it("refuses an answer outside the contract", async () => {
    const res = await mockedHub({ status: 200, body: { contract: "de.hub.portal-tickets/v1", accountId: 41, generatedAt: "x", tickets: [{ id: 1 }] } }).client.list({ accountId: "41" });
    expect(res).toMatchObject({ ok: false, reason: "invalid" });
  });

  it("gets and replies on the account's ticket", async () => {
    const got = await mockedHub({ status: 200, body: { contract: "de.hub.portal-tickets/v1", ticket: hubTicket(), conversation: [{ id: 3, from: "de", authorName: "Tech", body: "On it", at: "2026-11-06T11:00:00.000Z" }] } })
      .client.get({ accountId: "41" }, 41);
    expect(got.ok && got.data.conversation[0].body).toBe("On it");
    const hub = mockedHub({ status: 201, body: { contract: "de.hub.portal-tickets/v1", ticketId: 41, entryId: 9, created: true } });
    const sent = await hub.client.reply({ accountId: "41" }, 41, { idempotencyKey: "reply-c1-abcdef", authorName: "Sam", authorEmail: "sam@example.com", body: "Still offline" });
    expect(sent.ok).toBe(true);
    expect(hub.calls[0].url).toBe("https://hub.example.test/api/webhooks/portal/tickets/41/replies?accountId=41");
    expectSignedAsSent(hub.calls[0]);
  });

  it("parses exactly the fixture's ticket and message fields", () => {
    expect(Object.keys(hubTicket()).sort()).toEqual([...fixture.reads.portalTickets.ticketFields].sort());
  });
});

describe("portal list with Hub tickets", () => {
  const ctx = { clientId: "client-1", companyName: "Alpha" };
  const localRow = (over: Record<string, unknown>) => ({
    id: "local-1",
    ticketNumber: "TKT-1",
    subject: "Local",
    description: "",
    status: "open",
    priority: "medium",
    category: "General",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
    clientId: "client-1",
    companyName: "Alpha",
    isInternal: false,
    zohoTicketId: null,
    hubTicketId: null,
    ...over,
  });

  it("shows a portal ticket once, with the Hub's live status, whether linked by Hub id or by its old Desk id", () => {
    const merged = mergePortalAndHubTickets(
      [localRow({ id: "a", hubTicketId: 41 }), localRow({ id: "b", zohoTicketId: "9001" })],
      [hubTicket({ id: 41, status: "pending_client" }), hubTicket({ id: 42, deskTicketId: "9001", status: "resolved" }), hubTicket({ id: 43, subject: "Phoned in" })],
      ctx,
    );
    expect(merged.map((t) => [t.id, t.status, t.source])).toEqual(
      expect.arrayContaining([
        ["a", "pending_client", "portal"],
        ["b", "resolved", "portal"],
        ["hub-43", "open", "hub"],
      ]),
    );
    expect(merged).toHaveLength(3);
    expect(JSON.stringify(merged)).not.toContain("hubTicketId");
  });

  it("lets a client see their own Hub tickets, and the Company IT Contact all of them", () => {
    const t = hubTicket({ requesterEmail: "Sam@Example.com" });
    expect(canSeeHubTicket({ email: "sam@example.com" }, t)).toBe(true);
    expect(canSeeHubTicket({ email: "other@example.com" }, t)).toBe(false);
    expect(canSeeHubTicket({ email: "other@example.com", orgRole: "company_it_contact" }, t)).toBe(true);
    expect(canSeeHubTicket(undefined, t)).toBe(false);
  });
});

describe("reconciliation notes", () => {
  it("stores the note and logs identifiers only", () => {
    const written: TicketReconciliationEntry[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const note = recordTicketReconciliation(
      {
        kind: "create",
        channel: "client_portal",
        hubReason: "unreachable",
        hubStatus: 503,
        hubCode: null,
        handedTo: "desk",
        reference: "TKT-1",
        portalClientId: "client-1",
        hubAccountId: "41",
        deskTicketId: "9001",
        requesterEmail: "sam@example.com",
        subject: "Printer offline",
        hubTicketId: null,
      },
      { write: (e) => (written.push(e), true), now: () => new Date("2026-11-06T12:00:00Z") },
    );
    expect(written[0].record).toEqual(note);
    expect(note.id).toMatch(/^rec-[a-z0-9]+-[a-f0-9]{8}$/);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("TKT-1");
    expect(logged).not.toContain("sam@example.com");
    expect(logged).not.toContain("Printer offline");
    warn.mockRestore();
  });

  it("never throws when the note cannot be stored", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      recordTicketReconciliation(
        { kind: "reply", channel: "client_portal", hubReason: "no_account", hubStatus: null, hubCode: null, handedTo: "portal_only", reference: null, portalClientId: null, hubAccountId: null, deskTicketId: null, requesterEmail: "", subject: null, hubTicketId: 1 },
        { write: () => { throw new Error("disk full"); }, now: () => new Date() },
      ),
    ).not.toThrow();
    warn.mockRestore();
  });
});
