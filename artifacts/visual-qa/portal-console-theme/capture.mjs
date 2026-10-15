// Captures the real Client Portal in the "Admin console" theme (and graphite dark for
// comparison) at 390 / 768 / 1440 against a local dev server with the dev admin.
// Usage: node artifacts/visual-qa/portal-console-theme/capture.mjs <baseUrl> <password>
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import path from "node:path";

const [base = "http://127.0.0.1:5055", password] = process.argv.slice(2);
const out = path.dirname(new URL(import.meta.url).pathname);
const axe = readFileSync(path.resolve("node_modules/axe-core/axe.min.js"), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext({ reducedMotion: "reduce" });
const page = await ctx.newPage();
const login = await page.request.post(`${base}/api/portal/login`, { data: { email: "admin@digeratiexperts.com", password } });
if (!login.ok()) throw new Error(`login ${login.status()} ${await login.text()}`);

const results = [];
for (const theme of ["console", "black"]) {
  for (const route of ["dashboard", "tickets"]) {
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
      await page.goto(`${base}/portal/${route}`);
      await page.evaluate((t) => localStorage.setItem("de-portal-theme", t), theme);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForSelector(`.de-portal[data-theme="${theme}"] main, .de-portal[data-theme="${theme}"] h1`, { timeout: 20000 });
      await page.waitForTimeout(600);
      const url = new URL(page.url());
      if (url.hostname !== "127.0.0.1" || !url.pathname.startsWith(`/portal/${route}`)) throw new Error(`unexpected ${page.url()}`);
      const facts = await page.evaluate(() => ({
        field: getComputedStyle(document.querySelector(".de-portal")).backgroundColor,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      }));
      await page.addScriptTag({ content: axe });
      const axeRes = await page.evaluate(async () => {
        const r = await window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] });
        return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
      });
      const file = `${theme}-${route}-${width}.png`;
      await page.screenshot({ path: path.join(out, file), fullPage: true });
      results.push({ file, ...facts, axe: axeRes });
      console.log(file, JSON.stringify(facts), axeRes.join(" ") || "axe clean");
    }
  }
}
// The Appearance menu open, console theme, desktop.
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => localStorage.setItem("de-portal-theme", "console"));
await page.goto(`${base}/portal/dashboard`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /administrator|account|user/i }).first().click().catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(out, "console-menu-1440.png") });
await browser.close();
