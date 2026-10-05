import { describe, expect, it, vi } from "vitest";
import {
  checkStripeTaxReadiness,
  STRIPE_TAX_REGISTRATIONS_URL,
  STRIPE_TAX_SETTINGS_URL,
} from "./stripeTaxReadiness";

const KEY = "rk_test_fake_tax_only";
const env = { STRIPE_TAX_SECRET_KEY: KEY };

const SETTINGS_ACTIVE = {
  object: "tax.settings",
  status: "active",
  head_office: { address: { line1: "2 N Central Ave", city: "Phoenix", state: "AZ", postal_code: "85004", country: "US" } },
};
const SETTINGS_PENDING = {
  object: "tax.settings",
  status: "pending",
  head_office: null,
  status_details: { pending: { missing_fields: ["head_office"] } },
};
const registration = (state: string, status = "active") => ({
  object: "tax.registration",
  country: "US",
  country_options: { us: { state, type: "state_sales_tax" } },
  status,
});

/** Stripe stub keyed by URL: a body for 200, or a status number for an error. */
function stripe(settings: unknown, registrations: unknown) {
  return vi.fn(async (url: string, _init?: RequestInit) => {
    const answer = url === STRIPE_TAX_SETTINGS_URL ? settings : url === STRIPE_TAX_REGISTRATIONS_URL ? registrations : 404;
    if (typeof answer === "number") return new Response(JSON.stringify({ error: { type: "x" } }), { status: answer });
    return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

describe("Stripe Tax readiness for staff Pay Now", () => {
  it("is NOT_CONFIGURED without a key, and never calls Stripe", async () => {
    const fetchImpl = stripe(SETTINGS_ACTIVE, { data: [registration("AZ")] });
    const r = await checkStripeTaxReadiness({ env: {}, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r.status).toBe("NOT_CONFIGURED");
    expect(r.checks.key).toBe("missing");
    expect(r.message).toMatch(/STRIPE_TAX_SECRET_KEY/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("is READY only with an origin address and an active Arizona registration", async () => {
    const fetchImpl = stripe(SETTINGS_ACTIVE, { data: [registration("CA"), registration("AZ")] });
    const r = await checkStripeTaxReadiness({ env, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toMatchObject({ status: "READY", checks: { key: "set", originAddress: "set", arizona: "active" } });
    expect(r.quoteOnlyCategories).toContain("digital_templates");
  });

  it("only reads: two GETs with the Bearer key, nothing that could charge or change Stripe", async () => {
    const fetchImpl = stripe(SETTINGS_ACTIVE, { data: [registration("AZ")] });
    await checkStripeTaxReadiness({ env, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl.mock.calls.map(([url]) => url).sort()).toEqual([STRIPE_TAX_REGISTRATIONS_URL, STRIPE_TAX_SETTINGS_URL].sort());
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init?.method ?? "GET").toBe("GET");
      expect(init?.body).toBeUndefined();
      expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    }
  });

  it("says what is missing: the origin address first, then Arizona", async () => {
    const noOrigin = await checkStripeTaxReadiness({
      env,
      fetchImpl: stripe(SETTINGS_PENDING, { data: [] }) as unknown as typeof fetch,
    });
    expect(noOrigin).toMatchObject({ status: "INCOMPLETE", checks: { originAddress: "missing" } });
    expect(noOrigin.message).toMatch(/origin address/);

    for (const data of [[], [registration("CA")], [registration("AZ", "expired")], [registration("AZ", "scheduled")]]) {
      const r = await checkStripeTaxReadiness({ env, fetchImpl: stripe(SETTINGS_ACTIVE, { data }) as unknown as typeof fetch });
      expect(r).toMatchObject({ status: "INCOMPLETE", checks: { originAddress: "set", arizona: "missing" } });
      expect(r.message).toMatch(/Arizona/);
    }
  });

  it("is AUTH_REQUIRED when Stripe rejects the key", async () => {
    const r = await checkStripeTaxReadiness({ env, fetchImpl: stripe(401, 401) as unknown as typeof fetch });
    expect(r.status).toBe("AUTH_REQUIRED");
  });

  it("is UNKNOWN, never READY, when the key lacks the Read permissions or Stripe does not answer", async () => {
    const denied = await checkStripeTaxReadiness({ env, fetchImpl: stripe(SETTINGS_ACTIVE, 403) as unknown as typeof fetch });
    expect(denied).toMatchObject({ status: "UNKNOWN", checks: { originAddress: "set", arizona: "unknown" } });
    expect(denied.message).toMatch(/Read/);

    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const down = await checkStripeTaxReadiness({ env, fetchImpl: offline as unknown as typeof fetch });
    expect(down.status).toBe("UNKNOWN");

    const hang = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
    );
    const slow = await checkStripeTaxReadiness({ env, fetchImpl: hang as unknown as typeof fetch, timeoutMs: 20 });
    expect(slow.status).toBe("UNKNOWN");
  });
});
