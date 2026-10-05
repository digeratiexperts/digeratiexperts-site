import { BOOKS_ID_PATTERN, parseTaxItemOverrides, type StoreCategory } from "@shared/storeTaxCodes";

/**
 * Zoho Books sales tax for staff Pay Now (Joe, 2026-10-05: "yes switch to zoho
 * books").
 *
 * Zoho Books Sales Tax Automation works out US sales tax from DE's state
 * registrations, the customer's address and each item's tax category. Books has
 * no calculate-only endpoint, so the server creates a draft estimate on one
 * dedicated contact, reads the tax Books put on it, and deletes the estimate.
 * Nothing is sent to the customer. Zoho Payments still charges the card; Books
 * only supplies the number.
 *
 * The server's own Books token (a self-client refresh token) needs only:
 *   ZohoBooks.estimates.CREATE, ZohoBooks.estimates.DELETE,
 *   ZohoBooks.settings.READ, ZohoBooks.contacts.READ
 * It can create and delete estimates and read settings, nothing else: no
 * invoices, payments or customer changes.
 */

export const ZOHO_BOOKS_API = "https://www.zohoapis.com/books/v3";
export const ZOHO_ACCOUNTS_TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
const BOOKS_TIMEOUT_MS = 8000;

export interface ZohoBooksTaxConfig {
  organizationId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  /** The contact every tax-check estimate is drafted on. */
  contactId: string;
  /** The Books item whose tax category covers people-delivered services. */
  serviceItemId: string;
  itemOverrides: Partial<Record<StoreCategory, string>>;
}

/** Server settings Pay Now needs before it can ask Books for tax, by name. */
export const ZOHO_BOOKS_TAX_SETTINGS = [
  "ZOHO_BOOKS_ORGANIZATION_ID",
  "ZOHO_BOOKS_REFRESH_TOKEN",
  "ZOHO_BOOKS_CLIENT_ID",
  "ZOHO_BOOKS_CLIENT_SECRET",
  "ZOHO_BOOKS_TAX_CONTACT_ID",
  "ZOHO_BOOKS_SERVICE_ITEM_ID",
] as const;

function setting(env: NodeJS.ProcessEnv, name: string): string {
  return env[name]?.trim() ?? "";
}

/** The Books client falls back to the API self-client that already serves Desk. */
function clientCredentials(env: NodeJS.ProcessEnv): { clientId: string; clientSecret: string } {
  return {
    clientId: setting(env, "ZOHO_BOOKS_CLIENT_ID") || setting(env, "ZOHO_CLIENT_ID_API"),
    clientSecret: setting(env, "ZOHO_BOOKS_CLIENT_SECRET") || setting(env, "ZOHO_CLIENT_SECRET_API"),
  };
}

/** Which settings are missing or malformed. Empty means Pay Now can ask Books. */
export function missingZohoBooksTaxSettings(env: NodeJS.ProcessEnv = process.env): string[] {
  const { clientId, clientSecret } = clientCredentials(env);
  const missing: string[] = [];
  if (!BOOKS_ID_PATTERN.test(setting(env, "ZOHO_BOOKS_ORGANIZATION_ID"))) missing.push("ZOHO_BOOKS_ORGANIZATION_ID");
  if (!setting(env, "ZOHO_BOOKS_REFRESH_TOKEN")) missing.push("ZOHO_BOOKS_REFRESH_TOKEN");
  if (!clientId) missing.push("ZOHO_BOOKS_CLIENT_ID");
  if (!clientSecret) missing.push("ZOHO_BOOKS_CLIENT_SECRET");
  if (!BOOKS_ID_PATTERN.test(setting(env, "ZOHO_BOOKS_TAX_CONTACT_ID"))) missing.push("ZOHO_BOOKS_TAX_CONTACT_ID");
  if (!BOOKS_ID_PATTERN.test(setting(env, "ZOHO_BOOKS_SERVICE_ITEM_ID"))) missing.push("ZOHO_BOOKS_SERVICE_ITEM_ID");
  return missing;
}

