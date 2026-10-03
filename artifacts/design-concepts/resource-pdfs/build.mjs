// Render the three concept datasheets to tagged PDFs, then set document
// metadata with pikepdf (Chromium writes Title only).
//   node artifacts/design-concepts/resource-pdfs/build.mjs [a|b|c ...]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { documentShell, loadContent, ROOT } from "./lib/base.mjs";

const CONCEPTS = {
  a: "./concepts/a-editorial.mjs",
  b: "./concepts/b-technical.mjs",
  c: "./concepts/c-executive.mjs",
};
const pick = process.argv.slice(2);
const keys = pick.length ? pick : Object.keys(CONCEPTS);
const content = loadContent("proactive-it");
const out = path.join(ROOT, "out");
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PDF_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
try {
  for (const k of keys) {
    const mod = await import(CONCEPTS[k]);
    const { css, body } = mod.render(content);
    const html = documentShell({ c: content, css, body, conceptLabel: mod.label });
    const htmlPath = path.join(out, `concept-${k}.html`);
    writeFileSync(htmlPath, html);
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const pdfPath = path.join(out, `concept-${k}-proactive-it-datasheet.pdf`);
    await page.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
    await page.close();
    execFileSync("python3", [path.join(ROOT, "lib/finalize.py"), pdfPath, JSON.stringify({
      title: `${content.titleFull} Datasheet`,
      subject: content.subtitle,
      keywords: "Digerati Experts, ProActive IT, managed IT, cybersecurity, datasheet",
      lang: content.lang,
    })], { stdio: "inherit" });
    console.log(`concept ${k}: ${pdfPath}`);
  }
} finally {
  await browser.close();
}
