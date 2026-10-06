import { describe, expect, it } from "vitest";
import { buildProvisioningSummary, orderProvisioningState, provisioningIsLive, type LifecycleRun } from "./provisioning";

const run = (over: Partial<LifecycleRun> = {}): LifecycleRun => ({
  action: "onboard",
  email: "pat@acme.test",
  jumpcloud: { success: true, message: "JumpCloud user created" },
  blackpoint: { success: true, message: "Tenant contact added" },
  createdAt: "2026-10-06T10:00:00.000Z",
  ...over,
});

describe("provisioning summary", () => {
  it("is not_started with no recorded run", () => {
    const s = buildProvisioningSummary({ email: "pat@acme.test" });
    expect(s.overall).toBe("not_started");
    expect(s.steps.map((x) => x.state)).toEqual(["not_started", "not_started"]);
    expect(s.lastRunAt).toBeNull();
  });

  it("succeeds when both integrations succeeded", () => {
    const s = buildProvisioningSummary({ email: "pat@acme.test", latestRun: run() });
    expect(s.overall).toBe("succeeded");
    expect(s.steps[0].detail).toBe("JumpCloud user created");
  });

  it("fails when one integration hard-failed, and keeps its message", () => {
    const s = buildProvisioningSummary({
      email: "pat@acme.test",
      latestRun: run({ blackpoint: { success: false, message: "Tenant not found" } }),
    });
    expect(s.overall).toBe("failed");
    expect(s.steps[1]).toMatchObject({ state: "failed", detail: "Tenant not found" });
  });

  it("marks an unconfigured integration skipped, never succeeded", () => {
    const s = buildProvisioningSummary({
      email: "pat@acme.test",
      latestRun: run({ blackpoint: { success: false, message: "BLACKPOINT_API_KEY not configured" } }),
    });
    expect(s.steps[1].state).toBe("skipped");
    expect(s.overall).toBe("succeeded");
  });

  it("reports offboarded when the latest run was an offboard", () => {
    const s = buildProvisioningSummary({ email: "pat@acme.test", latestRun: run({ action: "offboard" }) });
    expect(s.overall).toBe("offboarded");
    expect(s.steps[0].label).toMatch(/removed/);
  });

  it("adds store orders only on the user's own profile", () => {
    const orders = [
      { id: "o1", orderNumber: "ORD-1", status: "provisioning", createdAt: "2026-10-05T00:00:00Z" },
      { id: "o2", orderNumber: "ORD-2", status: "quote_requested", createdAt: "2026-10-04T00:00:00Z" },
    ];
    expect(buildProvisioningSummary({ email: "pat@acme.test", latestRun: run(), orders }).steps).toHaveLength(2);
    const own = buildProvisioningSummary({ email: "pat@acme.test", latestRun: run(), orders, includeOrders: true });
    expect(own.orders.map((o) => o.orderNumber)).toEqual(["ORD-1"]);
    expect(own.steps[2]).toMatchObject({ key: "orders", state: "in_progress" });
    expect(own.overall).toBe("in_progress");
    expect(provisioningIsLive(own)).toBe(true);
  });

  it("keeps the account headline when only finished orders exist", () => {
    const s = buildProvisioningSummary({
      email: "pat@acme.test",
      orders: [{ id: "o1", orderNumber: "ORD-1", status: "completed" }],
      includeOrders: true,
    });
    expect(s.overall).toBe("not_started");
    expect(provisioningIsLive(s)).toBe(false);
  });

  it("maps order statuses", () => {
    expect(orderProvisioningState("paid")).toBe("in_progress");
    expect(orderProvisioningState("completed")).toBe("succeeded");
    expect(orderProvisioningState("refunded")).toBeNull();
    expect(orderProvisioningState("pending")).toBeNull();
  });
});
