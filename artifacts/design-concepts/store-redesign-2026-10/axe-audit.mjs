import { chromium } from "/home/user/digeratiexperts-site/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
const axe = fs.readFileSync(process.env.AXE_PATH || new URL("./node_modules/axe-core/axe.min.js", import.meta.url), "utf8");
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(process.argv[2], { waitUntil: "networkidle" });
  await p.evaluate(() => document.querySelectorAll(".rv").forEach(e => e.classList.add("in")));
  await p.waitForTimeout(1200);
  await p.addScriptTag({ content: axe });
  const r = await p.evaluate(() => axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }));
  console.log(`--- ${w}: ${r.violations.length} violations`);
  for (const v of r.violations) console.log(v.impact, v.id, v.nodes.length, "|", v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" ; "));
  await p.close();
}
await b.close();
