/**
 * Finish a rendered Store PDF for PDF/UA-1: the server-side port of
 * `scripts/de-documents/lib/finalize.py` (the resource PDFs' finalizer).
 *
 * Chromium and WeasyPrint both emit tagged PDFs, but leave three gaps that
 * veraPDF's PDF/UA-1 profile fails:
 *  - 7.1-3  painting operators outside any marked content (rules, cell borders,
 *           backgrounds, running header and footer): wrapped as /Artifact;
 *  - 7.18.x link annotations without a text alternative: given /Contents;
 *  - 7.1-8/9 no XMP metadata with a title: written, with the PDF/UA identifier.
 * Plus DisplayDocTitle, so viewers show the title instead of the file name.
 *
 * The four Store templates were validated with veraPDF after this step
 * (see server/pdf/README.md). Any failure here returns the original bytes:
 * a tagged PDF still beats no PDF.
 */
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFRef, PDFString, decodePDFRawStream } from "pdf-lib";
import type { PDFObject, PDFStream } from "pdf-lib";

const PAINT = new Set(["Tj", "TJ", "'", '"', "f", "F", "f*", "B", "B*", "b", "b*", "S", "s", "Do", "sh", "BI"]);
const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set(Array.from("()<>[]{}/%", (c) => c.charCodeAt(0)));
const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * Wrap every painting operator that sits outside marked content in
 * `/Artifact BMC … EMC`. Works on the original bytes (latin1 string) and only
 * inserts text, so nothing else in the stream is re-serialized.
 */
export function markArtifacts(src: string): { out: string; wrapped: number } {
  const len = src.length;
  let i = 0;
  let depth = 0;
  let operandStart = 0; // where the current operator's operands begin
  let copied = 0;
  let out = "";
  let wrapped = 0;
  while (i < len) {
    const c = src.charCodeAt(i);
    if (WS.has(c)) {
      i++;
      continue;
    }
    if (c === 0x25 /* % */) {
      while (i < len && src[i] !== "\n" && src[i] !== "\r") i++;
      continue;
    }
    if (c === 0x28 /* ( */) {
      let nest = 0;
      for (; i < len; i++) {
        const ch = src[i];
        if (ch === "\\") i++;
        else if (ch === "(") nest++;
        else if (ch === ")" && --nest === 0) {
          i++;
          break;
        }
      }
      continue;
    }
    if (c === 0x3c /* < */) {
      if (src[i + 1] === "<") i += 2;
      else {
        const end = src.indexOf(">", i);
        i = end < 0 ? len : end + 1;
      }
      continue;
    }
    if (c === 0x3e /* > */ || c === 0x5b || c === 0x5d || c === 0x7b || c === 0x7d) {
      i += src[i] === ">" && src[i + 1] === ">" ? 2 : 1;
      continue;
    }
    if (c === 0x2f /* / */) {
      i++;
      while (i < len && !WS.has(src.charCodeAt(i)) && !DELIM.has(src.charCodeAt(i))) i++;
      continue;
    }
    const start = i;
    while (i < len && !WS.has(src.charCodeAt(i)) && !DELIM.has(src.charCodeAt(i))) i++;
    const tok = src.slice(start, i);
    if (NUMERIC.test(tok) || tok === "true" || tok === "false" || tok === "null") continue;
    if (tok === "BI") {
      // Inline image: BI <dict> ID <binary> EI. Skip to the EI that ends it.
      const id = src.indexOf("ID", i);
      const m = id < 0 ? null : /\sEI(?=\s|$)/.exec(src.slice(id + 3));
      i = m ? id + 3 + m.index + m[0].length : len;
    }
    if (tok === "BDC" || tok === "BMC") depth++;
    else if (tok === "EMC") depth = Math.max(0, depth - 1);
    else if (depth === 0 && PAINT.has(tok)) {
      out += src.slice(copied, operandStart) + "\n/Artifact BMC\n" + src.slice(operandStart, i) + "\nEMC";
      copied = i;
      wrapped++;
    }
    operandStart = i;
  }
  return { out: out + src.slice(copied), wrapped };
}

