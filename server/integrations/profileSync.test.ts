import { describe, expect, it } from "vitest";
import { createDeSyncEnvelope } from "./deSyncContract";
import { buildPortalProfileCommand } from "./profileSync";
import { getHubProjection, handleHubEvents, resetHubProjections } from "./hubEvents";
import { resetDeSyncMemory } from "./deSyncStore";
import { resetInboxLifecycleMemory } from "./deSyncInboxLifecycle";
import type { Request, Response } from "express";

function mockRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: unknown };
}

describe("portal profile command", () => {
  const base = {
    hubAccountId: "12",
    portalClientId: "client-1",
    actorUserId: "user-1",
  };

  it("sends only the company name and the session account ids", () => {
    const command = buildPortalProfileCommand({
      ...base,
      payload: { companyName: "Acme Dental Group", canonicalAccountId: "12" },
    });
    expect(command).toEqual({
      ok: true,
      canonicalAccountId: "12",
      payload: {
        name: "Acme Dental Group",
        portalClientId: "client-1",
        actorUserId: "user-1",
      },
    });
  });

  it("rejects vendor, lifecycle, and login email fields", () => {
    const command = buildPortalProfileCommand({
      ...base,
      payload: { name: "Acme", email: "new@acme.example", margin: 10, accountLifecycleStatus: "At Risk" },
    });
    expect(command).toMatchObject({ ok: false, status: 400, code: "profile_field_rejected" });
  });

  it("rejects a forged account id and a mismatched portal client id", () => {
    expect(
      buildPortalProfileCommand({ ...base, payload: { name: "Acme", accountId: "99" } }),
    ).toMatchObject({ ok: false, code: "identity_conflict" });
    expect(
      buildPortalProfileCommand({ ...base, payload: { name: "Acme", portalClientId: "client-2" } }),
    ).toMatchObject({ ok: false, code: "identity_conflict" });
  });

  it("requires a mapped Hub account", () => {
    expect(
      buildPortalProfileCommand({ ...base, hubAccountId: null, payload: { name: "Acme" } }),
    ).toMatchObject({ ok: false, status: 409, code: "account_mapping_required" });
  });
});

describe("hub account.updated projection", () => {
  it("stores the company name and drops nested internal fields", async () => {
    resetDeSyncMemory();
    resetInboxLifecycleMemory();
    resetHubProjections();
    delete process.env.DATABASE_URL;
    const envelope = createDeSyncEnvelope({
      eventType: "account.updated",
      source: "techsales",
      entityType: "account",
      entityId: "12",
      canonicalAccountId: "12",
      payload: {
        name: "Acme Dental Group",
        portalClientId: "client-1",
        accountLifecycleStatus: "At Risk",
        vendorName: "Veeam",
        items: [{ name: "Support", sku: "SKU-1", unitCost: 4 }],
      },
    });
    const res = mockRes();
    await handleHubEvents(
      { method: "POST", body: envelope, get: () => "" } as unknown as Request,
      res,
    );
    expect(res.statusCode).toBe(200);
    expect(await getHubProjection("account", "12")).toEqual({
      name: "Acme Dental Group",
      portalClientId: "client-1",
      eventType: "account.updated",
      updatedAt: envelope.occurredAt,
      items: [{ name: "Support" }],
    });
  });
});
