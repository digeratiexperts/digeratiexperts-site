import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { canonicalizeQuoteItems } from "./storeQuoteCommerce";
import { buildQuotePdf, buildQuotePdfHtml } from "./storeQuotePdf";
import { PdfRendererUnavailableError } from "./pdf/renderHtmlToPdf";
import { isRendererAbsent } from "./pdf/rendererAbsence";

describe("store quote PDF", () => {
  it("builds branded HTML that restates the quote number and catalog totals", () => {
    const items = canonicalizeQuoteItems([
      {
        productId: "prod-010",
        sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
        quantity: 2,
      },
    ]);
    const html = buildQuotePdfHtml({
      quoteNumber: "QR-20260818-TEST",
      contactName: "Jordan Buyer",
      contactEmail: "jordan@example.com",
      companyName: "Example Medical",
      createdAt: new Date("2026-08-18T12:00:00.000Z"),
      requestedItems: items,
      message: "Need endpoint coverage for two clinics.",
    });

    expect(html).toContain("QR-20260818-TEST");
    expect(html).toContain("Jordan Buyer");
    expect(html).toContain("#D3126A");
    expect(html).toContain("78.00");
    expect(html).toContain("Need endpoint coverage for two clinics.");
    // Default account team: manager with embedded headshot, plus the sales department.
    expect(html).toContain("Your account manager");
    expect(html).toContain("Joseph Petro");
    expect(html).toContain("data:image/jpeg;base64,");
    expect(html).toContain("sales@digerati-experts.com");
  });

  it(
    "renders a real PDF buffer when a local renderer is available",
    async (ctx) => {
      const items = canonicalizeQuoteItems([
        {
          productId: "prod-010",
          sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
          quantity: 2,
        },
      ]);
      let pdf: Buffer;
      try {
        pdf = await buildQuotePdf({
          quoteNumber: "QR-20260818-TEST",
          contactName: "Jordan Buyer",
          contactEmail: "jordan@example.com",
          companyName: "Example Medical",
          createdAt: new Date("2026-08-18T12:00:00.000Z"),
          requestedItems: items,
          message: "Need endpoint coverage for two clinics.",
        });
      } catch (error) {
        // "when a local renderer is available" is a real condition, not a
        // caveat in the title. CI installs WeasyPrint and Playwright; a
        // contributor's machine and the agent sandbox often have neither, and
        // this case then failed for the environment rather than the code —
        // which trains people to read a red suite as normal.
        //
        // The error type alone is not enough to skip on. renderHtmlToPdf
        // raises PdfRendererUnavailableError whenever BOTH renderers fail, for
        // any reason — so a renderer that is installed but crashing on our HTML
        // raises it too, and skipping on the type alone would hide a real bug.
        // The message carries both engines' failures, so this also requires
        // each one to read as "absent" rather than "broken". A renderer that
        // runs and produces a bad PDF still fails every assertion below.
        if (error instanceof PdfRendererUnavailableError && isRendererAbsent(error.message)) {
          ctx.skip(
            `no local PDF renderer (WeasyPrint or Playwright): ${error.message}`,
          );
          return;
        }
        throw error;
      }

      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(pdf.byteLength).toBeGreaterThan(1500);
      // Finished for PDF/UA-1: tagged, identified, links described.
      const text = pdf.toString("latin1");
      expect(text).toContain("/StructTreeRoot");
      expect(text).toContain("<pdfuaid:part>1</pdfuaid:part>");
      expect(text).toContain("/DisplayDocTitle true");
      // Every link annotation carries a text alternative (wording varies by renderer).
      const doc = await PDFDocument.load(pdf);
      let links = 0;
      for (const page of doc.getPages()) {
        for (const ref of page.node.Annots()?.asArray() ?? []) {
          const a = doc.context.lookup(ref) as PDFDict;
          if (a.get(PDFName.of("Subtype")) !== PDFName.of("Link")) continue;
          links++;
          expect(a.has(PDFName.of("Contents"))).toBe(true);
        }
      }
      expect(links).toBeGreaterThan(0);
    },
    90_000,
  );
});