export function zohoBooksTaxConfig(env: NodeJS.ProcessEnv = process.env): ZohoBooksTaxConfig | null {
  if (missingZohoBooksTaxSettings(env).length > 0) return null;
  const { clientId, clientSecret } = clientCredentials(env);
  return {
    organizationId: setting(env, "ZOHO_BOOKS_ORGANIZATION_ID"),
    clientId,
    clientSecret,
    refreshToken: setting(env, "ZOHO_BOOKS_REFRESH_TOKEN"),
    contactId: setting(env, "ZOHO_BOOKS_TAX_CONTACT_ID"),
    serviceItemId: setting(env, "ZOHO_BOOKS_SERVICE_ITEM_ID"),
    itemOverrides: parseTaxItemOverrides(env.ZOHO_BOOKS_TAX_ITEMS),
  };
}

export interface BooksCallOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  nowMs?: number;
}

/** Why a Books call did not succeed: the token, the request, or the network. */
export type BooksFailure = "auth" | "forbidden" | "not_found" | "rejected" | "unreachable";

export type BooksReply = { ok: true; body: any } | { ok: false; failure: BooksFailure; status?: number; code?: unknown };

let token: { value: string; expiresAt: number; refreshToken: string } | null = null;
let refreshing: Promise<string | null> | null = null;

/** Test seam. */
export function resetZohoBooksToken(): void {
  token = null;
  refreshing = null;
}

async function withTimeout<T>(timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** A Books access token from the refresh token, cached until a minute before it expires. */
async function accessToken(config: ZohoBooksTaxConfig, options: BooksCallOptions): Promise<string | null> {
  const now = options.nowMs ?? Date.now();
  if (token && token.refreshToken === config.refreshToken && token.expiresAt - 60_000 > now) return token.value;
  if (refreshing) return refreshing;
  const fetchImpl = options.fetchImpl ?? fetch;
  refreshing = withTimeout(options.timeoutMs ?? BOOKS_TIMEOUT_MS, async (signal) => {
    try {
      const response = await fetchImpl(ZOHO_ACCOUNTS_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: config.refreshToken,
        }).toString(),
        signal,
      });
      const body = (await response.json().catch(() => ({}))) as { access_token?: unknown; expires_in?: unknown; error?: unknown };
      if (!response.ok || typeof body.access_token !== "string") {
        // Never log the token or the secret: the error name is enough.
        console.warn("[TAX] BOOKS_TOKEN_REJECTED", { status: response.status, error: typeof body.error === "string" ? body.error : null });
        return null;
      }
      const seconds = typeof body.expires_in === "number" && body.expires_in > 0 ? body.expires_in : 3600;
      token = { value: body.access_token, expiresAt: now + seconds * 1000, refreshToken: config.refreshToken };
      return token.value;
    } catch (error: any) {
      console.warn("[TAX] BOOKS_TOKEN_UNREACHABLE", { reason: error?.name === "AbortError" ? "timeout" : "network" });
      throw error;
    }
  }).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** One Books API call. A 401 drops the cached token and retries once. */
export async function booksCall(
  config: ZohoBooksTaxConfig,
  request: { method: "GET" | "POST" | "DELETE"; path: string; body?: unknown },
  options: BooksCallOptions = {},
): Promise<BooksReply> {
  const fetchImpl = options.fetchImpl ?? fetch;
  for (let attempt = 0; attempt < 2; attempt++) {
    let bearer: string | null;
    try {
      bearer = await accessToken(config, options);
    } catch {
      return { ok: false, failure: "unreachable" };
    }
    if (!bearer) return { ok: false, failure: "auth" };

    const url = `${ZOHO_BOOKS_API}${request.path}${request.path.includes("?") ? "&" : "?"}organization_id=${config.organizationId}`;
    let response: Response;
    let body: any;
    try {
      ({ response, body } = await withTimeout(options.timeoutMs ?? BOOKS_TIMEOUT_MS, async (signal) => {
        const res = await fetchImpl(url, {
          method: request.method,
          headers: {
            Authorization: `Zoho-oauthtoken ${bearer}`,
            ...(request.body ? { "Content-Type": "application/json" } : {}),
          },
          ...(request.body ? { body: JSON.stringify(request.body) } : {}),
          signal,
        });
        return { response: res, body: await res.json().catch(() => null) };
      }));
    } catch {
      return { ok: false, failure: "unreachable" };
    }

    if (response.status === 401 && attempt === 0) {
      token = null;
      continue;
    }
    if (response.ok && body && body.code === 0) return { ok: true, body };
    const failure: BooksFailure =
      response.status === 401 ? "auth" : response.status === 403 ? "forbidden" : response.status === 404 ? "not_found" : "rejected";
    return { ok: false, failure, status: response.status, code: body?.code };
  }
  return { ok: false, failure: "auth" };
}

