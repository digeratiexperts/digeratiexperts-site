/**
 * Sample Store documents for the Store PDF regression check
 * (`scripts/qa/store-pdf-check.mts`). One case per template state that changes
 * the layout or the wording. All data is EXAMPLE data, never client data.
 */
import { storeProducts } from "../../client/src/data/storeProducts";
import { DE_STORE_DOC_ID } from "../../server/pdf/dePdfBrand";
import { buildSolutionPacketHtml, type SolutionPacketPackage } from "../../server/pdf/solutionPacketPdf";
import { buildOrderPdfHtml, type OrderPdfInput } from "../../server/pdf/storeOrderPdf";
import { buildQuotePdfHtml, type QuotePdfInput } from "../../server/storeQuotePdf";
import { canonicalizeQuoteItems } from "../../server/storeQuoteCommerce";

/** Exact page count, or a range for documents that are meant to paginate. */
export type PageExpectation = { exact: number } | { min: number; max?: number };

export interface StorePdfCase {
  name: string;
  kind: "quote" | "order" | "receipt" | "solution";
  html: string;
  pages: PageExpectation;
  /** Text the PDF must extract (whitespace-insensitive). */
  mustInclude: string[];
  /** Text the PDF must not contain, such as a redacted address. */
  mustExclude?: string[];
}

const quoteBase: QuotePdfInput = {
  quoteNumber: "QR-EXAMPLE-0042",
  contactName: "Jordan Buyer",
  contactEmail: "jordan@example.com",
  companyName: "Example Medical",
  createdAt: new Date("2026-10-05T12:00:00Z"),
  requestedItems: canonicalizeQuoteItems([{ productId: "prod-010", sku: "DE-SVC-CM-ENDPOINT-CORE-MO", quantity: 2 }]),
};

/** The first `n` quotable catalog products, each at its minimum quantity. */
function catalogLines(n: number) {
  const quotable = storeProducts.filter((p) => Number(p.basePrice) > 0).slice(0, n);
  return canonicalizeQuoteItems(
    quotable.map((p) => ({ productId: p.id, sku: p.sku, quantity: Math.max(1, p.minimumQuantity) })),
  );
}

const order: OrderPdfInput = {
  orderNumber: "ORD-9K2F-2208",
  status: "paid",
  paymentMethod: "zoho",
  subtotal: "3484.00",
  tax: "0",
  total: "3484.00",
  billingName: "Jane Buyer",
  billingEmail: "accounts@example.com",
  billingCompany: "Example Dental",
  billingAddress: { street: "100 Main St", city: "Chandler", state: "AZ", zipCode: "85225" },
  paidAt: "2026-10-01T18:00:00Z",
  createdAt: "2026-10-01T17:55:00Z",
  lineItems: [
    { name: "Managed endpoint protection", sku: "MEP-EDR-SOC", quantity: 22, unitPrice: 47, total: 1034, pricingType: "per_endpoint" },
    { name: "Onboarding", sku: "ONB-3SITE", quantity: 1, unitPrice: 2450, total: 2450, pricingType: "one_time" },
  ],
};
const unpaid: OrderPdfInput = { ...order, status: "awaiting_payment", paidAt: null };

function pkg(familyLabel: string, offerName: string, lines: number): SolutionPacketPackage {
  return {
    familyLabel,
    offerName,
    pricingLabel: "Per user / month",
    assessmentLabel: "Assessment included",
    setupLabel: "Remote onboarding",
    lineItems: Array.from({ length: lines }, (_, i) => ({ label: `${offerName} scope line ${i + 1}`, quantity: `${i + 2} covered users` })),
  };
}
const solutionBase = {
  reference: "SOL-EXAMPLE",
  statusLabel: "Draft",
  profile: "Dental practice, 3 sites",
  relationship: "Fully managed",
  support: "Business hours remote",
};

const LONG_NOTES = (
  "Need endpoint coverage for two clinics before the January opening. " +
  "The second site shares the same tenant and firewall vendor. "
).repeat(7);

