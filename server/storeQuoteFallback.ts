/**
 * What happens to a store quote request the database refused (#240, same
 * never-lose rule the owner set for solution requests in #243).
 *
 * Three independent saves, each tried regardless of the others:
 *   1. the local disk spool (becomes a store_quote_requests row when Postgres recovers),
 *   2. a Zoho CRM deal/lead via the existing store quote sync,
 *   3. an email with the full request to the lead address and sales.
 * The submit is accepted when any of them held. Only when all three fail does
 * the buyer get the DURABLE_DATABASE_REQUIRED retry, and their draft is kept.
 */
import { buildCommercialSnapshot } from "./integrations/commercialSnapshot";
import { quoteSpoolDir, updateSpoolEntry, writeSpoolEntry, type SpoolEntry } from "./publicSolutionSpool";
import { quoteTotals } from "./storeQuoteCommerce";
import { syncStoreQuoteToCrm } from "./storeQuoteCrm";
import type { StoredQuoteRequest } from "./storeQuoteStore";
import { notificationService } from "./services/notificationService";

/** The spooled record: the quote plus what the QUOTE_REQUESTED event needs at recovery. */
export type SpooledQuote = {
  id: string;
  quote: StoredQuoteRequest;
  canonicalAccountId: string | null;
  portalClientId: string | null;
  crmRecorded: boolean;
};

export type QuoteSpoolEntry = SpoolEntry<SpooledQuote>;

export type QuoteOutsideDatabaseOutcome = {
  durable: "spool" | "crm" | "email" | null;
  spooled: boolean;
  crmRecorded: boolean;
  salesEmailed: boolean;
};

export type QuoteFallbackDeps = {
  spool: (entry: QuoteSpoolEntry) => boolean;
  updateSpool: (entry: QuoteSpoolEntry) => boolean;
  syncCrm: (record: SpooledQuote) => Promise<boolean>;
  emailSales: (quote: StoredQuoteRequest) => Promise<boolean>;
  now: () => Date;
};

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Plain-text summary for the fallback email: every line and the totals. */
export function describeQuoteRequest(quote: StoredQuoteRequest): string {
  const totals = quoteTotals(quote.requestedItems);
  const lines = quote.requestedItems.map(
    (item) => `- ${item.quantity} x ${item.name} (${item.sku}) @ ${money(item.unitPrice)} = ${money(item.total)} [${item.pricingType}]`,
  );
  return [
    "Requested items:",
    ...lines,
    "",
    `Due today: ${money(totals.dueToday)}  Monthly: ${money(totals.monthly)}  Annual: ${money(totals.annual)}`,
    ...(quote.message ? ["", "Message:", quote.message] : []),
  ].join("\n");
}

export const defaultQuoteFallbackDeps: QuoteFallbackDeps = {
  spool: (entry) => writeSpoolEntry(entry, quoteSpoolDir()),
  updateSpool: (entry) => updateSpoolEntry(entry, quoteSpoolDir()),
  syncCrm: async (record) =>
    (await syncStoreQuoteToCrm({ ...record.quote, canonicalAccountId: record.canonicalAccountId })) !== null,
  emailSales: (quote) =>
    notificationService.sendQuoteRequestFallback({
      quoteNumber: quote.quoteNumber,
      contactName: quote.contactName,
      contactEmail: quote.contactEmail,
      contactPhone: quote.contactPhone || "",
      companyName: quote.companyName || "",
      description: describeQuoteRequest(quote),
    }),
  now: () => new Date(),
};

export async function saveQuoteOutsideDatabase(
  record: SpooledQuote,
  deps: QuoteFallbackDeps = defaultQuoteFallbackDeps,
): Promise<QuoteOutsideDatabaseOutcome> {
  // The spool first: it is local, fast, and the only layer that later becomes a row.
  const entry: QuoteSpoolEntry = { version: 1, spooledAt: deps.now().toISOString(), salesEmailedAt: null, record };
  let spooled = false;
  try {
    spooled = deps.spool(entry);
  } catch {
    spooled = false;
  }

  let crmRecorded = false;
  try {
    crmRecorded = await deps.syncCrm(record);
  } catch (error: any) {
    console.warn("[store-quote] CRM sync failed outside the database:", error?.message || error);
  }

  let salesEmailed = false;
  try {
    salesEmailed = await deps.emailSales(record.quote);
  } catch (error: any) {
    console.warn("[store-quote] fallback email failed:", error?.message || error);
  }

  // Recovery must not create a second CRM record.
  if (spooled && (crmRecorded || salesEmailed)) {
    deps.updateSpool({
      ...entry,
      salesEmailedAt: salesEmailed ? deps.now().toISOString() : null,
      record: { ...record, crmRecorded },
    });
  }

  const durable = spooled ? "spool" : crmRecorded ? "crm" : salesEmailed ? "email" : null;
  return { durable, spooled, crmRecorded, salesEmailed };
}

/** The QUOTE_REQUESTED payload, shared by the route and recovery so the Hub sees one shape. */
export function quoteRequestedEvent(
  quote: StoredQuoteRequest,
  context: { canonicalAccountId: string | null; portalClientId: string | null },
) {
  return {
    id: quote.id,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    contactName: quote.contactName,
    contactEmail: quote.contactEmail,
    contactPhone: quote.contactPhone,
    companyName: quote.companyName,
    message: quote.message,
    source: "store_quote",
    canonicalAccountId: context.canonicalAccountId,
    portalClientId: context.portalClientId,
    commercial: buildCommercialSnapshot({
      reference: quote.quoteNumber,
      status: "requested",
      portalClientId: context.portalClientId,
      company: quote.companyName,
      email: quote.contactEmail,
      lineItems: quote.requestedItems,
      occurredAt: new Date(quote.createdAt).toISOString(),
    }),
  };
}
