/**
 * Zoho products the website calls and the OAuth scopes each one needs.
 * Single source of truth for the Zoho Connect consent screen, the legacy
 * Self Client instructions (docs/ZOHO-OAUTH-INVENTORY.md) and the "does this
 * grant cover product X" check.
 *
 * Ported from Intelligence Hub lib/zoho-oauth/scopes.ts. Local deviation: the
 * website's products (CRM, Desk, Books, Payments) instead of the Hub's, and a
 * Billing entry that rides the CRM token (server/zoho/zohoBilling.ts) but is
 * requested in the same consent.
 */

export type ZohoProduct = "crm" | "desk" | "books" | "payments";

export const ZOHO_PRODUCTS: readonly ZohoProduct[] = ["crm", "desk", "books", "payments"];

export const ZOHO_PRODUCT_LABELS: Record<ZohoProduct, string> = {
  crm: "Zoho CRM",
  desk: "Zoho Desk",
  books: "Zoho Books",
  payments: "Zoho Payments",
};

export const ZOHO_PRODUCT_SCOPES: Record<ZohoProduct, readonly string[]> = {
  // Leads, contacts, accounts, deals, calls (server/zoho/zohoCRM.ts).
  crm: ["ZohoCRM.modules.READ", "ZohoCRM.modules.CREATE", "ZohoCRM.modules.UPDATE", "ZohoCRM.users.READ"],
  // Tickets, contacts, the org lookup and the status probe (server/zoho/zohoDesk.ts).
  desk: [
    "Desk.tickets.READ",
    "Desk.tickets.CREATE",
    "Desk.tickets.UPDATE",
    "Desk.contacts.READ",
    "Desk.contacts.WRITE",
    "Desk.settings.READ",
    "Desk.basic.READ",
  ],
  // Pay Now tax checks and paid-order records (server/services/zohoBooksTax.ts,
  // zohoBooksInvoice.ts). Nothing that deletes invoices, payments or customers.
  books: [
    "ZohoBooks.estimates.CREATE",
    "ZohoBooks.estimates.DELETE",
    "ZohoBooks.settings.READ",
    "ZohoBooks.contacts.READ",
    "ZohoBooks.contacts.CREATE",
    "ZohoBooks.invoices.CREATE",
    "ZohoBooks.invoices.READ",
    "ZohoBooks.customerpayments.CREATE",
  ],
  // Hosted checkout sessions (server/zohoPayments.ts).
  payments: ["ZohoPay.payments.CREATE", "ZohoPay.payments.READ"],
};

/**
 * Read-only Zoho Billing scopes the CRM token also serves today
 * (server/zoho/zohoBilling.ts). Requested in the Connect consent so the shared
 * grant keeps Billing working; not required for CRM's own coverage check.
 */
export const ZOHO_BILLING_SCOPES: readonly string[] = [
  "ZohoSubscriptions.subscriptions.READ",
  "ZohoSubscriptions.invoices.READ",
  "ZohoSubscriptions.customers.READ",
  "ZohoSubscriptions.plans.READ",
  "ZohoSubscriptions.settings.READ",
];

export function parseZohoProducts(raw: unknown): ZohoProduct[] {
  const parts =
    typeof raw === "string" ? raw.split(",") : Array.isArray(raw) ? raw.map(String) : [];
  const picked = parts
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is ZohoProduct => (ZOHO_PRODUCTS as readonly string[]).includes(p));
  return picked.length ? [...new Set(picked)] : [...ZOHO_PRODUCTS];
}

/** Every scope one consent asks for: the products' scopes, plus Billing with CRM. */
export function scopesForProducts(products: readonly ZohoProduct[]): string[] {
  const scopes = products.flatMap((p) => ZOHO_PRODUCT_SCOPES[p]);
  if (products.includes("crm")) scopes.push(...ZOHO_BILLING_SCOPES);
  return [...new Set(scopes)];
}

function splitScopes(granted: string): string[] {
  return granted
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * True when `granted` (Zoho's space/comma separated scope string) covers every
 * required scope. `Service.resource.ALL` covers any operation on that
 * resource; `Service.ALL`-style prefixes cover deeper resources, and
 * `Service.fullaccess.all` covers every scope of that service.
 * A null/empty grant scope means "unknown" and is treated as covering, so the
 * first API call decides.
 */
export function scopesCover(granted: string | null | undefined, required: readonly string[]): boolean {
  if (!granted || !granted.trim()) return true;
  const have = splitScopes(granted);
  return required.every((r) => {
    const want = r.toLowerCase();
    return have.some((g) => {
      if (g === want) return true;
      if (!g.endsWith(".all")) return false;
      // ZohoBooks.fullaccess.all covers every ZohoBooks.* scope (local addition).
      const prefix = g.endsWith(".fullaccess.all")
        ? g.slice(0, -"fullaccess.all".length)
        : g.slice(0, -3); // keep trailing "."
      return want.startsWith(prefix);
    });
  });
}

export function productsCoveredBy(granted: string | null | undefined): ZohoProduct[] {
  return ZOHO_PRODUCTS.filter((p) => scopesCover(granted, ZOHO_PRODUCT_SCOPES[p]));
}
