import { describe, expect, it, vi } from "vitest";
import {
  canSeeDeskTicket,
  createDeskTicketSync,
  deskConversationsToComments,
  deskHtmlToText,
  mapDeskPriority,
  mapDeskStatus,
  mergePortalAndDeskTickets,
  normalizeCompanyName,
  parseDeskPortalTicketId,
  pickDeskAccount,
  ticketInScope,
  type DeskTicketApi,
} from "./portalDeskTickets";
import type { ZohoTicket } from "./zoho/zohoDesk";

function deskTicket(over: Partial<ZohoTicket> = {}): ZohoTicket {
  return {
    id: "9001",
    ticketNumber: "1234",
    subject: "Printer offline",
    description: "<p>Floor 2</p>",
    status: "Open",
    statusType: "Open",
    priority: "High",
    channel: "Email",
    contactId: "c1",
    accountId: "acc-alamo",
    email: "pat@alamo.example",
    departmentId: "d1",
    assigneeId: "",
    createdTime: "2026-10-01T10:00:00.000Z",
    modifiedTime: "2026-10-04T10:00:00.000Z",
    ...over,
  };
}

const alamo = { id: "client-alamo", companyName: "Alamo Industries", contactEmail: "it@alamo.example" };

function fakeApi(over: Partial<DeskTicketApi> = {}): DeskTicketApi {
  return {
    getContactByEmail: vi.fn(async () => null),
    searchAccountsByName: vi.fn(async () => [{ id: "acc-alamo", accountName: "Alamo Industries, Inc." }]),
    getTicketsByAccount: vi.fn(async () => [deskTicket()]),
    getAccountContacts: vi.fn(async () => []),
    getAllTicketsForContact: vi.fn(async () => []),
    ...over,
  };
}

describe("Desk status and priority mapping", () => {
  it("maps Desk statuses onto the portal filters", () => {
    expect(mapDeskStatus("Open", "Open")).toBe("open");
    expect(mapDeskStatus("Waiting on Customer", "On Hold")).toBe("pending_client");
    expect(mapDeskStatus("Awaiting client reply", "On Hold")).toBe("pending_client");
    expect(mapDeskStatus("In Progress", "Open")).toBe("in_progress");
    expect(mapDeskStatus("Escalated", "Open")).toBe("in_progress");
    expect(mapDeskStatus("On Hold", "On Hold")).toBe("in_progress");
    expect(mapDeskStatus("Resolved", "Closed")).toBe("resolved");
    expect(mapDeskStatus("Closed", "Closed")).toBe("closed");
    expect(mapDeskStatus("Something custom", "Closed")).toBe("closed");
  });

  it("maps priorities", () => {
    expect(mapDeskPriority("Urgent")).toBe("critical");
    expect(mapDeskPriority("High")).toBe("high");
    expect(mapDeskPriority("Low")).toBe("low");
    expect(mapDeskPriority(undefined)).toBe("medium");
  });
});

describe("company → Desk account matching", () => {
  it("normalizes legal suffixes and punctuation", () => {
    expect(normalizeCompanyName("Alamo Industries, Inc.")).toBe("alamo industries");
    expect(normalizeCompanyName("ALAMO INDUSTRIES LLC")).toBe("alamo industries");
    expect(normalizeCompanyName("Smith & Sons Co")).toBe("smith and sons");
  });

  it("only accepts a single exact match", () => {
    expect(pickDeskAccount("Alamo Industries", [{ id: "a", accountName: "Alamo Industries Inc" }])?.id).toBe("a");
    // A different company that merely contains the name must not match.
    expect(pickDeskAccount("Alamo", [{ id: "a", accountName: "Alamo Industries" }])).toBeNull();
    // Two accounts with the same name: ambiguous, show nothing.
    expect(
      pickDeskAccount("Alamo Industries", [
        { id: "a", accountName: "Alamo Industries" },
        { id: "b", accountName: "Alamo Industries LLC" },
      ]),
    ).toBeNull();
  });
});

