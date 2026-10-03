import type { ShipmentStatus } from "../types";
import { CarrierError, carrierJson, cityState, isRecord, readTokenGrant, text, type CarrierAdapter, type CarrierTrackResult } from "./common";

/**
 * USPS Tracking 3.0 on the current USPS APIs platform (apis.usps.com, OAuth 2.0).
 * The legacy Web Tools XML APIs were retired on January 25, 2026
 * (https://www.usps.com/business/web-tools-apis/), so they are not used.
 *
 * Source: USPS's official examples repository, https://github.com/USPS/api-examples
 * (README.md "OAuth Token", "Tracking"; Example-Postman.postman_collection.json),
 * which mirrors developers.usps.com. developers.usps.com and apis.usps.com were
 * blocked by the build machine's egress proxy.
 *
 * Hosts (README: "To use the API in Test Environment you need to change the URL
 * from https://apis.usps.com to https://apis-tem.usps.com"):
 *   production  https://apis.usps.com
 *   sandbox     https://apis-tem.usps.com
 */

export const USPS_ENV = {
  clientId: "PORTAL_CARRIER_USPS_CLIENT_ID",
  clientSecret: "PORTAL_CARRIER_USPS_CLIENT_SECRET",
  env: "PORTAL_CARRIER_USPS_ENV",
} as const;

/** No USPS tracking-number format is published in the reachable docs: path-safety check only. */
export function isValidUspsTrackingNumber(n: string): boolean {
  return /^[A-Za-z0-9]{1,64}$/.test(n);
}

/**
 * Top-level statusCategory. The full value list is on developers.usps.com
 * (unreachable from the build machine). Mapped here are only the values the
 * reachable official docs show: "Accepted" (USPS api-examples README,
 * Tracking detail example) and "In Transit" / "Delivered" (USPS Track &
 * Confirm user guide, https://www.usps.com/business/web-tools-apis/track-and-confirm-api.pdf).
 * Anything else is "unknown", so the staff-entered status stays.
 */
export function mapUspsStatus(category: string | null): ShipmentStatus {
  switch ((category || "").trim().toLowerCase()) {
    case "delivered":
      return "delivered";
    case "accepted":
    case "in transit":
      return "in_transit";
    default:
      return "unknown";
  }
}

/**
 * USPS eventTimestamp is the scan's local wall-clock time even though it ends
 * in "Z": the documented example pairs "2023-08-02T07:31:00Z" with the summary
 * "7:31 am on August 2, 2023 in RICHMOND, VA". The "Z" is dropped so the page
 * shows the local time instead of shifting it by the viewer's offset.
 */
export function uspsLocalTimestamp(v: unknown): string | null {
  const s = text(v);
  if (!s) return null;
  const local = s.replace(/(?:Z|[+-]00:?00)$/i, "");
  return Number.isNaN(Date.parse(local)) ? null : local;
}

export function mapUspsResponse(body: unknown): CarrierTrackResult {
  if (!isRecord(body) || (!text(body.statusCategory) && !Array.isArray(body.trackingEvents))) {
    throw new CarrierError("usps answer held no tracking result for the number");
  }
  const events = Array.isArray(body.trackingEvents) ? body.trackingEvents.filter(isRecord) : [];
  let newest: Record<string, unknown> | null = null;
  for (const e of events) {
    const t = uspsLocalTimestamp(e.eventTimestamp);
    if (!t) continue;
    if (!newest || Date.parse(t) > Date.parse(uspsLocalTimestamp(newest.eventTimestamp) as string)) newest = e;
  }
  return {
    status: mapUspsStatus(text(body.statusCategory)),
    latestEvent: (newest && text(newest.eventType)) ?? text(body.status),
    latestEventAt: newest ? uspsLocalTimestamp(newest.eventTimestamp) : null,
    latestLocation: newest ? cityState(newest.eventCity, newest.eventState) : null,
  };
}

export const uspsAdapter: CarrierAdapter = {
  id: "usps",
  envVars: USPS_ENV,
  isValidTrackingNumber: isValidUspsTrackingNumber,
  baseUrl: (sandbox) => (sandbox ? "https://apis-tem.usps.com" : "https://apis.usps.com"),

  // https://github.com/USPS/api-examples#oauth-token ("Example OAuth Client Credentials Token request"):
  // POST /oauth2/v3/token, JSON { client_id, client_secret, grant_type: "client_credentials" };
  // answers access_token and expires_in (a string of seconds).
  async issueToken(creds, baseUrl, fetchImpl) {
    const body = await carrierJson(
      "usps",
      "token",
      `${baseUrl}/oauth2/v3/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: creds.clientId, client_secret: creds.clientSecret, grant_type: "client_credentials" }),
      },
      fetchImpl,
    );
    return readTokenGrant("usps", body);
  },

  // https://github.com/USPS/api-examples#tracking ("Tracking - Single Request - Detail"):
  // GET /tracking/v3/tracking/{Tracking Number}?expand=DETAIL, Authorization: Bearer.
  async track(token, trackingNumber, baseUrl, fetchImpl) {
    return carrierJson(
      "usps",
      "track",
      `${baseUrl}/tracking/v3/tracking/${encodeURIComponent(trackingNumber)}?expand=DETAIL`,
      { method: "GET", headers: { Authorization: `Bearer ${token}` } },
      fetchImpl,
    );
  },

  map: mapUspsResponse,
};
