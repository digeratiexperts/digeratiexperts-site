/**
 * Branded order document — one template, two client surfaces:
 *  - "confirmation": the post-checkout Download PDF (`/api/store/orders/:id/pdf`)
 *  - "receipt": the portal order receipt (`/api/portal/orders/:id/receipt`)
 *
 * Same visual family as the solution packet and the preliminary quote
 * (dePdfBrand). Data comes straight from the stored `storeOrders` row; nothing
 * here recomputes prices.
 */
import { billingLabel, isRecurringPricingType, type CommercePricingType } from "@shared/storeCommerce";
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
} from "./dePdfBrand";
import { renderHtmlToPdf } from "./renderHtmlToPdf";

export interface OrderPdfLineItem {
  name?: string;
  sku?: string;
  quantity?: number | string;
  unitPrice?: number | string;
  total?: number | string;
  pricingType?: string;
}

export interface OrderPdfInput {
  orderNumber?: string | null;
  status?: string | null;
  paymentMethod?: string | null;
  lineItems?: unknown;
  subtotal?: string | number | null;
  tax?: string | number | null;
  total?: string | number | null;
  billingName?: string | null;
  billingEmail?: string | null;
  billingCompany?: string | null;
  billingAddress?: unknown;
  paidAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export type OrderPdfVariant = "confirmation" | "receipt";

export interface OrderPdfOptions {
  variant?: OrderPdfVariant;
  /**
   * Confirmation-token access gets the same redacted view as the JSON route:
   * no billing address. Bearer owners/admins see the full billing block.
   */
  redactBillingAddress?: boolean;
  /** Assigned account manager + sales department; default team when absent. */
  accountTeam?: AccountTeam;
}

const PRICING_TYPES: readonly CommercePricingType[] = [
  "one_time",
  "monthly",
  "yearly",
  "per_hour",
  "per_user",
  "per_endpoint",
  "per_device",
  "per_location",
  "per_seat",
];

const PAID_STATES = new Set(["paid", "processing", "provisioning", "completed"]);

const PAYMENT_LABELS: Record<string, string> = {
  stripe: "Credit card",
  zoho: "Zoho Payments",
  invoice: "Invoice",
  quote_request: "Quote request",
};

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

export { usd };

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

function cadence(pricingType: unknown): { label: string; recurring: boolean } | null {
  if (typeof pricingType !== "string" || !PRICING_TYPES.includes(pricingType as CommercePricingType)) {
    return null;
  }
  const type = pricingType as CommercePricingType;
  return { label: billingLabel(type), recurring: isRecurringPricingType(type) };
}

function addressLines(address: unknown): string[] {
  if (!address || typeof address !== "object" || Array.isArray(address)) return [];
  const a = address as Record<string, unknown>;
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
  const cityLine = [s("city"), [s("state"), s("zipCode")].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [s("street"), cityLine, s("country")].filter(Boolean);
}

export function buildOrderPdfHtml(order: OrderPdfInput, opts: OrderPdfOptions = {}): string {
  const variant: OrderPdfVariant = opts.variant ?? "confirmation";
  const lines: OrderPdfLineItem[] = Array.isArray(order.lineItems)
    ? (order.lineItems as OrderPdfLineItem[]).slice(0, 200)
    : [];
  const statusKey = (order.status || "pending").toLowerCase();
  const paid = PAID_STATES.has(statusKey);
  const closed = statusKey === "cancelled" || statusKey === "refunded";
  const statusText = titleCase(statusKey);
  const orderNumber = order.orderNumber?.trim() || "Order";
  const customer = order.billingCompany?.trim() || order.billingName?.trim() || "";
  const payment = order.paymentMethod
    ? PAYMENT_LABELS[order.paymentMethod] ?? titleCase(order.paymentMethod)
    : "—";

  const eyebrow = variant === "receipt" ? "Order receipt" : paid ? "Order confirmed" : "Order received";
  const docLabel = variant === "receipt" ? "Receipt" : "Order";
  const docId = variant === "receipt" ? DE_STORE_DOC_ID.receipt : DE_STORE_DOC_ID.order;

  const rows = lines
    .map((item) => {
      const c = cadence(item.pricingType);
      const qty = Math.max(1, Math.round(num(item.quantity) || 1));
      return `<tr>
        <td>
          <div class="item-name">${esc(item.name || "Item")}</div>
          <div class="ref">${esc(item.sku || "—")}</div>
          ${c ? `<span class="chip${c.recurring ? " recurring" : ""}">${esc(c.label)}</span>` : ""}
        </td>
        <td class="num">${qty}</td>
        <td class="num money">${usd(item.unitPrice)}</td>
        <td class="num money amount">${usd(item.total)}</td>
      </tr>`;
    })
    .join("");

  const billing = [
    order.billingName ? `<strong>${esc(order.billingName)}</strong>` : "",
    order.billingCompany && order.billingCompany !== order.billingName ? esc(order.billingCompany) : "",
    order.billingEmail ? esc(order.billingEmail) : "",
    ...(opts.redactBillingAddress ? [] : addressLines(order.billingAddress).map(esc)),
  ].filter(Boolean);

  const nextStep = paid
    ? "Your order is locked in and provisioning has begun. Remote setup comes first; any on-site work is scheduled with you."
    : closed
      ? `This order is ${esc(statusText.toLowerCase())}. Contact us with any questions about it.`
      : "We have your order. A Digerati Experts consultant confirms payment and provisioning next.";

  const items = rows
    ? `<table class="items">
      <thead><tr><th scope="col">Item</th><th scope="col" class="num">Qty</th><th scope="col" class="num">Unit price</th><th scope="col" class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`
    : `<p class="empty">No line items are recorded on this order.</p>`;

  const totals = `<table class="totals">
      <tr><td>Subtotal</td><td class="num money">${usd(order.subtotal)}</td></tr>
      <tr><td>Tax</td><td class="num money">${usd(order.tax)}</td></tr>
      <tr class="total"><td><span class="lbl">Total</span></td><td class="num money">${usd(order.total)}</td></tr>
    </table>`;

  const panels = `<table class="two" role="presentation"><tr>
      <td><div class="panel"><span class="lbl">Billed to</span>${billing.length ? billing.join("<br/>") : "—"}</div></td>
      <td><div class="panel"><span class="lbl">What happens next</span>${nextStep}</div></td>
    </tr></table>`;

  const body = `${coverBlock({
    docId,
    eyebrow,
    title: orderNumber,
    subtitleParts: [customer, phoenixDate(order.createdAt ?? undefined)],
    stamp: statusText,
  })}
  ${specStrip([
    [variant === "receipt" ? "Receipt for order" : "Order number", orderNumber],
    ["Order date", phoenixDate(order.createdAt ?? undefined)],
    ["Status", statusText],
    ["Payment", payment],
    ["Paid", order.paidAt ? phoenixDate(order.paidAt) : ""],
  ])}
  <main class="wrap">
    ${section(1, "Line items", items + totals)}
    ${panels}
    ${closeBlock({
      heading: paid ? "Track it in your portal" : closed ? "Questions about this order" : "We confirm the next step",
      text: "Track provisioning, invoices and support in your portal. Questions go to the support desk below.",
      email: COMPANY.supportEmail,
      portal: true,
    })}
    ${accountTeamBlock(opts.accountTeam ?? accountTeamFor(null))}
  </main>`;

  return documentHtml({
    title: `${docLabel} ${orderNumber} · ${DE_PDF.brandName}`,
    head: { left: `${docLabel} · ${orderNumber}`, right: docId },
    body,
  });
}

export async function renderOrderPdf(order: OrderPdfInput, opts: OrderPdfOptions = {}): Promise<Buffer> {
  return renderHtmlToPdf(buildOrderPdfHtml(order, opts));
}

/** Filesystem-safe base name, e.g. `DE-receipt-ORD-9K2F-2208`. */
export function orderPdfFileBase(order: { orderNumber?: string | null; id?: string | null }, variant: OrderPdfVariant): string {
  const ref = String(order.orderNumber || order.id || "order").replace(/[^A-Za-z0-9_-]/g, "");
  return `DE-${variant === "receipt" ? "receipt" : "order"}-${ref || "order"}`;
}
