import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { quotePayNowSalesTax, quoteSalesTax, TAX_RATE_UNAVAILABLE } from "./salesTax";
import { resetZohoBooksToken, ZOHO_ACCOUNTS_TOKEN_URL, ZOHO_BOOKS_API } from "./zohoBooksTax";

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

const ORG = "693714437";
const ITEM = "1957016000000500001";
const CONTACT = "1957016000000600001";
const BOOKS_ENV = {
  ZOHO_BOOKS_ORGANIZATION_ID: ORG,
  ZOHO_BOOKS_REFRESH_TOKEN: "1000.fake.refresh",
  ZOHO_BOOKS_CLIENT_ID: "1000.FAKECLIENT",
  ZOHO_BOOKS_CLIENT_SECRET: "fake-secret",
  ZOHO_BOOKS_TAX_CONTACT_ID: CONTACT,
  ZOHO_BOOKS_SERVICE_ITEM_ID: ITEM,
};
const PHOENIX = { line1: "2 N Central Ave", city: "Phoenix", state: "AZ", postalCode: "85004" };
const READY = async () => ({ status: "READY" });

const estimate = (sub: number, tax: number, extra: Record<string, unknown> = {}) => ({
  code: 0,
  estimate: {
    estimate_id: "1957016000000700001",
    estimate_number: "EST-00042",
    sub_total: sub,
    tax_total: tax,
    total: Math.round((sub + tax) * 100) / 100,
    taxes: tax > 0 ? [{ tax_name: "Phoenix, AZ", tax_amount: tax }] : [],
    ...extra,
  },
});

/** Zoho stub: token, one estimate create, one delete. A number is an error status; an Error is a network failure. */
function books(created: unknown | number | Error, removed: unknown | number = { code: 0, message: "deleted" }) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === ZOHO_ACCOUNTS_TOKEN_URL) {
      return new Response(JSON.stringify({ access_token: "1000.fake.access", expires_in: 3600 }), { status: 200 });
    }
    const answer = init?.method === "POST" ? created : init?.method === "DELETE" ? removed : 404;
    if (answer instanceof Error) throw answer;
    if (typeof answer === "number") return new Response(JSON.stringify({ code: 1, message: "x" }), { status: answer });
    return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

const calls = (fetchImpl: ReturnType<typeof books>, method: string) =>
  fetchImpl.mock.calls.filter(([url, init]) => url.startsWith(ZOHO_BOOKS_API) && init?.method === method);

