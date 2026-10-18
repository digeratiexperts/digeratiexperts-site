import { createRequire } from "node:module";
const require = createRequire("C:/Users/Joe/DE/Repos/digeratiexperts-site-wt-home-exploration/package.json");
const { chromium } = require("playwright");

const url = process.argv[2] ?? "http://localhost:5180/concepts/home-simple";
const out = "C:/Users/Joe/AppData/Local/Temp/opencode/concept-shots";
const widths = [390, 768, 1440];

const browser = await chromium.launch();
try {
  for (const w of widths) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 }, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e.message)));
    await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/home-simple-${w}.png`, fullPage: true });
    const sections = await page.locator("main > section, main > div > section, main footer").all();
    for (const [i, el] of sections.entries()) {
      await el.screenshot({ path: `${out}/s${String(i).padStart(2, "0")}-${w}.png` }).catch(() => {});
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(JSON.stringify({ width: w, horizontalOverflowPx: overflow, pageErrors: errors.slice(0, 5) }));
    await page.close();
  }
} finally {
  await browser.close();
}
