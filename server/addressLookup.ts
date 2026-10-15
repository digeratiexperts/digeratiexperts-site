import type { Express, Request, Response as ExpressResponse } from "express";
import rateLimit from "express-rate-limit";
import type { AddressSuggestion } from "@shared/addressLookup";
import { logger } from "./logger";

/**
 * Address type-ahead for the website, Store and Client Portal forms, backed by
 * Geoapify Address Autocomplete (https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/).
 * Joe chose Geoapify on 2026-10-15 (free tier: 3,000 requests a day).
 *
 * The key stays on the server (GEOAPIFY_API_KEY); the browser only ever calls
 * GET /api/address/suggest. Without the key the endpoint answers
 * { enabled: false } and the forms stay plain inputs, so nothing breaks.
 *
 * Quota care: the client debounces and waits for 4 characters, answers are
 * cached in memory for a day, and each IP is rate limited.
 */

export const GEOAPIFY_ENV = "GEOAPIFY_API_KEY";
const GEOAPIFY_URL = "https://api.geoapify.com/v1/geocode/autocomplete";
const TIMEOUT_MS = 4000;
const MIN_QUERY = 4;
const MAX_QUERY = 200;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;
/** ISO 3166-1 alpha-2 codes the forms send; anything else falls back to "us". */
const COUNTRY_RE = /^[a-z]{2}$/;

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const cache = new Map<string, { at: number; value: AddressSuggestion[] }>();

function cacheGet(key: string): AddressSuggestion[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  // Refresh recency (Map keeps insertion order).
  cache.delete(key);
  cache.set(key, hit);
  return hit.value;
}

function cacheSet(key: string, value: AddressSuggestion[]): void {
  cache.set(key, { at: Date.now(), value });
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
}

/** Exported for tests only. */
export function clearAddressCache(): void {
  cache.clear();
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/** Map one Geoapify `format=json` result into the fields our forms use. */
export function toSuggestion(r: Record<string, unknown>): AddressSuggestion | null {
  const house = str(r.housenumber);
  const street = str(r.street);
  const line1 = house && street ? `${house} ${street}` : street || str(r.address_line1) || str(r.name);
  if (!line1) return null;
  const countryCode = str(r.country_code).toUpperCase();
  const stateCode = str(r.state_code).toUpperCase();
  // The lookup is already filtered to one country, so its name is noise in the list.
  const label = (str(r.formatted) || [line1, str(r.address_line2)].filter(Boolean).join(", ")).replace(
    /,\s*(United States of America|United States|USA|Canada|Mexico|United Kingdom)$/i,
    "",
  );
  return {
    label,
    line1,
    city: str(r.city) || str(r.town) || str(r.village) || str(r.suburb),
    state: stateCode || str(r.state),
    stateName: str(r.state),
    postalCode: str(r.postcode),
    country: countryCode,
    hasHouseNumber: Boolean(house),
  };
}

export async function suggestAddresses(
  query: string,
  country: string,
  apiKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<AddressSuggestion[]> {
  const key = `${country}|${query.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = new URL(GEOAPIFY_URL);
  url.searchParams.set("text", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("lang", "en");
  url.searchParams.set("filter", `countrycode:${country}`);
  url.searchParams.set("apiKey", apiKey);

  const res = await fetchImpl(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Geoapify HTTP ${res.status}`);
  const body = (await res.json()) as { results?: Record<string, unknown>[] };
  const seen = new Set<string>();
  const out: AddressSuggestion[] = [];
  for (const r of body.results || []) {
    const s = toSuggestion(r);
    if (!s || seen.has(s.label)) continue;
    seen.add(s.label);
    out.push(s);
  }
  cacheSet(key, out);
  return out;
}

const addressLookupRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  message: { message: "Too many address lookups, please try again shortly", suggestions: [] },
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerAddressLookupRoutes(
  app: Express,
  deps: { apiKey?: () => string | undefined; fetchImpl?: FetchLike } = {},
): void {
  const apiKey = deps.apiKey ?? (() => process.env[GEOAPIFY_ENV]);

  app.get("/api/address/suggest", addressLookupRateLimiter, async (req: Request, res: ExpressResponse) => {
    res.setHeader("Cache-Control", "private, max-age=300");
    const key = apiKey();
    if (!key) return res.json({ enabled: false, suggestions: [] });

    const q = str(req.query.q).replace(/\s+/g, " ");
    const countryRaw = str(req.query.country).toLowerCase();
    const country = COUNTRY_RE.test(countryRaw) ? countryRaw : "us";
    if (q.length < MIN_QUERY || q.length > MAX_QUERY) return res.json({ enabled: true, suggestions: [] });

    try {
      const suggestions = await suggestAddresses(q, country, key, deps.fetchImpl);
      return res.json({ enabled: true, suggestions });
    } catch (error: any) {
      // Never surface vendor errors (or the key in a URL) to the browser.
      logger.warn(`Address lookup failed: ${error?.name === "TimeoutError" ? "timeout" : error?.message || "error"}`);
      return res.json({ enabled: true, suggestions: [], unavailable: true });
    }
  });
}