describe("createDeskTicketSync", () => {
  it("prefers the company contact's Desk account over a name search", async () => {
    const api = fakeApi({
      getContactByEmail: vi.fn(async () => ({ id: "c", firstName: "", lastName: "", email: "it@alamo.example", phone: "", accountId: "acc-from-contact" })),
    });
    const sync = createDeskTicketSync({ api, isConfigured: () => true });
    const result = await sync.getTicketsForClient(alamo);
    expect(result.accountId).toBe("acc-from-contact");
    expect(api.searchAccountsByName).not.toHaveBeenCalled();
    expect(api.getTicketsByAccount).toHaveBeenCalledWith("acc-from-contact");
  });

  it("serves from cache inside the TTL and re-reads after it", async () => {
    let t = 0;
    const api = fakeApi();
    const sync = createDeskTicketSync({ api, isConfigured: () => true, now: () => t, ticketTtlMs: 60_000 });
    await sync.getTicketsForClient(alamo);
    t = 30_000;
    await sync.getTicketsForClient(alamo);
    expect(api.getTicketsByAccount).toHaveBeenCalledTimes(1);
    t = 61_000;
    await sync.getTicketsForClient(alamo);
    expect(api.getTicketsByAccount).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good list when Desk fails", async () => {
    let fail = false;
    let t = 0;
    const api = fakeApi({
      getTicketsByAccount: vi.fn(async () => {
        if (fail) throw new Error("401");
        return [deskTicket()];
      }),
    });
    const sync = createDeskTicketSync({ api, isConfigured: () => true, now: () => t, ticketTtlMs: 1 });
    await sync.getTicketsForClient(alamo);
    fail = true;
    t = 10;
    const result = await sync.getTicketsForClient(alamo);
    expect(result.error).toBeTruthy();
    expect(result.tickets).toHaveLength(1);
    expect(result.syncedAt).toBe(0);
  });

  it("finds tickets through the company's own contacts when Desk has no account (Alamo's real shape)", async () => {
    // Alamo in production: no Desk account, contacts with no account, and
    // every ticket carrying accountId null.
    const contacts: Record<string, { id: string; email: string }> = {
      "suzette.alamo@gmail.com": { id: "c-suz", email: "suzette.alamo@gmail.com" },
      "indy.alamo@gmail.com": { id: "c-norma", email: "indy.alamo@gmail.com" },
    };
    const api = fakeApi({
      searchAccountsByName: vi.fn(async () => []),
      getContactByEmail: vi.fn(async (email: string) => {
        const c = contacts[email];
        return c ? { ...c, firstName: "", lastName: "", phone: "", accountId: undefined } : null;
      }),
      getAllTicketsForContact: vi.fn(async (contactId: string) =>
        contactId === "c-suz"
          ? [deskTicket({ id: "117", accountId: undefined, contactId: "c-suz", modifiedTime: "2026-05-19T00:00:00Z" })]
          : [deskTicket({ id: "129", accountId: undefined, contactId: "c-norma", modifiedTime: "2026-09-23T00:00:00Z" })],
      ),
    });
    const sync = createDeskTicketSync({ api, isConfigured: () => true });
    const result = await sync.getTicketsForClient({
      ...alamo,
      contactEmail: null,
      memberEmails: ["Suzette.Alamo@gmail.com", "indy.alamo@gmail.com", "nobody@alamo.example"],
    });
    expect(result.linked).toBe(true);
    expect(result.accountId).toBeNull();
    expect(result.tickets.map((t) => t.id)).toEqual(["129", "117"]);
    expect(api.getTicketsByAccount).not.toHaveBeenCalled();
  });

  it("ignores a loose Desk search hit whose email is not exactly the company's", async () => {
    const api = fakeApi({
      searchAccountsByName: vi.fn(async () => []),
      getContactByEmail: vi.fn(async () => ({ id: "c-other", firstName: "", lastName: "", email: "it@alamo.example.org", phone: "" })),
    });
    const sync = createDeskTicketSync({ api, isConfigured: () => true });
    const result = await sync.getTicketsForClient(alamo);
    expect(result.linked).toBe(false);
    expect(api.getAllTicketsForContact).not.toHaveBeenCalled();
  });

  it("merges account tickets with tickets from the account's contacts, once each", async () => {
    const api = fakeApi({
      getAccountContacts: vi.fn(async () => [{ id: "c1", firstName: "", lastName: "", email: "pat@alamo.example", phone: "" }]),
      getAllTicketsForContact: vi.fn(async () => [deskTicket(), deskTicket({ id: "9002", accountId: undefined })]),
    });
    const sync = createDeskTicketSync({ api, isConfigured: () => true });
    const result = await sync.getTicketsForClient(alamo);
    expect(result.tickets.map((t) => t.id).sort()).toEqual(["9001", "9002"]);
    expect(result.scope.contactIds).toEqual(["c1"]);
  });

  it("returns nothing when no account matches", async () => {
    const api = fakeApi({ searchAccountsByName: vi.fn(async () => [{ id: "x", accountName: "Other Co" }]) });
    const sync = createDeskTicketSync({ api, isConfigured: () => true });
    const result = await sync.getTicketsForClient(alamo);
    expect(result.accountId).toBeNull();
    expect(result.linked).toBe(false);
    expect(result.tickets).toEqual([]);
    expect(api.getTicketsByAccount).not.toHaveBeenCalled();
  });

  it("does nothing when Zoho is not configured", async () => {
    const api = fakeApi();
    const sync = createDeskTicketSync({ api, isConfigured: () => false });
    const result = await sync.getTicketsForClient(alamo);
    expect(result.tickets).toEqual([]);
    expect(api.getTicketsByAccount).not.toHaveBeenCalled();
  });

  it("background refresh re-reads viewed companies and drops stale ones", async () => {
    let t = 0;
    const api = fakeApi();
    const sync = createDeskTicketSync({ api, isConfigured: () => true, now: () => t, watchWindowMs: 1000 });
    await sync.getTicketsForClient(alamo);
    t = 500;
    expect(await sync.refreshWatched()).toEqual({ refreshed: 1, failed: 0, dropped: 0 });
    expect(api.getTicketsByAccount).toHaveBeenCalledTimes(2);
    t = 2000;
    expect(await sync.refreshWatched()).toEqual({ refreshed: 0, failed: 0, dropped: 1 });
    expect(sync.watchedCount()).toBe(0);
  });

  it("dedupes concurrent reads for the same company", async () => {
    const api = fakeApi();
    const sync = createDeskTicketSync({ api, isConfigured: () => true });
    await Promise.all([sync.getTicketsForClient(alamo), sync.getTicketsForClient(alamo)]);
    expect(api.getTicketsByAccount).toHaveBeenCalledTimes(1);
  });
});

