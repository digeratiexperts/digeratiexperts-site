// Readability QA: render pages of the published PDFs with the site's own pdf.js
// at the width a viewer fits them to on a 390 / 768 / 1440 viewport, and at 2×
// pinch-zoom on top of that. Writes PNGs; crops are cut by lib/crops.py.
//   DE_SITE=http://localhost:5000 npx tsx scripts/de-documents/qa-readability.mts <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "scripts/de-documents/out/qa/readability";
const base = process.env.DE_SITE ?? "http://localhost:5000";
mkdirSync(OUT, { recursive: true });

// [file, pages to render]
const DOCS: [string, number[]][] = [
  ["/assets/resources/datasheets/proactive-office-ecosystem-datasheet.pdf", [1, 2]],
  ["/assets/resources/checklists/backup-bcdr-checklist.pdf", [2]],
  ["/assets/resources/reports/cyber-risk-assessment-sample.pdf", [1, 2]],
];
// Fit width in CSS px a PDF viewer gives the page at each viewport, and device pixel ratio.
const VIEWPORTS = [
  { w: 390, fit: 390 - 16, dpr: 3 }, // phone: page fitted to width, small gutter
  { w: 768, fit: 768 - 48, dpr: 2 }, // tablet
  { w: 1440, fit: 816, dpr: 1 }, // desktop at 100% (8.5in at 96 dpi)
];

const b = await chromium.launch({ executablePath: process.env.PDF_CHROMIUM_PATH || undefined });
const page = await b.newPage();
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
await page.addScriptTag({ url: "/vendor/pdfjs/pdf.js" });
const summary: string[] = [];
for (const [file, pages] of DOCS) {
  for (const vp of VIEWPORTS) {
    for (const zoom of [1, 2]) {
      for (const n of pages) {
        const res = await page.evaluate(
          async ({ file, n, fit, dpr, zoom }) => {
            const lib = (window as any).pdfjsLib;
            lib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.js";
            const data = new Uint8Array(await (await fetch(file)).arrayBuffer());
            const doc = await lib.getDocument({ data, isEvalSupported: false }).promise;
            const p = await doc.getPage(n);
            const cssScale = (fit / p.getViewport({ scale: 1 }).width) * zoom;
            const viewport = p.getViewport({ scale: cssScale * dpr });
            const c = document.createElement("canvas");
            c.width = viewport.width;
            c.height = viewport.height;
            await p.render({ canvasContext: c.getContext("2d")!, viewport }).promise;
            return { png: c.toDataURL("image/png"), cssScale };
          },
          { file, n, fit: vp.fit, dpr: vp.dpr, zoom },
        );
        const name = `${file.split("/").pop()!.replace(".pdf", "")}-p${n}-${vp.w}-z${zoom}`;
        writeFileSync(`${OUT}/${name}.png`, Buffer.from(res.png.split(",")[1], "base64"));
        // 1pt = cssScale CSS px. Body text is 9.2pt, the smallest label 7pt.
        if (n === pages[0]) summary.push(`${vp.w}px zoom ${zoom}×: body ${(9.2 * res.cssScale).toFixed(1)} CSS px, smallest label ${(7 * res.cssScale).toFixed(1)} CSS px`);
      }
    }
  }
}
await b.close();
writeFileSync(`${OUT}/sizes.txt`, [...new Set(summary)].join("\n") + "\n");
console.log([...new Set(summary)].join("\n"));
