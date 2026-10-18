import { describe, expect, it } from "vitest";
import { validatePortalOrderSelection } from "@shared/portalOrderCatalog";
import {
  TENANT_JOIN_HOLES,
  assertLiveRecordScope,
  assertPortalActor,
  assertPortalCommandAllowed,
  assertSameTenant,
  joinTenantIdentity,
} from "./tenantIdentity";
import { validateZohoAgentPayload } from "./zohoAgentsReadiness";

const acme = {
  portalClientId: "client-acme",
  hubAccountId: "12",
  zohoAccountId: "z-acc-12",
};

const bravo = {
  portalClientId: "client-bravo",
  hubAccountId: "99",
  zohoAccountId: "z-acc-99",
};

describe("tenant identity join", () => {
  it("joins portal client, Hub account, and Zoho account on the same org", () => {
    const ids = joinTenantIdentity({
      client: { id: "client-acme", hubAccountId: "12", zohoAccountId: "z-acc-12" },
      actor: { clientId: "client-acme", role: "user", isActive: true },
    });
    expect(ids).toMatchObject(acme);
  });

  it("documents a hole at every maturity stage", () => {
    expect(TENANT_JOIN_HOLES.map((h) => h.stage)).toEqual([
      "prospect",
      "quoted",
      "onboarded",
      "active",
      "comanaged",
    ]);
  });
});

describe("cross-tenant fail-closed", () => {
  it("blocks Hub company A from seeing website portal company B", () => {
    const gate = assertSameTenant(acme, bravo);
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.status).toBe(403);
    expect(gate.code).toBe("tenant_mismatch");
  });

  it("blocks when ids are different kinds with no shared join", () => {
    const gate = assertSameTenant(
      { portalClientId: "client-acme" },
      { hubAccountId: "99", zohoAccountId: "z-acc-99" },
    );
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.code).toBe("tenant_unjoined");
  });

  it("allows a shared hubAccountId even if Zoho id is still missing on one side", () => {
    const gate = assertSameTenant(
      { portalClientId: "client-acme", hubAccountId: "12" },
      { hubAccountId: "12" },
    );
    expect(gate.ok).toBe(true);
  });

  it("blocks order/ticket fetch scoped to another live tenant (IDOR)", () => {
    const gate = assertLiveRecordScope({
      actor: acme,
      record: { clientId: "client-bravo", userId: "user-b" },
      actorUserId: "user-a",
    });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.code).toBe("idor");
  });

  it("allows the owning tenant to read its own order", () => {
    const gate = assertLiveRecordScope({
      actor: acme,
      record: { clientId: "client-acme", userId: "user-a" },
      actorUserId: "user-a",
    });
    expect(gate.ok).toBe(true);
  });
});

describe("disabled user and role downgrade", () => {
  it("rejects a disabled portal user", () => {
    const gate = assertPortalActor({ id: "u1", role: "user", isActive: false, clientId: "client-acme" });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.code).toBe("disabled_user");
  });

  it("rejects a viewer submitting a mutating command", () => {
    const gate = assertPortalCommandAllowed({
      actor: { id: "u1", role: "viewer", isActive: true, clientId: "client-acme" },
      client: { id: "client-acme", hubAccountId: "12" },
      eventType: "service.change_requested",
      payload: { canonicalAccountId: "12" },
    });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.code).toBe("role_downgrade");
  });

  it("rejects a command that claims another tenant's Hub account", () => {
    const gate = assertPortalCommandAllowed({
      actor: { id: "u1", role: "user", isActive: true, clientId: "client-acme" },
      client: { id: "client-acme", hubAccountId: "12" },
      eventType: "service.change_requested",
      payload: { canonicalAccountId: "99", portalClientId: "client-bravo" },
    });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.status).toBe(403);
  });

  it("refuses Hub-mapped commands while the prospect is still unmapped", () => {
    const gate = assertPortalCommandAllowed({
      actor: { id: "u1", role: "user", isActive: true, clientId: "client-acme", storeRole: "prospect" },
      client: { id: "client-acme", serviceType: "prospect", hubAccountId: null },
      eventType: "service.change_requested",
      payload: {},
    });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.code).toBe("unmapped_tenant");
  });

  it("allows a prospect to request a quote before Hub mapping exists", () => {
    const gate = assertPortalCommandAllowed({
      actor: { id: "u1", role: "user", isActive: true, clientId: "client-acme", storeRole: "prospect" },
      client: { id: "client-acme", serviceType: "prospect" },
      eventType: "quote.requested",
      payload: { portalClientId: "client-acme" },
    });
    expect(gate.ok).toBe(true);
  });
});

describe("order-form exclusivity is not regressed", () => {
  it("still rejects stacked exclusive ProActive packages", () => {
    const result = validatePortalOrderSelection([
      { serviceId: "proactive-it", quantity: 1 },
      { serviceId: "proactive-business", quantity: 1 },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("exclusive_conflict");
  });

  it("still rejects an unknown SKU", () => {
    const result = validatePortalOrderSelection([{ sku: "FAKE-SKU-999", quantity: 1 }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("unknown_sku");
  });
});

describe("Zoho agents readiness", () => {
  it("rejects agent events with no tenant id", () => {
    const gate = validateZohoAgentPayload({ event: "agent.response", message: "done" });
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.code).toBe("missing_tenant");
  });

  it("accepts agent.response when Hub and Zoho account ids are consistent", () => {
    const gate = validateZohoAgentPayload({
      event: "agent.response",
      message: "note added",
      hubAccountId: "12",
      zohoAccountId: "z-acc-12",
      portalClientId: "client-acme",
    });
    expect(gate.ok).toBe(true);
    if (!gate.ok) return;
    expect(gate.tenant).toEqual({
      portalClientId: "client-acme",
      hubAccountId: "12",
      zohoAccountId: "z-acc-12",
      zohoContactId: null,
      zohoDeskAccountId: null,
      zohoBooksCustomerId: null,
    });
  });
});
