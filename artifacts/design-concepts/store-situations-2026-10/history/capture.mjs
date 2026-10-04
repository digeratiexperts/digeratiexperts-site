// Renders each archived Store version
// as a numbered, dated panel (top 2600px of the full-page capture) for Joe to point at.
import { chromium } from "playwright-core";
import path from "node:path";
import { pathToFileURL } from "node:url";
const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "../../../..");
const qa = (p) => path.join(root, "artifacts/visual-qa", p);
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });

const versions = [
  ["1", "Aug 30", "The old Store (before the Door 2 rebuild)", qa("polish-sweep/store-1440-full.png")],
  ["2", "Sep 27", "Baseline before the redesign", qa("store-experience/baseline/01-index-1440.png")],
  ["3", "Sep 29", "Redesign, nothing added yet (approved round)", qa("store-experience/redesign/01-index-empty-1440.png")],
  ["4", "Sep 29", "Redesign, after a situation is picked", qa("store-experience/redesign/02-index-scenario-1440.png")],
  ["5", "Oct 1", "Stations: a numbered station per step", qa("store-stations/after-index-1440.png")],
  ["6", "Oct 3", "Today (option A, a copy of the live situation cards)", path.join(here, "../renders/A-1440.png")],
];
const page = await browser.newPage({ viewport: { width: 1520, height: 900 } });
for (const [n, date, name, file] of versions) {
  const html = `<!doctype html><html><body style="margin:0;background:#111;font:600 28px system-ui;color:#fff">
  <div style="padding:20px 40px;display:flex;gap:18px;align-items:center"><span style="background:#D3126A;border-radius:8px;padding:4px 14px">${n}</span>
  <span>${date} · ${name}</span></div>
  <div style="margin:0 40px 40px;height:2600px;overflow:hidden;border:1px solid #333"><img src="${pathToFileURL(file).href}" style="width:1440px;display:block"></div></body></html>`;
  const tmp = path.join(here, "_panel.html");
  (await import("node:fs")).writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: "load" });
  await page.screenshot({ path: path.join(here, `${n}-${date.replace(" ", "").toLowerCase()}.png`), fullPage: true });
}
(await import("node:fs")).rmSync(path.join(here, "_panel.html"), { force: true });
await browser.close();
