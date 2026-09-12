import { zohoClient } from "./zoho/zohoClient";
import { zohoCRMService } from "./zoho/zohoCRM";
import { money } from "@shared/storeCommerce";
import type { CanonicalQuoteLine } from "./storeQuoteCommerce";
import { quoteTotals } from "./storeQuoteCommerce";
import { websiteLeadTaxonomy } from "./zoho/leadTaxonomy";

export type StoreQuoteCrmInput = {
  quoteNumber: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  companyName?: string | null;
  message?: string | null;
  requestedItems: CanonicalQuoteLine[];
};

export type StoreQuoteCrmResult = {
  accountId?: string;
  contactId?: string;
  dealId?: string;
  leadId?: string;
  quoteId?: string;
};

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "Unknown" };
  if (parts.length === 1) return { first: "", last: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function buildCrmQuoteDescription(quote: StoreQuoteCrmInput): string {
  const totals = quoteTotals(quote.requestedItems);
  const lines = quote.requestedItems
    .slice(0, 25)
    .map((item) => `${item.quantity} x ${item.sku} ${item.name} @ $${item.unitPrice.toFixed(2)}`);
  return [
    `Store quote ${quote.quoteNumber}`,
    quote.companyName ? `Company: ${quote.companyName}` : "",
    `Due today $${totals.dueToday.toFixed(2)} / Monthly $${totals.monthly.toFixed(2)} / Annual $${totals.annual.toFixed(2)}`,
    "",
    "Requested items:",
    ...lines,
    quote.message ? `\nRequester notes: ${quote.message.slice(0, 500)}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n")
    .slice(0, 3000);
}

function closingDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString().slice(0, 10);
}

/**
 * Best-effort CRM sync. Never throws to the quote HTTP path.
 * Zoho Quotes module is optional — Deal + Contact + Lead always attempted first.
 */
export async function syncStoreQuoteToCrm(quote: StoreQuoteCrmInput): Promise<StoreQuoteCrmResult | null> {
  if (!zohoClient.isConfigured()) {
    console.info("[store-quote] CRM sync skipped — Zoho is not configured");
    return null;
  }

  const result: StoreQuoteCrmResult = {};
  const email = quote.contactEmail.trim().toLowerCase();
  const company = (quote.companyName || "Store quote prospect").trim().slice(0, 200);
  const { first, last } = splitName(quote.contactName);
  const description = buildCrmQuoteDescription(quote);
  const totals = quoteTotals(quote.requestedItems);
  const amount = money(totals.dueToday + totals.monthly + totals.annual);

  try {
    const accounts = await zohoCRMService.searchAccounts(`(Account_Name:equals:${company.replace(/[()]/g, "")})`);
    if (accounts[0]?.id) {
      result.accountId = accounts[0].id;
    } else {
      const created = await zohoCRMService.createAccount({
        Account_Name: company,
        Phone: quote.contactPhone || "",
        Description: `Created from store quote ${quote.quoteNumber}`,
      });
      result.accountId = (created as { details?: { id?: string }; id?: string }).details?.id || created.id;
    }
  } catch (error: any) {
    console.warn("[store-quote] CRM account sync failed:", error?.message || error);
  }

  try {
    const existing = await zohoCRMService.getContactByEmail(email);
    if (existing?.id) {
      result.contactId = existing.id;
    } else {
      const created = await zohoCRMService.createContact({
        First_Name: first || undefined,
        Last_Name: last,
        Email: email,
        Phone: quote.contactPhone || "",
        Account_Name: result.accountId ? { id: result.accountId, name: company } : undefined,
      });
      result.contactId = (created as { details?: { id?: string }; id?: string }).details?.id || created.id;
    }
  } catch (error: any) {
    console.warn("[store-quote] CRM contact sync failed:", error?.message || error);
  }

  try {
    const created = await zohoCRMService.createDeal({
      Deal_Name: `Store quote ${quote.quoteNumber}${quote.companyName ? ` — ${quote.companyName}` : ""}`.slice(0, 120),
      Amount: amount,
      Stage: "Qualification",
      Closing_Date: closingDate(),
      Account_Name: result.accountId ? { id: result.accountId, name: company } : undefined,
      Contact_Name: result.contactId ? { id: result.contactId, name: quote.contactName } : undefined,
      Description: description,
    } as any);
    result.dealId = (created as { details?: { id?: string }; id?: string }).details?.id || created.id;
  } catch (error: any) {
    console.warn("[store-quote] CRM deal sync failed:", error?.message || error);
  }

  try {
    const existingLead = await zohoCRMService.getLeadByEmail(email);
    if (existingLead?.id) {
      result.leadId = existingLead.id;
    } else {
      const taxonomy = websiteLeadTaxonomy("store_quote");
      const created = await zohoCRMService.createLead({
        First_Name: first || undefined,
        Last_Name: last,
        Email: email,
        Phone: quote.contactPhone || undefined,
        Company: company,
        Lead_Source: taxonomy.leadSource,
        Description: description,
        Lead_Status: taxonomy.leadStatus,
      });
      result.leadId = (created as { details?: { id?: string }; id?: string }).details?.id || created.id;
    }
  } catch (error: any) {
    console.warn("[store-quote] CRM lead sync failed:", error?.message || error);
  }

  try {
    const created = await zohoCRMService.createQuote({
      Subject: quote.quoteNumber,
      Quote_Stage: "Draft",
      Account_Name: result.accountId ? { id: result.accountId } : undefined,
      Contact_Name: result.contactId ? { id: result.contactId } : undefined,
      Description: description,
    });
    result.quoteId = created?.details?.id || created?.id;
  } catch (error: any) {
    console.warn("[store-quote] CRM Quotes module unavailable:", error?.message || error);
  }

  console.info("[store-quote] CRM sync finished", {
    quoteNumber: quote.quoteNumber,
    accountId: result.accountId || null,
    contactId: result.contactId || null,
    dealId: result.dealId || null,
    leadId: result.leadId || null,
    quoteId: result.quoteId || null,
  });

  return result;
}
