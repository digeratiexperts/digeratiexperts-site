import { brandFontFaceCss, esc, usd } from "./brandPdf";

export interface OrderPdfLineItem {
  name?: string;
  sku?: string;
  quantity?: number;
  unitPrice?: number | string;
  total?: number | string;
  pricingType?: string;
}

export interface OrderPdfInput {
  orderNumber?: string | null;
  status?: string | null;
  paymentMethod?: string | null;
  lineItems?: OrderPdfLineItem[] | unknown;
  subtotal?: string | number | null;
  tax?: string | number | null;
  total?: string | number | null;
  billingName?: string | null;
  billingEmail?: string | null;
  billingCompany?: string | null;
  billingAddress?: { city?: string; state?: string } | null;
  paidAt?: Date | string | null;
  createdAt?: Date | string | null;
}

function statusLabel(status?: string | null): { text: string; paid: boolean } {
  const s = (status || "pending").toLowerCase();
  const paid = ["paid", "processing", "provisioning", "completed"].includes(s);
  const text = s.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  return { text, paid };
}

function fmtDate(value?: Date | string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function isRecurring(pricingType?: string): boolean {
  return !!pricingType && /month|recurring|subscription|annual/i.test(pricingType);
}

/** Direction B — dark "order confirmed" packet. Returns a full HTML document. */
export function buildOrderPdfHtml(order: OrderPdfInput): string {
  const lines: OrderPdfLineItem[] = Array.isArray(order.lineItems) ? (order.lineItems as OrderPdfLineItem[]) : [];
  const status = statusLabel(order.status);
  const company = esc(order.billingCompany || order.billingName || "Customer");
  const seats = lines.reduce((n, l) => n + (Number(l.quantity) || 0), 0);
  const addr = order.billingAddress || {};
  const place = [addr.city, addr.state].filter(Boolean).map(esc).join(", ");

  const rows = lines
    .map((l) => {
      const recurring = isRecurring(l.pricingType);
      const pill = recurring
        ? `<span class="pill mo">Monthly</span>`
        : `<span class="pill once">One-time</span>`;
      return `<tr>
        <td><div class="it-name">${esc(l.name || "Item")}</div><div class="it-sku">SKU · ${esc(l.sku || "N/A")}</div>${pill}</td>
        <td class="r"><span class="qty">${Number(l.quantity) || 1}</span></td>
        <td class="r">${usd(l.unitPrice)}</td>
        <td class="r">${usd(l.total)}</td>
      </tr>`;
    })
    .join("");

  const paymentText = order.paymentMethod ? esc(order.paymentMethod) : "—";

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
${brandFontFaceCss()}
@page{size:Letter;margin:0;}
*{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
html,body{font-family:'Inter',sans-serif;color:#F7F5F2;background:#050312;}
.page{width:8.5in;min-height:11in;padding:0.6in 0.66in;background:
  radial-gradient(900px 500px at 85% -5%, rgba(8,145,178,0.18), transparent 60%),
  radial-gradient(700px 500px at -10% 108%, rgba(211,18,106,0.20), transparent 55%), #050312;}
.hud{display:flex;justify-content:space-between;align-items:center;border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:14px 18px;background:rgba(255,255,255,0.025);}
.wordmark{font-family:'Space Grotesk';font-weight:700;font-size:17px;letter-spacing:-0.01em;}
.wordmark b{color:#22d3ee;}
.hud-right{text-align:right;}
.hud-right .l{font-family:'Oxanium';font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:#8a86a0;}
.hud-right .v{font-family:'Oxanium';font-weight:700;font-size:15px;letter-spacing:0.06em;color:#22d3ee;}
.title{margin-top:34px;}
.status{display:inline-flex;align-items:center;gap:8px;font-family:'Oxanium';font-weight:700;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;padding:6px 13px;border-radius:999px;}
.status.paid{color:#06281f;background:#34d399;}
.status.pending{color:#3a2d08;background:#fbbf24;}
.status .dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:0.65;}
.h1{font-family:'Space Grotesk';font-weight:700;font-size:44px;line-height:1.0;letter-spacing:-0.025em;margin-top:16px;}
.h1 .g{color:#22d3ee;}
.sub{color:#b8b4c8;font-size:13.5px;margin-top:12px;max-width:5in;line-height:1.55;}
.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:26px;border:1px solid rgba(255,255,255,0.09);border-radius:12px;overflow:hidden;background:rgba(255,255,255,0.09);}
.mcell{background:#0d0920;padding:15px 16px;}
.mcell .l{font-family:'Oxanium';font-size:8.5px;letter-spacing:0.2em;text-transform:uppercase;color:#8a86a0;margin-bottom:6px;}
.mcell .v{font-family:'Space Grotesk';font-weight:600;font-size:14px;}
.lab{font-family:'Oxanium';font-weight:700;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#22d3ee;margin:30px 0 12px;}
table{width:100%;border-collapse:collapse;}
thead th{font-family:'Oxanium';font-weight:600;font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#8a86a0;text-align:left;padding:0 0 10px;border-bottom:1px solid rgba(255,255,255,0.09);}
thead th.r{text-align:right;}
tbody td{padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.09);font-size:13px;vertical-align:top;}
tbody td.r{text-align:right;font-family:'Space Grotesk';font-weight:600;white-space:nowrap;}
.it-name{font-weight:600;font-size:13.5px;}
.it-sku{font-family:'Oxanium';font-size:10px;letter-spacing:0.08em;color:#8a86a0;margin-top:3px;}
.pill{display:inline-block;font-family:'Oxanium';font-size:8.5px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;padding:3px 8px;border-radius:6px;margin-top:6px;}
.pill.mo{color:#22d3ee;background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.3);}
.pill.once{color:#F04C97;background:rgba(240,76,151,0.12);border:1px solid rgba(240,76,151,0.3);}
td .qty{font-family:'Oxanium';color:#b8b4c8;}
.foot{display:grid;grid-template-columns:1fr 0.9fr;gap:22px;margin-top:28px;}
.bill{border:1px solid rgba(255,255,255,0.09);border-radius:12px;padding:18px 20px;background:rgba(255,255,255,0.02);}
.bill .l{font-family:'Oxanium';font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#8a86a0;margin-bottom:10px;}
.bill .row{font-size:12.5px;color:#b8b4c8;margin-bottom:5px;}
.bill .row b{color:#F7F5F2;font-weight:600;}
.sum{border:1px solid rgba(255,255,255,0.09);border-radius:12px;overflow:hidden;}
.sum .r{display:flex;justify-content:space-between;padding:11px 18px;font-size:13px;color:#b8b4c8;border-bottom:1px solid rgba(255,255,255,0.09);}
.sum .r span:last-child{font-family:'Space Grotesk';font-weight:600;color:#F7F5F2;}
.sum .grand{background:linear-gradient(90deg, rgba(8,145,178,0.22), rgba(211,18,106,0.22));border-bottom:none;}
.sum .grand span{font-family:'Space Grotesk';font-weight:700;font-size:19px;color:#fff;}
.sum .grand .gl{font-size:10px;font-family:'Oxanium';letter-spacing:0.16em;text-transform:uppercase;align-self:center;color:#F7F5F2;}
.sig{display:flex;justify-content:space-between;align-items:center;margin-top:30px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.09);}
.sig .cta{font-family:'Space Grotesk';font-weight:700;font-size:16px;}
.sig .cta small{display:block;font-family:'Inter';font-weight:400;font-size:11.5px;color:#8a86a0;margin-top:3px;}
.sig .mark{font-family:'Oxanium';font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:#8a86a0;text-align:right;}
</style></head><body>
<section class="page">
  <div class="hud">
    <div class="wordmark">Digerati<b>·</b>Experts</div>
    <div class="hud-right"><div class="l">Order</div><div class="v">${esc(order.orderNumber || "—")}</div></div>
  </div>
  <div class="title">
    <span class="status ${status.paid ? "paid" : "pending"}"><span class="dot"></span>${esc(status.text)}</span>
    <div class="h1">Order <span class="g">${status.paid ? "confirmed." : "received."}</span></div>
    <div class="sub">Thank you, ${company}. ${status.paid ? "Your solution is locked in and our team has begun provisioning. Remote setup starts first; any on-site work is scheduled with you." : "We've received your order and will confirm payment and provisioning shortly."}</div>
  </div>
  <div class="meta">
    <div class="mcell"><div class="l">Order date</div><div class="v">${fmtDate(order.createdAt)}</div></div>
    <div class="mcell"><div class="l">Billed to</div><div class="v">${company}</div></div>
    <div class="mcell"><div class="l">Seats</div><div class="v">${seats || "—"} users</div></div>
    <div class="mcell"><div class="l">Payment</div><div class="v">${paymentText}</div></div>
  </div>
  <div class="lab">Line items</div>
  <table>
    <thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Unit</th><th class="r">Total</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4" style="color:#8a86a0;padding:18px 0">No line items.</td></tr>`}</tbody>
  </table>
  <div class="foot">
    <div class="bill">
      <div class="l">Billing &amp; service</div>
      <div class="row"><b>${company}</b></div>
      ${order.billingEmail ? `<div class="row">${esc(order.billingEmail)}</div>` : ""}
      ${place ? `<div class="row">${place}</div>` : ""}
      <div class="row" style="margin-top:10px;color:#8a86a0">Remote support after setup · included 24/7</div>
    </div>
    <div class="sum">
      <div class="r"><span>Subtotal</span><span>${usd(order.subtotal)}</span></div>
      <div class="r"><span>Tax</span><span>${usd(order.tax)}</span></div>
      <div class="r grand"><span class="gl">Total</span><span>${usd(order.total)}</span></div>
    </div>
  </div>
  <div class="sig">
    <div class="cta">Your portal is ready.<small>Track provisioning, invoices and tickets at portal.digeratiexperts.com</small></div>
    <div class="mark">Digerati Experts<br>Receipt · ${esc(order.orderNumber || "")}</div>
  </div>
</section>
</body></html>`;
}
