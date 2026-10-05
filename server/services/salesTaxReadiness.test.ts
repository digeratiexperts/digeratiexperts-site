import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkSalesTaxReadiness } from "./salesTaxReadiness";
import { resetZohoBooksToken, ZOHO_ACCOUNTS_TOKEN_URL, ZOHO_BOOKS_API } from "./zohoBooksTax";

const ORG = "693714437";
const ITEM = "1957016000000500001";
const CONTACT = "1957016000000600001";
const env = {
  ZOHO_BOOKS_ORGANIZATION_ID: ORG,
  ZOHO_BOOKS_REFRESH_TOKEN: "1000.fake.refresh",
  ZOHO_BOOKS_CLIENT_ID: "1000.FAKECLIENT",
  ZOHO_BOOKS_CLIENT_SECRET: "fake-secret",
  ZOHO_BOOKS_TAX_CONTACT_ID: CONTACT,
  ZOHO_BOOKS_SERVICE_ITEM_ID: ITEM,
};

type Answer = unknown | number;

/** Zoho stub keyed by path: a JSON body for 200, or a status number for an error. */
function zoho(answers: { token?: Answer; org?: Answer; item?: Answer; contact?: Answer }) {
  return vi.fn(async (url: string, _init?: RequestInit) => {
    const path = url.startsWith(ZOHO_BOOKS_API) ? new URL(url).pathname.replace("/books/v3", "") : url;
    const answer =
      url === ZOHO_ACCOUNTS_TOKEN_URL
        ? answers.token ?? { access_token: "1000.fake.access", expires_in: 3600 }
        : path === `/organizations/${ORG}`
          ? answers.org ?? { code: 0, organization: { organization_id: ORG, is_tax_registered: true } }
          : path === `/items/${ITEM}`
            ? answers.item ?? { code: 0, item: { item_id: ITEM, status: "active" } }
            : path === `/contacts/${CONTACT}`
              ? answers.contact ?? { code: 0, contact: { contact_id: CONTACT, status: "active" } }
              : 404;
    if (typeof answer === "number") return new Response(JSON.stringify({ code: 1, message: "x" }), { status: answer });
    return new Response(JSON.stringify(answer), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

const run = (fetchImpl: ReturnType<typeof zoho>, overrides: Record<string, string> = {}) =>
  checkSalesTaxReadiness({ env: { ...env, ...overrides }, fetchImpl: fetchImpl as unknown as typeof fetch });

describe("Zoho Books sales tax readiness for staff Pay Now", () => {
  beforeEach(() => resetZohoBooksToken());

  it("is NOT_CONFIGURED without the Books settings, names them, and never calls Zoho", async () => {
    const fetchImpl = zoho({});
    const r = await checkSalesTaxReadiness({ env: {}, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toMatchObject({ status: "NOT_CONFIGURED", provider: "zoho_books", checks: { connection: "missing" } });
    expect(r.missingSettings).toEqual([
      "ZOHO_BOOKS_ORGANIZATION_ID",
      "ZOHO_BOOKS_REFRESH_TOKEN",
      "ZOHO_BOOKS_CLIENT_ID",
      "ZOHO_BOOKS_CLIENT_SECRET",
      "ZOHO_BOOKS_TAX_CONTACT_ID",
      "ZOHO_BOOKS_SERVICE_ITEM_ID",
    ]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("borrows the API self-client when no Books client is named", async () => {
    const { ZOHO_BOOKS_CLIENT_ID: _id, ZOHO_BOOKS_CLIENT_SECRET: _secret, ...rest } = env;
    const r = await checkSalesTaxReadiness({
      env: { ...rest, ZOHO_CLIENT_ID_API: "1000.APICLIENT", ZOHO_CLIENT_SECRET_API: "api-secret" },
      fetchImpl: zoho({}) as unknown as typeof fetch,
    });
    expect(r.status).toBe("READY");
  });

  it("is READY only with a tax registration, an active service item and an active contact", async () => {
    const r = await run(zoho({}));
    expect(r).toMatchObject({
      status: "READY",
      checks: { connection: "set", taxRegistration: "active", serviceItem: "set", taxContact: "set" },
    });
    expect(r.quoteOnlyCategories).toContain("digital_templates");
  });

  it("only reads Books: GETs with the Zoho token and the organization, nothing that could change Books", async () => {
    const fetchImpl = zoho({});
    await run(fetchImpl);
    const books = fetchImpl.mock.calls.filter(([url]) => url.startsWith(ZOHO_BOOKS_API));
    expect(books).toHaveLength(3);
    for (const [url, init] of books) {
      expect(init?.method).toBe("GET");
      expect(new URL(url).searchParams.get("organization_id")).toBe(ORG);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Zoho-oauthtoken 1000.fake.access");
    }
  });

  it("is INCOMPLETE until Books has a sales tax registration", async () => {
    const r = await run(zoho({ org: { code: 0, organization: { organization_id: ORG, is_tax_registered: false } } }));
    expect(r).toMatchObject({ status: "INCOMPLETE", checks: { taxRegistration: "missing" } });
    expect(r.message).toMatch(/Sales Tax Automation/);
  });

  it("is INCOMPLETE when the service item or the contact is missing or inactive", async () => {
    expect((await run(zoho({ item: 404 }))).checks.serviceItem).toBe("missing");
    resetZohoBooksToken();
    const inactive = await run(zoho({ contact: { code: 0, contact: { contact_id: CONTACT, status: "inactive" } } }));
    expect(inactive).toMatchObject({ status: "INCOMPLETE", checks: { taxContact: "missing" } });
  });

  it("is AUTH_REQUIRED when Zoho refuses the refresh token", async () => {
    const r = await run(zoho({ token: { error: "invalid_code" } }));
    expect(r.status).toBe("AUTH_REQUIRED");
    expect(r.message).toMatch(/ZOHO_BOOKS_REFRESH_TOKEN/);
  });

  it("is UNKNOWN, never READY, when a scope is missing or Books does not answer", async () => {
    const forbidden = await run(zoho({ org: 403 }));
    expect(forbidden.status).toBe("UNKNOWN");
    expect(forbidden.message).toMatch(/scope/);
    resetZohoBooksToken();
    const down = await run(zoho({ org: 500 }));
    expect(down.status).toBe("UNKNOWN");
  });
});
