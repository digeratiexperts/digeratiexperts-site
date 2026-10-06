import { storeTaxItem } from "@shared/storeTaxCodes";
import { storeProducts } from "../../client/src/data/storeProducts";
import { booksCall, zohoBooksTaxConfig, type BooksCallOptions, type ZohoBooksTaxConfig } from "./zohoBooksTax";

/**
 * Paid Pay Now orders become Zoho Books invoices (Joe, 2026-10-05: "Yes and
 * everything else you mention").
 *
 * Zoho Payments takes the card outside Books, so Books never hears about the
 * sale on its own, and Arizona TPT returns are filed from Books. Once an order
 * is paid, fulfillment calls this once:
 *   1. find the customer in Books by billing email, or create them;
 *   2. create an invoice (reference = the website order number) with the same
 *      Books items, so Sales Tax Automation taxes it the way checkout did;
 *   3. only when the invoice total matches what Zoho Payments charged: mark it
 *      sent and record the payment against it.
 * A mismatch leaves the invoice as a draft for staff. Nothing is emailed to the
 * customer from Books; DE's own confirmation email already went out.
 *
 * Never throws: fulfillment must finish whatever Books says. The answer is one
 * line for the order notes, or null when Books is not connected.
 * Extra token scopes: ZohoBooks.contacts.CREATE, ZohoBooks.invoices.CREATE,
 * ZohoBooks.invoices.READ, ZohoBooks.customerpayments.CREATE.
 */

export interface PaidOrderForBooks {
  orderNumber: string;
  paymentMethod: string | null;
  lineItems: unknown;
  total: string | number | null;
  billingEmail: string | null;
  billingName: string | null;
  billingCompany: string | null;
  billingAddress: unknown;
  zohoPaymentId: string | null;
  paidAt: Date | string | null;
}

type OrderLine = { productId?: unknown; sku?: unknown; name?: unknown; quantity?: unknown; unitPrice?: unknown };
type Address = { line1: string; city: string; state: string; postalCode: string };

/** On whenever the server is connected to Books; ZOHO_BOOKS_RECORD_PAID_ORDERS=false turns it off. */
export function booksInvoicesEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return zohoBooksTaxConfig(env) !== null && env.ZOHO_BOOKS_RECORD_PAID_ORDERS?.trim().toLowerCase() !== "false";
}

function cents(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function money(c: number): string {
  return (c / 100).toFixed(2);
}

/** The order's paid date in DE's books: Arizona time, yyyy-mm-dd. */
export function booksDate(paidAt: Date | string | null): string {
  const date = paidAt ? new Date(paidAt) : new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Phoenix", year: "numeric", month: "2-digit", day: "2-digit" }).format(
    Number.isFinite(date.getTime()) ? date : new Date(),
  );
}

function address(value: unknown): Address | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Record<string, unknown>;
  const pick = (key: string) => (typeof a[key] === "string" ? (a[key] as string).trim() : "");
  const result = { line1: pick("line1"), city: pick("city"), state: pick("state"), postalCode: pick("postalCode") };
  return result.line1 && result.city && result.state && result.postalCode ? result : null;
}

function booksAddress(a: Address) {
  return { address: a.line1, city: a.city, state: a.state, zip: a.postalCode, country: "U.S.A" };
}

function splitName(full: string): { first_name: string; last_name: string } {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? { first_name: parts.slice(0, -1).join(" "), last_name: parts[parts.length - 1] } : { first_name: full.trim(), last_name: "" };
}

async function findOrCreateCustomer(
  config: ZohoBooksTaxConfig,
  order: PaidOrderForBooks,
  email: string,
  billing: Address | null,
  options: BooksCallOptions,
): Promise<string | null> {
  const found = await booksCall(
    config,
    { method: "GET", path: `/contacts?contact_type=customer&email=${encodeURIComponent(email)}` },
    options,
  );
  if (found.ok) {
    const match = (Array.isArray(found.body?.contacts) ? found.body.contacts : []).find(
      (contact: any) => typeof contact?.contact_id === "string" && contact.status !== "inactive",
    );
    if (match) return match.contact_id;
  } else {
    return null;
  }

  const company = order.billingCompany?.trim() || "";
  const person = order.billingName?.trim() || "";
  const baseName = company || person || email;
  const body = (contactName: string) => ({
    contact_name: contactName.slice(0, 200),
    ...(company ? { company_name: company.slice(0, 200) } : {}),
    contact_type: "customer",
    customer_sub_type: company ? "business" : "individual",
    ...(billing ? { billing_address: booksAddress(billing), shipping_address: booksAddress(billing) } : {}),
    contact_persons: [{ ...splitName(person || email), email, is_primary_contact: true }],
    notes: `Created by digeratiexperts.com for paid website order ${order.orderNumber}.`,
  });
  // Books contact names are unique: a name clash with a different email gets the email added.
  for (const contactName of [baseName, `${baseName} (${email})`]) {
    const created = await booksCall(config, { method: "POST", path: "/contacts", body: body(contactName) }, options);
    if (created.ok && typeof created.body?.contact?.contact_id === "string") return created.body.contact.contact_id;
    if (!created.ok && created.failure !== "rejected") return null;
  }
  return null;
}