describe("quotePayNowSalesTax (Zoho Books)", () => {
  beforeEach(() => resetZohoBooksToken());

  const services = [
    { sku: "DE-PRO-ASSESS", category: "professional_services" as const, quantity: 1, total: 750 },
    { sku: "DE-NET-SURVEY", category: "networking_projects" as const, quantity: 2, total: 250 },
  ];
  const ask = (fetchImpl: ReturnType<typeof books>, overrides: Partial<Parameters<typeof quotePayNowSalesTax>[0]> = {}, env: Record<string, string> = BOOKS_ENV) =>
    quotePayNowSalesTax(
      { lines: services, subtotal: 1000, address: PHOENIX, reference: "ORD-TEST", ...overrides },
      { env, fetchImpl: fetchImpl as unknown as typeof fetch, readiness: READY },
    );

  it("without a Books connection, keeps the verified-table rule and never calls Zoho", async () => {
    const fetchImpl = books(estimate(1000, 0));
    const decision = await quotePayNowSalesTax(
      { lines: services, subtotal: 1000, address: PHOENIX },
      { env: {}, fetchImpl: fetchImpl as unknown as typeof fetch, readiness: READY },
    );
    expect(decision).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("drafts an estimate on the tax contact with the service item and the billing address, reads the tax, then deletes it", async () => {
    const fetchImpl = books(estimate(1000, 0));
    const decision = await ask(fetchImpl);
    expect(decision).toMatchObject({ ok: true, tax: "0.00", total: "1000.00", source: "Zoho Books sales tax", calculationId: "EST-00042" });

    const [[url, init]] = calls(fetchImpl, "POST");
    expect(new URL(url).pathname).toBe("/books/v3/estimates");
    expect(new URL(url).searchParams.get("organization_id")).toBe(ORG);
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      customer_id: CONTACT,
      reference_number: "ORD-TEST",
      is_inclusive_tax: false,
      shipping_address: { address: "2 N Central Ave", city: "Phoenix", state: "AZ", zip: "85004", country: "U.S.A" },
    });
    // Quantity 1 at the line total: Books sees exactly what the customer pays.
    expect(body.line_items).toEqual([
      { item_id: ITEM, description: "DE-PRO-ASSESS x1", rate: 750, quantity: 1 },
      { item_id: ITEM, description: "DE-NET-SURVEY x2", rate: 250, quantity: 1 },
    ]);

    const [[deleteUrl]] = calls(fetchImpl, "DELETE");
    expect(new URL(deleteUrl).pathname).toBe("/books/v3/estimates/1957016000000700001");
    if (decision.ok) expect(decision.note).toMatch(/draft estimate EST-00042 deleted/);
  });

  it("adds the tax Books calculated to the total", async () => {
    const decision = await ask(books(estimate(1000, 56)));
    expect(decision).toMatchObject({ ok: true, tax: "56.00", total: "1056.00", rate: "0.05600" });
    if (decision.ok) expect(decision.note).toMatch(/Phoenix, AZ/);
  });

  it("steps aside, without calling Zoho, for items that have no confirmed Books item", async () => {
    const fetchImpl = books(estimate(1049, 0));
    const decision = await ask(fetchImpl, {
      lines: [...services, { sku: "DE-TPL-IRP", category: "digital_templates", quantity: 1, total: 49 }],
      subtotal: 1049,
    });
    expect(decision).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE, skus: ["DE-TPL-IRP"] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses an item from ZOHO_BOOKS_TAX_ITEMS for a category without a deploy", async () => {
    const fetchImpl = books(estimate(49, 0));
    const decision = await ask(
      fetchImpl,
      { lines: [{ sku: "DE-TPL-IRP", category: "digital_templates", quantity: 1, total: 49 }], subtotal: 49 },
      { ...BOOKS_ENV, ZOHO_BOOKS_TAX_ITEMS: '{"digital_templates":"1957016000000500099"}' },
    );
    expect(decision.ok).toBe(true);
    expect(JSON.parse(String(calls(fetchImpl, "POST")[0][1]?.body)).line_items[0].item_id).toBe("1957016000000500099");
  });

  it("never asks Books for tax until the readiness check reads READY", async () => {
    const fetchImpl = books(estimate(1000, 0));
    const decision = await quotePayNowSalesTax(
      { lines: services, subtotal: 1000, address: PHOENIX },
      { env: BOOKS_ENV, fetchImpl: fetchImpl as unknown as typeof fetch, readiness: async () => ({ status: "INCOMPLETE" }) },
    );
    expect(decision).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE });
    if (!decision.ok) expect(decision.error).toMatch(/setup is incomplete/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed when Books' numbers do not add up, and still deletes the draft", async () => {
    const fetchImpl = books(estimate(999, 0));
    expect(await ask(fetchImpl)).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE });
    expect(calls(fetchImpl, "DELETE")).toHaveLength(1);
  });

  it("fails closed on a rate above 20%", async () => {
    const decision = await ask(books(estimate(1000, 250)));
    expect(decision).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE });
    if (!decision.ok) expect(decision.error).toMatch(/above 20%/);
  });

  it("fails closed when Books refuses the estimate or does not answer", async () => {
    expect(await ask(books(400))).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE });
    resetZohoBooksToken();
    expect(await ask(books(new TypeError("fetch failed")))).toMatchObject({ ok: false, code: TAX_RATE_UNAVAILABLE });
  });

  it("keeps a good tax answer when the draft could not be deleted, and says so on the order", async () => {
    const decision = await ask(books(estimate(1000, 56), 500));
    expect(decision).toMatchObject({ ok: true, tax: "56.00" });
    if (decision.ok) expect(decision.note).toMatch(/NOT deleted, remove it in Books/);
  });

  it("needs a complete US billing address before asking Books", async () => {
    const fetchImpl = books(estimate(1000, 0));
    for (const address of [null, { ...PHOENIX, state: "Arizona" }, { ...PHOENIX, postalCode: "850" }, { ...PHOENIX, line1: " " }]) {
      const decision = await ask(fetchImpl, { address: address as typeof PHOENIX | null });
      expect(decision.ok).toBe(false);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("Store and Warehouse stay separate", () => {
  it("the public Store checkout never reaches Pay Now, Zoho Books or the tax service", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
    const sources = [
      "client/src/pages/store/PublicStoreCheckout.tsx",
      "server/publicSolutionRoutes.ts",
      "server/publicSolutionRequestStore.ts",
    ].map((file) => readFileSync(resolve(root, file), "utf8"));
    for (const source of sources) {
      expect(source).not.toMatch(/checkout\/zoho|salesTax|storeTaxCodes|zohoBooksTax|books\/v3/);
    }
  });
});
