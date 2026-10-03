import type { CarrierId, CarrierStatus, Env, NormalizedShipment, ShipmentStatus } from "../types";
import { isSandbox, readCredentials, trackWithCarrier, type CarrierAdapter, type CarrierTrackResult } from "./common";
import { fedexAdapter } from "./fedex";
import { upsAdapter } from "./ups";
import { uspsAdapter } from "./usps";

/**
 * Carrier tracking for PORTAL_SHIPPING_PROVIDER=manual (see ../README.md,
 * "Carrier tracking"). When DE staff entered a carrier and tracking number,
 * the page asks that carrier for the current status, but only for carriers
 * whose keys are set. With no keys (or PORTAL_CARRIER_TRACKING=off) nothing
 * is called and every row keeps its staff-entered status.
 */

export const CARRIER_ADAPTERS: Record<CarrierId, CarrierAdapter> = {
  ups: upsAdapter,
  fedex: fedexAdapter,
  usps: uspsAdapter,
};

export const CARRIER_IDS = ["ups", "fedex", "usps"] as const satisfies readonly CarrierId[];

/** PORTAL_CARRIER_TRACKING=off (also false / 0 / no / disabled) turns every carrier lookup off. */
export const CARRIER_TRACKING_SWITCH_ENV = "PORTAL_CARRIER_TRACKING";

/** Newest rows looked up per page load; the rest keep the staff status. */
export const CARRIER_LOOKUP_CAP = 25;
/** Parallel carrier lookups per page load. */
export const CARRIER_LOOKUP_CONCURRENCY = 4;
/** A carrier answer (or failure) is reused for this long per tracking number. */
export const CARRIER_CACHE_TTL_MS = 15 * 60_000;
/**
 * The page waits at most this long for lookups. Slower ones keep running
 * and fill the cache for the next load; their rows keep the staff status now.
 */
export const CARRIER_PAGE_BUDGET_MS = 8_000;

export function carrierTrackingEnabled(env: Env): boolean {
  const v = (env[CARRIER_TRACKING_SWITCH_ENV] || "").trim().toLowerCase();
  return !["off", "false", "0", "no", "disabled"].includes(v);
}

/**
 * Per carrier: are both its client id and secret set? Booleans only, never a
 * value, for the DE-admin setup page. Independent of the kill switch
 * (carrierTrackingEnabled).
 */
export function carrierTrackingConfig(env: Env): Record<CarrierId, { configured: boolean }> {
  return {
    ups: { configured: !!readCredentials(env, upsAdapter.envVars) },
    fedex: { configured: !!readCredentials(env, fedexAdapter.envVars) },
    usps: { configured: !!readCredentials(env, uspsAdapter.envVars) },
  };
}

/** Env var names per carrier (names only), for the setup page and docs. */
export const CARRIER_ENV_VARS: Record<CarrierId, { clientId: string; clientSecret: string; env: string }> = {
  ups: upsAdapter.envVars,
  fedex: fedexAdapter.envVars,
  usps: uspsAdapter.envVars,
};

/**
 * The staff-entered carrier name as a carrier id, or null. Case-insensitive;
 * accepts the service-level names staff tend to type ("UPS Ground",
 * "FedEx 2Day", "Fed Ex", "Federal Express", "USPS Priority Mail",
 * "U.S. Postal Service", "United States Postal Service").
 */
export function normalizeCarrierName(raw: string | null | undefined): CarrierId | null {
  if (!raw) return null;
  const words = raw.toLowerCase().replace(/\./g, "").split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return null;
  const joined = words.join("");
  if (words[0] === "usps" || joined.startsWith("unitedstatespostal") || joined.startsWith("uspostal") || joined === "postalservice") {
    return "usps";
  }
  if (words[0] === "ups" || joined.startsWith("unitedparcelservice")) return "ups";
  if (joined.startsWith("fedex") || joined.startsWith("federalexpress")) return "fedex";
  return null;
}

/** Tracking numbers are sent without spaces (staff often paste them grouped). */
export function cleanTrackingNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw.replace(/\s+/g, "");
  return n || null;
}

/**
 * Staff status vs carrier status: an unmappable carrier code keeps the staff
 * status, and a staff "delivered" / "cancelled" is only replaced when the
 * carrier says delivered.
 */
export function mergeStatus(staff: ShipmentStatus, carrier: ShipmentStatus): ShipmentStatus {
  if (carrier === "unknown") return staff;
  if ((staff === "delivered" || staff === "cancelled") && carrier !== "delivered") return staff;
  return carrier;
}

// ---------- result cache ----------

type CacheEntry = { at: number; result: CarrierTrackResult | null };
const resultCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();
const MAX_CACHE_ENTRIES = 5_000;