function linkDescription(uri: string): string {
  if (uri.startsWith("mailto:")) return `Email Digerati Experts at ${uri.slice(7)}`;
  if (uri.startsWith("tel:")) return `Call Digerati Experts at ${uri.slice(4)}`;
  return `Open ${uri.replace(/^https?:\/\//, "")}`;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function xmpPacket(title: string, lang: string, pdfua: boolean): string {
  const t = xmlEscape(title);
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:pdfuaid="http://www.aiim.org/pdfua/ns/id/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${t}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>Digerati Experts</rdf:li></rdf:Seq></dc:creator>
   <dc:language><rdf:Bag><rdf:li>${xmlEscape(lang)}</rdf:li></rdf:Bag></dc:language>
${pdfua ? "   <pdfuaid:part>1</pdfuaid:part>\n" : ""}  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

function streamBytes(obj: PDFObject | undefined): Uint8Array {
  if (obj instanceof PDFRawStream) return decodePDFRawStream(obj).decode();
  if (obj && "getContents" in obj) return (obj as PDFStream).getContents();
  return new Uint8Array();
}

/** Title from the document's <title>, which every Store template sets. */
export function htmlTitle(html: string): string {
  const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
  return (m?.[1] ?? "Digerati Experts")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export async function finalizePdf(pdf: Buffer, meta: { title: string; lang?: string }): Promise<Buffer> {
  const lang = meta.lang ?? "en-US";
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const ctx = doc.context;

  for (const page of doc.getPages()) {
    const node = page.node;
    // Artifact-mark untagged painting in the page's content (all streams joined).
    const contents = node.get(PDFName.of("Contents"));
    const resolved = contents instanceof PDFRef ? ctx.lookup(contents) : contents;
    const parts = resolved instanceof PDFArray ? resolved.asArray().map((r) => ctx.lookup(r)) : [resolved];
    const src = parts.map((p) => Buffer.from(streamBytes(p as PDFObject)).toString("latin1")).join("\n");
    const { out, wrapped } = markArtifacts(src);
    if (wrapped > 0) {
      const stream = ctx.flateStream(Buffer.from(out, "latin1"));
      node.set(PDFName.of("Contents"), ctx.register(stream));
    }
    // Text alternative for every link annotation.
    const annots = node.Annots();
    for (const ref of annots?.asArray() ?? []) {
      const a = ctx.lookup(ref);
      if (!(a instanceof PDFDict) || a.get(PDFName.of("Subtype")) !== PDFName.of("Link")) continue;
      if (a.has(PDFName.of("Contents"))) continue;
      const action = a.lookup(PDFName.of("A"));
      const uri = action instanceof PDFDict ? action.lookup(PDFName.of("URI")) : undefined;
      const target = uri instanceof PDFString || uri instanceof PDFHexString ? uri.decodeText() : "";
      a.set(PDFName.of("Contents"), PDFString.of(target ? linkDescription(target) : "Go to section"));
    }
  }

  // Claim PDF/UA only for a tagged file (an older WeasyPrint renders untagged).
  const markInfo = doc.catalog.lookupMaybe(PDFName.of("MarkInfo"), PDFDict);
  const tagged = markInfo?.get(PDFName.of("Marked"))?.toString() === "true" && doc.catalog.has(PDFName.of("StructTreeRoot"));
  // XMP is UTF-8; pass bytes, since a string would be written as Latin-1.
  const metadata = ctx.stream(Buffer.from(xmpPacket(meta.title, lang, tagged), "utf8"), {
    Type: "Metadata",
    Subtype: "XML",
  });
  doc.catalog.set(PDFName.of("Metadata"), ctx.register(metadata));
  doc.catalog.set(PDFName.of("Lang"), PDFString.of(lang));
  const vp = doc.catalog.lookupMaybe(PDFName.of("ViewerPreferences"), PDFDict) ?? ctx.obj({});
  vp.set(PDFName.of("DisplayDocTitle"), ctx.obj(true));
  doc.catalog.set(PDFName.of("ViewerPreferences"), vp);
  doc.setTitle(meta.title, { showInWindowTitleBar: true });
  doc.setAuthor("Digerati Experts");
  doc.setLanguage(lang);

  return Buffer.from(await doc.save({ useObjectStreams: false }));
}
