import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import upsFixture from "./fixtures/ups-track-details.json";
import fedexFixture from "./fixtures/fedex-track-trackingnumbers.json";
import uspsFixture from "./fixtures/usps-tracking-v3-detail.json";
import { _resetCarrierTokens, CarrierError, tokenExpiresAt } from "./common";
import { isValidUpsTrackingNumber, mapUpsResponse, mapUpsStatus, upsActivityTimestamp } from "./ups";
import { mapFedexResponse, mapFedexStatus } from "./fedex";
import { mapUspsResponse, mapUspsStatus, uspsLocalTimestamp } from "./usps";
import {
  _resetCarrierCache,
  applyCarrierTracking,
  CARRIER_CACHE_TTL_MS,
  carrierTrackingConfig,
  carrierTrackingEnabled,
  mergeStatus,
  normalizeCarrierName,
} from "./index";
import { buildManualDataWithCarriers } from "../manual";
import type { NormalizedShipment } from "../types";

const UPS_KEYS = { PORTAL_CARRIER_UPS_CLIENT_ID: "ups-id", PORTAL_CARRIER_UPS_CLIENT_SECRET: "ups-secret-value" };
const FEDEX_KEYS = { PORTAL_CARRIER_FEDEX_CLIENT_ID: "fx-id", PORTAL_CARRIER_FEDEX_CLIENT_SECRET: "fx-secret-value" };
const USPS_KEYS = { PORTAL_CARRIER_USPS_CLIENT_ID: "usps-id", PORTAL_CARRIER_USPS_CLIENT_SECRET: "usps-secret-value" };
const ALL_KEYS = { ...UPS_KEYS, ...FEDEX_KEYS, ...USPS_KEYS };

const UPS_NO = "1Z023E2X0214323462";

type Call = { url: string; method: string; headers: Record<string, string>; body: string | undefined };