export function storePdfCases(): StorePdfCase[] {
  return [
    {
      name: "quote-1-item",
      kind: "quote",
      html: buildQuotePdfHtml(quoteBase),
      pages: { exact: 1 },
      mustInclude: [DE_STORE_DOC_ID.quote, "QR-EXAMPLE-0042", "Example Medical"],
    },
    {
      name: "quote-1-item-notes",
      kind: "quote",
      html: buildQuotePdfHtml({ ...quoteBase, message: "Need endpoint coverage for two clinics.\nSecond site opens in January." }),
      pages: { exact: 1 },
      mustInclude: [DE_STORE_DOC_ID.quote, "Second site opens in January."],
    },
    {
      name: "quote-5-items",
      kind: "quote",
      html: buildQuotePdfHtml({ ...quoteBase, requestedItems: catalogLines(5) }),
      pages: { min: 1, max: 2 },
      mustInclude: [DE_STORE_DOC_ID.quote, catalogLines(5)[4].sku],
    },
    {
      name: "quote-30-items-long-notes",
      kind: "quote",
      html: buildQuotePdfHtml({ ...quoteBase, requestedItems: catalogLines(30), message: LONG_NOTES }),
      pages: { min: 2 },
      mustInclude: [DE_STORE_DOC_ID.quote, catalogLines(30)[29].sku],
    },
    {
      // Escaping and non-ASCII: names must print literally, never as markup.
      name: "quote-special-characters",
      kind: "quote",
      html: buildQuotePdfHtml({ ...quoteBase, contactName: "Zoë Ångström", companyName: "O'Brien & Sons <Dental>" }),
      pages: { exact: 1 },
      mustInclude: ["O'Brien & Sons <Dental>"],
    },
    {
      name: "order-paid",
      kind: "order",
      html: buildOrderPdfHtml(order),
      pages: { exact: 1 },
      mustInclude: [DE_STORE_DOC_ID.order, "ORD-9K2F-2208", "Order confirmed", "$3,484.00", "100 Main St"],
    },
    {
      name: "order-awaiting-payment",
      kind: "order",
      html: buildOrderPdfHtml(unpaid),
      pages: { exact: 1 },
      mustInclude: [DE_STORE_DOC_ID.order, "Order received", "We confirm the next step"],
    },
    {
      name: "order-cancelled",
      kind: "order",
      html: buildOrderPdfHtml({ ...unpaid, status: "cancelled" }),
      pages: { exact: 1 },
      mustInclude: [DE_STORE_DOC_ID.order, "Cancelled", "Questions about this order"],
    },
    {
      name: "order-no-line-items",
      kind: "order",
      html: buildOrderPdfHtml({ ...unpaid, lineItems: [], subtotal: "0", total: "0" }),
      pages: { exact: 1 },
      mustInclude: ["No line items are recorded on this order."],
    },
    {
      // Opened by confirmation token: the billing address is redacted.
      name: "order-26-lines-redacted",
      kind: "order",
      html: buildOrderPdfHtml(
        {
          ...unpaid,
          orderNumber: "ORD-LONG-0026",
          lineItems: Array.from({ length: 26 }, (_, i) => ({
            name: `Catalog line ${i + 1}`,
            sku: `SKU-${1000 + i}`,
            quantity: 1,
            unitPrice: 10,
            total: 10,
            pricingType: i % 2 ? "monthly" : "one_time",
          })),
        },
        { redactBillingAddress: true },
      ),
      pages: { min: 2 },
      mustInclude: [DE_STORE_DOC_ID.order, "ORD-LONG-0026", "SKU-1025"],
      mustExclude: ["100 Main St", "85225"],
    },
    {
      name: "receipt",
      kind: "receipt",
      html: buildOrderPdfHtml(order, { variant: "receipt" }),
      pages: { exact: 1 },
      mustInclude: [DE_STORE_DOC_ID.receipt, "Order receipt", "Receipt for order", "$3,484.00"],
    },
    {
      name: "solution-1-package",
      kind: "solution",
      html: buildSolutionPacketHtml({ ...solutionBase, packages: [pkg("IT Operations & Support", "ProActive Office", 1)] }),
      pages: { exact: 1 },
      mustInclude: [DE_STORE_DOC_ID.solution, "SOL-EXAMPLE", "ProActive Office"],
    },
    {
      name: "solution-3-packages",
      kind: "solution",
      html: buildSolutionPacketHtml({
        ...solutionBase,
        statusLabel: "Submitted",
        packages: [
          pkg("IT Operations & Support", "ProActive Office", 4),
          pkg("Cybersecurity", "Managed Endpoint Defense", 3),
          pkg("Compliance", "HIPAA Readiness", 2),
        ],
      }),
      pages: { min: 1, max: 2 },
      mustInclude: [DE_STORE_DOC_ID.solution, "Managed Endpoint Defense", "HIPAA Readiness"],
    },
  ];
}