export async function recordPaidOrderInBooks(
  order: PaidOrderForBooks,
  options: BooksCallOptions & { env?: NodeJS.ProcessEnv } = {},
): Promise<string | null> {
  const env = options.env ?? process.env;
  if (order.paymentMethod !== "zoho" || !booksInvoicesEnabled(env)) return null;
  const config = zohoBooksTaxConfig(env)!;

  try {
    const raw = Array.isArray(order.lineItems) ? (order.lineItems as OrderLine[]) : [];
    const lines = raw.map((line) => {
      const product = storeProducts.find((candidate) => candidate.id === line.productId);
      const itemId = product ? storeTaxItem(product.category, config.serviceItemId, config.itemOverrides) : null;
      return {
        sku: typeof line.sku === "string" ? line.sku : String(line.productId ?? "item"),
        name: typeof line.name === "string" ? line.name : product?.name ?? "Website order line",
        quantity: Number(line.quantity) || 1,
        rate: Number(line.unitPrice),
        itemId,
      };
    });
    if (lines.length === 0) return "booksInvoice:skipped (no line items)";
    const unmapped = lines.filter((line) => !line.itemId || !Number.isFinite(line.rate)).map((line) => line.sku);
    if (unmapped.length > 0) return `booksInvoice:skipped (no Books item for ${unmapped.join(", ")})`;

    const email = order.billingEmail?.trim() || "";
    if (!email) return "booksInvoice:skipped (no billing email)";
    const paidCents = cents(order.total);
    if (!Number.isFinite(paidCents) || paidCents <= 0) return "booksInvoice:skipped (no paid total)";

    // Idempotent: a retried fulfillment finds the invoice it already made.
    const existing = await booksCall(
      config,
      { method: "GET", path: `/invoices?reference_number=${encodeURIComponent(order.orderNumber)}` },
      options,
    );
    if (!existing.ok) return `booksInvoice:failed (Books ${existing.failure})`;
    const prior = (Array.isArray(existing.body?.invoices) ? existing.body.invoices : []).find(
      (invoice: any) => invoice?.reference_number === order.orderNumber,
    );
    if (prior) return `booksInvoice:${prior.invoice_number ?? prior.invoice_id} already recorded`;

    const billing = address(order.billingAddress);
    const customerId = await findOrCreateCustomer(config, order, email, billing, options);
    if (!customerId) return "booksInvoice:failed (customer could not be found or created)";

    const date = booksDate(order.paidAt);
    const created = await booksCall(
      config,
      {
        method: "POST",
        path: "/invoices?send=false",
        body: {
          customer_id: customerId,
          reference_number: order.orderNumber,
          date,
          payment_terms: 0,
          is_inclusive_tax: false,
          ...(billing ? { shipping_address: booksAddress(billing) } : {}),
          line_items: lines.map((line) => ({
            item_id: line.itemId,
            name: line.name.slice(0, 100),
            description: line.sku,
            rate: line.rate,
            quantity: line.quantity,
          })),
          notes: `Paid online through Zoho Payments (website order ${order.orderNumber}).`,
        },
      },
      options,
    );
    const invoice = created.ok ? created.body?.invoice : null;
    if (!invoice || typeof invoice.invoice_id !== "string") {
      return `booksInvoice:failed (invoice not created${created.ok ? "" : `: Books ${created.failure}`})`;
    }
    const number = typeof invoice.invoice_number === "string" ? invoice.invoice_number : invoice.invoice_id;

    const invoiceCents = cents(invoice.total);
    if (invoiceCents !== paidCents) {
      console.warn("[BOOKS] PAID_ORDER_TOTAL_MISMATCH", { orderNumber: order.orderNumber, invoice: number, invoiceCents, paidCents });
      return `booksInvoice:${number} left as draft (Books total $${money(invoiceCents)}, paid $${money(paidCents)})`;
    }

    const sent = await booksCall(config, { method: "POST", path: `/invoices/${invoice.invoice_id}/status/sent` }, options);
    if (!sent.ok) return `booksInvoice:${number} left as draft (could not mark sent: Books ${sent.failure})`;

    const deposit = env.ZOHO_BOOKS_DEPOSIT_ACCOUNT_ID?.trim();
    const payment = await booksCall(
      config,
      {
        method: "POST",
        path: "/customerpayments",
        body: {
          customer_id: customerId,
          payment_mode: "creditcard",
          amount: paidCents / 100,
          date,
          reference_number: (order.zohoPaymentId || order.orderNumber).slice(0, 100),
          description: `Zoho Payments ${order.zohoPaymentId ?? "payment"} for website order ${order.orderNumber}.`,
          invoices: [{ invoice_id: invoice.invoice_id, amount_applied: paidCents / 100 }],
          ...(deposit ? { account_id: deposit } : {}),
        },
      },
      options,
    );
    if (!payment.ok) return `booksInvoice:${number} sent, payment NOT recorded (Books ${payment.failure})`;

    console.info("[BOOKS] PAID_ORDER_RECORDED", { orderNumber: order.orderNumber, invoice: number, amount: money(paidCents) });
    return `booksInvoice:${number} paid`;
  } catch (error: any) {
    console.warn("[BOOKS] PAID_ORDER_NOT_RECORDED", { orderNumber: order.orderNumber, reason: error?.message || String(error) });
    return "booksInvoice:failed (unexpected error)";
  }
}