export interface BooksTaxLine {
  sku: string;
  itemId: string;
  quantity: number;
  /** Line total in dollars. */
  total: number;
}

export interface BooksTaxAddress {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
}

export type BooksTaxAnswer =
  | { ok: true; taxCents: number; subtotalCents: number; estimateNumber: string; taxNames: string[]; deleted: boolean }
  | { ok: false; failure: BooksFailure | "malformed" | "implausible" };

function cents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Drafts an estimate for this cart and address, reads the sales tax Books
 * calculated, then deletes the estimate. Each line goes in as quantity 1 at the
 * line total so Books sees exactly the amounts the customer pays.
 */
export async function calculateBooksSalesTax(
  config: ZohoBooksTaxConfig,
  input: { lines: BooksTaxLine[]; address: BooksTaxAddress; reference: string },
  options: BooksCallOptions = {},
): Promise<BooksTaxAnswer> {
  const subtotalCents = input.lines.reduce((sum, line) => sum + cents(line.total), 0);
  const created = await booksCall(
    config,
    {
      method: "POST",
      path: "/estimates",
      body: {
        customer_id: config.contactId,
        reference_number: input.reference.slice(0, 50),
        is_inclusive_tax: false,
        shipping_address: {
          address: input.address.line1,
          city: input.address.city,
          state: input.address.state,
          zip: input.address.postalCode,
          country: "U.S.A",
        },
        line_items: input.lines.map((line) => ({
          item_id: line.itemId,
          description: `${line.sku} x${line.quantity}`,
          rate: cents(line.total) / 100,
          quantity: 1,
        })),
        notes: "Website Pay Now sales tax check. Deleted automatically.",
      },
    },
    options,
  );
  if (!created.ok) {
    console.warn("[TAX] BOOKS_ESTIMATE_REJECTED", { failure: created.failure, status: created.status, code: created.code });
    return { ok: false, failure: created.failure };
  }

  const estimate = created.body?.estimate ?? {};
  const estimateId = typeof estimate.estimate_id === "string" ? estimate.estimate_id : null;
  const estimateNumber = typeof estimate.estimate_number === "string" ? estimate.estimate_number : estimateId ?? "unknown";

  let deleted = false;
  if (estimateId) {
    const removed = await booksCall(config, { method: "DELETE", path: `/estimates/${estimateId}` }, options);
    deleted = removed.ok;
    if (!removed.ok) {
      // The tax answer still stands; staff can delete the draft by hand.
      console.warn("[TAX] BOOKS_ESTIMATE_NOT_DELETED", { estimateNumber, failure: removed.failure });
    }
  }

  const sub = typeof estimate.sub_total === "number" ? cents(estimate.sub_total) : NaN;
  const tax = typeof estimate.tax_total === "number" ? cents(estimate.tax_total) : NaN;
  const total = typeof estimate.total === "number" ? cents(estimate.total) : NaN;
  if (!estimateId || sub !== subtotalCents || !Number.isInteger(tax) || tax < 0 || total !== sub + tax) {
    console.warn("[TAX] BOOKS_ESTIMATE_MALFORMED", { estimateNumber, sub, tax, total, subtotalCents });
    return { ok: false, failure: "malformed" };
  }
  if (tax > subtotalCents * 0.2) {
    console.warn("[TAX] BOOKS_TAX_IMPLAUSIBLE", { estimateNumber, tax, subtotalCents });
    return { ok: false, failure: "implausible" };
  }

  const taxNames = (Array.isArray(estimate.taxes) ? estimate.taxes : [])
    .map((entry: any) => (typeof entry?.tax_name === "string" ? entry.tax_name : null))
    .filter((name: string | null): name is string => !!name);
  return { ok: true, taxCents: tax, subtotalCents, estimateNumber, taxNames, deleted };
}
