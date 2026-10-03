// Build DE documents to tagged PDF.
//
//   npx tsx scripts/de-documents/build.mts                 # all documents → scripts/de-documents/out/
//   npx tsx scripts/de-documents/build.mts --publish       # all → client/public/<doc.file> (same public URLs)
//   npx tsx scripts/de-documents/build.mts <slug> [...]    # selected documents
//
// Chromium (Playwright) renders the HTML; a second pass fills report contents
// with real page numbers; lib/finalize.py writes metadata; lib/verify.py gates.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { DOCUMENTS } from "./content/index.mts";
import { type Doc, renderDoc, type TocEntry, tocEntries } from "./system/families.mts";
import { REPO_ROOT, SYSTEM_ROOT } from "./system/paths.mts";
import { stylesheet } from "./system/styles.mts";

const args = process.argv.slice(2);
const publish = args.includes("--publish");
const only = args.filter((a) => !a.startsWith("--"));
const docs = only.length ? DOCUMENTS.filter((d) => only.includes(d.slug)) : DOCUMENTS;
if (only.length && docs.length !== only.length) throw new Error(`Unknown slug in: ${only.join(", ")}`);

const outDir = path.join(SYSTEM_ROOT, "out");
const workDir = path.join(outDir, "html");
mkdirSync(workDir, { recursive: true });

function html(doc: Doc, toc: TocEntry[], total?: number) {
  const famLabel = doc.family[0].toUpperCase() + doc.family.slice(1);
  const css = stylesheet({
    left: `${famLabel} · ${doc.h1}`,
    right: `${doc.docId} · Edition ${doc.edition}`,
    stamp: doc.example ? "Example · not client data" : undefined,
  });
  return `<!doctype html><html lang="en-US"><head><meta charset="utf-8">
<title>${doc.title.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</title><meta name="author" content="Digerati Experts">
<style>${css}</style></head><body>
${renderDoc(doc, toc, total)}
</body></html>`;
}

function pageCount(pdfPath: string): number {
  const info = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
  return Number(/Pages:\s+(\d+)/.exec(info)?.[1] ?? 0);
}

/** Map heading ids to 1-based page numbers from the PDF's named destinations. */
function destPages(pdfPath: string): Record<string, number> {
  const out = execFileSync("python3", [path.join(SYSTEM_ROOT, "lib/dests.py"), pdfPath], { encoding: "utf8" });
  return JSON.parse(out);
}

const browser = await chromium.launch({
  executablePath: process.env.PDF_CHROMIUM_PATH || undefined,
});
const results: string[] = [];
try {
  for (const doc of docs) {
    const target = publish ? path.join(REPO_ROOT, "client/public", doc.file) : path.join(outDir, path.basename(doc.file));
    mkdirSync(path.dirname(target), { recursive: true });
    const render = async (toc: TocEntry[], total?: number) => {
      const htmlPath = path.join(workDir, `${doc.slug}.html`);
      writeFileSync(htmlPath, html(doc, toc, total));
      const page = await browser.newPage();
      await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.pdf({ path: target, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
      await page.close();
    };
    let toc = tocEntries(doc);
    await render(toc);
    if (doc.brief) {
      // Second pass: real page numbers in the contents and "Page 1 of N" on the summary page.
      const pages = destPages(target);
      toc = toc.map((e) => ({ ...e, page: pages[e.id] }));
      await render(toc, pageCount(target));
    }
    execFileSync("python3", [path.join(SYSTEM_ROOT, "lib/finalize.py"), target, JSON.stringify({
      title: doc.title,
      subject: doc.subtitle.replace(/\*\*/g, ""),
      keywords: doc.keywords,
      lang: "en-US",
    })]);
    results.push(target);
    console.log(`built ${path.relative(REPO_ROOT, target)}`);
  }
} finally {
  await browser.close();
}
execFileSync("python3", [path.join(SYSTEM_ROOT, "lib/verify.py"), ...results], { stdio: "inherit" });
