// Store PDF regression check: renders representative quotes, orders, a
// receipt and a solution packet through the production pipeline
// (renderHtmlToPdf → finalizePdf) and checks
//   - page counts (short documents stay on one page; a long order paginates),
//   - veraPDF PDF/UA-1 compliance when VERAPDF points at the CLI.
// Usage: npx tsx scripts/qa/store-pdf-check.mts [--require-verapdf] [out-dir]
// CI installs veraPDF with scripts/qa/install-verapdf.sh and passes --require-verapdf.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { buildOrderPdfHtml } from "../../server/pdf/storeOrderPdf";
import { buildSolutionPacketHtml } from "../../server/pdf/solutionPacketPdf";
import { renderHtmlToPdf } from "../../server/pdf/renderHtmlToPdf";
import { buildQuotePdfHtml } from "../../server/storeQuotePdf";
import { canonicalizeQuoteItems } from "../../server/storeQuoteCommerce";

const args = process.argv.slice(2);
const requireVera = args.includes("--require-verapdf");
const outDir = args.find((a) => !a.startsWith("--")) ?? mkdtempSync(path.join(tmpdir(), "store-pdf-check-"));
mkdirSync(outDir, { recursive: true });

// EXAMPLE fixtures (not client data).
const order = {
  orderNumber: "ORD-9K2F-2208", status: "paid", paymentMethod: "zoho",
  subtotal: "3484.00", tax: "0", total: "3484.00",
  billingName: "Jane Buyer", billingEmail: "accounts@example.com", billingCompany: "Example Dental",
  billingAddress: { street: "100 Main St", city: "Chandler", state: "AZ", zipCode: "85225" },
  paidAt: "2026-10-01T18:00:00Z", createdAt: "2026-10-01T17:55:00Z",
  lineItems: [
    { name: "Managed endpoint protection", sku: "MEP-EDR-SOC", quantity: 22, unitPrice: 47, total: 1034, pricingType: "per_endpoint" },
    { name: "Onboarding", sku: "ONB-3SITE", quantity: 1, unitPrice: 2450, total: 2450, pricingType: "one_time" },
  ],
};
const longOrder = {
  ...order, orderNumber: "ORD-LONG-0026", status: "awaiting_payment", paidAt: null,
  lineItems: Array.from({ length: 26 }, (_, i) => ({
    name: `Catalog line ${i + 1}`, sku: `SKU-${1000 + i}`, quantity: 1, unitPrice: 10, total: 10,
    pricingType: i % 2 ? "monthly" : "one_time",
  })),
};
const oneItem = canonicalizeQuoteItems([{ productId: "prod-010", sku: "DE-SVC-CM-ENDPOINT-CORE-MO", quantity: 2 }]);
const quote = (message: string | null) => buildQuotePdfHtml({
  quoteNumber: "QR-EXAMPLE-0042", contactName: "Jordan Buyer", contactEmail: "jordan@example.com",
  companyName: "Example Medical", createdAt: new Date("2026-10-05T12:00:00Z"), requestedItems: oneItem, message,
});

// [name, html, expected pages: exact number, or "2+" for "at least two"]
const cases: [string, string, number | "2+"][] = [
  ["quote-1-item", quote(null), 1],
  ["quote-1-item-notes", quote("Need endpoint coverage for two clinics.\nSecond site opens in January."), 1],
  ["order-confirmation", buildOrderPdfHtml(order), 1],
  ["receipt", buildOrderPdfHtml(order, { variant: "receipt" }), 1],
  ["order-26-lines-redacted", buildOrderPdfHtml(longOrder, { redactBillingAddress: true }), "2+"],
  ["solution-packet", buildSolutionPacketHtml({
    reference: "SOL-EXAMPLE", statusLabel: "Draft", profile: "Dental practice, 3 sites", relationship: "Fully managed",
    support: "Business hours remote",
    packages: [{ familyLabel: "IT Operations & Support", offerName: "ProActive Office", pricingLabel: "Per user / month",
      assessmentLabel: "Assessment included", setupLabel: "Remote onboarding",
      lineItems: [{ label: "Helpdesk intake and triage", quantity: "4 covered users" }] }],
  }), 1],
];

const failures: string[] = [];
const files: string[] = [];
for (const [name, html, expected] of cases) {
  const pdf = await renderHtmlToPdf(html);
  const file = path.join(outDir, `${name}.pdf`);
  writeFileSync(file, pdf);
  files.push(file);
  const pages = (await PDFDocument.load(pdf)).getPageCount();
  const ok = expected === "2+" ? pages >= 2 : pages === expected;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${pages} page(s), expected ${expected}`);
  if (!ok) failures.push(`${name}: ${pages} page(s), expected ${expected}`);
}

const vera = process.env.VERAPDF;
if (vera) {
  const out = execFileSync(vera, ["--flavour", "ua1", "--format", "json", ...files], { maxBuffer: 64 * 1024 * 1024 }).toString();
  for (const job of JSON.parse(out).report.jobs) {
    let vr = job.validationResult;
    vr = Array.isArray(vr) ? vr[0] : vr;
    const name = path.basename(job.itemDetails.name);
    const rules = (vr.details?.ruleSummaries ?? []).map((r: { clause: string; testNumber: number }) => `${r.clause}-${r.testNumber}`);
    console.log(`${vr.compliant ? "ok  " : "FAIL"} veraPDF PDF/UA-1 ${name}${rules.length ? ": " + rules.join(", ") : ""}`);
    if (!vr.compliant) failures.push(`veraPDF ${name}: ${rules.join(", ")}`);
  }
} else if (requireVera) {
  failures.push("VERAPDF is not set but --require-verapdf was given");
} else {
  console.log("veraPDF: not run (set VERAPDF to the CLI path)");
}

console.log(`PDFs in ${outDir}`);
if (failures.length) {
  console.error(`\nStore PDF check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
