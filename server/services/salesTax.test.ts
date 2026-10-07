import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STRIPE_GENERAL_SERVICES } from "@shared/storeTaxCodes";
import {
  quotePayNowSalesTax,
  quoteSalesTax,
  STRIPE_TAX_CALCULATIONS_URL,
  TAX_RATE_UNAVAILABLE,
} from "./salesTax";

const ENV = "AZ_TPT_RATE_TABLE_JSON";

afterEach(() => {
  delete process.env[ENV];
});

describe("quoteSalesTax", () => {
  it("refuses to invent a rate or a zero-tax charge when no table is configured", () => {
    delete process.env[ENV];
    const decision = quoteSalesTax(750);
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.code).toBe(TAX_RATE_UNAVAILABLE);
      expect(decision.error).toMatch(/will not record tax as zero/i);
    }
  });

  it("uses only a verified table supplied outside git", () => {
    process.env[ENV] = JSON.stringify({
      source: "https://azdor.gov/transaction-privilege-tax/tax-rate-table",
      retrievedOn: "2026-09-01",
      rate: 0.056,
    });
    const decision = quoteSalesTax(100);
    expect(decision).toMatchObject({ ok: true, tax: "5.60", total: "105.60" });
  });
});

describe("quotePayNowSalesTax (Stripe Tax)", () => {
  const KEY = "rk_test_fake_tax_only";
  const phoenix = { line1: "2 N Central Ave", city: "Phoenix", state: "AZ", postalCode: "85004" };
  const services = [
    { sku: "DE-SVC-CM-ONBOARD-S-OT", category: "comanaged_onboarding" as const, quantity: 1, total: 1500 },
    { sku: "DE-SVC-CONSULT-VCIO-HR", category: "professional_services" as const, quantity: 2, total: 400 },
  ];

  function stripeReply(status: number, body: unknown) {
    return vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
    );
  }

  function calculation(taxCents: number, reasons: string[], subtotalCents = 190000) {
    return {
      id: "taxcalc_1Abc",
      object: "tax.calculation",
      amount_total: subtotalCents + taxCents,
      tax_amount_exclusive: taxCents,
      tax_breakdown: reasons.map((reason) => ({ amount: 0, taxability_reason: reason })),
    };
  }

  it("without a Stripe key, keeps the verified-table rule and never calls Stripe", async () => {
    const fetchImpl = stripeReply(200, calculation(0, ["not_subject_to_tax"]));
    const decision = await quotePayNowSalesTax(
      { lines: services, subtotal: 1900, address: phoenix },
      { env: {}, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(decision).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("asks Stripe with each line's tax code and the billing address, then charges its tax", async () => {
    const fetchImpl = stripeReply(200, calculation(0, ["not_subject_to_tax"]));
    const decision = await quotePayNowSalesTax(
      { lines: services, subtotal: 1900, address: phoenix },
      { env: { STRIPE_TAX_SECRET_KEY: KEY }, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(decision).toMatchObject({ ok: true, tax: "0.00", total: "1900.00", calculationId: "taxcalc_1Abc" });
    if (decision.ok) expect(decision.note).toContain("not_subject_to_tax");

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(STRIPE_TAX_CALCULATIONS_URL);
    expect((init!.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const form = new URLSearchParams(String(init!.body));
    expect(form.get("currency")).toBe("usd");
    expect(form.get("line_items[0][amount]")).toBe("150000");
    expect(form.get("line_items[0][tax_code]")).toBe(STRIPE_GENERAL_SERVICES);
    expect(form.get("line_items[0][tax_behavior]")).toBe("exclusive");
    expect(form.get("line_items[1][quantity]")).toBe("2");
    expect(form.get("line_items[1][reference]")).toBe("2:DE-SVC-CONSULT-VCIO-HR");
    expect(form.get("customer_details[address][postal_code]")).toBe("85004");
    expect(form.get("customer_details[address][state]")).toBe("AZ");
    expect(form.get("customer_details[address_source]")).toBe("billing");
  });

  it("adds Stripe's tax to the total when a line is taxable", async () => {
    const fetchImpl = stripeReply(200, calculation(10640, ["standard_rated"]));
    const decision = await quotePayNowSalesTax(
      { lines: services, subtotal: 1900, address: phoenix },
      { env: { STRIPE_TAX_SECRET_KEY: KEY }, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(decision).toMatchObject({ ok: true, tax: "106.40", total: "2006.40", rate: "0.05600" });
  });

  it("steps aside, without calling Stripe, for items that have no confirmed tax code", async () => {
    const fetchImpl = stripeReply(200, calculation(0, ["standard_rated"]));
    const decision = await quotePayNowSalesTax(
      {
        lines: [...services, { sku: "DE-DIG-TPL-POLICY-CORE-OT", category: "digital_templates", quantity: 1, total: 149 }],
        subtotal: 2049,
        address: phoenix,
      },
      { env: { STRIPE_TAX_SECRET_KEY: KEY }, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(decision).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE, skus: ["DE-DIG-TPL-POLICY-CORE-OT"] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses a confirmed code from STRIPE_TAX_CODES and ignores a malformed one", async () => {
    const fetchImpl = stripeReply(200, calculation(0, ["not_subject_to_tax"], 14900));
    const env = {
      STRIPE_TAX_SECRET_KEY: KEY,
      STRIPE_TAX_CODES: JSON.stringify({ digital_templates: "txcd_12345678", digital_training: "not-a-code" }),
    };
    const ok = await quotePayNowSalesTax(
      { lines: [{ sku: "DE-DIG-TPL-POLICY-CORE-OT", category: "digital_templates", quantity: 1, total: 149 }], subtotal: 149, address: phoenix },
      { env, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(ok.ok).toBe(true);
    expect(new URLSearchParams(String(fetchImpl.mock.calls[0][1]!.body)).get("line_items[0][tax_code]")).toBe("txcd_12345678");

    const refused = await quotePayNowSalesTax(
      { lines: [{ sku: "DE-DIG-TRN-ONBOARD-OT", category: "digital_training", quantity: 1, total: 99 }], subtotal: 99, address: phoenix },
      { env, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(refused).toMatchObject({ ok: false, skus: ["DE-DIG-TRN-ONBOARD-OT"] });
  });

  it("refuses to charge an Arizona client while Stripe has no Arizona registration", async () => {
    const fetchImpl = stripeReply(200, calculation(0, ["not_collecting"]));
    const decision = await quotePayNowSalesTax(
      { lines: services, subtotal: 1900, address: phoenix },
      { env: { STRIPE_TAX_SECRET_KEY: KEY }, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(decision).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE });
  });

  it("charges an out-of-state client where DE does not collect", async () => {
    const fetchImpl = stripeReply(200, calculation(0, ["not_collecting"]));
    const decision = await quotePayNowSalesTax(
      { lines: services, subtotal: 1900, address: { line1: "1 Market St", city: "San Francisco", state: "CA", postalCode: "94105" } },
      { env: { STRIPE_TAX_SECRET_KEY: KEY }, fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(decision).toMatchObject({ ok: true, tax: "0.00", total: "1900.00" });
  });

  it.each([
    ["a Stripe error", () => stripeReply(400, { error: { type: "invalid_request_error", code: "parameter_invalid", param: "line_items[0][tax_code]" } })],
    ["a network failure", () => vi.fn(async () => { throw new TypeError("fetch failed"); })],
    ["totals that do not add up", () => stripeReply(200, { ...calculation(500, ["standard_rated"]), amount_total: 1 })],
    ["a negative tax", () => stripeReply(200, calculation(-100, ["standard_rated"]))],
    ["a rate above 20%", () => stripeReply(200, calculation(50000, ["standard_rated"]))],
    ["a reply without an id", () => stripeReply(200, { ...calculation(0, ["standard_rated"]), id: undefined })],
  ])("fails closed on %s", async (_label, makeFetch) => {
    const decision = await quotePayNowSalesTax(
      { lines: services, subtotal: 1900, address: phoenix },
      { env: { STRIPE_TAX_SECRET_KEY: KEY }, fetchImpl: makeFetch() as unknown as typeof fetch },
    );
    expect(decision).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE });
  });

  it("fails closed when Stripe does not answer in time", async () => {
    const hang = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
      }),
    );
    const decision = await quotePayNowSalesTax(
      { lines: services, subtotal: 1900, address: phoenix },
      { env: { STRIPE_TAX_SECRET_KEY: KEY }, fetchImpl: hang as unknown as typeof fetch, timeoutMs: 20 },
    );
    expect(decision).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE });
  });

  it("needs a complete US billing address before asking Stripe", async () => {
    const fetchImpl = stripeReply(200, calculation(0, ["standard_rated"]));
    for (const address of [null, { ...phoenix, postalCode: "850" }, { ...phoenix, state: "Arizona" }, { ...phoenix, line1: " " }]) {
      const decision = await quotePayNowSalesTax(
        { lines: services, subtotal: 1900, address: address as never },
        { env: { STRIPE_TAX_SECRET_KEY: KEY }, fetchImpl: fetchImpl as unknown as typeof fetch },
      );
      expect(decision.ok).toBe(false);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("Store and Warehouse stay separate", () => {
  it("the public Store checkout never reaches Pay Now, Stripe Tax or the tax service", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const sources = [
      "client/src/pages/store/PublicStoreCheckout.tsx",
      "server/publicSolutionRoutes.ts",
      "server/publicSolutionRequestStore.ts",
    ].map((file) => readFileSync(resolve(root, file), "utf8"));
    for (const source of sources) {
      expect(source).not.toMatch(/checkout\/zoho|salesTax|storeTaxCodes|api\.stripe\.com/);
    }
  });
});
