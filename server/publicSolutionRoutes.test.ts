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
    // A draft view never carries a contact field, sent or not.
    expect(body.request).not.toHaveProperty("contactEmail");
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
    expect(body.message).toContain("recorded");
    expect(body.message).not.toContain("saved");
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
        environment: { userCount: "9", workstationCount: "9", mobileDeviceCount: "4", siteCount: "1", deviceOwnership: "company", internalIt: "unsure" },
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.request.status).toBe("submitted");
    expect(body.correlationId).toMatch(/-/);
    expect(body.crm).toBe("pending");
    expect(body.message).toContain("recorded");
  });

  it("rejects missing four-field contact and replays idempotent submits", async () => {
    const missing = await fetch(`${baseUrl}/api/public/solutions/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        familyId: "identity_access",
        contactName: "Jordan Buyer",
        contactEmail: "jordan@example.com",
        environment: { userCount: "9", workstationCount: "9", mobileDeviceCount: "4", siteCount: "1", deviceOwnership: "company", internalIt: "unsure" },
      }),
    });
    expect(missing.status).toBe(400);
    expect((await missing.json()).error).toMatch(/phone/i);

    const payload = {
      familyId: "identity_access",
      offerId: "de-identity-standalone",
      deliveryModel: "standalone",
      deliveryPreference: "standalone",
      contactName: "Jordan Buyer",
      contactEmail: "jordan@example.com",
      contactPhone: "480-555-0100",
      organizationName: "Example Medical",
      environment: { userCount: "9", workstationCount: "9", mobileDeviceCount: "4", siteCount: "1", deviceOwnership: "company", internalIt: "unsure" },
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
      const response = await fourFieldSubmit({ idempotencyKey: "lead-payload-test", suggestion: { value: "co_managed", accepted: false } });
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
      // The suggestion the buyer saw reaches DE with whether it was used; a malformed one is dropped, not stored.
      expect(lead.message).toContain("Suggestion shown: Co-Managed (declined)");
      const malformed = await fourFieldSubmit({ idempotencyKey: "lead-payload-malformed", suggestion: { value: "dropship", accepted: "yes" } });
      expect((await malformed.json()).request.suggestion).toBeNull();
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

  it("mints a short human reference on submit and serves its status without contact details", async () => {
    const response = await fourFieldSubmit({ idempotencyKey: "reference-test" });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.request.reference).toMatch(/^DE-[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(body.reference).toBe(body.request.reference);
    expect(body.nextStep).toBe("quote");
    expect(body.acknowledged).toBe(false);
    // A replay returns the same reference, not a second one.
    const replay = await (await fourFieldSubmit({ idempotencyKey: "reference-test" })).json();
    expect(replay.replayed).toBe(true);
    expect(replay.request.reference).toBe(body.request.reference);

    // Read back the way a person types it: lower case, no hyphen.
    const typed = body.request.reference.toLowerCase().replace("-", "");
    const status = await fetch(`${baseUrl}/api/public/solutions/request/status/${typed}`);
    expect(status.status).toBe(200);
    expect(status.headers.get("cache-control")).toBe("no-store");
    const view = (await status.json()).solution;
    expect(view).toEqual({
      reference: body.request.reference,
      status: "submitted",
      submittedAt: expect.any(String),
      durable: false,
      nextStep: "quote",
    });
    const serialized = JSON.stringify(view).toLowerCase();
    // Contact, session and profile facts never leave by reference. The exact shape above already
    // proves it; these names guard the next person who adds a field (never a bare digit: timestamps).
    for (const secret of ["riley", "example.com", "0199", "accounting", "sessionid", "\"id\"", "backup_continuity", "usercount", "environment", "selectedneeds"]) {
      expect(serialized, `status view leaks ${secret}`).not.toContain(secret);
    }

    expect((await fetch(`${baseUrl}/api/public/solutions/request/status/DE-ZZZZZZ`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/public/solutions/request/status/not-a-reference`)).status).toBe(404);
    expect((await fetch(`${baseUrl}/api/public/solutions/request/status/DE-OOOOOO`)).status).toBe(404);
  });

  it("refuses a submit with no profile before it stores any contact detail, and swallows honeypot bots", async () => {
    const noProfile = await fourFieldSubmit({ environment: { userCount: "12" }, idempotencyKey: "no-profile" });
    expect(noProfile.status).toBe(400);
    const noProfileBody = await noProfile.json();
    expect(noProfileBody.code).toBe("PROFILE_INCOMPLETE");
    expect(noProfileBody.error).toMatch(/business profile/i);
    const noRelationship = await fourFieldSubmit({ deliveryPreference: "", deliveryModel: "", idempotencyKey: "no-relationship" });
    expect(noRelationship.status).toBe(400);
    expect((await noRelationship.json()).code).toBe("RELATIONSHIP_REQUIRED");
    const noNeeds = await fourFieldSubmit({ familyId: "", selectedNeeds: [], idempotencyKey: "no-needs" });
    expect((await noNeeds.json()).code).toBe("NEEDS_REQUIRED");
    const draft = await (await fetch(`${baseUrl}/api/public/solutions/request`)).json();
    expect(draft.request).not.toHaveProperty("contactEmail");

    const bot = await fourFieldSubmit({ company_website: "http://spam.example", idempotencyKey: "bot" });
    expect(bot.status).toBe(400);
    expect((await bot.json()).code).toBe("CONTACT_REQUIRED");
  });

  it("never trusts a body intent or an installation the package does not offer, and reads the session from the cookie only", async () => {
    const response = await fetch(`${baseUrl}/api/public/solutions/request?sessionId=someone-else`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "someone-else",
        selectedNeeds: [
          { familyId: "compliance_risk", offerId: "de-compliance-standalone", deliveryModel: "standalone", installation: "onsite", source: "auditor-evidence" },
          { familyId: "hardware_lifecycle", offerId: "de-hardware-standalone", deliveryModel: "standalone", installation: "onsite" },
        ],
        deliveryPreference: "standalone",
        intent: "request",
        contactEmail: "leak@example.com",
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.request.intent).toBe("assessment");
    expect(body.request.nextStep).toBe("assessment");
    expect(body.request.selectedNeeds[0]).toEqual({
      familyId: "compliance_risk",
      offerId: "de-compliance-standalone",
      deliveryModel: "standalone",
      source: "auditor-evidence",
      installation: "remote_assist",
    });
    expect(body.request.selectedNeeds[1].installation).toBe("onsite");
    // A draft never carries contact details; a query or body session id is ignored.
    expect(body.request).not.toHaveProperty("contactEmail");
    expect(body.request).not.toHaveProperty("organizationName");
    expect(body.durable).toBe(false);
    expect(body.forked).toBe(false);
    const other = await (await fetch(`${baseUrl}/api/public/solutions/request?sessionId=someone-else`)).json();
    expect(other.request.selectedNeeds).toEqual([]);
  });

  it("gives a session a fresh draft after it submits, and forks a write that lands on a submitted record", async () => {
    const submitted = await fourFieldSubmit({ idempotencyKey: "fork-test" });
    expect(submitted.status).toBe(200);
    const cookie = submitted.headers.get("set-cookie")?.split(";")[0] ?? "";
    const reference = (await submitted.json()).reference;

    const next = await (await fetch(`${baseUrl}/api/public/solutions/request`, { headers: { cookie } })).json();
    expect(next.request.status).toBe("draft");
    expect(next.request.selectedNeeds).toEqual([]);
    expect(next.previousReference).toBe(reference);

    const written = await (
      await fetch(`${baseUrl}/api/public/solutions/request`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie },
        body: JSON.stringify({ selectedNeeds: [{ familyId: "identity_access", deliveryModel: "standalone", offerId: "de-identity-standalone" }] }),
      })
    ).json();
    expect(written.request.status).toBe("draft");
    expect(written.request.reference).toBeNull();
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
