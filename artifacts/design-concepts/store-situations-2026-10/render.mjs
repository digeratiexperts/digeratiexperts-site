// Screenshots each option at 1440 and 390; reports horizontal overflow.
import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const url = pathToFileURL(path.join(here, "situations.html")).href;
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
for (const w of [1440, 390]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: w === 390 ? 2 : 1 });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(w, "overflow px:", over);
  for (const k of "ABCDEF") {
    await page.locator(`#opt-${k}`).screenshot({ path: path.join(here, "renders", `${k}-${w}.png`) });
  }
  await page.close();
}
await browser.close();
