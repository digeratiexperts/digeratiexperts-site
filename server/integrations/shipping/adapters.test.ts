import { describe, expect, it, vi, beforeEach } from "vitest";
import shipstationFixture from "./fixtures/shipstation-list-shipments.json";
import easypostFixture from "./fixtures/easypost-list-shipments.json";
import easypostKeysFixture from "./fixtures/easypost-api-keys.json";
import shippoFixture from "./fixtures/shippo-list-transactions.json";
import { loadShipStation, mapShipStationResponse, parseShipStationStoreId } from "./shipstation";
import { _resetEasyPostKeyCache, filterByReference, findChildProductionKey, loadEasyPost, mapEasyPostShipment, parseEasyPostScope } from "./easypost";
import { filterByMetadata, loadShippo, mapShippoTransaction, parseShippoScope } from "./shippo";
import { buildManualData } from "./manual";
import { readShippingClientMap } from "./index";
import { isSafeScopePrefix } from "./http";
import { ShippingConfigError, ShippingVendorError } from "./types";

// index.ts imports the manual records store; keep it off any database.
vi.mock("../../db", () => ({ db: null, dbReady: false }));

type Call = { url: string; headers: Record<string, string> };

function fakeFetch(handler: (url: string) => { status?: number; body: unknown }) {
  const calls: Call[] = [];
  const impl = vi.fn(async (input: any, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const { status = 200, body } = handler(url);
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("ShipStation adapter", () => {
  it("maps the documented List Shipments shape", () => {
    const data = mapShipStationResponse(shipstationFixture.response, "12345");
    expect(data.provider).toBe("shipstation");
    expect(data.reportsDeliveryStatus).toBe(false);
    expect(data.counts).toEqual({ active: null, total: 2 });
    expect(data.shipments[0]).toEqual({
      id: "33974373",
      reference: "100038-1",
      carrier: "stamps_com",
      trackingNumber: "9400111899561704681189",
      trackingUrl: null,
      status: "label_created",
      shippedAt: "2014-10-03",
      deliveredAt: null,
      items: 3,
      notes: null,
    });
    expect(data.shipments[1].status).toBe("cancelled");
  });

  it("refuses the whole answer when a row names another store", () => {
    expect(() => mapShipStationResponse(shipstationFixture.response, "999")).toThrow(ShippingVendorError);
  });

  it("asks ShipStation for the mapped store only, with Basic auth", async () => {
    const { impl, calls } = fakeFetch(() => ({ body: shipstationFixture.response }));
    await loadShipStation(
      "12345",
      { PORTAL_SHIPPING_SHIPSTATION_API_KEY: "ShipStation", PORTAL_SHIPPING_SHIPSTATION_API_SECRET: "Rocks" },
      impl,
    );
    expect(calls).toHaveLength(1);
    const u = new URL(calls[0].url);
    expect(u.origin + u.pathname).toBe("https://ssapi.shipstation.com/shipments");
    expect(u.searchParams.get("storeId")).toBe("12345");
    // Example from https://www.shipstation.com/docs/api/requirements/
    expect(calls[0].headers.Authorization).toBe("Basic U2hpcFN0YXRpb246Um9ja3M=");
  });

  it("rejects a non-numeric store id and missing credentials", async () => {
    expect(() => parseShipStationStoreId("acme")).toThrow(ShippingConfigError);
    await expect(loadShipStation("12345", {}, fakeFetch(() => ({ body: {} })).impl)).rejects.toThrow(ShippingConfigError);
  });

  it("turns a vendor error into a ShippingVendorError without the body text", async () => {
    const { impl } = fakeFetch(() => ({ status: 401, body: "secret vendor detail" }));
    const err = await loadShipStation(
      "12345",
      { PORTAL_SHIPPING_SHIPSTATION_API_KEY: "k", PORTAL_SHIPPING_SHIPSTATION_API_SECRET: "s" },
      impl,
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ShippingVendorError);
    expect(err.message).toBe("ShipStation answered HTTP 401");
  });
});

describe("EasyPost adapter", () => {
  beforeEach(() => _resetEasyPostKeyCache());

  it("maps shipments and trackers", () => {
    const rows = easypostFixture.response.shipments as Record<string, unknown>[];
    const first = mapEasyPostShipment(rows[0]);
    expect(first).toMatchObject({
      id: "shp_aaa111",
      reference: "ACME-1001",
      carrier: "USPS",
      trackingNumber: "9400100000000000000001",
      trackingUrl: "https://track.easypost.com/djE6dHJrX2FhYTExMQ",
      status: "in_transit",
      deliveredAt: null,
    });
    expect(mapEasyPostShipment(rows[1])).toMatchObject({ status: "delivered", deliveredAt: "2026-09-23T14:05:00Z", carrier: "UPS" });
    expect(mapEasyPostShipment(rows[2])).toMatchObject({ status: "cancelled", carrier: "USPS" });
  });

  it("parses scopes and refuses unsafe prefixes", () => {
    expect(parseEasyPostScope("user_acme")).toEqual({ kind: "child", userId: "user_acme" });
    expect(parseEasyPostScope("reference:ACME-")).toEqual({ kind: "reference", prefix: "ACME-" });
    expect(() => parseEasyPostScope("reference:ACME")).toThrow(ShippingConfigError);
    expect(() => parseEasyPostScope("reference:")).toThrow(ShippingConfigError);
    expect(() => parseEasyPostScope("acme")).toThrow(ShippingConfigError);
  });

  it("keeps only exact reference-prefix matches", () => {
    const rows = easypostFixture.response.shipments as Record<string, unknown>[];
    expect(filterByReference(rows, "ACME-").map((s) => s.id)).toEqual(["shp_aaa111", "shp_bbb222"]);
    expect(filterByReference(rows, "GLOBEX-").map((s) => s.id)).toEqual(["shp_ccc333"]);
  });

  it("finds a child's production key, never another child's", () => {
    expect(findChildProductionKey(easypostKeysFixture.response, "user_acme")).toBe("ACME_PROD_KEY");
    expect(findChildProductionKey(easypostKeysFixture.response, "user_globex")).toBe("GLOBEX_PROD_KEY");
    expect(findChildProductionKey(easypostKeysFixture.response, "user_parent")).toBeNull();
    expect(findChildProductionKey(easypostKeysFixture.response, "user_nobody")).toBeNull();
  });

  it("reads a child user's shipments with that child's own key", async () => {
    const { impl, calls } = fakeFetch((url) =>
      url.endsWith("/api_keys") ? { body: easypostKeysFixture.response } : { body: easypostFixture.response },
    );
    const data = await loadEasyPost("user_acme", { PORTAL_SHIPPING_EASYPOST_API_KEY: "PARENT_PROD_KEY" }, impl, new Date("2026-10-03T00:00:00Z"));
    expect(calls[0].url).toBe("https://api.easypost.com/v2/api_keys");
    expect(calls[0].headers.Authorization).toBe(`Basic ${Buffer.from("PARENT_PROD_KEY:").toString("base64")}`);
    const list = new URL(calls[1].url);
    expect(list.pathname).toBe("/v2/shipments");
    expect(list.searchParams.get("include_children")).toBeNull();
    expect(calls[1].headers.Authorization).toBe(`Basic ${Buffer.from("ACME_PROD_KEY:").toString("base64")}`);
    expect(data.windowDays).toBe(90);
    expect(data.counts).toEqual({ active: 1, total: 3 });
  });

  it("fails closed when the mapped child is not under the account", async () => {
    const { impl } = fakeFetch(() => ({ body: easypostKeysFixture.response }));
    await expect(loadEasyPost("user_nobody", { PORTAL_SHIPPING_EASYPOST_API_KEY: "P" }, impl)).rejects.toThrow(ShippingConfigError);
  });

  it("filters the parent's shipments by reference prefix server-side", async () => {
    const { impl, calls } = fakeFetch(() => ({ body: easypostFixture.response }));
    const data = await loadEasyPost("reference:GLOBEX-", { PORTAL_SHIPPING_EASYPOST_API_KEY: "P" }, impl);
    expect(calls).toHaveLength(1);
    expect(data.shipments.map((s) => s.reference)).toEqual(["GLOBEX-77"]);
  });
});

describe("Shippo adapter", () => {
  const rows = shippoFixture.response.results as Record<string, unknown>[];

  it("maps transactions and drops failed purchases", () => {
    expect(mapShippoTransaction(rows[0])).toEqual({
      id: "70ae8117ee1749e393f249d5b77c45e0",
      reference: "ACME-Order 1001",
      carrier: null,
      trackingNumber: "9499907123456123456781",
      trackingUrl: "https://tools.usps.com/go/TrackConfirmAction_input?origTrackNum=9499907123456123456781",
      status: "delivered",
      shippedAt: "2026-09-22T19:14:48.273Z",
      deliveredAt: null,
      items: null,
      notes: null,
    });
    expect(mapShippoTransaction(rows[1])).toMatchObject({ status: "in_transit", carrier: "UPS" });
    expect(mapShippoTransaction(rows[2])).toMatchObject({ status: "processing", trackingNumber: null });
    expect(mapShippoTransaction(rows[3])).toBeNull();
    expect(mapShippoTransaction(rows[4])).toMatchObject({ status: "cancelled" });
  });

  it("keeps only exact metadata-prefix matches", () => {
    expect(filterByMetadata(rows, "ACME-").map((s) => s.id)).toEqual([
      "70ae8117ee1749e393f249d5b77c45e0",
      "915d94940ea54c3a80cbfa328722f5a1",
      "f7a8b9",
    ]);
    expect(filterByMetadata(rows, "GLOBEX-").map((s) => s.id)).toEqual(["a1b2c3"]);
  });

  it("scopes a managed account with the SHIPPO-ACCOUNT-ID header and ShippoToken auth", async () => {
    const { impl, calls } = fakeFetch(() => ({ body: shippoFixture.response }));
    const data = await loadShippo("account:acc123", { PORTAL_SHIPPING_SHIPPO_API_TOKEN: "shippo_live_x" }, impl);
    expect(calls[0].headers["SHIPPO-ACCOUNT-ID"]).toBe("acc123");
    expect(calls[0].headers.Authorization).toBe("ShippoToken shippo_live_x");
    expect(new URL(calls[0].url).pathname).toBe("/transactions");
    expect(data.shipments).toHaveLength(4);
    expect(data.counts).toEqual({ active: 2, total: 4 });
  });

  it("refuses malformed scopes", () => {
    expect(() => parseShippoScope("acc123")).toThrow(ShippingConfigError);
    expect(() => parseShippoScope("metadata:AC")).toThrow(ShippingConfigError);
    expect(parseShippoScope("metadata:ACME-")).toEqual({ kind: "metadata", prefix: "ACME-" });
  });
});

describe("manual adapter and shared helpers", () => {
  it("maps staff records, validating status and URL", () => {
    const now = "2026-10-01T00:00:00.000Z";
    const data = buildManualData([
      {
        id: "mr_1",
        clientId: "acme",
        kind: "shipment",
        createdBy: "u",
        createdAt: now,
        updatedAt: now,
        data: { reference: "PO-1", carrier: "UPS", trackingNumber: "1Z1", status: "in_transit", shippedAt: "2026-09-30", items: "4", trackingUrl: "javascript:alert(1)" },
      },
      {
        id: "mr_2",
        clientId: "acme",
        kind: "shipment",
        createdBy: "u",
        createdAt: now,
        updatedAt: now,
        data: { trackingNumber: "X", status: "teleported", shippedAt: "2026-09-01", deliveredAt: "2026-09-03" },
      },
    ]);
    expect(data.shipments[0]).toMatchObject({ id: "mr_1", status: "in_transit", items: 4, trackingUrl: null });
    expect(data.shipments[1]).toMatchObject({ id: "mr_2", status: "unknown" });
    expect(data.counts).toEqual({ active: 1, total: 2 });
  });

  it("reads the client map and treats bad JSON as a config fault", () => {
    expect(readShippingClientMap({ PORTAL_SHIPPING_CLIENT_MAP: '{"acme":"123","globex":456,"x":""}' })).toEqual({ acme: "123", globex: "456" });
    expect(() => readShippingClientMap({ PORTAL_SHIPPING_CLIENT_MAP: "{nope" })).toThrow(ShippingConfigError);
    expect(readShippingClientMap({})).toEqual({});
  });

  it("only accepts delimiter-terminated prefixes", () => {
    expect(isSafeScopePrefix("ACME-")).toBe(true);
    expect(isSafeScopePrefix("ACME")).toBe(false);
    expect(isSafeScopePrefix("A-")).toBe(false);
    expect(isSafeScopePrefix("--x-")).toBe(false);
  });
});
