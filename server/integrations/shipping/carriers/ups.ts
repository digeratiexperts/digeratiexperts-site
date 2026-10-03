import { randomUUID } from "crypto";
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
 * UPS Tracking API (OAuth client credentials).
 *
 * Source: UPS's official OpenAPI specs, github.com/UPS-API/api-documentation
 * (Tracking.yaml, OAuthClientCredentials.yaml, UPSTrackAlert.yaml), the specs
 * developer.ups.com renders. developer.ups.com itself was blocked by the
 * build machine's egress proxy.
 *
 * Hosts (both specs list them as separate servers):
 *   production  https://onlinetools.ups.com
 *   sandbox     https://wwwcie.ups.com   ("Customer Integration Environment")
 */

export const UPS_ENV = {
  clientId: "PORTAL_CARRIER_UPS_CLIENT_ID",
  clientSecret: "PORTAL_CARRIER_UPS_CLIENT_SECRET",
  env: "PORTAL_CARRIER_UPS_ENV",
} as const;

/** Tracking.yaml: transactionSrc "Identifies the client/source application that is calling" (required header). */
export const UPS_TRANSACTION_SRC = "digerati-portal";

/**
 * Tracking.yaml, inquiryNumber: "Each inquiry number must be between 7 and 34
 * characters in length." The alphanumeric rule is this server's path-safety
 * check, not a UPS rule.
 */
export function isValidUpsTrackingNumber(n: string): boolean {
  return /^[A-Za-z0-9]{7,34}$/.test(n);
}

/**
 * Package currentStatus.type. Tracking.yaml describes it as "The activity
 * status type" (example "X") without listing values; UPS's Track Alert spec
 * (UPSTrackAlert.yaml, activityStatus.type) lists them:
 *   D Delivery · I On the Way · M Manifest · MV Manifest Void ·
 *   U Updated Delivery Date or Time · X Package Exception
 * "D" covers the delivery stage, so "delivered" also needs the package's
 * deliveryDate (type "DEL" = Delivered Date) or deliveryTime (type "DEL" =
 * Delivered Time); without one it counts as in transit.
 */
export function mapUpsStatus(type: string | null, delivered: boolean): ShipmentStatus {
  switch ((type || "").toUpperCase()) {
    case "D":
      return delivered ? "delivered" : "in_transit";
    case "I":
    case "U":
      return "in_transit";
    case "M":
      return "label_created";
    case "MV":
      return "cancelled";
    case "X":
      return "exception";
    default:
      return "unknown";
  }
}

/**
 * Activity date "YYYYMMDD" + time "HHMMSS" (local, 24 h) + gmtOffset
 * ("-05:00") as ISO 8601; date only when the time is missing.
 */
export function upsActivityTimestamp(a: Record<string, unknown>): string | null {
  const date = text(a.date);
  if (!date || !/^\d{8}$/.test(date)) return null;
  const day = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
  const rawTime = text(a.time);
  if (!rawTime || !/^\d{5,6}$/.test(rawTime)) return day;
  const t = rawTime.padStart(6, "0");
  const offset = text(a.gmtOffset);
  const iso = `${day}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}${offset && /^[+-]\d{2}:\d{2}$/.test(offset) ? offset : ""}`;
  return Number.isNaN(Date.parse(iso)) ? day : iso;
}

/** Maps a TrackApiResponse: trackResponse.shipment[0].package[0]. */
export function mapUpsResponse(body: unknown): CarrierTrackResult {
  const tr = isRecord(body) && isRecord(body.trackResponse) ? body.trackResponse : null;
  const shipment = tr ? firstRecord(tr.shipment) : null;
  const pkg = shipment ? firstRecord(shipment.package) : null;
  if (!pkg) throw new CarrierError("ups answer held no package for the number");
  const current = isRecord(pkg.currentStatus) ? pkg.currentStatus : {};
  const delivered =
    (Array.isArray(pkg.deliveryDate) && pkg.deliveryDate.some((d) => isRecord(d) && d.type === "DEL")) ||
    (isRecord(pkg.deliveryTime) && pkg.deliveryTime.type === "DEL");
  // Tracking.yaml, Activity: "Activities are returned in chronological order, with the most recent activity first."
  const latest = firstRecord(pkg.activity);
  const latestStatus = latest && isRecord(latest.status) ? latest.status : {};
  const address = latest && isRecord(latest.location) && isRecord(latest.location.address) ? latest.location.address : {};
  return {
    status: mapUpsStatus(text(current.type) ?? text(latestStatus.type), delivered),
    latestEvent: text(latestStatus.description) ?? text(current.description) ?? text(pkg.statusDescription),
    latestEventAt: latest ? upsActivityTimestamp(latest) : null,
    latestLocation: cityState(address.city, address.stateProvince),
  };
}

export const upsAdapter: CarrierAdapter = {
  id: "ups",
  envVars: UPS_ENV,
  isValidTrackingNumber: isValidUpsTrackingNumber,
  baseUrl: (sandbox) => (sandbox ? "https://wwwcie.ups.com" : "https://onlinetools.ups.com"),

  // https://github.com/UPS-API/api-documentation/blob/main/OAuthClientCredentials.yaml
  // (developer.ups.com/api/reference/oauth/client-credentials): POST /security/v1/oauth/token,
  // HTTP Basic (client id : secret), form body grant_type=client_credentials;
  // answers access_token and expires_in ("Expire time for requested token in seconds", a string).
  async issueToken(creds, baseUrl, fetchImpl) {
    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, "utf8").toString("base64");
    const body = await carrierJson(
      "ups",
      "token",
      `${baseUrl}/security/v1/oauth/token`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
      },
      fetchImpl,
    );
    return readTokenGrant("ups", body);
  },

  // https://github.com/UPS-API/api-documentation/blob/main/Tracking.yaml
  // (developer.ups.com/api/reference/tracking): GET /api/track/v1/details/{inquiryNumber},
  // OAuth bearer, required headers transId ("An identifier unique to the request")
  // and transactionSrc.
  async track(token, trackingNumber, baseUrl, fetchImpl) {
    return carrierJson(
      "ups",
      "track",
      `${baseUrl}/api/track/v1/details/${encodeURIComponent(trackingNumber)}?locale=en_US`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          transId: randomUUID().replace(/-/g, ""),
          transactionSrc: UPS_TRANSACTION_SRC,
        },
      },
      fetchImpl,
    );
  },

  map: mapUpsResponse,
};
