import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { averageResolutionHours, buildCompanyMetrics } from "./adminCompanyMetrics";

const company = { id: "c1", companyName: "Acme", status: "active", createdAt: "2026-01-01T00:00:00Z" };

describe("admin company metrics tell the truth (#234)", () => {
  it("never invents service, billing or tier figures", () => {
    const m = buildCompanyMetrics({ company, tickets: [], users: [], files: [] });
    expect(m.services).toEqual({ activeServices: null, monthlyValue: null, tier: null });
    expect(m.billing).toEqual({ pendingInvoices: null, totalOwed: null, lastPayment: null });
    expect(m.sources.services).toBe("not_connected");
    expect(m.sources.billing).toBe("not_connected");
    expect(m.activity.lastLogin).toBeNull();
    expect(m.tickets.avgResolutionHours).toBeNull();
  });

  it("computes average resolution from real resolved tickets only", () => {
    const tickets = [
      { status: "resolved", createdAt: "2026-10-01T00:00:00Z", resolvedAt: "2026-10-01T02:00:00Z" },
      { status: "resolved", createdAt: "2026-10-02T00:00:00Z", resolvedAt: "2026-10-02T04:00:00Z" },
      { status: "open", createdAt: "2026-10-03T00:00:00Z", resolvedAt: null },
    ];
    expect(averageResolutionHours(tickets)).toBe(3);
    const m = buildCompanyMetrics({ company, tickets, users: [], files: [], now: new Date("2026-10-15T00:00:00Z") });
    expect(m.tickets).toMatchObject({ total: 3, open: 1, resolved: 2, avgResolutionHours: 3 });
    expect(m.activity.ticketsThisMonth).toBe(3);
  });

  it("last login is the most recent real login among the company's users", () => {
    const m = buildCompanyMetrics({
      company,
      tickets: [],
      users: [
        { isActive: true, role: "user", lastLogin: "2026-09-01T00:00:00Z" },
        { isActive: false, role: "admin", lastLogin: "2026-09-20T12:00:00Z" },
        { isActive: true, role: "user", lastLogin: null },
      ],
      files: [{ category: "agents", createdAt: "2026-10-02T00:00:00Z" }],
      now: new Date("2026-10-15T00:00:00Z"),
    });
    expect(m.activity.lastLogin).toBe("2026-09-20T12:00:00.000Z");
    expect(m.users).toEqual({ total: 3, activeUsers: 2, admins: 1 });
    expect(m.files).toMatchObject({ total: 1, agents: 1 });
  });

  it("the production route handlers carry no hard-coded customer operational values", () => {
    const src = readFileSync(new URL("./routes.ts", import.meta.url), "utf8");
    for (const fabricated of ['"4.2 hours"', '"$1,250.00"', '"$450.00"', '"2024-12-15"', 'tier: "Business"', "DESKTOP-01", "Q4 Security Update"]) {
      expect(src, fabricated).not.toContain(fabricated);
    }
  });
});
