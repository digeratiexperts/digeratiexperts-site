import { billingLabel, money } from "@shared/storeCommerce";
import { PRIMARY_PHONE } from "@shared/companyContact";
import type { CanonicalQuoteLine, QuoteTotals } from "./storeQuoteCommerce";
import { quoteTotals } from "./storeQuoteCommerce";
import {
  coverBlock,
  DE_PDF,
  dePdfBaseStyles,
  esc,
  phoenixDate,
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

function moneyLabel(value: number): string {
  return `$${money(value).toFixed(2)}`;
}

/** Branded preliminary quote HTML (same visual family as the solution packet). */
export function buildQuotePdfHtml(quote: QuotePdfInput): string {
  const totals: QuoteTotals = quoteTotals(quote.requestedItems);
  const submitted = phoenixDate(quote.createdAt);
  const company = quote.companyName?.trim() || "";

  const lines = quote.requestedItems
    .map((item) => {
      const cadence = billingLabel(item.pricingType);
      const discount =
        item.unitPrice < item.listPrice ? ` (list ${moneyLabel(item.listPrice)})` : "";
      const note = item.contractOnly ? `<div class="svc-desc">Contract review required before provisioning.</div>` : "";
      return `<div class="line">
        <span class="line-label">
          <strong>${esc(item.quantity)} × ${esc(item.name)}</strong>
          <div class="svc-desc">${esc(item.sku)} · ${esc(cadence)} · ${esc(moneyLabel(item.unitPrice))} each${esc(discount)}</div>
          ${note}
        </span>
        <span class="line-qty">${esc(moneyLabel(item.total))}</span>
      </div>`;
    })
    .join("");

  const notes = (quote.message || "").trim().slice(0, 800);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${esc(quote.quoteNumber)} · ${esc(DE_PDF.brandName)}</title>
<style>
${dePdfBaseStyles()}
  .svc-desc { color: #47425e; font-size: 9px; margin: 2px 0 0; font-weight: 400; }
  .line { border-top: 1px solid ${DE_PDF.line}; }
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
      <td><div class="k">Due today</div><div class="v">${esc(moneyLabel(totals.dueToday))}</div><div class="note">One-time / setup</div></td>
      <td><div class="k">Monthly</div><div class="v">${esc(moneyLabel(totals.monthly))}</div><div class="note">Recurring catalog estimate</div></td>
      <td><div class="k">Annual</div><div class="v">${esc(moneyLabel(totals.annual))}</div><div class="note">Catalog projection</div></td>
    </tr></table>

    <h2>Requested line items</h2>
    <div class="pkg">
      ${lines || `<p class="empty" style="padding:12px 14px">No catalog lines on this request.</p>`}
    </div>

    ${
      notes
        ? `<h2>Notes from request</h2><p>${esc(notes).replace(/\n/g, "<br/>")}</p>`
        : ""
    }

    <div class="closing">
      This PDF restates catalog pricing for the requested solution. It is not a signed
      commercial offer. A consultant will confirm terms.
      Questions: sales@digerati-experts.com · ${esc(PRIMARY_PHONE.display)}
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
