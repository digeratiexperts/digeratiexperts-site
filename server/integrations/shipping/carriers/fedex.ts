import type { ShipmentStatus } from "../types";
import {
  CarrierError,
  carrierJson,
  cityState,
  firstRecord,
  isRecord,
  readTokenGrant,
  text,
  type CarrierAdapter,
  type CarrierTrackResult,
} from "./common";

/**
 * FedEx Track API ("Basic Integrated Visibility", formerly Track API), OAuth.
 *
 * Source: developer.fedex.com, read through search-engine excerpts of the
 * official pages because developer.fedex.com was blocked by the build
 * machine's egress proxy, and FedEx publishes no official SDK or OpenAPI file
 * on GitHub or npm. See README.md "Carrier tracking" for what is confirmed and
 * what must be checked against the docs before the keys are set.
 *
 *   Auth:  https://developer.fedex.com/api/en-us/catalog/authorization/docs.html
 *   Track: https://developer.fedex.com/api/en-us/catalog/track/docs.html
 *   Hosts: https://apis.fedex.com (production), https://apis-sandbox.fedex.com (test)
 */

export const FEDEX_ENV = {
  clientId: "PORTAL_CARRIER_FEDEX_CLIENT_ID",
  clientSecret: "PORTAL_CARRIER_FEDEX_CLIENT_SECRET",
  env: "PORTAL_CARRIER_FEDEX_ENV",
} as const;

/**
 * No FedEx tracking-number format was found in the reachable docs, so only
 * this server's path / body safety check applies.
 */
export function isValidFedexTrackingNumber(n: string): boolean {
  return /^[A-Za-z0-9]{1,64}$/.test(n);
}

/**
 * latestStatusDetail.code. Only the codes confirmed for the Track API
 * response are mapped: DL delivered, OD out for delivery, IT in transit,
 * PU picked up, OC order (label) created, SE shipment exception, CA cancelled.
 * Any other code is "unknown", so the staff-entered status stays.
 */
export function mapFedexStatus(code: string | null): ShipmentStatus {
  switch ((code || "").toUpperCase()) {
    case "DL":
      return "delivered";
    case "OD":
    case "IT":
    case "PU":
      return "in_transit";
    case "OC":
      return "label_created";
    case "SE":
      return "exception";
    case "CA":
      return "cancelled";
    default:
      return "unknown";
  }
}

function parsedTime(v: unknown): number {
  const s = text(v);
  return s ? Date.parse(s) : NaN;
}

/** Maps output.completeTrackResults[0].trackResults[0]. */
export function mapFedexResponse(body: unknown): CarrierTrackResult {
  const output = isRecord(body) && isRecord(body.output) ? body.output : null;
  const complete = output ? firstRecord(output.completeTrackResults) : null;
  const result = complete ? firstRecord(complete.trackResults) : null;
  if (!result) throw new CarrierError("fedex answer held no track result for the number");
  // A per-number error (e.g. not found) comes back inside the 200 answer.
  if (isRecord(result.error) && !isRecord(result.latestStatusDetail)) {
    throw new CarrierError("fedex answered with a track result error");
  }
  const latest = isRecord(result.latestStatusDetail) ? result.latestStatusDetail : {};
  const code = text(latest.code);
  const derived = text(latest.derivedCode);
  let status = mapFedexStatus(code);
  if (status === "unknown") status = mapFedexStatus(derived);

  // Newest scan event by its own timestamp, not by array position.
  const events = Array.isArray(result.scanEvents) ? result.scanEvents.filter(isRecord) : [];
  let newest: Record<string, unknown> | null = null;
  for (const e of events) {
    const t = parsedTime(e.date);
    if (Number.isNaN(t)) continue;
    if (!newest || t > parsedTime(newest.date)) newest = e;
  }
  const loc = newest && isRecord(newest.scanLocation) ? newest.scanLocation : isRecord(latest.scanLocation) ? latest.scanLocation : {};
  return {
    status,
    latestEvent: (newest && text(newest.eventDescription)) ?? text(latest.description) ?? text(latest.statusByLocale),
    latestEventAt: newest ? text(newest.date) : null,
    latestLocation: cityState(loc.city, loc.stateOrProvinceCode),
  };
}

export const fedexAdapter: CarrierAdapter = {
  id: "fedex",
  envVars: FEDEX_ENV,
  isValidTrackingNumber: isValidFedexTrackingNumber,
  baseUrl: (sandbox) => (sandbox ? "https://apis-sandbox.fedex.com" : "https://apis.fedex.com"),

  // https://developer.fedex.com/api/en-us/catalog/authorization/docs.html
  // POST /oauth/token, Content-Type application/x-www-form-urlencoded, form
  // grant_type=client_credentials, client_id (Project API Key), client_secret
  // (Project Secret Key); answers access_token, token_type, expires_in (seconds, standard one hour).
  async issueToken(creds, baseUrl, fetchImpl) {
    const body = await carrierJson(
      "fedex",
      "token",
      `${baseUrl}/oauth/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
        }).toString(),
      },
      fetchImpl,
    );
    return readTokenGrant("fedex", body);
  },

  // https://developer.fedex.com/api/en-us/catalog/track/docs.html
  // POST /track/v1/trackingnumbers ("Track by Tracking Number"), bearer token,
  // body { includeDetailedScans, trackingInfo: [{ trackingNumberInfo: { trackingNumber } }] }
  // (up to 30 numbers per request; one is sent).
  async track(token, trackingNumber, baseUrl, fetchImpl) {
    return carrierJson(
      "fedex",
      "track",
      `${baseUrl}/track/v1/trackingnumbers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-locale": "en_US" },
        body: JSON.stringify({
          includeDetailedScans: true,
          trackingInfo: [{ trackingNumberInfo: { trackingNumber } }],
        }),
      },
      fetchImpl,
    );
  },

  map: mapFedexResponse,
};
