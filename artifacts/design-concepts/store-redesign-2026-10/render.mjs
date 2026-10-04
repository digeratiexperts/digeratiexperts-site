// Full-page renders of each concept at 1440 / 768 / 390 from localhost; reports overflow.
import { chromium } from "playwright-core";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const base = process.argv[2] || "http://localhost:3000/artifacts/design-concepts/store-redesign-2026-10";
const files = process.argv.slice(3).length ? process.argv.slice(3) : ["1-storefront", "2-marketplace", "3-graphite"];
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const f of files) for (const w of [1440, 768, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: w === 390 ? 2 : 1 });
  const errs = []; p.on("pageerror", e => errs.push(e.message)); p.on("requestfailed", r => errs.push("fail " + r.url()));
  await p.goto(`${base}/${f}.html`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const over = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  await p.screenshot({ path: path.join(here, "renders", `${f}-${w}.png`), fullPage: true });
  console.log(f, w, "overflow", over, errs.join(" | "));
  await p.close();
}
await b.close();
