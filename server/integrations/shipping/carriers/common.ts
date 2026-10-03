import type { CarrierId, Env, ShipmentStatus } from "../types";
import { VENDOR_TIMEOUT_MS } from "../types";

/**
 * Shared plumbing for the carrier tracking adapters (ups.ts, fedex.ts,
 * usps.ts): HTTP with a 10 s timeout and status-only errors, and an OAuth
 * access-token cache. Nothing here ever puts a credential, a token or a
 * carrier response body into an error message or a log line.
 */

/** What one carrier said about one tracking number, already normalized. */
export type CarrierTrackResult = {
  /** "unknown" when the carrier's code is not one we can map; the staff status is then kept. */
  status: ShipmentStatus;
  latestEvent: string | null;
  latestEventAt: string | null;
  latestLocation: string | null;
};

export type CarrierCredentials = { clientId: string; clientSecret: string };

export type TokenGrant = { accessToken: string; expiresInSec: number | null };

export type CarrierAdapter = {
  id: CarrierId;
  /** Env var names, for the admin setup page and the README. Values are never read out. */
  envVars: { clientId: string; clientSecret: string; env: string };
  /** Format check only where the carrier's docs define one. */
  isValidTrackingNumber(trackingNumber: string): boolean;
  issueToken(creds: CarrierCredentials, baseUrl: string, fetchImpl: typeof fetch): Promise<TokenGrant>;
  /** One tracking request; throws CarrierError (httpStatus 401 lets the caller refresh the token once). */
  track(token: string, trackingNumber: string, baseUrl: string, fetchImpl: typeof fetch): Promise<unknown>;
  /** Maps the carrier's answer; throws CarrierError when it holds no result for the number. */
  map(body: unknown): CarrierTrackResult;
  baseUrl(sandbox: boolean): string;
};

/** A carrier request failed. The message names the carrier and HTTP status only. */
export class CarrierError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null = null,
  ) {
    super(message);
    this.name = "CarrierError";
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function text(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function firstRecord(v: unknown): Record<string, unknown> | null {
  return Array.isArray(v) && isRecord(v[0]) ? v[0] : null;
}

/** "City, ST" from whichever parts are present; null when neither is. */
export function cityState(city: unknown, state: unknown): string | null {
  const parts = [text(city), text(state)].filter((p): p is string => !!p);
  return parts.length ? parts.join(", ") : null;
}

/** Reads a carrier's client id + secret from env; null unless both are set. */
export function readCredentials(env: Env, names: { clientId: string; clientSecret: string }): CarrierCredentials | null {
  const clientId = (env[names.clientId] || "").trim();
  const clientSecret = (env[names.clientSecret] || "").trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/** PORTAL_CARRIER_<X>_ENV=sandbox selects the carrier's documented test host; anything else is production. */
export function isSandbox(env: Env, name: string): boolean {
  return (env[name] || "").trim().toLowerCase() === "sandbox";
}

/**
 * One JSON request to a carrier with a 10 s timeout. Failures become a
 * CarrierError naming the carrier, the step and the HTTP status: never the
 * body (it can echo request details) and never a header.
 */
export async function carrierJson(
  carrier: CarrierId,
  step: string,
  url: string,
  init: { method: "GET" | "POST"; headers: Record<string, string>; body?: string },
  fetchImpl: typeof fetch,
): Promise<unknown> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: init.method,
      headers: { Accept: "application/json", ...init.headers },
      body: init.body,
      signal: AbortSignal.timeout(VENDOR_TIMEOUT_MS),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    throw new CarrierError(`${carrier} ${step} request failed (${name})`);
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new CarrierError(`${carrier} ${step} answered HTTP ${res.status}`, res.status);
  }
  try {
    return await res.json();
  } catch {
    throw new CarrierError(`${carrier} ${step} answered with invalid JSON`);
  }
}

/** Reads an OAuth token answer: access_token plus expires_in (seconds, number or numeric string). */
export function readTokenGrant(carrier: CarrierId, body: unknown): TokenGrant {
  const accessToken = isRecord(body) ? text(body.access_token) : null;
  if (!accessToken) throw new CarrierError(`${carrier} token answer had no access_token`);
  const raw = isRecord(body) ? body.expires_in : undefined;
  const n = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() ? Number(raw) : NaN;
  return { accessToken, expiresInSec: Number.isFinite(n) && n > 0 ? n : null };
}

// ---------- token cache ----------

/** Used when a token answer carries no usable expires_in. */
const FALLBACK_TOKEN_TTL_SEC = 300;
/** Refresh this long before the carrier's stated expiry. */
const TOKEN_REFRESH_MARGIN_SEC = 60;

const tokens = new Map<string, { token: string; expiresAt: number }>();
const pendingTokens = new Map<string, Promise<string>>();

export function tokenExpiresAt(grant: TokenGrant, now: number): number {
  const ttl = grant.expiresInSec ?? FALLBACK_TOKEN_TTL_SEC;
  const usable = ttl > TOKEN_REFRESH_MARGIN_SEC * 2 ? ttl - TOKEN_REFRESH_MARGIN_SEC : ttl / 2;
  return now + usable * 1000;
}

/**
 * The cached token for `key` until shortly before it expires; one issue
 * request at a time per key (parallel lookups share it). The key holds the
 * carrier, host and client id, never the secret.
 */
export async function cachedToken(key: string, now: () => number, issue: () => Promise<TokenGrant>): Promise<string> {
  const hit = tokens.get(key);
  if (hit && hit.expiresAt > now()) return hit.token;
  const pending = pendingTokens.get(key);
  if (pending) return pending;
  const p = issue()
    .then((grant) => {
      tokens.set(key, { token: grant.accessToken, expiresAt: tokenExpiresAt(grant, now()) });
      return grant.accessToken;
    })
    .finally(() => pendingTokens.delete(key));
  pendingTokens.set(key, p);
  return p;
}

export function dropToken(key: string) {
  tokens.delete(key);
}

/** Tests only. */
export function _resetCarrierTokens() {
  tokens.clear();
  pendingTokens.clear();
}

/**
 * Track one number: get (or reuse) the token, ask the carrier, map the
 * answer. A 401 on the tracking call drops the cached token and retries once
 * with a fresh one (FedEx's best-practice guide: cache the token until a 401).
 */
export async function trackWithCarrier(
  adapter: CarrierAdapter,
  creds: CarrierCredentials,
  sandbox: boolean,
  trackingNumber: string,
  opts: { fetchImpl: typeof fetch; now: () => number },
): Promise<CarrierTrackResult> {
  const baseUrl = adapter.baseUrl(sandbox);
  const key = `${adapter.id}|${baseUrl}|${creds.clientId}`;
  const issue = () => adapter.issueToken(creds, baseUrl, opts.fetchImpl);
  let token = await cachedToken(key, opts.now, issue);
  let body: unknown;
  try {
    body = await adapter.track(token, trackingNumber, baseUrl, opts.fetchImpl);
  } catch (err) {
    if (!(err instanceof CarrierError) || err.httpStatus !== 401) throw err;
    dropToken(key);
    token = await cachedToken(key, opts.now, issue);
    body = await adapter.track(token, trackingNumber, baseUrl, opts.fetchImpl);
  }
  return adapter.map(body);
}
