import { describe, expect, it, vi } from "vitest";

// The page module pulls in UI and hooks; the verdict logic under test is pure.
vi.mock("./PortalLayout", () => ({ PortalLayout: () => null, portalFirstName: () => "" }));

import { buildVerdict, figure, renderableRows, text, type DashboardStats } from "./PortalDashboard";

function stats(over: Partial<DashboardStats> = {}): DashboardStats {
  return {
    openTickets: 0,
    resolvedTickets: 0,
    waitingOnClient: 0,
    activeServices: 2,
    pendingInvoices: 0,
    recentTickets: [],
    services: [],
    zohoConnected: true,
    ...over,
  };
}

describe("buildVerdict (W1 dashboard truth)", () => {
  it("does not treat a status that merely contains 'pending' as waiting on the client", () => {
    const v = buildVerdict(
      stats({
        waitingOnClient: 0,
        openTickets: 1,
        recentTickets: [{ id: "1", subject: "x", status: "pending vendor" }],
      }),
      false,
    );
    expect(v.title).toMatch(/with DE engineers/);
    expect(v.title).not.toMatch(/waiting on you/);
  });

  it("uses the server's waitingOnClient count over all tickets, not the 5 recent ones", () => {
    const v = buildVerdict(stats({ waitingOnClient: 7, recentTickets: [] }), false);
    expect(v.title).toBe("7 items are waiting on you.");
    expect(v.href).toBe("/portal/tickets?status=pending_client");
  });

  it("never derives a total from the recent-ticket sample", () => {
    const v = buildVerdict(
      stats({ waitingOnClient: undefined, recentTickets: [{ id: "1", subject: "x", status: "resolved" }] }),
      false,
    );
    expect(v.title).toBe("We couldn't confirm your ticket status.");
    expect(v.tone).not.toBe("ok");
  });

  it("unknown ticket counts never read as an all-clear", () => {
    const v = buildVerdict(stats({ openTickets: null, resolvedTickets: null, waitingOnClient: null }), false);
    expect(v.title).toBe("We couldn't confirm your ticket status.");
    expect(v.href).toBe("/portal/tickets");
  });

  it("known invoices still surface when ticket status is unknown", () => {
    const v = buildVerdict(stats({ waitingOnClient: null, openTickets: null, pendingInvoices: 1 }), false);
    expect(v.title).toBe("1 item is waiting on you.");
    expect(v.detail).toMatch(/Ticket status couldn't be confirmed/);
  });

  it("names unlinked billing instead of calling it an outage", () => {
    const v = buildVerdict(stats({ pendingInvoices: null, activeServices: null, billingStatus: "not_linked" }), false);
    expect(v.detail).toMatch(/Billing isn't linked/);
  });

  it("never claims nothing is pending when billing could not be read", () => {
    const v = buildVerdict(stats({ pendingInvoices: null }), false);
    expect(v.title).toBe("No tickets are waiting on you.");
    expect(v.detail).toMatch(/Billing figures aren't available/);
    expect(v.detail).not.toMatch(/no pending invoices/i);
  });

  it("makes no monitoring claim", () => {
    const v = buildVerdict(stats(), false);
    expect(v.tone).toBe("ok");
    expect(v.detail).not.toMatch(/watching/i);
  });

  it("reports pending invoices when billing is known", () => {
    const v = buildVerdict(stats({ pendingInvoices: 2 }), false);
    expect(v.title).toBe("2 items are waiting on you.");
    expect(v.href).toBe("/portal/invoices");
  });

  it("shows the error verdict on load failure", () => {
    expect(buildVerdict(undefined, true).title).toMatch(/couldn't load/);
  });
});

describe("renderableRows: null or malformed rows never crash the page", () => {
  it("drops null, primitives and rows without a string id", () => {
    expect(renderableRows([null, 1, "x", { id: 3 }, { id: "ok", subject: "s" }, undefined])).toEqual([{ id: "ok", subject: "s" }]);
  });
  it("treats a non-array as empty", () => {
    expect(renderableRows(null)).toEqual([]);
    expect(renderableRows({ id: "x" })).toEqual([]);
  });
});

describe("text: only plain strings reach React", () => {
  it("falls back for objects, numbers, null and blank strings", () => {
    expect(text({ en: "Managed" }, "Subscription")).toBe("Subscription");
    expect(text(5, "x")).toBe("x");
    expect(text(null, "x")).toBe("x");
    expect(text("  ", "x")).toBe("x");
    expect(text("Backup", "x")).toBe("Backup");
  });
});

describe("figure: unknown is not zero", () => {
  it("returns a dash for null, undefined and errors", () => {
    expect(figure(null, false)).toBe("—");
    expect(figure(undefined, false)).toBe("—");
    expect(figure(3, true)).toBe("—");
  });
  it("keeps a real zero", () => {
    expect(figure(0, false)).toBe(0);
  });
});
