import { billingLabel, isRecurringPricingType } from "@shared/storeCommerce";
import type { CanonicalQuoteLine, QuoteTotals } from "./storeQuoteCommerce";
import { quoteTotals } from "./storeQuoteCommerce";
import { COMPANY } from "@shared/companyContact";
import { accountTeamFor, type AccountTeam } from "@shared/accountManagers";
import {
  accountTeamBlock,
  closeBlock,
  coverBlock,
  DE_PDF,
  DE_STORE_DOC_ID,
  documentHtml,
  esc,
  phoenixDate,
  section,
  specStrip,
  usd,
} from "./pdf/dePdfBrand";
import { renderHtmlToPdf } from "./pdf/renderHtmlToPdf";

export type QuotePdfInput = {
  quoteNumber: string;
  contactName: string;
  contactEmail: string;
  companyName?: string | null;
  createdAt: Date | string;
  requestedItems: CanonicalQuoteLine[];
  message?: string | null;
  /** Assigned account manager + sales department; default team when absent. */
  accountTeam?: AccountTeam;
};

/** Preliminary quote on the DE document system (transaction family). */
export function buildQuotePdfHtml(quote: QuotePdfInput): string {
  const totals: QuoteTotals = quoteTotals(quote.requestedItems);
  const submitted = phoenixDate(quote.createdAt);
  const company = quote.companyName?.trim() || "";

  const rows = quote.requestedItems
    .map((item) => {
      const cadence = billingLabel(item.pricingType);
      const recurring = isRecurringPricingType(item.pricingType);
      const discount =
        item.unitPrice < item.listPrice
          ? `<div class="item-sub">Your price \u2014 list ${esc(usd(item.listPrice))}</div>`
          : "";
      const contract = item.contractOnly
        ? `<div class="item-sub">Contract review required before provisioning.</div>`
        : "";
      return `<tr>
        <td>
          <div class="item-name">${esc(item.name)}</div>
          <div class="ref">${esc(item.sku)}</div>
          <span class="chip${recurring ? " recurring" : ""}">${esc(cadence)}</span>
          ${discount}${contract}
        </td>
        <td class="num">${esc(item.quantity)}</td>
        <td class="num money">${esc(usd(item.unitPrice))}</td>
        <td class="num money amount">${esc(usd(item.total))}</td>
      </tr>`;
    })
    .join("");

  const notes = (quote.message || "").trim().slice(0, 800);

  const kpis = `<table class="kpis" role="presentation"><tr>
      <td><span class="lbl">Due today</span><div class="v money">${esc(usd(totals.dueToday))}</div><div class="u">One-time / setup</div></td>
      <td><span class="lbl">Monthly</span><div class="v money">${esc(usd(totals.monthly))}</div><div class="u">Recurring, billed monthly</div></td>
      <td><span class="lbl">Annual</span><div class="v money">${esc(usd(totals.annual))}</div><div class="u">Billed yearly (not a 12-month projection)</div></td>
    </tr></table>`;

  const items = rows
    ? `<table class="items">
      <thead><tr><th scope="col">Item</th><th scope="col" class="num">Qty</th><th scope="col" class="num">Unit price</th><th scope="col" class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
    : `<p class="empty">No catalog lines on this request.</p>`;

  const body = `${coverBlock({
    docId: DE_STORE_DOC_ID.quote,
    eyebrow: "Preliminary solution quote",
    title: quote.quoteNumber,
    subtitleParts: [company || quote.contactName, submitted],
    stamp: "Preliminary \u00B7 not a signed offer",
  })}
  ${specStrip([
    ["Quote number", quote.quoteNumber],
    ["Submitted", submitted],
    ["Prepared for", quote.contactName],
    ["Company", company],
    ["Email", quote.contactEmail],
  ])}
  <main class="wrap">
    ${section(1, "Investment summary", kpis)}
    ${section(2, "Requested line items", items)}
    ${notes ? section(3, "Notes from request", `<div class="callout">${esc(notes).replace(/\n/g, "<br/>")}</div>`) : ""}
    ${closeBlock({
      heading: "A consultant confirms terms",
      text: "This PDF restates catalog pricing for the requested solution. It is not a signed commercial offer. A consultant will confirm terms.",
      email: COMPANY.salesEmail,
    })}
    ${accountTeamBlock(quote.accountTeam ?? accountTeamFor(null))}
  </main>`;

  return documentHtml({
    title: `${quote.quoteNumber} · ${DE_PDF.brandName}`,
    head: { left: `Preliminary quote · ${quote.quoteNumber}`, right: DE_STORE_DOC_ID.quote },
    body,
  });
}

/**
 * Branded preliminary quote PDF via the shared HTML→PDF pipeline.
 * Regenerated on each download from the stored canonical quote.
 */
export async function buildQuotePdf(quote: QuotePdfInput): Promise<Buffer> {
  return renderHtmlToPdf(buildQuotePdfHtml(quote));
}
