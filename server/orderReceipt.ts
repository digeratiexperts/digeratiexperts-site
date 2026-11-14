type ReceiptLineItem = {
  name?: unknown;
  sku?: unknown;
  quantity?: unknown;
  unitPrice?: unknown;
  total?: unknown;
};

export type OrderReceiptInput = {
  orderNumber: unknown;
  createdAt: unknown;
  status?: unknown;
  paidAt?: unknown;
  lineItems?: unknown;
  subtotal?: unknown;
  tax?: unknown;
  total?: unknown;
  billingName?: unknown;
  billingCompany?: unknown;
  billingEmail?: unknown;
  billingAddress?: unknown;
};

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeReceiptHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

function receiptMoney(value: unknown): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00";
}

function receiptDate(value: unknown): string {
  const date = new Date(value as string | number | Date);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : "N/A";
}

function receiptStatus(value: unknown): string {
  return String(value || "pending")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function receiptAddress(value: unknown): {
  street?: unknown;
  city?: unknown;
  state?: unknown;
  zipCode?: unknown;
} {
  return value && typeof value === "object" ? value as ReturnType<typeof receiptAddress> : {};
}

export function orderReceiptFilename(orderNumber: unknown): string {
  const token = String(orderNumber || "order")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "order";
  return `receipt-${token}.html`;
}

export function renderOrderReceiptHtml(order: OrderReceiptInput, phone: string): string {
  const lineItems = Array.isArray(order.lineItems) ? order.lineItems as ReceiptLineItem[] : [];
  const address = receiptAddress(order.billingAddress);
  const orderNumber = escapeReceiptHtml(order.orderNumber || "N/A");
  const billingLocation = [address.city, address.state, address.zipCode]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(", ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>Receipt - ${orderNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: bold; color: #D3126A; margin-bottom: 8px; }
    .receipt-title { font-size: 18px; color: #666; }
    .order-info { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .order-info .label { font-size: 12px; color: #666; margin-bottom: 4px; }
    .order-info .value { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin: 30px 0; }
    th { text-align: left; padding: 12px; border-bottom: 2px solid #e0e0e0; font-weight: 600; }
    td { padding: 12px; border-bottom: 1px solid #e0e0e0; }
    .text-right { text-align: right; }
    .totals { margin-left: auto; width: 300px; max-width: 100%; }
    .totals .row { display: flex; justify-content: space-between; padding: 8px 0; }
    .totals .total { font-weight: bold; font-size: 18px; border-top: 2px solid #333; padding-top: 12px; margin-top: 8px; }
    .billing { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .billing h3 { margin: 0 0 12px 0; font-size: 14px; color: #666; }
    .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px; }
    @media (max-width: 560px) { .order-info { display: grid; grid-template-columns: 1fr 1fr; } }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Digerati Experts</div>
    <div class="receipt-title">Order Receipt</div>
  </div>
  <div class="order-info">
    <div><div class="label">Order Number</div><div class="value">${orderNumber}</div></div>
    <div><div class="label">Order Date</div><div class="value">${escapeReceiptHtml(receiptDate(order.createdAt))}</div></div>
    <div><div class="label">Status</div><div class="value">${escapeReceiptHtml(receiptStatus(order.status))}</div></div>
    ${order.paidAt ? `<div><div class="label">Paid On</div><div class="value">${escapeReceiptHtml(receiptDate(order.paidAt))}</div></div>` : ""}
  </div>
  <table>
    <thead><tr><th>Item</th><th class="text-right">Qty</th><th class="text-right">Unit Price</th><th class="text-right">Total</th></tr></thead>
    <tbody>
      ${lineItems.map((item) => `<tr>
        <td>${escapeReceiptHtml(item.name || "Item")}<br><small style="color:#666">SKU: ${escapeReceiptHtml(item.sku || "N/A")}</small></td>
        <td class="text-right">${escapeReceiptHtml(item.quantity || 1)}</td>
        <td class="text-right">$${receiptMoney(item.unitPrice)}</td>
        <td class="text-right">$${receiptMoney(item.total)}</td>
      </tr>`).join("")}
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>$${receiptMoney(order.subtotal)}</span></div>
    <div class="row"><span>Tax</span><span>$${receiptMoney(order.tax)}</span></div>
    <div class="row total"><span>Total</span><span>$${receiptMoney(order.total)}</span></div>
  </div>
  <div class="billing">
    <h3>Billing Information</h3>
    <div>${escapeReceiptHtml(order.billingName || "N/A")}</div>
    ${order.billingCompany ? `<div>${escapeReceiptHtml(order.billingCompany)}</div>` : ""}
    ${order.billingEmail ? `<div>${escapeReceiptHtml(order.billingEmail)}</div>` : ""}
    ${address.street ? `<div>${escapeReceiptHtml(address.street)}</div>` : ""}
    ${billingLocation ? `<div>${escapeReceiptHtml(billingLocation)}</div>` : ""}
  </div>
  <div class="footer">
    <p>Thank you for your business!</p>
    <p>Digerati Experts | support@digeratiexperts.com | ${escapeReceiptHtml(phone)}</p>
  </div>
</body>
</html>`;
}
