import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, PDFString, decodePDFRawStream } from "pdf-lib";
import { finalizePdf, htmlTitle, markArtifacts } from "./finalizePdf";

describe("markArtifacts", () => {
  it("wraps painting outside marked content and leaves tagged content alone", () => {
    const src = "q 0 0 10 10 re f Q\n/P <</MCID 0>> BDC BT (Hi) Tj ET EMC\n1 0 0 RG 0 0 m 5 5 l S";
    const { out, wrapped } = markArtifacts(src);
    expect(wrapped).toBe(2);
    // Only the painting operator is wrapped, as in scripts/de-documents/lib/finalize.py.
    expect(out).toContain("0 0 10 10 re\n/Artifact BMC\n f\nEMC");
    expect(out).toContain("/P <</MCID 0>> BDC BT (Hi) Tj ET EMC");
    expect(out).toMatch(/5 5 l\n\/Artifact BMC\n S\nEMC$/);
  });

  it("is not fooled by operator names inside strings, names or hex", () => {
    const src = "BT (a Tj ( nested ) f \\) S) Tj ET /Tj <54 6a> Tj";
    const { wrapped } = markArtifacts(src);
    expect(wrapped).toBe(2);
  });

  it("skips inline image data", () => {
    const src = "q BI /W 1 /H 1 ID \x00Tj f\xff EI Q";
    const { out, wrapped } = markArtifacts(src);
    expect(wrapped).toBe(1);
    expect(out).toContain("\x00Tj f\xff EI\nEMC");
  });
});

describe("finalizePdf", () => {
  it("adds artifacts, link text, XMP title and DisplayDocTitle", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    page.drawText("Quote", { x: 10, y: 150, size: 12 });
    const link = doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [10, 10, 90, 30],
      A: { S: "URI", URI: PDFString.of("mailto:info@digeratiexperts.com") },
    });
    page.node.set(PDFName.of("Annots"), doc.context.obj([doc.context.register(link)]));
    const out = await finalizePdf(Buffer.from(await doc.save()), { title: "Q-1 · Digerati Experts" });

    const res = await PDFDocument.load(out);
    const p = res.getPages()[0].node;
    const contents = res.context.lookup(p.get(PDFName.of("Contents")));
    const text = Buffer.from(decodePDFRawStream(contents as PDFRawStream).decode()).toString("latin1");
    expect(markArtifacts(text).wrapped).toBe(0); // nothing left outside marked content
    const annot = res.context.lookup(p.Annots()!.get(0)) as PDFDict;
    expect((annot.get(PDFName.of("Contents")) as PDFString).decodeText()).toBe("Email Digerati Experts at info@digeratiexperts.com");
    const xmp = Buffer.from((res.context.lookup(res.catalog.get(PDFName.of("Metadata"))) as PDFRawStream).getContents()).toString("utf8");
    expect(xmp).toContain("Q-1 · Digerati Experts");
    expect(xmp).not.toContain("pdfuaid:part>1"); // untagged input: no PDF/UA claim
    const vp = res.catalog.lookup(PDFName.of("ViewerPreferences")) as PDFDict;
    expect(vp.get(PDFName.of("DisplayDocTitle"))?.toString()).toBe("true");
  });

  it("reads the title from the HTML", () => {
    expect(htmlTitle("<title>Receipt ORD-1 &amp; co · Digerati Experts</title>")).toBe("Receipt ORD-1 & co · Digerati Experts");
  });
});
