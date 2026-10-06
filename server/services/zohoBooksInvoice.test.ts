import { beforeEach, describe, expect, it, vi } from "vitest";
import { booksDate, recordPaidOrderInBooks, type PaidOrderForBooks } from "./zohoBooksInvoice";
import { resetZohoBooksToken, ZOHO_ACCOUNTS_TOKEN_URL, ZOHO_BOOKS_API } from "./zohoBooksTax";

const SERVICE_ITEM = "1957016000006629001";
const env = {
  ZOHO_BOOKS_ORGANIZATION_ID: "693714437",
  ZOHO_BOOKS_REFRESH_TOKEN: "1000.fake.refresh",
  ZOHO_BOOKS_CLIENT_ID: "1000.FAKECLIENT",
  ZOHO_BOOKS_CLIENT_SECRET: "fake-secret",
  ZOHO_BOOKS_TAX_CONTACT_ID: "1957016000006631001",
  ZOHO_BOOKS_SERVICE_ITEM_ID: SERVICE_ITEM,
};

const order = (overrides: Partial<PaidOrderForBooks> = {}): PaidOrderForBooks => ({
  orderNumber: "ORD-MG8K2-ABCD",
  paymentMethod: "zoho",
  lineItems: [
    { productId: "prod-090", sku: "DE-SVC-CONSULT-VCIO-HR", name: "vCIO consulting", quantity: 2, unitPrice: 200, total: 400 },
    { productId: "prod-035", sku: "DE-SVC-NET-ENG-HR", name: "Network engineering", quantity: 1, unitPrice: 600, total: 600 },
  ],
  total: "1056.00",
  billingEmail: "ops@example.com",
  billingName: "Pat Q Buyer",
  billingCompany: "Example Co",
  billingAddress: { line1: "2 N Central Ave", city: "Phoenix", state: "AZ", postalCode: "85004" },
  zohoPaymentId: "2000000012345",
  // 2026-10-06 03:00 UTC is still 2026-10-05 in Arizona.
  paidAt: new Date("2026-10-06T03:00:00Z"),
  ...overrides,
});

type Route = (body: any) => unknown | number;

/** Books stub keyed by "METHOD /path" (query dropped). A number is an error status. */
function books(routes: Record<string, Route | unknown>) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url === ZOHO_ACCOUNTS_TOKEN_URL) {
      return new Response(JSON.stringify({ access_token: "1000.fake.access", expires_in: 3600 }), { status: 200 });
    }
    const key = `${init?.method} ${new URL(url).pathname.replace("/books/v3", "")}`;
    const route = routes[key];
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const answer = typeof route === "function" ? (route as Route)(body) : route ?? 404;
    if (typeof answer === "number") return new Response(JSON.stringify({ code: 1, message: "x" }), { status: answer });
    return new Response(JSON.stringify({ code: 0, ...(answer as object) }), { status: 200 });
  });
}

const happy = (overrides: Record<string, Route | unknown> = {}) =>
  books({
    "GET /invoices": { invoices: [] },
    "GET /contacts": { contacts: [] },
    "POST /contacts": { contact: { contact_id: "1957016000007000001" } },
    "POST /invoices": (body: any) => ({ invoice: { invoice_id: "1957016000007100001", invoice_number: "INV-000123", total: 1056, reference_number: body.reference_number } }),
    "POST /invoices/1957016000007100001/status/sent": {},
    "POST /customerpayments": { payment: { payment_id: "1957016000007200001" } },
    ...overrides,
  });

const sent = (fetchImpl: ReturnType<typeof books>, key: string) =>
  fetchImpl.mock.calls
    .filter(([url, init]) => url.startsWith(ZOHO_BOOKS_API) && `${init?.method} ${new URL(url).pathname.replace("/books/v3", "")}` === key)
    .map(([url, init]) => ({ url: new URL(url), body: init?.body ? JSON.parse(String(init.body)) : undefined }));

const run = (fetchImpl: ReturnType<typeof books>, o = order(), e: Record<string, string> = env) =>
  recordPaidOrderInBooks(o, { env: e, fetchImpl: fetchImpl as unknown as typeof fetch });

