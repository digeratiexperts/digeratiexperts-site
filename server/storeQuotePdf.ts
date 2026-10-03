import { billingLabel, isRecurringPricingType } from "@shared/storeCommerce";
import { PRIMARY_PHONE } from "@shared/companyContact";
import type { CanonicalQuoteLine, QuoteTotals } from "./storeQuoteCommerce";
import { quoteTotals } from "./storeQuoteCommerce";
import {
  coverBlock,
  DE_PDF,
  dePdfBaseStyles,
  esc,
  phoenixDate,
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
};

/** Branded preliminary quote HTML (same visual family as the solution packet). */
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
          <div class="item-sub ref">${esc(item.sku)}</div>
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

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${esc(quote.quoteNumber)} · ${esc(DE_PDF.brandName)}</title>
<style>
${dePdfBaseStyles()}
</style>
</head><body>
  ${coverBlock({
    eyebrow: "Preliminary solution quote",
    title: quote.quoteNumber,
    subtitleParts: [company || quote.contactName, submitted],
  })}
  <div class="meta-strip">
    Prepared for <strong>${esc(quote.contactName)}</strong>
    ${company ? ` \u2022 Company <strong>${esc(company)}</strong>` : ""}
    \u2022 ${esc(quote.contactEmail)}
    \u2022 ${esc(DE_PDF.website)}
  </div>
  <div class="wrap">
    <h2>Investment summary</h2>
    <table class="invest"><tr>
      <td><div class="k">Due today</div><div class="v">${esc(usd(totals.dueToday))}</div><div class="note">One-time / setup</div></td>
      <td><div class="k">Monthly</div><div class="v">${esc(usd(totals.monthly))}</div><div class="note">Recurring catalog estimate</div></td>
      <td><div class="k">Annual</div><div class="v">${esc(usd(totals.annual))}</div><div class="note">Catalog projection</div></td>
    </tr></table>

    <h2>Requested line items</h2>
    ${
      rows
        ? `<table class="items">
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
        : `<p class="empty">No catalog lines on this request.</p>`
    }

    ${
      notes
        ? `<h2>Notes from request</h2><p>${esc(notes).replace(/\n/g, "<br/>")}</p>`
        : ""
    }

    <div class="closing">
      This PDF restates catalog pricing for the requested solution. It is not a signed
      commercial offer. A consultant will confirm terms.
      Questions: <span class="nowrap">sales@digerati-experts.com</span> · <span class="nowrap">${esc(PRIMARY_PHONE.display)}</span>
    </div>
  </div>
</body></html>`;
}

/**
 * Branded preliminary quote PDF via the shared HTML→PDF pipeline.
 * Regenerated on each download from the stored canonical quote.
 */
export async function buildQuotePdf(quote: QuotePdfInput): Promise<Buffer> {
  return renderHtmlToPdf(buildQuotePdfHtml(quote));
}
