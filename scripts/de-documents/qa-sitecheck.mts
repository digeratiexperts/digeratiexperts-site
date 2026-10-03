// In-site QA: for each sample resource page at 390 / 768 / 1440, confirm the
// download link is visible and serves the PDF, then render page 1 with the
// site's own pdf.js (a second PDF engine) at that viewport width.
//   DE_SITE=http://localhost:5000 npx tsx scripts/de-documents/qa-sitecheck.mts <out-dir>
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";
const S = process.argv[2] ?? "scripts/de-documents/out/qa";
const base = process.env.DE_SITE ?? "http://localhost:5000";
mkdirSync(`${S}/site`, { recursive: true });
const pages = [
  ["/resources/reports/cyber-risk-assessment-sample", "/assets/resources/reports/cyber-risk-assessment-sample.pdf"],
  ["/resources/checklists/backup-bcdr-checklist", "/assets/resources/checklists/backup-bcdr-checklist.pdf"],
  ["/resources/datasheets/proactive-it-ecosystem-datasheet", "/assets/resources/datasheets/proactive-it-ecosystem-datasheet.pdf"],
];
const vps = [{ w: 390, h: 844, dpr: 2, mobile: true }, { w: 768, h: 1024, dpr: 2, mobile: true }, { w: 1440, h: 900, dpr: 1, mobile: false }];
const b = await chromium.launch({ executablePath: process.env.PDF_CHROMIUM_PATH || undefined });
for (const vp of vps) {
  const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.dpr, isMobile: vp.mobile, hasTouch: vp.mobile });
  for (const [route, file] of pages) {
    const p = await ctx.newPage();
    await p.goto(base + route, { waitUntil: "networkidle" });
    const link = p.locator(`a[href="${file}"]`).first();
    const count = await p.locator(`a[href="${file}"]`).count();
    let shot = "";
    if (count) {
      await link.scrollIntoViewIfNeeded();
      const box = await link.boundingBox();
      shot = `${S}/site/${vp.w}-${route.split("/").pop()}.png`;
      await p.screenshot({ path: shot });
      const [resp] = await Promise.all([ctx.request.get(base + file)]);
      console.log(`${vp.w} ${route}: link visible=${await link.isVisible()} size=${Math.round(box!.width)}x${Math.round(box!.height)} → ${resp.status()} ${resp.headers()["content-type"]} ${(await resp.body()).length}B`);
    } else console.log(`${vp.w} ${route}: NO LINK to ${file}`);
    // Render the PDF with the site's own pdf.js at this viewport width.
    const v = await ctx.newPage();
    await v.goto(base + "/", { waitUntil: "domcontentloaded" });
    const out = await v.evaluate(async ({ file, w, dpr }) => {
      await new Promise<void>((res, rej) => { const s = document.createElement("script"); s.src = "/vendor/pdfjs/pdf.js"; s.onload = () => res(); s.onerror = () => rej(new Error("pdfjs")); document.head.appendChild(s); });
      const lib = (window as any).pdfjsLib; lib.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.js";
      const data = new Uint8Array(await (await fetch(file)).arrayBuffer());
      const doc = await lib.getDocument({ data, isEvalSupported: false }).promise;
      const page = await doc.getPage(1);
      const vp1 = page.getViewport({ scale: 1 });
      const scale = (w / vp1.width) * dpr;
      const viewport = page.getViewport({ scale });
      const c = document.createElement("canvas"); c.width = viewport.width; c.height = viewport.height;
      await page.render({ canvasContext: c.getContext("2d")!, viewport }).promise;
      const text = (await page.getTextContent()).items.map((i: any) => i.str).join(" ");
      const meta = await doc.getMetadata();
      return { png: c.toDataURL("image/png"), pages: doc.numPages, words: text.split(/\s+/).length, title: meta.info.Title, lang: meta.info.Language };
    }, { file, w: vp.w, dpr: vp.dpr });
    const fs = await import("node:fs");
    fs.writeFileSync(`${S}/site/pdfjs-${vp.w}-${route.split("/").pop()}.png`, Buffer.from(out.png.split(",")[1], "base64"));
    console.log(`   pdf.js: ${out.pages} pages, ${out.words} words on p1, title "${out.title}"`);
    await p.close(); await v.close();
  }
  await ctx.close();
}
await b.close();
