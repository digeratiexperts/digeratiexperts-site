import { STORE_TAX_CODE_PENDING } from "@shared/storeTaxCodes";
import { stripeTaxKey } from "./salesTax";

/**
 * Is staff Pay Now able to charge sales tax right now? (2026-10-05)
 *
 * Read-only: it asks Stripe for the Tax settings (origin address) and the
 * active registrations (Arizona), with the same restricted key Pay Now uses.
 * The key needs Tax Settings and Tax Registrations on Read. Nothing here can
 * charge, refund or change Stripe. The answer is cached for a few minutes so
 * the Warehouse pages do not call Stripe on every load.
 *
 * Statuses mirror the Warehouse connector vocabulary and never default to
 * healthy: READY only when the key works, the origin address is set and an
 * Arizona registration is active.
 */

export type StripeTaxReadinessStatus = "READY" | "NOT_CONFIGURED" | "AUTH_REQUIRED" | "INCOMPLETE" | "UNKNOWN";

export interface StripeTaxReadiness {
  status: StripeTaxReadinessStatus;
  checks: {
    key: "set" | "missing";
    originAddress: "set" | "missing" | "unknown";
    arizona: "active" | "missing" | "unknown";
  };
  /** What staff should do next, in one sentence. */
  message: string;
  /** Store categories that stay quote-only until a tax code is confirmed. */
  quoteOnlyCategories: string[];
  checkedAt: string;
}

export const STRIPE_TAX_SETTINGS_URL = "https://api.stripe.com/v1/tax/settings";
export const STRIPE_TAX_REGISTRATIONS_URL = "https://api.stripe.com/v1/tax/registrations?status=active&limit=100";
const READINESS_TTL_MS = 5 * 60 * 1000;
const READINESS_TIMEOUT_MS = 8000;

type StripeReply = { ok: true; body: any } | { ok: false; status: number | "network" };

async function stripeGet(url: string, key: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<StripeReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, body: await response.json().catch(() => null) };
  } catch {
    return { ok: false, status: "network" };
  } finally {
    clearTimeout(timer);
  }
}

function hasActiveArizona(body: any): boolean {
  const rows = Array.isArray(body?.data) ? body.data : [];
  return rows.some(
    (row: any) =>
      row?.status === "active" &&
      row?.country === "US" &&
      row?.country_options?.us?.state === "AZ",
  );
}

export async function checkStripeTaxReadiness(
  options: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; now?: Date; timeoutMs?: number } = {},
): Promise<StripeTaxReadiness> {
  const env = options.env ?? process.env;
  const checkedAt = (options.now ?? new Date()).toISOString();
  const quoteOnlyCategories = Array.from(STORE_TAX_CODE_PENDING);
  const base = { quoteOnlyCategories, checkedAt };

  const key = stripeTaxKey(env);
  if (!key) {
    return {
      ...base,
      status: "NOT_CONFIGURED",
      checks: { key: "missing", originAddress: "unknown", arizona: "unknown" },
      message: "Pay Now is paused: STRIPE_TAX_SECRET_KEY is not set on the server, so every Pay Now cart switches to a quote.",
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? READINESS_TIMEOUT_MS;
  const [settings, registrations] = await Promise.all([
    stripeGet(STRIPE_TAX_SETTINGS_URL, key, fetchImpl, timeoutMs),
    stripeGet(STRIPE_TAX_REGISTRATIONS_URL, key, fetchImpl, timeoutMs),
  ]);

  if ((!settings.ok && settings.status === 401) || (!registrations.ok && registrations.status === 401)) {
    return {
      ...base,
      status: "AUTH_REQUIRED",
      checks: { key: "set", originAddress: "unknown", arizona: "unknown" },
      message: "Stripe rejected STRIPE_TAX_SECRET_KEY (401). Create a new restricted Tax key and replace it on the server.",
    };
  }

  const originAddress: StripeTaxReadiness["checks"]["originAddress"] = settings.ok
    ? settings.body?.status === "active" && settings.body?.head_office
      ? "set"
      : "missing"
    : "unknown";
  const arizona: StripeTaxReadiness["checks"]["arizona"] = registrations.ok
    ? hasActiveArizona(registrations.body)
      ? "active"
      : "missing"
    : "unknown";
  const checks = { key: "set" as const, originAddress, arizona };

  if (originAddress === "missing") {
    return {
      ...base,
      status: "INCOMPLETE",
      checks,
      message: "Stripe Tax has no origin address yet. Add DE's Phoenix address under Stripe Dashboard → Tax → Settings.",
    };
  }
  if (arizona === "missing") {
    return {
      ...base,
      status: "INCOMPLETE",
      checks,
      message: "Stripe Tax has no active Arizona registration, so Arizona clients still switch to a quote. Add Arizona under Stripe Dashboard → Tax → Registrations.",
    };
  }
  if (originAddress === "unknown" || arizona === "unknown") {
    const denied = [settings, registrations].some((reply) => !reply.ok && reply.status === 403);
    return {
      ...base,
      status: "UNKNOWN",
      checks,
      message: denied
        ? "The key can calculate tax but cannot read Tax Settings or Tax Registrations. Give the restricted key Read on both to see this check."
        : "Stripe did not answer the readiness check. Pay Now still fails closed to a quote if Stripe cannot calculate tax.",
    };
  }
  return {
    ...base,
    status: "READY",
    checks,
    message: "Pay Now calculates sales tax with Stripe Tax: the origin address is set and Arizona is registered.",
  };
}

let cached: { at: number; value: StripeTaxReadiness } | null = null;

/** The readiness answer, cached for READINESS_TTL_MS. Not-configured is never cached, so a new key shows at once. */
export async function cachedStripeTaxReadiness(nowMs: number = Date.now()): Promise<StripeTaxReadiness> {
  if (cached && nowMs - cached.at < READINESS_TTL_MS && stripeTaxKey()) return cached.value;
  const value = await checkStripeTaxReadiness();
  cached = value.status === "NOT_CONFIGURED" ? null : { at: nowMs, value };
  return value;
}

/** Test seam. */
export function resetStripeTaxReadinessCache(): void {
  cached = null;
}
