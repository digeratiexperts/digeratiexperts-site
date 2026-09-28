import express from "express";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { registerPublicSolutionRoutes } from "./publicSolutionRoutes";
import { resetPublicSolutionRequestsForTests } from "./publicSolutionRequestStore";
import { eventBus, EventTypes } from "./eventBus";
import { syncPublicSolutionRequestToCrm } from "./publicSolutionRequestCrm";

vi.mock("./publicSolutionRequestCrm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./publicSolutionRequestCrm")>();
  return {
    ...actual,
    syncPublicSolutionRequestToCrm: vi.fn(async () => "pending"),
  };
});

const prohibited = [
  "coro",
  "ninjaone",
  "blackpoint",
  "hudu",
  "pax8",
  "sku",
  "margin",
  "distributor",
];

describe("public solution Door 2 API", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    registerPublicSolutionRoutes(app);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No test port");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  beforeEach(() => {
    resetPublicSolutionRequestsForTests();
  });

  it("returns 13 public families with package policy and without private fields", async () => {
    const response = await fetch(`${baseUrl}/api/public/solutions/families`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.families).toHaveLength(13);
    for (const family of body.families) {
      expect(family.offers.map((offer: { deliveryModel: string }) => offer.deliveryModel).sort()).toEqual([
        "co_managed",
        "standalone",
      ]);
      expect(family.offers.every((offer: { package?: unknown }) => !!offer.package)).toBe(true);
    }
    const raw = JSON.stringify(body).toLowerCase();
    for (const term of prohibited) expect(raw).not.toContain(term);
  });

  it("returns a generic 404 for an unknown family", async () => {
    const response = await fetch(`${baseUrl}/api/public/solutions/families/not-a-family`);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: "Not found" });
    expect(JSON.stringify(body).toLowerCase()).not.toContain("sku");
  });

  it("saves a profile, package selection, and fulfillment without contact or lead submission", async () => {
    const response = await fetch(`${baseUrl}/api/public/solutions/request`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedNeeds: [{ familyId: "identity_access", offerId: "de-identity-standalone", deliveryModel: "standalone" }],
        deliveryPreference: "standalone",
        environment: {
          userCount: "25",
          workstationCount: "32",
          mobileDeviceCount: "18",
          siteCount: "2",
          deviceOwnership: "hybrid",
          internalIt: "no",
        },
        fulfillment: { installation: "remote_assist", remoteSupport: "as_needed" },
        intent: "quote",
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.request.status).toBe("draft");
    expect(body.request.contactEmail).toBe("");
    expect(body.request.environment.workstationCount).toBe("32");
    expect(body.request.environment.mobileDeviceCount).toBe("18");
    expect(body.request.fulfillment).toEqual({ installation: "remote_assist", remoteSupport: "as_needed" });
  });

  it("lets a guest submit several families as one composed solution", async () => {
    const response = await fetch(`${baseUrl}/api/public/solutions/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedNeeds: [
          { familyId: "identity_access", offerId: "de-identity-co-managed", deliveryModel: "co_managed" },
          { familyId: "backup_continuity", offerId: "de-continuity-co-managed", deliveryModel: "co_managed" },
          { familyId: "email_collaboration", offerId: "de-collaboration-co-managed", deliveryModel: "co_managed" },
        ],
        deliveryPreference: "co_managed",
        intent: "quote",
        contactName: "Jordan Buyer",
        contactEmail: "jordan@example.com",
        contactPhone: "480-555-0100",
        organizationName: "Example Medical",
        environment: {
          userCount: "42",
          workstationCount: "48",
          mobileDeviceCount: "20",
          siteCount: "2",
          deviceOwnership: "hybrid",
          internalIt: "yes",
        },
        fulfillment: { installation: "remote_assist", remoteSupport: "ongoing" },
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.request.status).toBe("submitted");
    expect(body.request.selectedNeeds).toHaveLength(3);
    expect(body.request.selectedNeeds.map((need: { familyId: string }) => need.familyId)).toEqual([
      "identity_access",
      "backup_continuity",
      "email_collaboration",
    ]);
    expect(body.request.environment.userCount).toBe("42");
    expect(body.request.environment.workstationCount).toBe("48");
    expect(body.request.fulfillment.remoteSupport).toBe("ongoing");
    expect(body.message).toContain("saved");
    expect(JSON.stringify(body).toLowerCase()).not.toContain("sku");
  });

  it("lets a guest submit without portal login when all four contact fields are present", async () => {
    const response = await fetch(`${baseUrl}/api/public/solutions/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyId: "identity_access",
        offerId: "de-identity-standalone",
        deliveryModel: "standalone",
        deliveryPreference: "standalone",
        intent: "quote",
        contactName: "Jordan Buyer",
        contactEmail: "jordan@example.com",
        contactPhone: "480-555-0100",
        organizationName: "Example Medical",
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.request.status).toBe("submitted");
    expect(body.correlationId).toMatch(/-/);
    expect(body.crm).toBe("pending");
    expect(body.message).toContain("saved");
  });

  it("rejects missing four-field contact and replays idempotent submits", async () => {
    const missing = await fetch(`${baseUrl}/api/public/solutions/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ familyId: "identity_access", contactName: "Jordan Buyer", contactEmail: "jordan@example.com" }),
    });
    expect(missing.status).toBe(400);

    const payload = {
      familyId: "identity_access",
      offerId: "de-identity-standalone",
      deliveryModel: "standalone",
      deliveryPreference: "standalone",
      contactName: "Jordan Buyer",
      contactEmail: "jordan@example.com",
      contactPhone: "480-555-0100",
      organizationName: "Example Medical",
      idempotencyKey: "door2-test-key",
    };
    const first = await fetch(`${baseUrl}/api/public/solutions/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    const second = await fetch(`${baseUrl}/api/public/solutions/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const secondBody = await second.json();
    expect(secondBody.replayed).toBe(true);
    expect(secondBody.request.id).toBe(firstBody.request.id);
  });

  const fourFieldSubmit = (extra: Record<string, unknown> = {}) =>
    fetch(`${baseUrl}/api/public/solutions/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyId: "backup_continuity",
        offerId: "de-continuity-standalone",
        deliveryModel: "standalone",
        deliveryPreference: "standalone",
        intent: "quote",
        contactName: "Riley Owner",
        contactEmail: "riley@example.com",
        contactPhone: "480-555-0199",
        organizationName: "Riley Accounting",
        environment: { userCount: "12", workstationCount: "14", mobileDeviceCount: "6", siteCount: "1", deviceOwnership: "company", internalIt: "no" },
        ...extra,
      }),
    });

  it("emits a lead the admin notification and Hub outbox can actually read", async () => {
    const emitted: Array<[string, any]> = [];
    const spy = vi.spyOn(eventBus, "emit").mockImplementation(async (type: any, data: any) => {
      emitted.push([type, data]);
      return undefined as any;
    });
    try {
      const response = await fourFieldSubmit({ idempotencyKey: "lead-payload-test" });
      expect(response.status).toBe(200);
      const lead = emitted.find(([type]) => type === EventTypes.LEAD_CREATED)?.[1];
      expect(lead).toBeDefined();
      expect(lead).toMatchObject({
        source: "solution_request",
        name: "Riley Owner",
        email: "riley@example.com",
        company: "Riley Accounting",
        phone: "480-555-0199",
      });
      expect(typeof lead.id).toBe("string");
      expect(lead.message).toContain("Backup & Business Continuity");
      expect(lead.message).toContain("Users: 12");
    } finally {
      spy.mockRestore();
    }
  });

  it("refuses a production submit that is neither durable nor in the CRM, and lets the retry be a real submit", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSmoke = process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;
    process.env.NODE_ENV = "production";
    delete process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;
    const emitSpy = vi.spyOn(eventBus, "emit").mockImplementation(async () => undefined as any);
    try {
      const refused = await fourFieldSubmit({ idempotencyKey: "durability-test" });
      expect(refused.status).toBe(503);
      const body = await refused.json();
      expect(body.code).toBe("DURABLE_STORAGE_REQUIRED");
      expect(emitSpy).not.toHaveBeenCalledWith(EventTypes.LEAD_CREATED, expect.anything());

      // Once the CRM records it, the same submit is accepted and is not a replay.
      vi.mocked(syncPublicSolutionRequestToCrm).mockResolvedValueOnce("recorded");
      const accepted = await fourFieldSubmit({ idempotencyKey: "durability-test" });
      expect(accepted.status).toBe(200);
      const acceptedBody = await accepted.json();
      expect(acceptedBody.replayed).toBe(false);
      expect(acceptedBody.durable).toBe("crm");
      expect(acceptedBody.crm).toBe("recorded");
      expect(emitSpy).toHaveBeenCalledWith(EventTypes.LEAD_CREATED, expect.objectContaining({ email: "riley@example.com" }));
    } finally {
      emitSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
      if (originalSmoke === undefined) delete process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;
      else process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = originalSmoke;
    }
  });

  it("accepts memory-only submits outside production, labelled as such, and sends no-store", async () => {
    const response = await fourFieldSubmit({ idempotencyKey: "memory-label-test" });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.durable).toBe("memory");
    expect(body.replayed).toBe(false);
  });
});