describe("mergePortalAndDeskTickets", () => {
  const ctx = { clientId: "client-alamo", companyName: "Alamo Industries" };
  const localTicket = {
    id: "local-1",
    ticketNumber: "TKT-1",
    subject: "VPN",
    description: "",
    status: "open",
    priority: "medium",
    category: "General",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    clientId: "client-alamo",
    companyName: "Alamo Industries",
    isInternal: false,
  };

  it("shows a portal ticket once, with Desk's live status", () => {
    const merged = mergePortalAndDeskTickets(
      [{ ...localTicket, zohoTicketId: "9001" }],
      [deskTicket({ status: "Waiting on Customer" })],
      ctx,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("local-1");
    expect(merged[0].status).toBe("pending_client");
  });

  it("adds Desk-only tickets, newest first", () => {
    const merged = mergePortalAndDeskTickets([{ ...localTicket, zohoTicketId: null }], [deskTicket()], ctx);
    expect(merged.map((t) => t.id)).toEqual(["desk-9001", "local-1"]);
    expect(merged[0].ticketNumber).toBe("#1234");
    expect(merged[0].priority).toBe("high");
  });
});

describe("access and rendering helpers", () => {
  it("parses only desk-<digits> ids", () => {
    expect(parseDeskPortalTicketId("desk-123")).toBe("123");
    expect(parseDeskPortalTicketId("desk-../x")).toBeNull();
    expect(parseDeskPortalTicketId("abc")).toBeNull();
  });

  it("lets a client see their own Desk tickets, IT contacts see all", () => {
    const t = { email: "Pat@Alamo.example" };
    expect(canSeeDeskTicket({ email: "pat@alamo.example" }, t)).toBe(true);
    expect(canSeeDeskTicket({ email: "sam@alamo.example" }, t)).toBe(false);
    expect(canSeeDeskTicket({ email: "sam@alamo.example", isCompanyItContact: true }, t)).toBe(true);
    expect(canSeeDeskTicket(undefined, t)).toBe(false);
  });

  it("matches the raising contact when Desk left the ticket email empty", () => {
    const scope = { contactIdsByEmail: { "suzette.alamo@gmail.com": "c-suz" } };
    const t = { email: undefined, contactId: "c-suz" };
    expect(canSeeDeskTicket({ email: "suzette.alamo@gmail.com" }, t, scope)).toBe(true);
    expect(canSeeDeskTicket({ email: "indy.alamo@gmail.com" }, t, scope)).toBe(false);
  });

  it("keeps single-ticket reads inside the company's Desk scope", () => {
    const scope = { accountId: null, contactIds: ["c-suz"], contactIdsByEmail: {} };
    expect(ticketInScope({ accountId: undefined, contactId: "c-suz" }, scope)).toBe(true);
    expect(ticketInScope({ accountId: undefined, contactId: "c-stranger" }, scope)).toBe(false);
    // No account in scope must never match a ticket that also has none.
    expect(ticketInScope({ accountId: undefined, contactId: "" }, scope)).toBe(false);
    expect(ticketInScope({ accountId: "acc-1", contactId: "x" }, { ...scope, accountId: "acc-1" })).toBe(true);
  });

  it("strips Desk HTML", () => {
    expect(deskHtmlToText("<div>Hi&nbsp;there<br>line 2</div><p>a &amp; b</p>")).toBe("Hi there\nline 2\na & b");
  });

  it("hides private Desk comments from clients", () => {
    const conversations = [
      { id: "1", type: "thread", summary: "Help please", direction: "in", visibility: "public", createdTime: "2026-10-01T00:00:00Z", author: { name: "Pat", email: "pat@alamo.example" } },
      { id: "2", type: "comment", content: "internal note", isPublic: false, commentedTime: "2026-10-02T00:00:00Z", commenter: { name: "Eng", type: "AGENT" } },
      { id: "3", type: "thread", summary: "On it", direction: "out", visibility: "public", createdTime: "2026-10-03T00:00:00Z", author: { name: "Eng" } },
    ];
    const client = deskConversationsToComments(conversations, { isAdmin: false, viewerEmail: "pat@alamo.example" });
    expect(client.map((c) => [c.author, c.content])).toEqual([
      ["You", "Help please"],
      ["Support", "On it"],
    ]);
    const admin = deskConversationsToComments(conversations, { isAdmin: true });
    expect(admin).toHaveLength(3);
    expect(admin[1].isInternal).toBe(true);
  });
});
