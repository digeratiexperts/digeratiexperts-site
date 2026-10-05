import { STORE_TAX_CODE_PENDING } from "@shared/storeTaxCodes";
import { booksCall, missingZohoBooksTaxSettings, zohoBooksTaxConfig, type BooksCallOptions, type BooksReply } from "./zohoBooksTax";

/**
 * Is staff Pay Now able to charge sales tax right now? (Zoho Books, 2026-10-05)
 *
 * Read-only: it asks Zoho Books for the organization (is a sales tax
 * registration on?), the service item and the tax-check contact, with the same
 * token Pay Now uses. Nothing here creates, changes or deletes anything in
 * Books. The answer is cached for a few minutes so the Warehouse pages and
 * checkout do not call Books on every load.
 *
 * Statuses mirror the Warehouse connector vocabulary and never default to
 * healthy: READY only when the token works, Books reports a tax registration,
 * and the service item and contact both exist. Checkout asks Books for tax only
 * when this reads READY.
 */

export type SalesTaxReadinessStatus = "READY" | "NOT_CONFIGURED" | "AUTH_REQUIRED" | "INCOMPLETE" | "UNKNOWN";
type Check = "set" | "missing" | "unknown";

export interface SalesTaxReadiness {
  status: SalesTaxReadinessStatus;
  provider: "zoho_books";
  checks: {
    connection: "set" | "missing";
    taxRegistration: "active" | "missing" | "unknown";
    serviceItem: Check;
    taxContact: Check;
  };
  /** What staff should do next, in one sentence. */
  message: string;
  /** Server settings that are not set yet, by name. Never their values. */
  missingSettings: string[];
  /** Store categories that stay quote-only until a Books item is confirmed. */
  quoteOnlyCategories: string[];
  checkedAt: string;
}

const READINESS_TTL_MS = 5 * 60 * 1000;

function exists(reply: BooksReply, key: "item" | "contact"): Check {
  if (reply.ok) return reply.body?.[key]?.status === "inactive" ? "missing" : "set";
  return reply.failure === "not_found" ? "missing" : "unknown";
}

/**
 * Books marks an organization registered for sales tax once Sales Tax
 * Automation has DE's registration (is_tax_registered on the organization).
 */
function registration(reply: BooksReply): SalesTaxReadiness["checks"]["taxRegistration"] {
  if (!reply.ok) return "unknown";
  const org = reply.body?.organization ?? {};
  return org.is_tax_registered === true || org.is_registered_for_tax === true ? "active" : "missing";
}

export async function checkSalesTaxReadiness(
  options: { env?: NodeJS.ProcessEnv; now?: Date } & BooksCallOptions = {},
): Promise<SalesTaxReadiness> {
  const env = options.env ?? process.env;
  const base = {
    provider: "zoho_books" as const,
    quoteOnlyCategories: Array.from(STORE_TAX_CODE_PENDING),
    checkedAt: (options.now ?? new Date()).toISOString(),
  };

  const missingSettings = missingZohoBooksTaxSettings(env);
  const config = zohoBooksTaxConfig(env);
  if (!config) {
    return {
      ...base,
      status: "NOT_CONFIGURED",
      checks: { connection: "missing", taxRegistration: "unknown", serviceItem: "unknown", taxContact: "unknown" },
      missingSettings,
      message: "Pay Now is paused: the server is not connected to Zoho Books yet, so every Pay Now cart switches to a quote.",
    };
  }

  const [org, item, contact] = await Promise.all([
    booksCall(config, { method: "GET", path: `/organizations/${config.organizationId}` }, options),
    booksCall(config, { method: "GET", path: `/items/${config.serviceItemId}` }, options),
    booksCall(config, { method: "GET", path: `/contacts/${config.contactId}` }, options),
  ]);
  const replies = [org, item, contact];

  if (replies.some((reply) => !reply.ok && reply.failure === "auth")) {
    return {
      ...base,
      status: "AUTH_REQUIRED",
      checks: { connection: "set", taxRegistration: "unknown", serviceItem: "unknown", taxContact: "unknown" },
      missingSettings,
      message: "Zoho refused the Books token. Generate a new self-client code with the four Books scopes and replace ZOHO_BOOKS_REFRESH_TOKEN on the server.",
    };
  }

  const checks = {
    connection: "set" as const,
    taxRegistration: registration(org),
    serviceItem: exists(item, "item"),
    taxContact: exists(contact, "contact"),
  };

  if (checks.taxRegistration === "missing") {
    return {
      ...base,
      status: "INCOMPLETE",
      checks,
      missingSettings,
      message: "Zoho Books has no sales tax registration yet. Turn on Sales Tax Automation in Books (Settings → Taxes) and add DE's Arizona registration.",
    };
  }
  if (checks.serviceItem === "missing") {
    return {
      ...base,
      status: "INCOMPLETE",
      checks,
      missingSettings,
      message: "ZOHO_BOOKS_SERVICE_ITEM_ID does not match an active item in Books. Point it at the service item that carries the tax category.",
    };
  }
  if (checks.taxContact === "missing") {
    return {
      ...base,
      status: "INCOMPLETE",
      checks,
      missingSettings,
      message: "ZOHO_BOOKS_TAX_CONTACT_ID does not match an active contact in Books. Point it at the contact used for tax checks.",
    };
  }
  if (checks.taxRegistration === "unknown" || checks.serviceItem === "unknown" || checks.taxContact === "unknown") {
    const forbidden = replies.some((reply) => !reply.ok && reply.failure === "forbidden");
    return {
      ...base,
      status: "UNKNOWN",
      checks,
      missingSettings,
      message: forbidden
        ? "The Books token is missing a scope. It needs ZohoBooks.estimates.CREATE, estimates.DELETE, settings.READ and contacts.READ."
        : "Zoho Books did not answer the readiness check. Pay Now still switches to a quote if Books cannot calculate tax.",
    };
  }
  return {
    ...base,
    status: "READY",
    checks,
    missingSettings,
    message: "Pay Now asks Zoho Books for sales tax: Books has a tax registration, and the service item and tax-check contact are set.",
  };
}

let cached: { at: number; value: SalesTaxReadiness } | null = null;

/** The readiness answer, cached for READINESS_TTL_MS. Not-configured is never cached, so new settings show at once. */
export async function cachedSalesTaxReadiness(nowMs: number = Date.now()): Promise<SalesTaxReadiness> {
  if (cached && nowMs - cached.at < READINESS_TTL_MS && zohoBooksTaxConfig()) return cached.value;
  const value = await checkSalesTaxReadiness();
  cached = value.status === "NOT_CONFIGURED" ? null : { at: nowMs, value };
  return value;
}

/** Test seam. */
export function resetSalesTaxReadinessCache(): void {
  cached = null;
}
