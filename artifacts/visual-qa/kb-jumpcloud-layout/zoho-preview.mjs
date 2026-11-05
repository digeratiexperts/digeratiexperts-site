// Previews zoho/help-center/stylesheet.css on the live help center without publishing:
// the page loads from help.digerati-experts.com, and the theme stylesheet request is
// answered with the local file (zoho/help-center/README.md, "Testing a change").
// Read-only: nothing is submitted to Zoho.
// Usage: node artifacts/visual-qa/kb-jumpcloud-layout/zoho-preview.mjs [articleUrl]
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";

const url = process.argv[2] || "https://help.digerati-experts.com/portal/en/kb/articles/how-to-enroll-your-mobile-device";
const out = path.join(path.dirname(new URL(import.meta.url).pathname), "zoho");
const css = readFileSync(path.resolve("zoho/help-center/stylesheet.css"), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium" });

for (const width of [390, 1100, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.route(/\/hccustomize\/.*\/stylesheet\.css/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: css }));
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("#articleContent", { timeout: 30000 });
  await page.waitForTimeout(4000);
  const facts = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect();
    const box = (s) => (r(s) ? `${Math.round(r(s).x)}+${Math.round(r(s).width)}` : "missing");
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      nav: box(".Layout__layout2"),
      body: box("#articleContent"),
      toc: box(".TOCContainer__tocContainer"),
    };
  });
  console.log(width, JSON.stringify(facts));
  await page.screenshot({ path: path.join(out, `zoho-article-${width}.png`) });
  // Scrolled: the side list and "On this page" should stay in view.
  // Zoho scrolls an inner container, not the window.
  await page.evaluate(() => {
    const scroller = [...document.querySelectorAll("body *")].find((e) => e.scrollHeight > e.clientHeight + 50 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    if (scroller) scroller.scrollTop = 1600;
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, `zoho-article-${width}-scrolled.png`) });
  await page.close();
}
await browser.close();