function pruneCache(now: number) {
  if (resultCache.size <= MAX_CACHE_ENTRIES) return;
  for (const [k, v] of resultCache) if (now - v.at >= CARRIER_CACHE_TTL_MS) resultCache.delete(k);
  // Still too big: drop the oldest insertions.
  for (const k of resultCache.keys()) {
    if (resultCache.size <= MAX_CACHE_ENTRIES) break;
    resultCache.delete(k);
  }
}

/** Tests only. */
export function _resetCarrierCache() {
  resultCache.clear();
  inflight.clear();
}

type Job = { index: number; carrier: CarrierId; trackingNumber: string; shipmentId: string };

export type CarrierTrackingOptions = {
  env: Env;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Overrides for tests. */
  cap?: number;
  concurrency?: number;
  budgetMs?: number;
  log?: (line: string) => void;
};

function lookup(job: Job, sandbox: boolean, opts: Required<Pick<CarrierTrackingOptions, "fetchImpl" | "now" | "log">> & { env: Env }) {
  const key = `${job.carrier}|${sandbox ? "sandbox" : "production"}|${job.trackingNumber}`;
  const hit = resultCache.get(key);
  if (hit && opts.now() - hit.at < CARRIER_CACHE_TTL_MS) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;
  const adapter = CARRIER_ADAPTERS[job.carrier];
  const creds = readCredentials(opts.env, adapter.envVars);
  const p = (async (): Promise<CacheEntry> => {
    const at = opts.now();
    try {
      if (!creds) throw new Error(`${job.carrier} is not configured`);
      const result = await trackWithCarrier(adapter, creds, sandbox, job.trackingNumber, { fetchImpl: opts.fetchImpl, now: opts.now });
      return { at, result };
    } catch (err) {
      // Name + message only: CarrierError messages carry the carrier, step and HTTP status, never a body or credential.
      const reason = err instanceof Error ? `${err.name}: ${err.message}` : "unknown error";
      opts.log(`[portal shipping] carrier lookup failed for shipment ${job.shipmentId} (${job.carrier}): ${reason}`);
      // Failures are cached too, so a dead number is not retried on every page load.
      return { at, result: null };
    }
  })().then((entry) => {
    resultCache.set(key, entry);
    pruneCache(opts.now());
    return entry;
  });
  const tracked = p.finally(() => inflight.delete(key));
  inflight.set(key, tracked);
  return tracked;
}

/**
 * Adds carrierStatus to staff-entered shipments (expects newest first) and
 * merges the carrier's status in. Every row gets carrierStatus: null unless a
 * carrier answered for it. Never throws for a carrier fault.
 */
export async function applyCarrierTracking(shipments: NormalizedShipment[], opts: CarrierTrackingOptions): Promise<NormalizedShipment[]> {
  const out: NormalizedShipment[] = shipments.map((s) => ({ ...s, carrierStatus: null }));
  const { env } = opts;
  if (!carrierTrackingEnabled(env)) return out;
  const configured = carrierTrackingConfig(env);
  if (!CARRIER_IDS.some((c) => configured[c].configured)) return out;

  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const log = opts.log ?? ((line: string) => console.warn(line));
  const cap = opts.cap ?? CARRIER_LOOKUP_CAP;

  const jobs: Job[] = [];
  out.forEach((s, index) => {
    if (jobs.length >= cap) return;
    const carrier = normalizeCarrierName(s.carrier);
    const trackingNumber = cleanTrackingNumber(s.trackingNumber);
    if (!carrier || !trackingNumber || !configured[carrier].configured) return;
    if (!CARRIER_ADAPTERS[carrier].isValidTrackingNumber(trackingNumber)) return;
    jobs.push({ index, carrier, trackingNumber, shipmentId: s.id });
  });
  if (!jobs.length) return out;

  const done = new Map<number, CacheEntry>();
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const sandbox = isSandbox(env, CARRIER_ADAPTERS[job.carrier].envVars.env);
      done.set(job.index, await lookup(job, sandbox, { env, fetchImpl, now, log }));
    }
  };
  const workers = Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? CARRIER_LOOKUP_CONCURRENCY, jobs.length)) }, worker);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, opts.budgetMs ?? CARRIER_PAGE_BUDGET_MS);
    timer.unref?.();
  });
  await Promise.race([Promise.all(workers), budget]);
  if (timer) clearTimeout(timer);

  for (const job of jobs) {
    const entry = done.get(job.index);
    if (!entry?.result) continue;
    const row = out[job.index];
    const r = entry.result;
    const carrierStatus: CarrierStatus = {
      source: job.carrier,
      checkedAt: new Date(entry.at).toISOString(),
      latestEvent: r.latestEvent,
      latestEventAt: r.latestEventAt,
      latestLocation: r.latestLocation,
    };
    const status = mergeStatus(row.status, r.status);
    const deliveredAt =
      row.deliveredAt ?? (status === "delivered" && r.status === "delivered" && r.latestEventAt ? r.latestEventAt.slice(0, 10) : null);
    out[job.index] = { ...row, status, deliveredAt, carrierStatus };
  }
  return out;
}