describe("Paid Pay Now orders become Zoho Books invoices", () => {
  beforeEach(() => resetZohoBooksToken());

  it("does nothing without a Books connection, for non-Zoho payments, or when switched off", async () => {
    const fetchImpl = happy();
    expect(await recordPaidOrderInBooks(order(), { env: {}, fetchImpl: fetchImpl as unknown as typeof fetch })).toBeNull();
    expect(await run(fetchImpl, order({ paymentMethod: "stripe" }))).toBeNull();
    expect(await run(fetchImpl, order(), { ...env, ZOHO_BOOKS_RECORD_PAID_ORDERS: "false" })).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("creates the customer, invoices the order with the Books service item, then records the Zoho payment", async () => {
    const fetchImpl = happy();
    expect(await run(fetchImpl)).toBe("booksInvoice:INV-000123 paid");

    const [contact] = sent(fetchImpl, "POST /contacts");
    expect(contact.body).toMatchObject({
      contact_name: "Example Co",
      company_name: "Example Co",
      contact_type: "customer",
      customer_sub_type: "business",
      billing_address: { address: "2 N Central Ave", city: "Phoenix", state: "AZ", zip: "85004", country: "U.S.A" },
      contact_persons: [{ first_name: "Pat Q", last_name: "Buyer", email: "ops@example.com", is_primary_contact: true }],
    });

    const [invoice] = sent(fetchImpl, "POST /invoices");
    expect(invoice.url.searchParams.get("send")).toBe("false");
    expect(invoice.body).toMatchObject({
      customer_id: "1957016000007000001",
      reference_number: "ORD-MG8K2-ABCD",
      date: "2026-10-05",
      is_inclusive_tax: false,
      shipping_address: { city: "Phoenix", state: "AZ", zip: "85004" },
    });
    expect(invoice.body.line_items).toEqual([
      { item_id: SERVICE_ITEM, name: "vCIO consulting", description: "DE-SVC-CONSULT-VCIO-HR", rate: 200, quantity: 2 },
      { item_id: SERVICE_ITEM, name: "Network engineering", description: "DE-SVC-NET-ENG-HR", rate: 600, quantity: 1 },
    ]);

    expect(sent(fetchImpl, "POST /invoices/1957016000007100001/status/sent")).toHaveLength(1);
    const [payment] = sent(fetchImpl, "POST /customerpayments");
    expect(payment.body).toMatchObject({
      customer_id: "1957016000007000001",
      payment_mode: "creditcard",
      amount: 1056,
      date: "2026-10-05",
      reference_number: "2000000012345",
      invoices: [{ invoice_id: "1957016000007100001", amount_applied: 1056 }],
    });
    expect(payment.body.account_id).toBeUndefined();
  });

  it("reuses a customer Books already has for that email", async () => {
    const fetchImpl = happy({ "GET /contacts": { contacts: [{ contact_id: "1957016000000555001", status: "active" }] } });
    expect(await run(fetchImpl)).toBe("booksInvoice:INV-000123 paid");
    expect(sent(fetchImpl, "GET /contacts")[0].url.searchParams.get("email")).toBe("ops@example.com");
    expect(sent(fetchImpl, "POST /contacts")).toHaveLength(0);
    expect(sent(fetchImpl, "POST /invoices")[0].body.customer_id).toBe("1957016000000555001");
  });

  it("adds the email to the contact name when Books already has a different customer with that name", async () => {
    let attempts = 0;
    const fetchImpl = happy({
      "POST /contacts": (body: any) => (++attempts === 1 ? 400 : { contact: { contact_id: "1957016000007000009", name: body.contact_name } }),
    });
    expect(await run(fetchImpl)).toBe("booksInvoice:INV-000123 paid");
    expect(sent(fetchImpl, "POST /contacts").map((c) => c.body.contact_name)).toEqual(["Example Co", "Example Co (ops@example.com)"]);
  });

  it("is idempotent: a retried fulfillment finds the invoice by order number and makes nothing new", async () => {
    const fetchImpl = happy({ "GET /invoices": { invoices: [{ invoice_id: "1", invoice_number: "INV-000120", reference_number: "ORD-MG8K2-ABCD" }] } });
    expect(await run(fetchImpl)).toBe("booksInvoice:INV-000120 already recorded");
    expect(sent(fetchImpl, "POST /invoices")).toHaveLength(0);
    expect(sent(fetchImpl, "POST /customerpayments")).toHaveLength(0);
  });

  it("leaves the invoice as a draft, with no payment, when Books' total differs from what was charged", async () => {
    const fetchImpl = happy({ "POST /invoices": { invoice: { invoice_id: "1957016000007100001", invoice_number: "INV-000123", total: 1060.5 } } });
    expect(await run(fetchImpl)).toBe("booksInvoice:INV-000123 left as draft (Books total $1060.50, paid $1056.00)");
    expect(sent(fetchImpl, "POST /invoices/1957016000007100001/status/sent")).toHaveLength(0);
    expect(sent(fetchImpl, "POST /customerpayments")).toHaveLength(0);
  });

  it("says so on the order when the payment could not be recorded", async () => {
    const fetchImpl = happy({ "POST /customerpayments": 400 });
    expect(await run(fetchImpl)).toBe("booksInvoice:INV-000123 sent, payment NOT recorded (Books rejected)");
  });

  it("deposits to the account named in ZOHO_BOOKS_DEPOSIT_ACCOUNT_ID", async () => {
    const fetchImpl = happy();
    await run(fetchImpl, order(), { ...env, ZOHO_BOOKS_DEPOSIT_ACCOUNT_ID: "1957016000000000459" });
    expect(sent(fetchImpl, "POST /customerpayments")[0].body.account_id).toBe("1957016000000000459");
  });

  it("skips, without calling Books, a line that has no Books item, and never throws", async () => {
    const fetchImpl = happy();
    const withTemplate = order({
      lineItems: [{ productId: "prod-075", sku: "DE-DIG-TPL-POLICY-CORE-OT", name: "Policy pack", quantity: 1, unitPrice: 49, total: 49 }],
    });
    expect(await run(fetchImpl, withTemplate)).toBe("booksInvoice:skipped (no Books item for DE-DIG-TPL-POLICY-CORE-OT)");
    expect(fetchImpl).not.toHaveBeenCalled();
    const broken = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await recordPaidOrderInBooks(order(), { env, fetchImpl: broken as unknown as typeof fetch })).toMatch(/^booksInvoice:failed/);
  });

  it("dates the invoice in Arizona time", () => {
    expect(booksDate(new Date("2026-10-06T06:59:00Z"))).toBe("2026-10-05");
    expect(booksDate(new Date("2026-10-06T07:00:00Z"))).toBe("2026-10-06");
  });
});
