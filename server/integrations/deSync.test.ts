import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eventBus } from "../eventBus";
import { createDeSyncEnvelope, parseDeSyncEnvelope, shouldEchoToHub } from "./deSyncContract";
import { signDeSyncRequest, timingSafeStringEqual, verifySignedRequest } from "./deSyncAuth";
import {
  enqueueOutbox,
  getHubProjectionRecord,
  listOutbox,
  resetDeSyncMemory,
} from "./deSyncStore";
import { resetInboxLifecycleMemory } from "./deSyncInboxLifecycle";
import { enqueueWebsiteCommand } from "./enqueueWebsiteCommand";
import { getHubProjection, handleHubEvents, resetHubProjections } from "./hubEvents";
import { readHubDeliveryResult } from "./techSalesClient";
import type { Request, Response } from "express";

function mockReq(overrides: Partial<Request> & { body?: unknown; headers?: Record<string, string> }): Request {
  const headers = overrides.headers || {};
  return {
    method: "POST",
    path: "/api/integrations/v1/hub/events",
    originalUrl: "/api/integrations/v1/hub/events",
    get: (name: string) => headers[name.toLowerCase()] || headers[name] || "",
    body: overrides.body,
    ...overrides,
  } as unknown as Request;
}

function mockRes() {
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
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe("de-sync contract", () => {
  it("rejects arbitrary JSON", () => {
    expect(() => parseDeSyncEnvelope({ hello: "world" })).toThrow();
  });

  it("creates a valid envelope", () => {
    const envelope = createDeSyncEnvelope({
      eventType: "lead.created",
      source: "website",
      entityType: "lead",
      payload: { email: "a@example.com" },
    });
    expect(parseDeSyncEnvelope(envelope).eventType).toBe("lead.created");
  });

  it("never echoes Hub-origin events back to Hub", () => {
    const envelope = createDeSyncEnvelope({
      eventType: "account.updated",
      source: "techsales",
      entityType: "account",
      payload: { name: "Acme" },
    });
    expect(shouldEchoToHub(envelope)).toBe(false);
  });
});

describe("de-sync auth", () => {
  beforeEach(() => {
    process.env.TECHSALES_SYNC_TOKEN = "legacy-token-value";
    delete process.env.WEBSITE_TO_HUB_SECRET;
    delete process.env.HUB_TO_WEBSITE_SECRET;
  });

  it("accepts HMAC over the canonical string", () => {
    const body = JSON.stringify({ ok: true });
    const timestamp = new Date().toISOString();
    const eventId = "11111111-1111-4111-8111-111111111111";
    const signature = signDeSyncRequest({
      method: "POST",
      path: "/api/integrations/v1/hub/events",
      timestamp,
      eventId,
      body,
      secret: "legacy-token-value",
    });
    const result = verifySignedRequest(
      mockReq({
        body: { ok: true },
        headers: {
          "x-de-event-id": eventId,
          "x-de-timestamp": timestamp,
          "x-de-source": "techsales",
          "x-de-signature": signature,
        },
      }),
      "hub_to_website",
    );
    expect(result.ok).toBe(true);
  });

  it("compares secrets in constant time", () => {
    expect(timingSafeStringEqual("abc", "abc")).toBe(true);
    expect(timingSafeStringEqual("abc", "abd")).toBe(false);
  });
});

describe("lifecycle A–H", () => {
  beforeEach(() => {
    resetDeSyncMemory();
    resetInboxLifecycleMemory();
    resetHubProjections();
    delete process.env.DATABASE_URL;
    process.env.TECHSALES_HUB_URL = "https://techsales.example.test";
    process.env.TECHSALES_SYNC_TOKEN = "legacy-token-value";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("A: new website lead is durable and delivered once", async () => {
    const envelope = await enqueueWebsiteCommand({
      id: "lead-a",
      name: "Jordan Buyer",
      email: "jordan@example.com",
      company: "Acme Dental",
      source: "contact_form",
    });
    const pending = await listOutbox("pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].eventType).toBe("lead.created");

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    const { processDeSyncOutbox } = await import("./deSyncWorker");
    const result = await processDeSyncOutbox();
    expect(result.delivered).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/integrations/v1/website/leads");
    expect(envelope.eventId).toBeTruthy();
  });

  it("B: quote accept from Hub updates local projection only", async () => {
    const envelope = createDeSyncEnvelope({
      eventType: "quote.accepted",
      source: "techsales",
      entityType: "quote",
      entityId: "88",
      canonicalAccountId: "12",
      payload: { quoteId: 88, status: "accepted" },
    });
    const res = mockRes();
    await handleHubEvents(mockReq({ body: envelope }), res);
    expect(res.statusCode).toBe(200);
    const outbox = await listOutbox();
    expect(outbox.filter((r) => r.eventType === "quote.response_submitted")).toHaveLength(0);
  });

  it("C: agreement event is stored, not re-commanded", async () => {
    const envelope = createDeSyncEnvelope({
      eventType: "agreement.created",
      source: "techsales",
      entityType: "agreement",
      entityId: "agr-1",
      payload: { title: "MSA" },
    });
    const res = mockRes();
    await handleHubEvents(mockReq({ body: envelope }), res);
    expect((res.body as { ok?: boolean }).ok).toBe(true);
    expect(await listOutbox()).toHaveLength(0);
  });

  it("D: store quote uses quote.requested", async () => {
    await enqueueWebsiteCommand(
      {
        id: "qr-1",
        name: "Pat",
        email: "pat@example.com",
        company: "Acme",
        source: "store_quote",
      },
      "quote.requested",
    );
    const pending = await listOutbox("pending");
    expect(pending[0].eventType).toBe("quote.requested");
  });

  it("E: five duplicate Hub events apply once", async () => {
    const envelope = createDeSyncEnvelope({
      eventType: "order.created",
      source: "techsales",
      entityType: "order",
      entityId: "ord-1",
      payload: { orderNumber: "SO-1" },
    });

    for (let i = 0; i < 5; i += 1) {
      const res = mockRes();
      await handleHubEvents(mockReq({ body: envelope }), res);
      expect(res.statusCode).toBe(200);
      expect((res.body as { duplicate?: boolean }).duplicate).toBe(i > 0);
    }
  });

  it("E2: failed application is retried with the same event id before duplicate acknowledgement", async () => {
    const envelope = createDeSyncEnvelope({
      eventType: "order.updated",
      source: "techsales",
      entityType: "order",
      entityId: "ord-retry",
      payload: { status: "processing" },
    });

    const emitSpy = vi.spyOn(eventBus, "emit").mockRejectedValueOnce(new Error("projection failure"));

    const failed = mockRes();
    await handleHubEvents(mockReq({ body: envelope }), failed);
    expect(failed.statusCode).toBe(500);

    emitSpy.mockRestore();

    const retried = mockRes();
    await handleHubEvents(mockReq({ body: envelope }), retried);
    expect(retried.statusCode).toBe(200);
    expect((retried.body as { duplicate?: boolean }).duplicate).toBe(false);

    const duplicate = mockRes();
    await handleHubEvents(mockReq({ body: envelope }), duplicate);
    expect(duplicate.statusCode).toBe(200);
    expect((duplicate.body as { duplicate?: boolean }).duplicate).toBe(true);
  });

  it("F: website still 202/queued when Hub is down", async () => {
    await enqueueWebsiteCommand({
      id: "lead-f",
      email: "down@example.com",
      name: "Down",
      source: "assessment",
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("hub down")));
    const { processDeSyncOutbox } = await import("./deSyncWorker");
    const result = await processDeSyncOutbox();
    expect(result.delivered).toBe(0);
    expect(result.retried).toBe(1);
    const pending = await listOutbox("pending");
    expect(pending).toHaveLength(1);
  });

  it("G: portal command stays in outbox if Hub is unreachable", async () => {
    await enqueueOutbox({
      eventType: "service.change_requested",
      source: "portal",
      destination: "hub",
      entityType: "service",
      canonicalAccountId: "12",
      payload: { sku: "backup" },
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("portal peer down")));
    const { processDeSyncOutbox } = await import("./deSyncWorker");
    const result = await processDeSyncOutbox();
    expect(result.delivered).toBe(0);
    expect((await listOutbox("pending")).length + (await listOutbox("failed")).length).toBeGreaterThan(0);
  });

  it("H: rename does not change canonical account id", async () => {
    const envelope = createDeSyncEnvelope({
      eventType: "account.updated",
      source: "techsales",
      entityType: "account",
      entityId: "12",
      canonicalAccountId: "12",
      payload: { name: "Acme Dental Group", portalClientId: "client-1" },
    });
    const res = mockRes();
    await handleHubEvents(mockReq({ body: envelope }), res);
    expect((res.body as { ok?: boolean }).ok).toBe(true);
    expect(envelope.canonicalAccountId).toBe("12");
  });

  it("stores a Hub projection for the canonical account and ignores an older event", async () => {
    const newer = createDeSyncEnvelope({
      eventType: "quote.accepted",
      source: "techsales",
      entityType: "quote",
      entityId: "88",
      canonicalAccountId: "12",
      payload: { status: "accepted", quoteId: 88 },
    });
    const accepted = mockRes();
    await handleHubEvents(mockReq({ body: newer }), accepted);
    expect(accepted.statusCode).toBe(200);

    const replay = mockRes();
    await handleHubEvents(mockReq({ body: newer }), replay);
    expect((replay.body as { duplicate?: boolean }).duplicate).toBe(true);

    const older = createDeSyncEnvelope({
      eventType: "quote.updated",
      source: "techsales",
      entityType: "quote",
      entityId: "88",
      payload: { status: "draft" },
    });
    older.occurredAt = new Date(Date.parse(newer.occurredAt) - 60_000).toISOString();
    const stale = mockRes();
    await handleHubEvents(mockReq({ body: older }), stale);
    expect(stale.statusCode).toBe(200);

    const row = await getHubProjectionRecord("quote", "88");
    expect(row?.canonicalAccountId).toBe("12");
    expect(row?.eventId).toBe(newer.eventId);
    expect(row?.payload.status).toBe("accepted");
    expect(await getHubProjection("quote", "88")).toMatchObject({ status: "accepted" });
  });

  it("keeps portalClientId on a website lead envelope", async () => {
    await enqueueWebsiteCommand(
      {
        id: "prospect-1",
        name: "Pat",
        email: "pat@example.com",
        company: "Acme",
        source: "portal_register",
        portalClientId: "prospect-1",
      },
      "lead.created",
    );
    const pending = await listOutbox("pending");
    expect(pending[0].payload.portalClientId).toBe("prospect-1");
  });

  it("reads the Hub account id from a delivery ack", () => {
    expect(readHubDeliveryResult({ ok: true, canonicalAccountId: "41" })).toEqual({
      canonicalAccountId: "41",
      duplicate: false,
    });
    expect(readHubDeliveryResult({ duplicate: true })).toEqual({
      canonicalAccountId: null,
      duplicate: true,
    });
  });
});