/** Carrier stand-in: answers token and tracking calls per host; `track` decides the tracking answer. */
function carrierFetch(track: (url: string, call: Call) => { status?: number; body: unknown } = defaultTrack) {
  const calls: Call[] = [];
  const impl = vi.fn(async (input: any, init?: RequestInit) => {
    const url = String(input);
    const call: Call = {
      url,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: typeof init?.body === "string" ? init.body : undefined,
    };
    calls.push(call);
    let answer: { status?: number; body: unknown };
    if (url.endsWith("/security/v1/oauth/token")) answer = { body: upsFixture.tokenResponse };
    else if (url.endsWith("/oauth/token")) answer = { body: fedexFixture.tokenResponse };
    else if (url.endsWith("/oauth2/v3/token")) answer = { body: uspsFixture.tokenResponse };
    else answer = track(url, call);
    const { status = 200, body } = answer;
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function defaultTrack(url: string): { status?: number; body: unknown } {
  if (url.includes("/api/track/v1/details/")) return { body: upsFixture.delivered };
  if (url.includes("/track/v1/trackingnumbers")) return { body: fedexFixture.inTransit };
  if (url.includes("/tracking/v3/tracking/")) return { body: uspsFixture.documentedExample };
  return { status: 404, body: {} };
}

function row(over: Partial<NormalizedShipment> & { id: string }): NormalizedShipment {
  return {
    reference: null,
    carrier: "UPS",
    trackingNumber: UPS_NO,
    trackingUrl: null,
    status: "in_transit",
    shippedAt: "2026-09-30",
    deliveredAt: null,
    items: null,
    notes: null,
    ...over,
  };
}

const silent = () => undefined;

beforeEach(() => {
  _resetCarrierTokens();
  _resetCarrierCache();
});

describe("carrier name matching", () => {
  it("recognises UPS, FedEx and USPS spellings, case-insensitively", () => {
    for (const s of ["UPS", "ups", "UPS Ground", "ups 2nd day air", "United Parcel Service"]) expect(normalizeCarrierName(s)).toBe("ups");
    for (const s of ["FedEx", "FEDEX", "Fed Ex", "FedEx Ground", "fedex 2day", "Federal Express"]) expect(normalizeCarrierName(s)).toBe("fedex");
    for (const s of ["USPS", "usps priority mail", "U.S.P.S.", "U.S. Postal Service", "US Postal Service", "United States Postal Service"]) {
      expect(normalizeCarrierName(s)).toBe("usps");
    }
  });

  it("does not guess at other carriers or look-alikes", () => {
    for (const s of ["DHL", "Upstate Courier", "OnTrac", "stamps_com", "", null, undefined, "  "]) expect(normalizeCarrierName(s)).toBeNull();
  });

  it("checks UPS inquiry numbers against the documented 7-34 character length", () => {
    expect(isValidUpsTrackingNumber(UPS_NO)).toBe(true);
    expect(isValidUpsTrackingNumber("1Z2345")).toBe(false);
    expect(isValidUpsTrackingNumber("1".repeat(35))).toBe(false);
    expect(isValidUpsTrackingNumber("1Z023E2X/../x")).toBe(false);
  });
});

describe("UPS mapping (Tracking.yaml)", () => {
  it("maps the spec's documented field examples", () => {
    expect(mapUpsResponse(upsFixture.documentedExamples)).toEqual({
      status: "exception",
      latestEvent: "Your package was released by the customs agency.",
      latestEventAt: "2021-02-10T07:13:56-05:00",
      latestLocation: "Wayne, NJ",
    });
  });

  it("needs a DEL delivery date or time before calling a D status delivered", () => {
    expect(mapUpsResponse(upsFixture.delivered)).toEqual({
      status: "delivered",
      latestEvent: "Delivered",
      latestEventAt: "2021-02-12T14:15:00-05:00",
      latestLocation: "Wayne, NJ",
    });
    expect(mapUpsStatus("D", false)).toBe("in_transit");
    expect(mapUpsResponse(upsFixture.manifest)).toMatchObject({ status: "label_created", latestEvent: expect.any(String), latestEventAt: null, latestLocation: null });
  });

  it("maps every Track Alert status type and leaves others unknown", () => {
    expect(["I", "U", "M", "MV", "X", "P", ""].map((t) => mapUpsStatus(t, false))).toEqual([
      "in_transit",
      "in_transit",
      "label_created",
      "cancelled",
      "exception",
      "unknown",
      "unknown",
    ]);
  });

  it("builds timestamps from date, time and gmtOffset", () => {
    expect(upsActivityTimestamp({ date: "20210210", time: "74700", gmtOffset: "-05:00" })).toBe("2021-02-10T07:47:00-05:00");
    expect(upsActivityTimestamp({ date: "20210210" })).toBe("2021-02-10");
    expect(upsActivityTimestamp({ date: "bad" })).toBeNull();
  });

  it("treats an answer with no package as a failure", () => {
    expect(() => mapUpsResponse({ trackResponse: { shipment: [{ warnings: [{ code: "TW0001", message: "Tracking Information Not Found" }] }] } })).toThrow(CarrierError);
  });
});

describe("FedEx mapping", () => {
  it("uses the newest scan event by timestamp", () => {
    expect(mapFedexResponse(fedexFixture.delivered)).toEqual({
      status: "delivered",
      latestEvent: "Delivered",
      latestEventAt: "2018-02-02T12:01:00-07:00",
      latestLocation: "Norton, VA",
    });
  });

  it("falls back to latestStatusDetail when there are no scan events", () => {
    expect(mapFedexResponse(fedexFixture.inTransit)).toEqual({
      status: "in_transit",
      latestEvent: "In transit",
      latestEventAt: null,
      latestLocation: "Memphis, TN",
    });
  });

  it("treats a per-number error as a failure", () => {
    expect(() => mapFedexResponse(fedexFixture.notFound)).toThrow(CarrierError);
  });

  it("maps only the confirmed codes", () => {
    expect(["DL", "OD", "IT", "PU", "OC", "SE", "CA", "ZZ"].map(mapFedexStatus)).toEqual([
      "delivered",
      "in_transit",
      "in_transit",
      "in_transit",
      "label_created",
      "exception",
      "cancelled",
      "unknown",
    ]);
  });
});

describe("USPS mapping (Tracking 3.0)", () => {
  it("maps the documented detail example", () => {
    expect(mapUspsResponse(uspsFixture.documentedExample)).toEqual({
      status: "in_transit",
      latestEvent: "USPS in possession of item",
      latestEventAt: "2023-08-02T07:31:00",
      latestLocation: "RICHMOND, VA",
    });
  });

  it("maps Delivered and picks the newest event", () => {
    expect(mapUspsResponse(uspsFixture.delivered)).toEqual({
      status: "delivered",
      latestEvent: "Delivered, In/At Mailbox",
      latestEventAt: "2023-08-04T13:05:00",
      latestLocation: "CEDAR RAPIDS, IA",
    });
  });

  it("leaves undocumented categories unknown", () => {
    expect(mapUspsStatus("Alert")).toBe("unknown");
    expect(mapUspsStatus("In Transit")).toBe("in_transit");
    expect(uspsLocalTimestamp("nonsense")).toBeNull();
  });
});

describe("requests and token caching", () => {
  it("UPS: Basic token request, then bearer + transId + transactionSrc, production host by default", async () => {
    const { impl, calls } = carrierFetch();
    const out = await applyCarrierTracking([row({ id: "a" })], { env: UPS_KEYS, fetchImpl: impl, log: silent });
    expect(out[0].status).toBe("delivered");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "POST https://onlinetools.ups.com/security/v1/oauth/token",
      `GET https://onlinetools.ups.com/api/track/v1/details/${UPS_NO}?locale=en_US`,
    ]);
    expect(calls[0].headers.Authorization).toBe(`Basic ${Buffer.from("ups-id:ups-secret-value").toString("base64")}`);
    expect(calls[0].body).toBe("grant_type=client_credentials");
    expect(calls[1].headers.Authorization).toBe("Bearer ups-access-token-1");
    expect(calls[1].headers.transId).toMatch(/^[0-9a-f]{32}$/);
    expect(calls[1].headers.transactionSrc).toBeTruthy();
  });

  it("uses each carrier's documented sandbox host when PORTAL_CARRIER_<X>_ENV=sandbox", async () => {
    const { impl, calls } = carrierFetch();
    await applyCarrierTracking(
      [
        row({ id: "u" }),
        row({ id: "f", carrier: "FedEx", trackingNumber: "123456789012" }),
        row({ id: "p", carrier: "USPS", trackingNumber: "9400100000000000000000" }),
      ],
      {
        env: { ...ALL_KEYS, PORTAL_CARRIER_UPS_ENV: "sandbox", PORTAL_CARRIER_FEDEX_ENV: "sandbox", PORTAL_CARRIER_USPS_ENV: "sandbox" },
        fetchImpl: impl,
        log: silent,
      },
    );
    const hosts = new Set(calls.map((c) => new URL(c.url).host));
    expect(hosts).toEqual(new Set(["wwwcie.ups.com", "apis-sandbox.fedex.com", "apis-tem.usps.com"]));
    const fedexTrack = calls.find((c) => c.url.endsWith("/track/v1/trackingnumbers"))!;
    expect(JSON.parse(fedexTrack.body!)).toEqual({ includeDetailedScans: true, trackingInfo: [{ trackingNumberInfo: { trackingNumber: "123456789012" } }] });
    const fedexToken = calls.find((c) => c.url.endsWith("/oauth/token") && c.url.includes("fedex"))!;
    expect(new URLSearchParams(fedexToken.body).get("grant_type")).toBe("client_credentials");
    const uspsToken = calls.find((c) => c.url.endsWith("/oauth2/v3/token"))!;
    expect(JSON.parse(uspsToken.body!)).toEqual({ client_id: "usps-id", client_secret: "usps-secret-value", grant_type: "client_credentials" });
    expect(calls.find((c) => c.url.includes("/tracking/v3/tracking/"))!.url).toBe(
      "https://apis-tem.usps.com/tracking/v3/tracking/9400100000000000000000?expand=DETAIL",
    );
  });

  it("reuses one token until shortly before expiry", async () => {
    let t = 1_000_000;
    const now = () => t;
    const { impl, calls } = carrierFetch();
    const tokenCalls = () => calls.filter((c) => c.url.endsWith("/security/v1/oauth/token")).length;
    await applyCarrierTracking([row({ id: "a", trackingNumber: "1ZAAAAAAA1" }), row({ id: "b", trackingNumber: "1ZAAAAAAA2" })], {
      env: UPS_KEYS,
      fetchImpl: impl,
      now,
      log: silent,
    });
    expect(tokenCalls()).toBe(1);
    t += 20 * 60_000; // result cache expired, token (14399 s) still valid
    await applyCarrierTracking([row({ id: "a", trackingNumber: "1ZAAAAAAA1" })], { env: UPS_KEYS, fetchImpl: impl, now, log: silent });
    expect(tokenCalls()).toBe(1);
    t += 4 * 3600_000; // past expiry
    await applyCarrierTracking([row({ id: "a", trackingNumber: "1ZAAAAAAA1" })], { env: UPS_KEYS, fetchImpl: impl, now, log: silent });
    expect(tokenCalls()).toBe(2);
  });

  it("refreshes the token once when the carrier answers 401", async () => {
    let first = true;
    const { impl, calls } = carrierFetch((url) => {
      if (first) {
        first = false;
        return { status: 401, body: {} };
      }
      return defaultTrack(url);
    });
    const out = await applyCarrierTracking([row({ id: "a" })], { env: UPS_KEYS, fetchImpl: impl, log: silent });
    expect(out[0].carrierStatus?.source).toBe("ups");
    expect(calls.filter((c) => c.url.endsWith("/oauth/token"))).toHaveLength(2);
  });

  it("computes expiry with a refresh margin", () => {
    expect(tokenExpiresAt({ accessToken: "x", expiresInSec: 3600 }, 0)).toBe(3540_000);
    expect(tokenExpiresAt({ accessToken: "x", expiresInSec: 60 }, 0)).toBe(30_000);
    expect(tokenExpiresAt({ accessToken: "x", expiresInSec: null }, 0)).toBe(240_000);
  });
});

describe("applyCarrierTracking", () => {
  it("does nothing without keys: staff status, carrierStatus null, no request", async () => {
    const { impl } = carrierFetch();
    const rows = [row({ id: "a", status: "processing" })];
    const out = await applyCarrierTracking(rows, { env: {}, fetchImpl: impl, log: silent });
    expect(out).toEqual([{ ...rows[0], carrierStatus: null }]);
    expect(impl).not.toHaveBeenCalled();
  });

  it("never calls a carrier whose keys are not set", async () => {
    const { impl, calls } = carrierFetch();
    const out = await applyCarrierTracking(
      [row({ id: "u" }), row({ id: "f", carrier: "FedEx", trackingNumber: "123456789012" }), row({ id: "p", carrier: "USPS", trackingNumber: "940010000000" })],
      { env: UPS_KEYS, fetchImpl: impl, log: silent },
    );
    expect(calls.every((c) => new URL(c.url).host === "onlinetools.ups.com")).toBe(true);
    expect(out.map((s) => s.carrierStatus?.source ?? null)).toEqual(["ups", null, null]);
  });

  it("kill switch PORTAL_CARRIER_TRACKING=off stops every lookup", async () => {
    const { impl } = carrierFetch();
    expect(carrierTrackingEnabled({ PORTAL_CARRIER_TRACKING: "off" })).toBe(false);
    expect(carrierTrackingEnabled({})).toBe(true);
    const out = await applyCarrierTracking([row({ id: "a" })], { env: { ...ALL_KEYS, PORTAL_CARRIER_TRACKING: "OFF" }, fetchImpl: impl, log: silent });
    expect(out[0]).toMatchObject({ status: "in_transit", carrierStatus: null });
    expect(impl).not.toHaveBeenCalled();
  });

  it("keeps the staff status when a carrier fails, and logs without secrets or body text", async () => {
    const { impl } = carrierFetch(() => ({ status: 500, body: "upstream echo: ups-secret-value" }));
    const lines: string[] = [];
    const out = await applyCarrierTracking([row({ id: "mr_9", status: "exception" })], { env: UPS_KEYS, fetchImpl: impl, log: (l) => lines.push(l) });
    expect(out[0]).toMatchObject({ status: "exception", carrierStatus: null });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("mr_9");
    expect(lines[0]).toContain("HTTP 500");
    expect(lines[0]).not.toContain("ups-secret-value");
    expect(lines[0]).not.toContain("ups-access-token");
  });

  it("keeps the staff status when the token request fails or times out", async () => {
    const impl = vi.fn(async () => {
      throw Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    }) as unknown as typeof fetch;
    const lines: string[] = [];
    const out = await applyCarrierTracking([row({ id: "a", status: "processing" })], { env: UPS_KEYS, fetchImpl: impl, log: (l) => lines.push(l) });
    expect(out[0]).toMatchObject({ status: "processing", carrierStatus: null });
    expect(lines[0]).toContain("TimeoutError");
  });

  it("fills carrierStatus and the delivered date from the carrier", async () => {
    const { impl } = carrierFetch();
    const out = await applyCarrierTracking([row({ id: "a" })], { env: UPS_KEYS, fetchImpl: impl, now: () => Date.parse("2026-10-03T12:00:00Z"), log: silent });
    expect(out[0]).toMatchObject({
      status: "delivered",
      deliveredAt: "2021-02-12",
      carrierStatus: {
        source: "ups",
        checkedAt: "2026-10-03T12:00:00.000Z",
        latestEvent: "Delivered",
        latestEventAt: "2021-02-12T14:15:00-05:00",
        latestLocation: "Wayne, NJ",
      },
    });
  });

  it("does not overwrite staff delivered / cancelled unless the carrier says delivered", async () => {
    expect(mergeStatus("delivered", "in_transit")).toBe("delivered");
    expect(mergeStatus("cancelled", "exception")).toBe("cancelled");
    expect(mergeStatus("cancelled", "delivered")).toBe("delivered");
    expect(mergeStatus("processing", "unknown")).toBe("processing");
    expect(mergeStatus("processing", "in_transit")).toBe("in_transit");

    const { impl } = carrierFetch((url) => (url.includes("/tracking/v3/") ? { body: uspsFixture.documentedExample } : defaultTrack(url)));
    const out = await applyCarrierTracking([row({ id: "a", carrier: "USPS", trackingNumber: "940010000000", status: "delivered", deliveredAt: "2026-09-01" })], {
      env: USPS_KEYS,
      fetchImpl: impl,
      log: silent,
    });
    expect(out[0]).toMatchObject({ status: "delivered", deliveredAt: "2026-09-01", carrierStatus: { source: "usps" } });
  });

  it("caches each answer for 15 minutes per tracking number", async () => {
    let t = 5_000_000;
    const now = () => t;
    const { impl, calls } = carrierFetch();
    const trackCalls = () => calls.filter((c) => c.url.includes("/api/track/")).length;
    const opts = { env: UPS_KEYS, fetchImpl: impl, now, log: silent };
    await applyCarrierTracking([row({ id: "a" })], opts);
    await applyCarrierTracking([row({ id: "a" })], opts);
    expect(trackCalls()).toBe(1);
    t += CARRIER_CACHE_TTL_MS - 1;
    await applyCarrierTracking([row({ id: "a" })], opts);
    expect(trackCalls()).toBe(1);
    t += 2;
    await applyCarrierTracking([row({ id: "a" })], opts);
    expect(trackCalls()).toBe(2);
  });

  it("caches failures too, so a dead number is not retried every load", async () => {
    const { impl, calls } = carrierFetch(() => ({ status: 404, body: {} }));
    const opts = { env: UPS_KEYS, fetchImpl: impl, log: silent };
    await applyCarrierTracking([row({ id: "a" })], opts);
    await applyCarrierTracking([row({ id: "a" })], opts);
    expect(calls.filter((c) => c.url.includes("/api/track/"))).toHaveLength(1);
  });

  it("looks up at most `cap` rows, newest first, with limited concurrency", async () => {
    let active = 0;
    let peak = 0;
    const impl = vi.fn(async (input: any) => {
      const url = String(input);
      if (url.endsWith("/oauth/token")) return new Response(JSON.stringify(upsFixture.tokenResponse), { status: 200 });
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return new Response(JSON.stringify(upsFixture.delivered), { status: 200 });
    }) as unknown as typeof fetch;
    const rows = Array.from({ length: 30 }, (_, i) => row({ id: `r${i}`, trackingNumber: `1ZTEST${String(i).padStart(4, "0")}` }));
    const out = await applyCarrierTracking(rows, { env: UPS_KEYS, fetchImpl: impl, log: silent, cap: 25, concurrency: 4 });
    expect(out.slice(0, 25).every((s) => s.carrierStatus?.source === "ups")).toBe(true);
    expect(out.slice(25).every((s) => s.carrierStatus === null && s.status === "in_transit")).toBe(true);
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it("skips rows with no tracking number, an unknown carrier or a UPS number of the wrong length", async () => {
    const { impl } = carrierFetch();
    const out = await applyCarrierTracking(
      [row({ id: "a", trackingNumber: null }), row({ id: "b", carrier: "DHL" }), row({ id: "c", trackingNumber: "1Z12" }), row({ id: "d", trackingNumber: "1Z 023E 2X02 1432 3462" })],
      { env: UPS_KEYS, fetchImpl: impl, log: silent },
    );
    expect(out.map((s) => s.carrierStatus?.source ?? null)).toEqual([null, null, null, "ups"]);
  });

  it("returns within the page budget; slow lookups keep the staff status", async () => {
    const impl = vi.fn(async (input: any) => {
      if (String(input).endsWith("/oauth/token")) return new Response(JSON.stringify(upsFixture.tokenResponse), { status: 200 });
      return new Promise<Response>(() => undefined); // never answers
    }) as unknown as typeof fetch;
    const started = Date.now();
    const out = await applyCarrierTracking([row({ id: "a", status: "processing" })], { env: UPS_KEYS, fetchImpl: impl, log: silent, budgetMs: 30 });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(out[0]).toMatchObject({ status: "processing", carrierStatus: null });
  });
});

describe("carrierTrackingConfig", () => {
  it("answers booleans only, true only with both id and secret", () => {
    const cfg = carrierTrackingConfig({ ...UPS_KEYS, PORTAL_CARRIER_FEDEX_CLIENT_ID: "only-id", PORTAL_CARRIER_USPS_CLIENT_SECRET: " " });
    expect(cfg).toEqual({ ups: { configured: true }, fedex: { configured: false }, usps: { configured: false } });
    expect(JSON.stringify(cfg)).not.toContain("ups-id");
  });
});

describe("manual provider with carriers", () => {
  afterEach(() => vi.restoreAllMocks());

  it("recounts active shipments after the carrier answer", async () => {
    const { impl } = carrierFetch();
    const at = "2026-10-01T00:00:00.000Z";
    const data = await buildManualDataWithCarriers(
      [
        { id: "m1", clientId: "acme", kind: "shipment", createdBy: null, createdAt: at, updatedAt: at, data: { carrier: "UPS", trackingNumber: UPS_NO, status: "in_transit", shippedAt: "2026-09-30" } },
        { id: "m2", clientId: "acme", kind: "shipment", createdBy: null, createdAt: at, updatedAt: at, data: { carrier: "Other", trackingNumber: "X1", status: "processing", shippedAt: "2026-09-29" } },
      ],
      { env: UPS_KEYS, fetchImpl: impl, log: silent },
    );
    expect(data.shipments.map((s) => [s.id, s.status, s.carrierStatus?.source ?? null])).toEqual([
      ["m1", "delivered", "ups"],
      ["m2", "processing", null],
    ]);
    expect(data.counts).toEqual({ active: 1, total: 2 });
  });
});
