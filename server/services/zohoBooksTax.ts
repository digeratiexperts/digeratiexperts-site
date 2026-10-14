import { BOOKS_ID_PATTERN, parseTaxItemOverrides, type StoreCategory } from "@shared/storeTaxCodes";
import {
  isZohoAuthUnavailableError,
  resetZohoOAuthForTests,
  zohoConnectCovers,
  zohoDefaultDc,
  zohoOAuthDeps,
  ZohoProductAuth,
  type ZohoProductHealth,
} from "../zoho/oauth";

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
 * The server's own Books token (a self-client refresh token) needs, for tax:
 *   ZohoBooks.estimates.CREATE, ZohoBooks.estimates.DELETE,
 *   ZohoBooks.settings.READ, ZohoBooks.contacts.READ
 * and, to record paid orders (server/services/zohoBooksInvoice.ts):
 *   ZohoBooks.contacts.CREATE, ZohoBooks.invoices.CREATE,
 *   ZohoBooks.invoices.READ, ZohoBooks.customerpayments.CREATE
 * Nothing that deletes invoices, payments or customers, or changes settings.
 *
 * Tokens come from the token manager (server/zoho/oauth): the Zoho Connect
 * grant when it covers Books, else ZOHO_BOOKS_REFRESH_TOKEN with the client
 * below. Throttling and Zoho outages read as "unreachable", never "auth".
 */

/** Books API and token endpoint for the server's data center (ZOHO_ACCOUNTS_SERVER; US by default). */
export const ZOHO_BOOKS_API = `${zohoDefaultDc().api}/books/v3`;
export const ZOHO_ACCOUNTS_TOKEN_URL = `${zohoDefaultDc().accounts}/oauth/v2/token`;
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

/**
 * Which settings are missing or malformed. Empty means Pay Now can ask Books.
 * With a Zoho Connect grant that covers Books, the refresh token and client
 * settings are not needed.
 */
export function missingZohoBooksTaxSettings(env: NodeJS.ProcessEnv = process.env): string[] {
  const { clientId, clientSecret } = clientCredentials(env);
  const viaConnect = zohoConnectCovers("books");
  const missing: string[] = [];
  if (!BOOKS_ID_PATTERN.test(setting(env, "ZOHO_BOOKS_ORGANIZATION_ID"))) missing.push("ZOHO_BOOKS_ORGANIZATION_ID");
  if (!viaConnect && !setting(env, "ZOHO_BOOKS_REFRESH_TOKEN")) missing.push("ZOHO_BOOKS_REFRESH_TOKEN");
  if (!viaConnect && !clientId) missing.push("ZOHO_BOOKS_CLIENT_ID");
  if (!viaConnect && !clientSecret) missing.push("ZOHO_BOOKS_CLIENT_SECRET");
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

/** Thrown by the Books token manager when there is no usable credential. */
class BooksAuthError extends Error {}

/**
 * The Books token manager for this config. Built per call so the config (and
 * the test seams in `options`) decide the legacy credential; the access token,
 * single-flight refresh, budget and backoff are shared per refresh token
 * inside the manager, so building one is cheap and never mints a token.
 */
function booksAuth(config: ZohoBooksTaxConfig, options: BooksCallOptions): ZohoProductAuth {
  return new ZohoProductAuth(
    {
      product: "books",
      legacySources: () =>
        config.refreshToken
          ? [{ label: "ZOHO_BOOKS_REFRESH_TOKEN", refreshToken: config.refreshToken, client: { id: config.clientId, secret: config.clientSecret } }]
          : [],
      notConfigured: (message) => new BooksAuthError(message),
    },
    {
      store: zohoOAuthDeps.store,
      log: zohoOAuthDeps.log,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.nowMs !== undefined ? { now: () => options.nowMs! } : {}),
    },
  );
}

/**
 * Books token health from stored state (no Zoho call): connected, degraded,
 * needs_reconnect or not_configured. Separate from Pay Now tax readiness
 * (salesTaxReadiness.ts), which also checks Books' own settings.
 */
export async function zohoBooksTokenHealth(env: NodeJS.ProcessEnv = process.env): Promise<ZohoProductHealth> {
  const config = zohoBooksTaxConfig(env);
  if (!config) return { configured: false, state: "not_configured", source: null };
  return booksAuth(config, {}).status();
}

/** Test seam. */
export function resetZohoBooksToken(): void {
  resetZohoOAuthForTests();
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

/** One Books API call. A 401 drops the cached token and retries once. */
export async function booksCall(
  config: ZohoBooksTaxConfig,
  request: { method: "GET" | "POST" | "DELETE"; path: string; body?: unknown },
  options: BooksCallOptions = {},
): Promise<BooksReply> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const auth = booksAuth(config, options);
  let rejected: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    let bearer: string;
    let apiBase = ZOHO_BOOKS_API;
    try {
      const access = await auth.getAccess(rejected ? { rejectedToken: rejected } : {});
      bearer = access.token;
      apiBase = `${access.apiDomain}/books/v3`;
    } catch (error) {
      if (error instanceof BooksAuthError) {
        // Zoho refused the credential (or there is none): the error name only.
        console.warn("[TAX] BOOKS_TOKEN_REJECTED", { reason: "needs_reconnect" });
        return { ok: false, failure: "auth" };
      }
      // Throttled, backing off, or Zoho unreachable: not an auth problem (#418).
      console.warn("[TAX] BOOKS_TOKEN_UNREACHABLE", { reason: isZohoAuthUnavailableError(error) ? "degraded" : "network" });
      return { ok: false, failure: "unreachable" };
    }
    if (rejected && bearer === rejected) return { ok: false, failure: "auth" };

    const url = `${apiBase}${request.path}${request.path.includes("?") ? "&" : "?"}organization_id=${config.organizationId}`;
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

    auth.noteApiResult(response.status);
    if (response.status === 401 && attempt === 0) {
      rejected = bearer;
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
