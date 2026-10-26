import { describe, expect, it, vi } from "vitest";

// The page module pulls in UI and hooks; the verdict logic under test is pure.
vi.mock("./PortalLayout", () => ({ PortalLayout: () => null, portalFirstName: () => "" }));

import { buildVerdict, figure, type DashboardStats } from "./PortalDashboard";

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
        waitingOnClient: undefined,
        openTickets: 1,
        recentTickets: [{ id: "1", subject: "x", status: "pending vendor" }],
      }),
      false,
    );
    expect(v.title).toMatch(/with DE engineers/);
  });

  it("uses the server's waitingOnClient count over all tickets, not the 5 recent ones", () => {
    const v = buildVerdict(stats({ waitingOnClient: 7, recentTickets: [] }), false);
    expect(v.title).toBe("7 items are waiting on you.");
    expect(v.href).toBe("/portal/tickets?status=pending_client");
  });

  it("falls back to the exact pending_client status for older servers", () => {
    const v = buildVerdict(
      stats({ waitingOnClient: undefined, recentTickets: [{ id: "1", subject: "x", status: "pending_client" }] }),
      false,
    );
    expect(v.title).toBe("1 item is waiting on you.");
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
